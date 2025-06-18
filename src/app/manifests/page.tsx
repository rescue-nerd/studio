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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { getSupabaseErrorMessage } from "@/lib/supabase-error-handler";
import { cn } from "@/lib/utils";
import type {
  Bilti as FirestoreBilti,
  Branch as FirestoreBranch,
  Driver as FirestoreDriver,
  Manifest as FirestoreManifest,
  Party as FirestoreParty,
  Truck as FirestoreTruck
} from "@/types/firestore";
import { format } from "date-fns";
import { CalendarIcon, ClipboardList, Edit, Loader2, PlusCircle, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

// Local Interfaces
interface Manifest extends Omit<FirestoreManifest, 'miti' | 'createdAt' | 'updatedAt'> {
  id: string;
  miti: Date;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}
interface Bilti extends Omit<FirestoreBilti, 'miti' | 'createdAt' | 'updatedAt'> {
  id: string;
  miti: Date;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}
interface Truck extends FirestoreTruck {}
interface Driver extends FirestoreDriver {}
interface Branch extends FirestoreBranch {}
interface Party extends FirestoreParty {}

const defaultManifestFormData: Omit<Manifest, 'id' | 'status' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> = {
  miti: new Date(),
  nepaliMiti: "",
  truckId: "",
  driverId: "",
  fromBranchId: "",
  toBranchId: "",
  attachedBiltiIds: [],
  remarks: "",
};

// Supabase Edge Functions calls
const createManifestFn = async (data: any) => {
  const response = await supabase.functions.invoke('create-manifest', { body: data });
  return response.data;
};

const updateManifestFn = async (data: any) => {
  const response = await supabase.functions.invoke('update-manifest', { body: data });
  return response.data;
};

const deleteManifestFn = async (data: any) => {
  const response = await supabase.functions.invoke('delete-manifest', { body: data });
  return response.data;
};


export default function ManifestsPage() {
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [availableBiltis, setAvailableBiltis] = useState<Bilti[]>([]); 
  const [allBiltisMaster, setAllBiltisMaster] = useState<Bilti[]>([]); 
  
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [parties, setParties] = useState<Party[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingManifest, setEditingManifest] = useState<Manifest | null>(null);
  const [formData, setFormData] = useState<Omit<Manifest, 'id' | 'status' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>>(defaultManifestFormData);
  
  const [selectedBiltiIdsInForm, setSelectedBiltiIdsInForm] = useState<Set<string>>(new Set());

  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [manifestToDelete, setManifestToDelete] = useState<Manifest | null>(null);
  const { user: authUser, loading: authLoading } = useAuth(); 
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authUser, authLoading, router]);

  const fetchMasterData = async () => {
    if (!authUser) return;
    try {
      const [trucksRes, driversRes, branchesRes, partiesRes] = await Promise.all([
        supabase.from('trucks').select('*').order('truck_no'),
        supabase.from('drivers').select('*').order('name'),
        supabase.from('branches').select('*').order('name'),
        supabase.from('parties').select('*').order('name')
      ]);

      if (trucksRes.error) throw trucksRes.error;
      if (driversRes.error) throw driversRes.error;
      if (branchesRes.error) throw branchesRes.error;
      if (partiesRes.error) throw partiesRes.error;

      setTrucks(trucksRes.data || []);
      setDrivers(driversRes.data || []);
      setBranches(branchesRes.data || []);
      setParties(partiesRes.data || []);
      
      // Fetch biltis using Supabase
      const { data: biltisData, error } = await supabase
        .from('biltis')
        .select('*')
        .order('created_at');
      
      if (error) throw error;
      
      const allFetchedBiltis = (biltisData || []).map(bilti => ({
        ...bilti,
        miti: new Date(bilti.miti)
      })) as Bilti[];
      
      setAllBiltisMaster(allFetchedBiltis);
      setAvailableBiltis(allFetchedBiltis.filter(b => b.status === "Pending"));

    } catch (error) {
      console.error("Error fetching master data for manifests: ", error);
      toast({ title: "Error", description: "Failed to load required data for manifests.", variant: "destructive" });
    }
  };

  const fetchManifests = async () => {
    if (!authUser) return;
    try {
      const { data, error } = await supabase
        .from('manifests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const fetchedManifests: Manifest[] = (data || []).map(manifest => ({
        ...manifest,
        miti: new Date(manifest.miti)
      }));
      
      setManifests(fetchedManifests);
    } catch (error) {
      console.error("Error fetching manifests: ", error);
      toast({ title: "Error", description: getSupabaseErrorMessage(error), variant: "destructive" });
    }
  };
  
  useEffect(() => {
    if(authUser){
      const loadAllData = async () => {
          setIsLoading(true);
          await fetchMasterData();
          await fetchManifests();
          setIsLoading(false);
      }
      loadAllData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);


  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof Omit<Manifest, 'id' | 'status' | 'createdAt'| 'createdBy'| 'updatedAt'| 'updatedBy' | 'attachedBiltiIds' | 'nepaliMiti' | 'miti'>) => (value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => ({ ...prev, miti: date }));
    }
  };

  const handleBiltiSelectionChange = (biltiId: string, checked: boolean) => {
    setSelectedBiltiIdsInForm(prev => {
      const newSet = new Set(prev);
      if (checked) newSet.add(biltiId);
      else newSet.delete(biltiId);
      return newSet;
    });
  };

  const openAddForm = () => {
    setEditingManifest(null);
    setFormData({
        ...defaultManifestFormData, 
        miti: new Date(), 
        truckId: trucks[0]?.id || "",
        driverId: drivers[0]?.id || "",
        fromBranchId: branches[0]?.id || "",
        toBranchId: branches.length > 1 ? branches[1].id : (branches[0]?.id || ""),
    });
    setSelectedBiltiIdsInForm(new Set());
    setAvailableBiltis(allBiltisMaster.filter(b => b.status === "Pending"));
    setIsFormDialogOpen(true);
  };

  const openEditForm = (manifest: Manifest) => {
    setEditingManifest(manifest);
    const { id, status, createdAt, createdBy, updatedAt, updatedBy, ...editableData } = manifest;
    setFormData({...editableData, nepaliMiti: manifest.nepaliMiti || ""});
    setSelectedBiltiIdsInForm(new Set(manifest.attachedBiltiIds));
    setAvailableBiltis(allBiltisMaster.filter(b => b.status === "Pending" || manifest.attachedBiltiIds.includes(b.id)));
    setIsFormDialogOpen(true);
  };
  
  const getPartyName = (partyId?: string) => parties.find(p => p.id === partyId)?.name || "N/A";
  const getTruckNo = (truckId: string) => trucks.find(t => t.id === truckId)?.truckNo || "N/A";
  const getDriverName = (driverId: string) => drivers.find(d => d.id === driverId)?.name || "N/A";
  const getBranchName = (branchId: string) => branches.find(b => b.id === branchId)?.name || "N/A";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) {
        toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
        return;
    }
    if (!formData.truckId || !formData.driverId || !formData.fromBranchId || !formData.toBranchId) {
        toast({ title: "Missing Fields", description: "Truck, Driver, From Branch, and To Branch are required.", variant: "destructive" });
        return;
    }
    if (selectedBiltiIdsInForm.size === 0) {
        toast({ title: "No Biltis Selected", description: "Please select at least one Bilti.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);

    const payload = {
      ...formData,
      miti: formData.miti.toISOString(),
      attachedBiltiIds: Array.from(selectedBiltiIdsInForm),
    };
    
    try {
      let result: any;
      if (editingManifest) {
        result = await updateManifestFn({ manifestId: editingManifest.id, ...payload });
      } else {
        result = await createManifestFn(payload);
      }

      if (result.success) {
        toast({ title: "Success", description: result.message });
        fetchManifests();
        fetchMasterData(); // Re-fetch to update bilti statuses for selection
        setIsFormDialogOpen(false);
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
        console.error("Error saving manifest:", error);
        toast({ title: "Error", description: error.message || "Failed to save manifest.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (manifest: Manifest) => {
    setManifestToDelete(manifest);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!manifestToDelete || !authUser) return;
    setIsSubmitting(true);
    try {
      const result = await deleteManifestFn({ manifestId: manifestToDelete.id });
      if (result.success) {
        toast({ title: "Success", description: result.message });
        fetchManifests();
        fetchMasterData(); // Re-fetch biltis
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error deleting manifest: ", error);
      toast({ title: "Error", description: error.message || "Failed to delete manifest.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setIsDeleteDialogOpen(false);
      setManifestToDelete(null);
    }
  };

  const filteredManifests = manifests.filter(manifest => 
    manifest.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getTruckNo(manifest.truckId).toLowerCase().includes(searchTerm.toLowerCase()) ||
    getBranchName(manifest.fromBranchId).toLowerCase().includes(searchTerm.toLowerCase()) ||
    getBranchName(manifest.toBranchId).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (manifest.nepaliMiti && manifest.nepaliMiti.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const biltisForFormSelection = editingManifest 
    ? allBiltisMaster.filter(b => b.status === "Pending" || editingManifest.attachedBiltiIds.includes(b.id))
    : allBiltisMaster.filter(b => b.status === "Pending");

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground flex items-center"><ClipboardList className="mr-3 h-8 w-8 text-primary"/>Manifest Creation</h1>
          <p className="text-muted-foreground ml-11">Consolidate multiple Biltis/Invoices into truck trips.</p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => {
            setIsFormDialogOpen(isOpen);
            if (!isOpen) { setEditingManifest(null); setSelectedBiltiIdsInForm(new Set()); }
        }}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm} disabled={isSubmitting || isLoading}>
              <PlusCircle className="mr-2 h-4 w-4" /> New Manifest
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{editingManifest ? "Edit Manifest" : "Create New Manifest"}</DialogTitle>
              <DialogDescription>
                {editingManifest ? "Update the details for this manifest." : "Fill in the details to create a new manifest."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4 max-h-[75vh] overflow-y-auto p-1">
                {/* Form fields as before */}
                <div className="grid md:grid-cols-4 items-start gap-4">
                  <div className="md:col-span-1">
                    <Label htmlFor="manifestNo">Manifest No.</Label>
                    <Input id="manifestNo" value={editingManifest ? editingManifest.id : "Auto-Generated"} readOnly className="bg-muted" />
                  </div>
                  <div className="md:col-span-1">
                    <Label htmlFor="miti">Miti (AD)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !formData.miti && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.miti ? format(formData.miti, "PPP") : <span>Pick AD date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.miti} onSelect={handleDateChange} initialFocus /></PopoverContent>
                    </Popover>
                  </div>
                  <div className="md:col-span-1">
                    <Label htmlFor="nepaliMiti">Nepali Miti (BS)</Label>
                    <Input id="nepaliMiti" name="nepaliMiti" value={formData.nepaliMiti || ""} onChange={handleInputChange} placeholder="e.g., 2081-04-01" />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="truckId">Truck</Label>
                    <Select value={formData.truckId} onValueChange={handleSelectChange('truckId')} required disabled={isLoading || trucks.length === 0}>
                      <SelectTrigger><SelectValue placeholder={isLoading ? "Loading..." : (trucks.length === 0 ? "No trucks" : "Select Truck")} /></SelectTrigger>
                      <SelectContent>{trucks.map(t => <SelectItem key={t.id} value={t.id}>{t.truckNo} ({t.type})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="driverId">Driver</Label>
                    <Select value={formData.driverId} onValueChange={handleSelectChange('driverId')} required disabled={isLoading || drivers.length === 0}>
                      <SelectTrigger><SelectValue placeholder={isLoading ? "Loading..." : (drivers.length === 0 ? "No drivers" : "Select Driver")} /></SelectTrigger>
                      <SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fromBranchId">From Branch</Label>
                    <Select value={formData.fromBranchId} onValueChange={handleSelectChange('fromBranchId')} required disabled={isLoading || branches.length === 0}>
                      <SelectTrigger><SelectValue placeholder={isLoading ? "Loading..." : (branches.length === 0 ? "No branches" : "Select Origin Branch")} /></SelectTrigger>
                      <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="toBranchId">To Branch</Label>
                    <Select value={formData.toBranchId} onValueChange={handleSelectChange('toBranchId')} required disabled={isLoading || branches.length === 0}>
                      <SelectTrigger><SelectValue placeholder={isLoading ? "Loading..." : (branches.length === 0 ? "No branches" : "Select Destination Branch")} /></SelectTrigger>
                      <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                    <Label htmlFor="remarks">Remarks (Optional)</Label>
                    <Input id="remarks" name="remarks" value={formData.remarks || ""} onChange={handleInputChange} placeholder="e.g., Special instructions for trip"/>
                </div>

                <div className="mt-4">
                  <Label className="text-base font-medium">Attach Biltis</Label>
                  <ScrollArea className="h-[250px] w-full rounded-md border mt-2">
                    <Table>
                      <TableHeader className="sticky top-0 bg-secondary">
                        <TableRow>
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead>Bilti No.</TableHead>
                          <TableHead>Consignor</TableHead>
                          <TableHead>Consignee</TableHead>
                          <TableHead>Destination</TableHead>
                          <TableHead>Packages</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {biltisForFormSelection.length === 0 && <TableRow><TableCell colSpan={6} className="text-center h-24">No Biltis available for manifesting (status 'Pending' or already in this manifest).</TableCell></TableRow>}
                        {biltisForFormSelection.map(bilti => (
                          <TableRow key={bilti.id} className={selectedBiltiIdsInForm.has(bilti.id) ? "bg-primary/10" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={selectedBiltiIdsInForm.has(bilti.id)}
                                onCheckedChange={(checked) => handleBiltiSelectionChange(bilti.id, !!checked)}
                                id={`bilti-${bilti.id}`}
                                disabled={!!(editingManifest && bilti.status === "Manifested" && !editingManifest.attachedBiltiIds.includes(bilti.id))}
                              />
                            </TableCell>
                            <TableCell>{bilti.id}</TableCell>
                            <TableCell>{getPartyName(bilti.consignorId)}</TableCell>
                            <TableCell>{getPartyName(bilti.consigneeId)}</TableCell>
                            <TableCell>{bilti.destination}</TableCell>
                            <TableCell>{bilti.packages}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </div>
              <DialogFooter className="pt-4 border-t mt-2">
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting || isLoading}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingManifest ? "Update Manifest" : "Save Manifest"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Manifest List</CardTitle>
          <CardDescription>View and manage all created manifests.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search Manifests (No, Truck, Branch, BS Date)..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
        {isLoading && manifests.length === 0 ? (
            <div className="flex justify-center items-center h-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading manifests...</p></div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Manifest No.</TableHead>
                <TableHead>Miti (AD)</TableHead>
                <TableHead>Miti (BS)</TableHead>
                <TableHead>Truck</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead># Biltis</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredManifests.length === 0 && !isLoading && <TableRow><TableCell colSpan={10} className="text-center h-24">No manifests found.</TableCell></TableRow>}
              {filteredManifests.map((manifest) => (
                <TableRow key={manifest.id}>
                  <TableCell className="font-medium">{manifest.id}</TableCell>
                  <TableCell>{format(manifest.miti, "PP")}</TableCell>
                  <TableCell>{manifest.nepaliMiti || "N/A"}</TableCell>
                  <TableCell>{getTruckNo(manifest.truckId)}</TableCell>
                  <TableCell>{getDriverName(manifest.driverId)}</TableCell>
                  <TableCell>{getBranchName(manifest.fromBranchId)}</TableCell>
                  <TableCell>{getBranchName(manifest.toBranchId)}</TableCell>
                  <TableCell>{manifest.attachedBiltiIds.length}</TableCell>
                  <TableCell>
                     <span className={cn("px-2 py-1 text-xs rounded-full", 
                        manifest.status === "Open" ? "bg-blue-200 text-blue-800" : 
                        manifest.status === "In Transit" ? "bg-yellow-400 text-yellow-900" :
                        manifest.status === "Received" ? "bg-orange-400 text-orange-900" :
                        manifest.status === "Completed" ? "bg-accent text-accent-foreground" : 
                        manifest.status === "Cancelled" ? "bg-destructive text-destructive-foreground" : "bg-gray-200 text-gray-800"
                     )}>{manifest.status || "N/A"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="icon" aria-label="Edit Manifest" onClick={() => openEditForm(manifest)} disabled={isSubmitting || manifest.status !== "Open"}>
                        <Edit className="h-4 w-4" />
                      </Button>
                       <AlertDialog open={isDeleteDialogOpen && manifestToDelete?.id === manifest.id} onOpenChange={(open) => { if(!open) setManifestToDelete(null); setIsDeleteDialogOpen(open);}}>
                         <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="icon" aria-label="Delete Manifest" onClick={() => handleDeleteClick(manifest)} disabled={isSubmitting || manifest.status !== "Open"}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                         </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>This action cannot be undone. This will permanently delete Manifest "{manifestToDelete?.id}" and revert associated Biltis to 'Pending'.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {setManifestToDelete(null); setIsDeleteDialogOpen(false);}} disabled={isSubmitting}>Cancel</AlertDialogCancel>
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



