
"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, Search, Edit, Trash2, ClipboardList, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { db } from "@/lib/firebase";
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  Timestamp,
  query,
  orderBy,
  writeBatch,
  where,
  documentId
} from "firebase/firestore";
import type { 
  Manifest as FirestoreManifest, 
  Bilti as FirestoreBilti, 
  Truck as FirestoreTruck, 
  Driver as FirestoreDriver, 
  Branch as FirestoreBranch,
  Party as FirestoreParty
} from "@/types/firestore";


// Local Interfaces
interface Manifest extends Omit<FirestoreManifest, 'miti' | 'createdAt' | 'updatedAt'> {
  id: string;
  miti: Date;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}
interface Bilti extends Omit<FirestoreBilti, 'miti' | 'createdAt' | 'updatedAt'> {
  id: string;
  miti: Date;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
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

const PLACEHOLDER_USER_ID = "system_user_placeholder";

export default function ManifestsPage() {
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [availableBiltis, setAvailableBiltis] = useState<Bilti[]>([]); // For form selection
  const [allBiltisMaster, setAllBiltisMaster] = useState<Bilti[]>([]); // Master list for context
  
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


  const fetchMasterData = async () => {
    // setIsLoading(true); // Handled by overall load
    try {
      const [trucksSnap, driversSnap, branchesSnap, partiesSnap, biltisSnap] = await Promise.all([
        getDocs(query(collection(db, "trucks"), orderBy("truckNo"))),
        getDocs(query(collection(db, "drivers"), orderBy("name"))),
        getDocs(query(collection(db, "branches"), orderBy("name"))),
        getDocs(query(collection(db, "parties"), orderBy("name"))),
        getDocs(query(collection(db, "biltis"))), // Fetch all biltis for context and selection
      ]);

      setTrucks(trucksSnap.docs.map(d => ({ ...d.data(), id: d.id } as Truck)));
      setDrivers(driversSnap.docs.map(d => ({ ...d.data(), id: d.id } as Driver)));
      setBranches(branchesSnap.docs.map(d => ({ ...d.data(), id: d.id } as Branch)));
      setParties(partiesSnap.docs.map(d => ({ ...d.data(), id: d.id } as Party)));
      
      const allFetchedBiltis = biltisSnap.docs.map(d => {
        const data = d.data() as FirestoreBilti;
        return { ...data, id: d.id, miti: data.miti.toDate() } as Bilti;
      });
      setAllBiltisMaster(allFetchedBiltis);
      // Filter biltis available for manifesting (status "Pending")
      setAvailableBiltis(allFetchedBiltis.filter(b => b.status === "Pending"));

    } catch (error) {
      console.error("Error fetching master data for manifests: ", error);
      toast({ title: "Error", description: "Failed to load required data for manifests.", variant: "destructive" });
    }
  };

  const fetchManifests = async () => {
    // setIsLoading(true); // Handled by overall load
    try {
      const manifestsCollectionRef = collection(db, "manifests");
      const q = query(manifestsCollectionRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedManifests: Manifest[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data() as FirestoreManifest;
        return {
          ...data,
          id: docSnap.id,
          miti: data.miti.toDate(),
        };
      });
      setManifests(fetchedManifests);
    } catch (error) {
      console.error("Error fetching manifests: ", error);
      toast({ title: "Error", description: "Failed to fetch manifests.", variant: "destructive" });
    }
  };
  
  useEffect(() => {
    const loadAllData = async () => {
        setIsLoading(true);
        await fetchMasterData(); // Fetches biltis too
        await fetchManifests();
        setIsLoading(false);
    }
    loadAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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
      if (checked) {
        newSet.add(biltiId);
      } else {
        newSet.delete(biltiId);
      }
      return newSet;
    });
  };

  const openAddForm = () => {
    setEditingManifest(null);
    const defaultTruckId = trucks.length > 0 ? trucks[0].id : "";
    const defaultDriverId = drivers.length > 0 ? drivers[0].id : "";
    const defaultFromBranchId = branches.length > 0 ? branches[0].id : "";
    const defaultToBranchId = branches.length > 1 ? branches[1].id : (branches.length > 0 ? branches[0].id : "");

    setFormData({
        ...defaultManifestFormData, 
        miti: new Date(), 
        truckId: defaultTruckId,
        driverId: defaultDriverId,
        fromBranchId: defaultFromBranchId,
        toBranchId: defaultToBranchId,
    });
    setSelectedBiltiIdsInForm(new Set());
    // Update available biltis for selection (only pending ones)
    setAvailableBiltis(allBiltisMaster.filter(b => b.status === "Pending"));
    setIsFormDialogOpen(true);
  };

  const openEditForm = (manifest: Manifest) => {
    setEditingManifest(manifest);
    const { id, status, createdAt, createdBy, updatedAt, updatedBy, ...editableData } = manifest;
    setFormData({...editableData, nepaliMiti: manifest.nepaliMiti || ""});
    setSelectedBiltiIdsInForm(new Set(manifest.attachedBiltiIds));
    // Biltis available for selection: pending ones + those already in this manifest
    setAvailableBiltis(allBiltisMaster.filter(b => b.status === "Pending" || manifest.attachedBiltiIds.includes(b.id)));
    setIsFormDialogOpen(true);
  };
  
