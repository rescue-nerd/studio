"use client";

import SmartBranchSelectDialog from "@/components/shared/smart-branch-select-dialog";
import SmartManifestSelectDialog from "@/components/shared/smart-manifest-select-dialog";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/supabase-db";
import { cn } from "@/lib/utils";
import type {
  CloudFunctionResponse,
  Branch as FirestoreBranch,
  GoodsReceipt as FirestoreGoodsReceipt,
  Manifest as FirestoreManifest,
  GoodsReceiptCreateRequest,
  GoodsReceiptDeleteRequest,
  GoodsReceiptUpdateRequest
} from "@/types/firestore";
import { format } from "date-fns";
import { ArchiveRestore, CalendarIcon, Edit, Loader2, PlusCircle, Search, Trash2 } from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

// Local Interfaces
interface GoodsReceipt extends Omit<FirestoreGoodsReceipt, 'miti' | 'createdAt' | 'updatedAt'> {
  id: string;
  miti: Date;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}
interface Manifest extends Omit<FirestoreManifest, 'miti' | 'createdAt' | 'updatedAt'> {
  id: string;
  miti: Date;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}
interface Branch extends FirestoreBranch {}
// interface Godown extends FirestoreGodown {} // If needed for receivingGodownId

const defaultGoodsReceiptFormData: Omit<GoodsReceipt, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'nepaliMiti' | 'shortages' | 'damages' | 'receivingGodownId'> = {
  miti: new Date(),
  manifestId: "",
  receivingBranchId: "", 
  remarks: "",
};

const PLACEHOLDER_USER_ID = "system_user_placeholder";

const createGoodsReceiptFn = async (data: GoodsReceiptCreateRequest) => {
  const response = await supabase.functions.invoke('create-goods-receipt', {
    body: data
  });
  return response.data as CloudFunctionResponse;
};

const updateGoodsReceiptFn = async (data: GoodsReceiptUpdateRequest) => {
  const response = await supabase.functions.invoke('update-goods-receipt', {
    body: data
  });
  return response.data as CloudFunctionResponse;
};

const deleteGoodsReceiptFn = async (data: GoodsReceiptDeleteRequest) => {
  const response = await supabase.functions.invoke('delete-goods-receipt', {
    body: data
  });
  return response.data as CloudFunctionResponse;
};

