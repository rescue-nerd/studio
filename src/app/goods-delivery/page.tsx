"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Ensure Select components are imported
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context"; // Import useAuth
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/supabase-db";
import { handleSupabaseError, logError } from "@/lib/supabase-error-handler";
import { cn } from "@/lib/utils";
// Canonical Types
import type {
  Bilti as CanonicalBilti,
  Branch as CanonicalBranch,
  GoodsDelivery as CanonicalGoodsDelivery,
  Party as CanonicalParty
} from "@/types/database";
import { format, parseISO } from "date-fns"; // Added parseISO
import { CalendarIcon, Edit, Loader2, PackageOpen, PlusCircle, Search, Trash2 } from "lucide-react"; // Added icons
import { useRouter } from "next/navigation"; // Import useRouter
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";


// Use canonical types
type GoodsDelivery = CanonicalGoodsDelivery & { nepaliMiti?: string }; // Add nepaliMiti for UI if needed
type Bilti = CanonicalBilti;
type Party = CanonicalParty;
type Branch = CanonicalBranch;


// Form data type, derived from CanonicalGoodsDelivery
type GoodsDeliveryFormData = Omit<CanonicalGoodsDelivery, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber' | 'branchId'> & {
  nepaliMiti?: string; // For UI consistency
  // Rebate/discount fields are not in canonical GoodsDelivery, removed for now.
  // These might be handled via ledger adjustments or a separate related table.
};


const defaultGoodsDeliveryFormData: GoodsDeliveryFormData = {
  date: new Date().toISOString(),
  biltiId: "",
  deliveredTo: "", // This field is on CanonicalGoodsDelivery
  remarks: "",
  nepaliMiti: "",
  // branchId will be set from authUser or a selector
};


// Supabase function names (if any specific ones are used for GoodsDelivery)
// For now, assuming direct DB operations via db wrapper or generic functions.
// const createGoodsDeliveryFn = ...
// const updateGoodsDeliveryFn = ...
// const deleteGoodsDeliveryFn = ...