  const getPartyName = (partyId?: string) => parties.find(p => p.id === partyId)?.name || "N/A";
  const getTruckNo = (truckId: string) => trucks.find(t => t.id === truckId)?.truckNo || "N/A";
  const getDriverName = (driverId: string) => drivers.find(d => d.id === driverId)?.name || "N/A";
  const getBranchName = (branchId: string) => branches.find(b => b.id === branchId)?.name || "N/A";


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.truckId || !formData.driverId || !formData.fromBranchId || !formData.toBranchId) {
        toast({ title: "Missing Fields", description: "Truck, Driver, From Branch, and To Branch are required.", variant: "destructive" });
        return;
    }
    if (selectedBiltiIdsInForm.size === 0) {
        toast({ title: "No Biltis Selected", description: "Please select at least one Bilti to attach to the manifest.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);

    const manifestDataPayload: Omit<FirestoreManifest, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'status'> & Partial<Pick<FirestoreManifest, 'status' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>> = {
      ...formData,
      miti: Timestamp.fromDate(formData.miti),
      attachedBiltiIds: Array.from(selectedBiltiIdsInForm),
    };

    const batch = writeBatch(db);

    if (editingManifest) {
      try {
        const manifestDocRef = doc(db, "manifests", editingManifest.id);
        batch.update(manifestDocRef, {
            ...manifestDataPayload,
            updatedAt: Timestamp.now(),
            updatedBy: PLACEHOLDER_USER_ID,
        });

        // Logic to update Bilti statuses:
        // Biltis removed from this manifest should become "Pending"
        const biltisToRemoveFromManifest = editingManifest.attachedBiltiIds.filter(id => !selectedBiltiIdsInForm.has(id));
        biltisToRemoveFromManifest.forEach(biltiId => {
            const biltiDocRef = doc(db, "biltis", biltiId);
            batch.update(biltiDocRef, { status: "Pending", manifestId: null });
        });
        // Biltis added or kept in this manifest should be "Manifested"
        selectedBiltiIdsInForm.forEach(biltiId => {
            const biltiDocRef = doc(db, "biltis", biltiId);
            batch.update(biltiDocRef, { status: "Manifested", manifestId: editingManifest.id });
        });
        
        await batch.commit();
        toast({ title: "Manifest Updated", description: `Manifest ${editingManifest.id} updated successfully.` });
      } catch (error) {
        console.error("Error updating manifest: ", error);
        toast({ title: "Error", description: "Failed to update manifest.", variant: "destructive" });
      }
    } else { // Adding new manifest
      try {
        const manifestCollectionRef = collection(db, "manifests");
        // For add, Firestore generates ID, so we create ref then set, or just add.
        // Let's use addDoc and then get the ID for bilti updates.
        const newManifestDocRef = await addDoc(manifestCollectionRef, {
            ...manifestDataPayload,
            status: "Open" as FirestoreManifest["status"],
            createdAt: Timestamp.now(),
            createdBy: PLACEHOLDER_USER_ID,
        });

        const newBatch = writeBatch(db); // New batch for bilti updates with new manifest ID
        selectedBiltiIdsInForm.forEach(biltiId => {
            const biltiDocRef = doc(db, "biltis", biltiId);
            newBatch.update(biltiDocRef, { status: "Manifested", manifestId: newManifestDocRef.id });
        });
        await newBatch.commit();
        toast({ title: "Manifest Created", description: `New manifest created successfully.` });
      } catch (error) {
        console.error("Error adding manifest: ", error);
        toast({ title: "Error", description: "Failed to create manifest.", variant: "destructive" });
      }
    }
    setIsSubmitting(false);
    setIsFormDialogOpen(false);
    setEditingManifest(null);
    fetchManifests(); // Refresh manifests list
    fetchMasterData(); // Refresh biltis list (to update their statuses for selection)
  };

  const handleDeleteClick = (manifest: Manifest) => {
    setManifestToDelete(manifest);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (manifestToDelete) {
      setIsSubmitting(true);
      const batch = writeBatch(db);
      try {
        // Delete the manifest
        const manifestDocRef = doc(db, "manifests", manifestToDelete.id);
        batch.delete(manifestDocRef);

        // Revert status of attached Biltis to "Pending"
        manifestToDelete.attachedBiltiIds.forEach(biltiId => {
          const biltiDocRef = doc(db, "biltis", biltiId);
          batch.update(biltiDocRef, { status: "Pending", manifestId: null });
        });
        
        await batch.commit();
        toast({ title: "Manifest Deleted", description: `Manifest "${manifestToDelete.id}" deleted and Biltis reverted.` });
        fetchManifests();
        fetchMasterData(); // Refresh biltis for selection
      } catch (error) {
        console.error("Error deleting manifest: ", error);
        toast({ title: "Error", description: "Failed to delete manifest.", variant: "destructive" });
      } finally {
        setIsSubmitting(false);
      }
    }
    setIsDeleteDialogOpen(false);
    setManifestToDelete(null);
  };

  const filteredManifests = manifests.filter(manifest => 
    manifest.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getTruckNo(manifest.truckId).toLowerCase().includes(searchTerm.toLowerCase()) ||
    getBranchName(manifest.fromBranchId).toLowerCase().includes(searchTerm.toLowerCase()) ||
    getBranchName(manifest.toBranchId).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (manifest.nepaliMiti && manifest.nepaliMiti.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Biltis to show in the selection table inside the form dialog
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
                  <div className="md:col-span-1"></div>
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
                                disabled={editingManifest && bilti.status === "Manifested" && !editingManifest.attachedBiltiIds.includes(bilti.id)} // Disable if manifested elsewhere
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
                      <Button variant="outline" size="icon" aria-label="Edit Manifest" onClick={() => openEditForm(manifest)} disabled={isSubmitting}>
                        <Edit className="h-4 w-4" />
                      </Button>
                       <AlertDialog open={isDeleteDialogOpen && manifestToDelete?.id === manifest.id} onOpenChange={(open) => { if(!open) setManifestToDelete(null); setIsDeleteDialogOpen(open);}}>
                         <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="icon" aria-label="Delete Manifest" onClick={() => handleDeleteClick(manifest)} disabled={isSubmitting}>
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
    

    