export default function GoodsReceiptPage() {
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [manifestsForSelection, setManifestsForSelection] = useState<Manifest[]>([]);
  const [allManifestsMaster, setAllManifestsMaster] = useState<Manifest[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  // const [godowns, setGodowns] = useState<Godown[]>([]); // For future use

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<GoodsReceipt | null>(null);
  const [formData, setFormData] = useState<Omit<GoodsReceipt, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'shortages' | 'damages' | 'receivingGodownId'>>(defaultGoodsReceiptFormData);
  
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<GoodsReceipt | null>(null);

  const [isManifestSelectOpen, setIsManifestSelectOpen] = useState(false);
  const [isBranchSelectOpen, setIsBranchSelectOpen] = useState(false);

  const [selectedManifestInForm, setSelectedManifestInForm] = useState<Manifest | null>(null);
  const [selectedReceivingBranchInForm, setSelectedReceivingBranchInForm] = useState<Branch | null>(null);

  const fetchMasterData = async () => {
    try {
      const [manifests, branches] = await Promise.all([
        db.query<Manifest>('manifests', {
          select: '*',
          orderBy: { column: 'createdAt', ascending: false }
        }),
        db.query<Branch>('branches', {
          select: '*',
          orderBy: { column: 'name', ascending: true }
        })
      ]);

      setAllManifestsMaster(manifests);
      setManifestsForSelection(manifests.filter(m => m.status === "In Transit"));
      setBranches(branches);
    } catch (error) {
      console.error("Error fetching master data for goods receipt:", error);
      toast({ title: "Error", description: "Failed to fetch master data.", variant: "destructive" });
    }
  };

  const fetchGoodsReceipts = async () => {
    try {
      const { data, error } = await supabase
        .from('goods_receipts')
        .select('*')
        .order('miti', { ascending: false });
      
      if (error) throw error;
      setGoodsReceipts(data || []);
    } catch (error) {
      console.error("Error fetching goods receipts: ", error);
      toast({ title: "Error", description: handleSupabaseError(error), variant: "destructive" });
    }
  };

  const fetchManifests = async () => {
    try {
      const { data, error } = await supabase
        .from('manifests')
        .select('*')
        .order('miti', { ascending: false });
      
      if (error) throw error;
      setManifests(data || []);
    } catch (error) {
      console.error("Error fetching manifests: ", error);
      toast({ title: "Error", description: handleSupabaseError(error), variant: "destructive" });
    }
  };

  useEffect(() => {
    const loadAllData = async () => {
        setIsLoading(true);
        await fetchMasterData();
        await fetchGoodsReceipts();
        setIsLoading(false);
    }
    loadAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => ({ ...prev, miti: date }));
    }
  };

  const handleManifestSelect = (manifest: Manifest) => {
    setFormData(prev => ({...prev, manifestId: manifest.id}));
    setSelectedManifestInForm(manifest);
    const targetBranch = branches.find(b => b.id === manifest.toBranchId);
    if (targetBranch) {
        setFormData(prev => ({...prev, receivingBranchId: targetBranch.id}));
        setSelectedReceivingBranchInForm(targetBranch);
    } else {
        setFormData(prev => ({...prev, receivingBranchId: ""}));
        setSelectedReceivingBranchInForm(null);
    }
  };

  const handleReceivingBranchSelect = (branch: Branch) => {
    setFormData(prev => ({...prev, receivingBranchId: branch.id}));
    setSelectedReceivingBranchInForm(branch);
  };
  
  const handleBranchAdd = async (newBranchData: Omit<Branch, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'status' | 'managerName' | 'managerUserId' | 'contactEmail' | 'contactPhone'> & { status?: "Active" | "Inactive" }) => {
    setIsSubmitting(true);
    try {
      const branch = await db.create<Branch>('branches', {
        name: newBranchData.name,
        location: newBranchData.location || "",
        status: newBranchData.status || "Active",
        createdAt: new Date(),
        createdBy: PLACEHOLDER_USER_ID
      });
      setBranches(prev => [...prev, branch]);
      toast({ title: "Success", description: "Branch created successfully." });
    } catch (error) {
      console.error("Error creating branch:", error);
      toast({ title: "Error", description: "Failed to create branch.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const openAddForm = () => {
    setEditingReceipt(null);
    const initialReceivingBranchId = selectedManifestInForm?.toBranchId && branches.find(b => b.id === selectedManifestInForm.toBranchId) 
                                     ? selectedManifestInForm.toBranchId 
                                     : (branches.length > 0 ? branches[0].id : "");
    setFormData({
        ...defaultGoodsReceiptFormData, 
        miti: new Date(), 
        receivingBranchId: initialReceivingBranchId,
    });
    setSelectedManifestInForm(null);
    setSelectedReceivingBranchInForm(branches.find(b => b.id === initialReceivingBranchId) || null);
    // Update manifests available for selection
    setManifestsForSelection(allManifestsMaster.filter(m => m.status === "In Transit"));
    setIsFormDialogOpen(true);
  };

  const openEditForm = (receipt: GoodsReceipt) => {
    setEditingReceipt(receipt);
    const { id, createdAt, createdBy, updatedAt, updatedBy, ...editableData } = receipt;
    setFormData({...editableData, nepaliMiti: receipt.nepaliMiti || ""});
    
    const manifestForEdit = allManifestsMaster.find(m => m.id === receipt.manifestId);
    setSelectedManifestInForm(manifestForEdit || null);
    setSelectedReceivingBranchInForm(branches.find(b => b.id === receipt.receivingBranchId) || null);
    // Manifests for selection: "In Transit" OR the one currently attached to this receipt
    setManifestsForSelection(allManifestsMaster.filter(m => m.status === "In Transit" || m.id === receipt.manifestId));
    setIsFormDialogOpen(true);
  };
  
  const getBranchName = (branchId?: string) => branches.find(b => b.id === branchId)?.name || "N/A";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.manifestId || !formData.receivingBranchId) { 
        toast({ title: "Missing Fields", description: "Manifest and Receiving Branch are required.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    
    try {
      if (editingReceipt) {
        // Update existing receipt
        const updateData: GoodsReceiptUpdateRequest = {
          receiptId: editingReceipt.id,
          miti: formData.miti.toISOString(),
          nepaliMiti: formData.nepaliMiti,
          manifestId: formData.manifestId,
          receivingBranchId: formData.receivingBranchId,
          remarks: formData.remarks,
          // Note: shortages and damages would be handled here if form included them
        };
        
        const result = await updateGoodsReceiptFn(updateData);
        if (result.success) {
          toast({ title: "Goods Receipt Updated", description: result.message });
        } else {
          throw new Error(result.message);
        }
      } else {
        // Create new receipt
        const createData: GoodsReceiptCreateRequest = {
          miti: formData.miti.toISOString(),
          nepaliMiti: formData.nepaliMiti,
          manifestId: formData.manifestId,
          receivingBranchId: formData.receivingBranchId,
          remarks: formData.remarks,
          // Note: shortages and damages would be handled here if form included them
        };
        
        const result = await createGoodsReceiptFn(createData);
        if (result.success) {
          toast({ title: "Goods Receipt Created", description: result.message });
        } else {
          throw new Error(result.message);
        }
      }
    } catch (error) {
      console.error(`Error with goods receipt ${editingReceipt ? 'update' : 'create'} operation:`, error);
      toast({ title: "Error", description: "Failed to process goods receipt.", variant: "destructive" });
    }

    setIsSubmitting(false);
    setIsFormDialogOpen(false);
    setEditingReceipt(null);
    setSelectedManifestInForm(null);
    setSelectedReceivingBranchInForm(null);
    fetchGoodsReceipts();
    fetchMasterData(); // Refresh manifests list
  };

  const handleDeleteClick = (receipt: GoodsReceipt) => {
    setReceiptToDelete(receipt);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (receiptToDelete) {
      setIsSubmitting(true);
      try {
        const result = await deleteGoodsReceiptFn({ receiptId: receiptToDelete.id });
        if (result.success) {
          toast({ title: "Goods Receipt Deleted", description: result.message });
          fetchGoodsReceipts();
          fetchMasterData(); // Refresh manifests list
        } else {
          throw new Error(result.message);
        }
      } catch (error) {
        console.error("Error deleting goods receipt:", error);
        toast({ title: "Error", description: "Failed to delete goods receipt.", variant: "destructive" });
      } finally {
        setIsSubmitting(false);
      }
    }
    setIsDeleteDialogOpen(false);
    setReceiptToDelete(null);
  };

  const filteredReceipts = goodsReceipts.filter(receipt => 
    receipt.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    receipt.manifestId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (receipt.nepaliMiti && receipt.nepaliMiti.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
       <SmartManifestSelectDialog
        isOpen={isManifestSelectOpen}
        onOpenChange={setIsManifestSelectOpen}
        manifests={manifestsForSelection} // Pass only "In Transit" or current editing manifest's ID
        branches={branches} 
        onManifestSelect={handleManifestSelect}
        dialogTitle="Select Manifest for Receipt"
      />
      <SmartBranchSelectDialog
        isOpen={isBranchSelectOpen}
        onOpenChange={setIsBranchSelectOpen}
        branches={branches}
        onBranchSelect={handleReceivingBranchSelect}
        onBranchAdd={handleBranchAdd}
        dialogTitle="Select Receiving Branch"
      />

      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground flex items-center"><ArchiveRestore className="mr-3 h-8 w-8 text-primary"/>Goods Receipt</h1>
          <p className="text-muted-foreground ml-11">Mark goods as received at branch/godown from a manifest.</p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => {
            setIsFormDialogOpen(isOpen);
            if (!isOpen) {
              setEditingReceipt(null); 
              setSelectedManifestInForm(null);
              setSelectedReceivingBranchInForm(null);
            }
        }}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm} disabled={isSubmitting || isLoading}>
              <PlusCircle className="mr-2 h-4 w-4" /> New Goods Receipt
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingReceipt ? "Edit Goods Receipt" : "Create New Goods Receipt"}</DialogTitle>
              <DialogDescription>
                Record the receipt of goods from a manifest.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="receiptNo" className="text-right md:col-span-1 col-span-4">Receipt No.</Label>
                  <Input id="receiptNo" value={editingReceipt ? editingReceipt.id : "Auto-Generated"} readOnly className="bg-muted md:col-span-3 col-span-4" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="miti" className="text-right md:col-span-1 col-span-4">Miti (AD)</Label>
                  <Popover>
                    <PopoverTrigger asChild className="md:col-span-3 col-span-4">
                      <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !formData.miti && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.miti ? format(formData.miti, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.miti} onSelect={handleDateChange} initialFocus /></PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="nepaliMiti" className="text-right md:col-span-1 col-span-4">Nepali Miti</Label>
                  <Input id="nepaliMiti" name="nepaliMiti" value={formData.nepaliMiti || ""} onChange={handleInputChange} className="md:col-span-3 col-span-4" placeholder="e.g., 2081-04-01" />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="manifestIdButton" className="text-right md:col-span-1 col-span-4">Manifest</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    id="manifestIdButton"
                    className="md:col-span-3 col-span-4 justify-start" 
                    onClick={() => setIsManifestSelectOpen(true)}
                    disabled={isLoading || manifestsForSelection.length === 0}
                  >
                    {selectedManifestInForm ? `${selectedManifestInForm.id} (To: ${getBranchName(selectedManifestInForm.toBranchId)})` : (isLoading ? "Loading..." : (manifestsForSelection.length === 0 ? "No manifests pending" : "Select Manifest..."))}
                  </Button>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="receivingBranchIdButton" className="text-right md:col-span-1 col-span-4">Receiving Branch</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    id="receivingBranchIdButton"
                    className="md:col-span-3 col-span-4 justify-start" 
                    onClick={() => setIsBranchSelectOpen(true)}
                     disabled={isLoading || branches.length === 0}
                  >
                    {selectedReceivingBranchInForm ? selectedReceivingBranchInForm.name : (isLoading ? "Loading..." : (branches.length === 0 ? "No branches" : "Select Branch..."))}
                  </Button>
                </div>
                
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="remarks" className="text-right pt-2 md:col-span-1 col-span-4">Remarks</Label>
                  <Textarea id="remarks" name="remarks" value={formData.remarks || ""} onChange={handleInputChange} placeholder="Note any shortages, damages, or other observations." className="md:col-span-3 col-span-4" rows={4}/>
                </div>
              </div>
              <DialogFooter className="pt-4 border-t">
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting || isLoading}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingReceipt ? "Update Receipt" : "Save Receipt"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Goods Receipt List</CardTitle>
          <CardDescription>View all recorded goods receipts.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search Receipts (No, Manifest No, BS Date)..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
         {isLoading && goodsReceipts.length === 0 ? (
            <div className="flex justify-center items-center h-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading receipts...</p></div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt No.</TableHead>
                <TableHead>Miti (AD)</TableHead>
                <TableHead>Miti (BS)</TableHead>
                <TableHead>Manifest No.</TableHead>
                <TableHead>Receiving Branch</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReceipts.length === 0 && !isLoading && <TableRow><TableCell colSpan={7} className="text-center h-24">No goods receipts found.</TableCell></TableRow>}
              {filteredReceipts.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell className="font-medium">{receipt.id}</TableCell>
                  <TableCell>{format(receipt.miti, "PP")}</TableCell>
                  <TableCell>{receipt.nepaliMiti || "N/A"}</TableCell>
                  <TableCell>{receipt.manifestId}</TableCell>
                  <TableCell>{getBranchName(receipt.receivingBranchId)}</TableCell>
                  <TableCell className="max-w-xs truncate" title={receipt.remarks || ""}>{receipt.remarks || "N/A"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="icon" aria-label="Edit Receipt" onClick={() => openEditForm(receipt)} disabled={isSubmitting}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog open={isDeleteDialogOpen && receiptToDelete?.id === receipt.id} onOpenChange={(open) => { if(!open) setReceiptToDelete(null); setIsDeleteDialogOpen(open);}}>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="icon" aria-label="Delete Receipt" onClick={() => handleDeleteClick(receipt)} disabled={isSubmitting}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete Goods Receipt "{receiptToDelete?.id}" and revert associated manifest status.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {setReceiptToDelete(null); setIsDeleteDialogOpen(false);}} disabled={isSubmitting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting}>
                              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}