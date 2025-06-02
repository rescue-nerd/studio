"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Search, Edit, Trash2, ArchiveRestore, CalendarIcon, Loader2 } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import SmartManifestSelectDialog from "@/components/shared/smart-manifest-select-dialog";
import SmartBranchSelectDialog from "@/components/shared/smart-branch-select-dialog";
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
  where,
  writeBatch
} from "firebase/firestore";
import type { 
  GoodsReceipt as FirestoreGoodsReceipt, 
  Manifest as FirestoreManifest, 
  Branch as FirestoreBranch,
  Godown as FirestoreGodown // Assuming you might use Godowns later
} from "@/types/firestore";

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
      const [manifestsSnap, branchesSnap] = await Promise.all([
        getDocs(query(collection(db, "manifests"))), // Fetch all manifests for context
        getDocs(query(collection(db, "branches"), orderBy("name"))),
        // getDocs(query(collection(db, "godowns"), orderBy("name"))), // For godowns later
      ]);

      const allFetchedManifests = manifestsSnap.docs.map(d => {
        const data = d.data() as FirestoreManifest;
        return { ...data, id: d.id, miti: data.miti.toDate() } as Manifest;
      });
      setAllManifestsMaster(allFetchedManifests);
      setManifestsForSelection(allFetchedManifests.filter(m => m.status === "In Transit"));

      setBranches(branchesSnap.docs.map(d => ({ ...d.data(), id: d.id } as Branch)));
      // setGodowns(godownsSnap.docs.map(d => ({ ...d.data(), id: d.id } as Godown)));

    } catch (error) {
      console.error("Error fetching master data for goods receipt: ", error);
      toast({ title: "Error", description: "Failed to load required data.", variant: "destructive" });
    }
  };

  const fetchGoodsReceipts = async () => {
    try {
      const receiptsCollectionRef = collection(db, "goodsReceipts");
      const q = query(receiptsCollectionRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedReceipts: GoodsReceipt[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data() as FirestoreGoodsReceipt;
        return { ...data, id: docSnap.id, miti: data.miti.toDate() };
      });
      setGoodsReceipts(fetchedReceipts);
    } catch (error) {
      console.error("Error fetching goods receipts: ", error);
      toast({ title: "Error", description: "Failed to fetch goods receipts.", variant: "destructive" });
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
    setIsSubmitting(true); // Use isSubmitting to disable buttons during this operation
    try {
      const branchPayload: Omit<FirestoreBranch, 'id'> = {
        name: newBranchData.name,
        location: newBranchData.location || "",
        status: newBranchData.status || "Active",
        createdAt: Timestamp.now(),
        createdBy: PLACEHOLDER_USER_ID,
      };
      const docRef = await addDoc(collection(db, "branches"), branchPayload);
      const newBranch: Branch = { ...branchPayload, id: docRef.id };
      setBranches(prev => [...prev, newBranch].sort((a,b) => a.name.localeCompare(b.name)));
      handleReceivingBranchSelect(newBranch); // Auto-select new branch
      toast({ title: "Branch Added", description: `${newBranch.name} has been added.`});
    } catch (error) {
      console.error("Error adding branch from dialog: ", error);
      toast({ title: "Error", description: "Failed to add new branch.", variant: "destructive" });
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
    
    const receiptDataPayload: Omit<FirestoreGoodsReceipt, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> & Partial<Pick<FirestoreGoodsReceipt, 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>> = {
      ...formData,
      miti: Timestamp.fromDate(formData.miti),
    };

    const batch = writeBatch(db);

    if (editingReceipt) {
      try {
        // Note: Typically, you might not change the manifest for an existing receipt.
        // If manifestId *can* change, logic to revert old manifest status and update new one is needed.
        // For simplicity, this example assumes manifestId doesn't change on edit or status updates are handled carefully.
        const receiptDocRef = doc(db, "goodsReceipts", editingReceipt.id);
        batch.update(receiptDocRef, {
            ...receiptDataPayload,
            updatedAt: Timestamp.now(),
            updatedBy: PLACEHOLDER_USER_ID,
        });
        // If the manifest associated with this receipt was changed, update statuses
        if (editingReceipt.manifestId !== formData.manifestId) {
            const oldManifestDocRef = doc(db, "manifests", editingReceipt.manifestId);
            batch.update(oldManifestDocRef, { status: "In Transit", goodsReceiptId: null }); // Revert old
            
            const newManifestDocRef = doc(db, "manifests", formData.manifestId);
            batch.update(newManifestDocRef, { status: "Received", goodsReceiptId: editingReceipt.id }); // Update new
        } else { // If manifest is same, ensure its status is "Received"
            const manifestDocRef = doc(db, "manifests", formData.manifestId);
            batch.update(manifestDocRef, { status: "Received", goodsReceiptId: editingReceipt.id });
        }
        
        await batch.commit();
        toast({ title: "Goods Receipt Updated", description: `Receipt ${editingReceipt.id} updated successfully.` });
      } catch (error) {
        console.error("Error updating goods receipt: ", error);
        toast({ title: "Error", description: "Failed to update goods receipt.", variant: "destructive" });
      }
    } else { // Adding new receipt
      try {
        const receiptCollectionRef = collection(db, "goodsReceipts");
        const newReceiptDocRef = doc(receiptCollectionRef); // Generate ID upfront for manifest update
        
        batch.set(newReceiptDocRef, {
            ...receiptDataPayload,
            createdBy: PLACEHOLDER_USER_ID,
            createdAt: Timestamp.now(),
        });
        
        // Update Manifest status to "Received"
        const manifestDocRef = doc(db, "manifests", formData.manifestId);
        batch.update(manifestDocRef, { status: "Received", goodsReceiptId: newReceiptDocRef.id });
        
        await batch.commit();
        toast({ title: "Goods Receipt Created", description: `New receipt created. Manifest ${formData.manifestId} marked 'Received'.` });
      } catch (error) {
        console.error("Error adding goods receipt: ", error);
        toast({ title: "Error", description: "Failed to create goods receipt.", variant: "destructive" });
      }
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
      const batch = writeBatch(db);
      try {
        const receiptDocRef = doc(db, "goodsReceipts", receiptToDelete.id);
        batch.delete(receiptDocRef);

        // Revert associated Manifest status to "In Transit"
        const manifestDocRef = doc(db, "manifests", receiptToDelete.manifestId);
        batch.update(manifestDocRef, { status: "In Transit", goodsReceiptId: null });

        await batch.commit();
        toast({ title: "Goods Receipt Deleted", description: `Receipt "${receiptToDelete.id}" deleted. Manifest status reverted.` });
        fetchGoodsReceipts();
        fetchMasterData(); // Refresh manifests list
      } catch (error) {
        console.error("Error deleting goods receipt: ", error);
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