export default function GoodsDeliveryPage() {
  const [goodsDeliveries, setGoodsDeliveries] = useState<GoodsDelivery[]>([]);
  const [biltisForSelection, setBiltisForSelection] = useState<Bilti[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]); 

  const { toast } = useToast();
  const { user: authUser, profile, loading: authLoading } = useAuth(); 
  const router = useRouter(); 

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<GoodsDelivery | null>(null);
  
  const [formData, setFormData] = useState<GoodsDeliveryFormData>(defaultGoodsDeliveryFormData);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(""); 

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deliveryToDelete, setDeliveryToDelete] = useState<GoodsDelivery | null>(null);
  
  // Removed: const [isBiltiSelectDialogOpen, setIsBiltiSelectDialogOpen] = useState(false);
  const [selectedBiltiForForm, setSelectedBiltiForForm] = useState<Bilti | null>(null);


  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    } else if (profile && !selectedBranchId) { // Use profile
      const userBranch = profile.assignedBranchIds?.[0]; // Use profile
      if (userBranch) {
        setSelectedBranchId(userBranch);
      } else if (branches.length > 0) {
        setSelectedBranchId(branches[0].id);
      }
    }
  }, [authUser, profile, authLoading, router, branches, selectedBranchId]); // Added profile


  const fetchMasterData = async () => {
    if (!profile) return; // Use profile
    try {
      const [biltisData, partiesData, branchesData] = await Promise.all([
        db.query<Bilti>('biltis', { filters: { status: 'manifested' } , orderBy: { column: 'documentNumber'} } ), // Fetch biltis ready for delivery (e.g., status 'manifested' or 'received')
        db.query<Party>('parties', { orderBy: { column: 'name' } }),
        db.query<Branch>('branches', { orderBy: { column: 'name' } }),
      ]);

      setBiltisForSelection(biltisData);
      setParties(partiesData);
      setBranches(branchesData);

      // Set default selected branch if not already set by user context
      if (!selectedBranchId && branchesData.length > 0) {
        const userBranch = profile.assignedBranchIds?.[0]; // Use profile
        if (userBranch && branchesData.some(b => b.id === userBranch)) {
            setSelectedBranchId(userBranch);
        } else {
            setSelectedBranchId(branchesData[0].id);
        }
      }

    } catch (error) {
      logError(error, "Error fetching master data for goods delivery");
      handleSupabaseError(error, toast);
    }
  };

  const fetchGoodsDeliveries = async () => {
    if (!authUser || !selectedBranchId) return; // Ensure branch is selected
    setIsLoading(true);
    try {
      const fetchedDeliveries = await db.query<GoodsDelivery>('goods_deliveries', { 
        filters: { branchId: selectedBranchId },
        orderBy: { column: 'date', ascending: false } 
      });
      setGoodsDeliveries(fetchedDeliveries.map(d => ({...d, date: d.date || new Date().toISOString() })));
    } catch (error) {
      logError(error, "Error fetching goods deliveries");
      handleSupabaseError(error, toast);
      setGoodsDeliveries([]); // Clear on error
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData(); // Fetches branches, parties, and initial biltis
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]); // Re-fetch if authUser changes (e.g. login/logout)

 useEffect(() => {
    if (selectedBranchId) {
        fetchGoodsDeliveries(); // Fetch deliveries when branch changes
        // Optionally, re-filter biltis for selection based on the new branch
        // This depends on whether biltis are branch-specific for delivery purposes
        // For now, assuming biltisForSelection is already broadly filtered by status
    } else {
        setGoodsDeliveries([]); // Clear deliveries if no branch selected
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);


  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => ({ ...prev, date: date.toISOString() }));
    }
  };
  
  const handleBiltiSelectForDelivery = (biltiId: string) => { // Changed to accept biltiId directly
    const bilti = biltisForSelection.find(b => b.id === biltiId);
    if (bilti) {
        setFormData(prev => ({ ...prev, biltiId: bilti.id }));
        setSelectedBiltiForForm(bilti); 
    } else {
        setFormData(prev => ({ ...prev, biltiId: "" }));
        setSelectedBiltiForForm(null);
    }
    // Removed: setIsBiltiSelectDialogOpen(false);
  };


  const openAddForm = () => {
    setEditingDelivery(null);
    setSelectedBiltiForForm(null);
    setFormData({
        ...defaultGoodsDeliveryFormData,
        date: new Date().toISOString(),
        // branchId is handled by selectedBranchId state
    });
    // Filter biltis for selection based on current selectedBranchId and appropriate status
    // This might require re-fetching or filtering `biltisForSelection` if they are branch-dependent
    // For now, assume `biltisForSelection` is up-to-date or broadly filtered.
    setIsFormDialogOpen(true);
  };

  const openEditForm = (delivery: GoodsDelivery) => {
    setEditingDelivery(delivery);
    const { id, documentNumber, createdAt, updatedAt, branchId, ...editableData } = delivery;
    
    const biltiForThisDelivery = biltisForSelection.find(b => b.id === delivery.biltiId);
    setSelectedBiltiForForm(biltiForThisDelivery || null);

    setFormData({
        ...editableData,
        nepaliMiti: delivery.nepaliMiti || "",
        date: delivery.date || new Date().toISOString(),
    });
    // Ensure biltisForSelection includes the bilti being edited, even if its status changed
    // This might involve temporarily adding it to the list if it's not there
    if (biltiForThisDelivery && !biltisForSelection.some(b => b.id === delivery.biltiId)) {
        setBiltisForSelection(prev => [biltiForThisDelivery, ...prev]);
    }
    setIsFormDialogOpen(true);
  };
  
  const getPartyName = (partyId?: string) => parties.find(p => p.id === partyId)?.name || "N/A";
  const getBiltiDocumentNumber = (biltiId?: string) => biltisForSelection.find(b => b.id === biltiId)?.documentNumber || "N/A";
  const getBranchName = (branchId?: string) => branches.find(b => b.id === branchId)?.name || "N/A"; // Added getBranchName


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedBranchId) { // Use profile
        toast({ title: "Error", description: "User or Branch not identified.", variant: "destructive" });
        return;
    }
    if (!formData.biltiId) { 
        toast({ title: "No Bilti Selected", description: "Please select a Bilti for delivery.", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);

    const payload: Omit<CanonicalGoodsDelivery, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber'> = {
      branchId: selectedBranchId,
      date: formData.date,
      biltiId: formData.biltiId,
      deliveredTo: formData.deliveredTo,
      remarks: formData.remarks,
      // nepaliMiti is not part of canonical, but if your backend handles it, include it.
      // For now, assuming it's UI only or handled by a trigger/function if `date` is primary.
    };
    
    // If your DB schema includes nepaliMiti and you want to save it:
    // (payload as any).nepaliMiti = formData.nepaliMiti;


    try {
      if (editingDelivery) {
        // Update existing delivery
        const updatedDelivery = await db.update<GoodsDelivery>('goods_deliveries', editingDelivery.id, payload);
        toast({ title: "Goods Delivery Updated", description: `Delivery note ${updatedDelivery.documentNumber} has been updated.` });
      } else {
        // Create new delivery
        // The 'documentNumber' is expected to be auto-generated by the database (e.g., via a trigger or default value)
        const newDelivery = await db.create<GoodsDelivery>('goods_deliveries', payload);
        toast({ title: "Goods Delivery Recorded", description: `Delivery note ${newDelivery.documentNumber} has been recorded.` });
      }
      fetchGoodsDeliveries(); // Refresh list
      fetchMasterData(); // Refresh biltis list for selection (e.g. status update)
      setIsFormDialogOpen(false);
      setEditingDelivery(null);
      setSelectedBiltiForForm(null);
    } catch (error) {
      logError(error, `Error with goods delivery ${editingDelivery ? 'update' : 'create'} operation`);
      handleSupabaseError(error, toast); // Corrected call
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (delivery: GoodsDelivery) => {
    setDeliveryToDelete(delivery);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (deliveryToDelete) {
      setIsSubmitting(true);
      try {
        await db.delete('goods_deliveries', deliveryToDelete.id);
        toast({ title: "Goods Delivery Deleted", description: `Delivery note ${deliveryToDelete.documentNumber} has been deleted.` });
        fetchGoodsDeliveries();
        fetchMasterData(); // Refresh biltis (status might change)
      } catch (error) {
        logError(error, "Error deleting goods delivery");
        handleSupabaseError(error, toast); // Corrected call
      } finally {
        setIsSubmitting(false);
        setIsDeleteDialogOpen(false);
        setDeliveryToDelete(null);
      }
    }
  };

  const filteredDeliveries = goodsDeliveries.filter(delivery => {
    const searchTermLower = searchTerm.toLowerCase();
    const bilti = biltisForSelection.find(b => b.id === delivery.biltiId);
    return (
        (delivery.documentNumber && delivery.documentNumber.toLowerCase().includes(searchTermLower)) ||
        (bilti && bilti.documentNumber.toLowerCase().includes(searchTermLower)) ||
        (delivery.nepaliMiti && delivery.nepaliMiti.toLowerCase().includes(searchTermLower)) ||
        delivery.deliveredTo.toLowerCase().includes(searchTermLower)
    );
  });
  
  // UI Rendering (major changes needed here due to single bilti per delivery)
  // The form will simplify significantly. The table display will also change.

  if (authLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Authenticating...</p></div>;
  }
  
  return (
    <div className="space-y-6">
      {/* Removed SmartBiltiMultiSelectDialog */}

      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground flex items-center"><PackageOpen className="mr-3 h-8 w-8 text-primary"/>Goods Delivery</h1>
          <p className="text-muted-foreground ml-11">Mark goods as delivered from a selected branch.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
            <div className="w-full md:w-64">
                <Label htmlFor="branchSelect">Operating Branch</Label>
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId} disabled={branches.length === 0 || isLoading}>
                    <SelectTrigger id="branchSelect">
                        <SelectValue placeholder="Select Branch..." />
                    </SelectTrigger>
                    <SelectContent>
                        {branches.map(branch => (
                            <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => {
                setIsFormDialogOpen(isOpen);
                if (!isOpen) {setEditingDelivery(null); setSelectedBiltiForForm(null);}
            }}>
            <DialogTrigger asChild>
                <Button onClick={openAddForm} disabled={isSubmitting || isLoading || !selectedBranchId || biltisForSelection.filter(b => b.branchId === selectedBranchId && b.status === 'manifested').length === 0}>
                <PlusCircle className="mr-2 h-4 w-4" /> New Goods Delivery
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl max-h-[90vh]"> {/* Simplified form, less width needed */}
                <DialogHeader>
                <DialogTitle>{editingDelivery ? "Edit Goods Delivery" : "Record New Goods Delivery"}</DialogTitle>
                <DialogDescription>
                    Select a Bilti and record its delivery details.
                </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                <ScrollArea className="flex-grow pr-1">
                    <div className="grid gap-4 py-4 ">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="deliveryNoteNo" className="text-right md:col-span-1 col-span-4">Delivery No.</Label>
                        <Input id="deliveryNoteNo" value={editingDelivery ? editingDelivery.documentNumber : "Auto-Generated"} readOnly className="bg-muted md:col-span-3 col-span-4" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="date" className="text-right md:col-span-1 col-span-4">Date (AD)</Label>
                        <Popover>
                        <PopoverTrigger asChild className="md:col-span-3 col-span-4">
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !formData.date && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.date ? format(parseISO(formData.date), "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.date ? parseISO(formData.date) : undefined} onSelect={handleDateChange} initialFocus /></PopoverContent>
                        </Popover>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="nepaliMiti" className="text-right md:col-span-1 col-span-4">Nepali Miti</Label>
                        <Input id="nepaliMiti" name="nepaliMiti" value={formData.nepaliMiti || ""} onChange={handleInputChange} className="md:col-span-3 col-span-4" placeholder="YYYY-MM-DD" />
                    </div>
                    
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="biltiSelection" className="text-right md:col-span-1 col-span-4">Select Bilti</Label>
                        <Select 
                            value={formData.biltiId} 
                            onValueChange={handleBiltiSelectForDelivery}
                            disabled={isLoading || biltisForSelection.filter(b => b.branchId === selectedBranchId && b.status === 'manifested').length === 0}
                        >
                            <SelectTrigger className="md:col-span-3 col-span-4">
                                <SelectValue placeholder={isLoading ? "Loading Biltis..." : (biltisForSelection.filter(b => b.branchId === selectedBranchId && b.status === 'manifested').length === 0 ? "No Biltis available" : "Select a Bilti...")} />
                            </SelectTrigger>
                            <SelectContent>
                                {biltisForSelection
                                    .filter(b => b.branchId === selectedBranchId && b.status === 'manifested')
                                    .map(bilti => (
                                        <SelectItem key={bilti.id} value={bilti.id}>
                                            {`Bilti: ${bilti.documentNumber} (Consignee: ${getPartyName(bilti.consigneeId)})`}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Removed section for multiple biltis and their rebate/discount inputs */}
                    {/* The canonical GoodsDelivery links to a single biltiId and has no direct rebate/discount fields */}

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="deliveredTo" className="text-right md:col-span-1 col-span-4">Delivered To</Label>
                        <Input id="deliveredTo" name="deliveredTo" value={formData.deliveredTo || ""} onChange={handleInputChange} className="md:col-span-3 col-span-4" placeholder="Name of person receiving" required />
                    </div>
                    <div className="grid grid-cols-4 items-start gap-4 mt-2">
                        <Label htmlFor="remarks" className="text-right pt-2 md:col-span-1 col-span-4">Remarks</Label>
                        <Textarea id="remarks" name="remarks" value={formData.remarks || ""} onChange={handleInputChange} placeholder="Delivery remarks..." className="md:col-span-3 col-span-4" rows={3}/>
                    </div>
                    </div>
                </ScrollArea>
                <DialogFooter className="pt-4 border-t mt-auto">
                    <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting || isLoading || !formData.biltiId}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editingDelivery ? "Update Delivery" : "Save Delivery"}
                    </Button>
                </DialogFooter>
                </form>
            </DialogContent>
            </Dialog>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Goods Delivery List ({getBranchName(selectedBranchId)})</CardTitle>
          <CardDescription>View all recorded goods deliveries for the selected branch.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by Delivery No, Bilti No, Nepali Miti, Delivered To..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
         {isLoading && goodsDeliveries.length === 0 && selectedBranchId ? (
            <div className="flex justify-center items-center h-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading deliveries for {getBranchName(selectedBranchId)}...</p></div>
          ) : !selectedBranchId ? (
            <div className="flex justify-center items-center h-24 text-muted-foreground">Please select a branch to view deliveries.</div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Delivery No.</TableHead>
                <TableHead>Date (AD)</TableHead>
                <TableHead>Nepali Miti</TableHead>
                <TableHead>Bilti No.</TableHead>
                <TableHead>Delivered To</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeliveries.length === 0 && !isLoading && selectedBranchId && <TableRow><TableCell colSpan={6} className="text-center h-24">No goods deliveries found for {getBranchName(selectedBranchId)}.</TableCell></TableRow>}
              {filteredDeliveries.map((delivery) => {
                const biltiDetails = biltisForSelection.find(b => b.id === delivery.biltiId);
                return (
                <TableRow key={delivery.id}>
                  <TableCell className="font-medium">{delivery.documentNumber}</TableCell>
                  <TableCell>{format(parseISO(delivery.date), "PP")}</TableCell>
                  <TableCell>{delivery.nepaliMiti || "N/A"}</TableCell>
                  <TableCell>{biltiDetails?.documentNumber || delivery.biltiId}</TableCell>
                  <TableCell>{delivery.deliveredTo}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="icon" aria-label="Edit Delivery" onClick={() => openEditForm(delivery)} disabled={isSubmitting}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog open={isDeleteDialogOpen && deliveryToDelete?.id === delivery.id} onOpenChange={(open) => { if(!open) setDeliveryToDelete(null); setIsDeleteDialogOpen(open);}}>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="icon" aria-label="Delete Delivery" onClick={() => handleDeleteClick(delivery)} disabled={isSubmitting}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete Delivery Note "{deliveryToDelete?.documentNumber}". Associated Bilti status might need manual adjustment or be handled by backend logic.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {setDeliveryToDelete(null); setIsDeleteDialogOpen(false);}} disabled={isSubmitting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                               {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
          )}
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">
                Goods Delivery records are per Bilti. Ensure Bilti statuses are updated accordingly (e.g., to 'delivered').
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}