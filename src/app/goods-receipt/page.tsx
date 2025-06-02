
"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Search, Edit, Trash2, ArchiveRestore, CalendarIcon } from "lucide-react";
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


// Interfaces
export interface Branch { 
  id: string;
  name: string;
  location?: string; // Made optional to align with simpler add form
}
export interface Godown { 
  id: string;
  name: string;
  branchId: string;
}
export interface Manifest { 
  id: string;
  miti: Date;
  truckId: string;
  driverId: string;
  fromBranchId: string;
  toBranchId: string;
  attachedBiltiIds: string[];
  status?: "Open" | "In Transit" | "Completed" | "Cancelled" | "Received"; 
}
export interface GoodsReceipt {
  id: string;
  miti: Date;
  manifestId: string;
  receivingBranchId?: string; 
  receivingGodownId?: string; 
  remarks: string;
}

// Mock Data
const initialMockBranchesData: Branch[] = [
  { id: "BRN001", name: "Kathmandu Main", location: "Ring Road, KTM" },
  { id: "BRN002", name: "Pokhara Hub", location: "Lakeside, PKR" },
  { id: "BRN003", name: "Biratnagar Depot", location: "Industrial Area, BRT" },
];
const initialMockGodowns: Godown[] = [
  { id: "GDN001", name: "KTM Central Godown", branchId: "BRN001"},
  { id: "GDN002", name: "Pokhara Lakeside Storage", branchId: "BRN002"},
];
const initialManifestsPendingReceipt: Manifest[] = [
  { id: "MAN-001", miti: new Date("2024-07-10"), truckId: "TRK001", driverId: "DRV001", fromBranchId: "BRN001", toBranchId: "BRN002", attachedBiltiIds: ["BLT-001", "BLT-003"], status: "In Transit" },
  { id: "MAN-002", miti: new Date("2024-07-11"), truckId: "TRK002", driverId: "DRV002", fromBranchId: "BRN002", toBranchId: "BRN003", attachedBiltiIds: ["BLT-002"], status: "In Transit" },
  { id: "MAN-003", miti: new Date("2024-07-12"), truckId: "TRK001", driverId: "DRV001", fromBranchId: "BRN003", toBranchId: "BRN001", attachedBiltiIds: ["BLT-004"], status: "In Transit" },
];

const defaultGoodsReceiptFormData: Omit<GoodsReceipt, 'id'> = {
  miti: new Date(),
  manifestId: "",
  receivingBranchId: "",
  remarks: "",
};

export default function GoodsReceiptPage() {
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [manifestsPendingReceipt, setManifestsPendingReceipt] = useState<Manifest[]>(initialManifestsPendingReceipt);
  const [branches, setBranches] = useState<Branch[]>(initialMockBranchesData);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<GoodsReceipt | null>(null);
  const [formData, setFormData] = useState<Omit<GoodsReceipt, 'id'>>(defaultGoodsReceiptFormData);
  
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<GoodsReceipt | null>(null);

  const [isManifestSelectOpen, setIsManifestSelectOpen] = useState(false);
  const [isBranchSelectOpen, setIsBranchSelectOpen] = useState(false);

  const [selectedManifest, setSelectedManifest] = useState<Manifest | null>(null);
  const [selectedReceivingBranch, setSelectedReceivingBranch] = useState<Branch | null>(null);


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
    setSelectedManifest(manifest);
    // Auto-fill receiving branch if manifest's toBranchId matches an existing branch
    const targetBranch = branches.find(b => b.id === manifest.toBranchId);
    if (targetBranch) {
        setFormData(prev => ({...prev, receivingBranchId: targetBranch.id}));
        setSelectedReceivingBranch(targetBranch);
    }
  };

  const handleReceivingBranchSelect = (branch: Branch) => {
    setFormData(prev => ({...prev, receivingBranchId: branch.id}));
    setSelectedReceivingBranch(branch);
  };
  
  const handleBranchAdd = (newBranch: Branch) => {
    setBranches(prev => [...prev, newBranch]);
    toast({ title: "Branch Added", description: `${newBranch.name} has been added.`});
  }


  const generateReceiptNo = (): string => {
    const nextId = goodsReceipts.length + 1 + Math.floor(Math.random() * 100);
    return `GRN-${String(nextId).padStart(3, '0')}`;
  };

  const openAddForm = () => {
    setEditingReceipt(null);
    setFormData({...defaultGoodsReceiptFormData, miti: new Date() });
    setSelectedManifest(null);
    setSelectedReceivingBranch(null);
    setIsFormDialogOpen(true);
  };

  const openEditForm = (receipt: GoodsReceipt) => {
    setEditingReceipt(receipt);
    setFormData(receipt);
    setSelectedManifest(manifestsPendingReceipt.find(m => m.id === receipt.manifestId) || initialManifestsPendingReceipt.find(m => m.id === receipt.manifestId) || null);
    setSelectedReceivingBranch(branches.find(b => b.id === receipt.receivingBranchId) || null);
    setIsFormDialogOpen(true);
  };
  
  const getBranchName = (branchId?: string) => branches.find(b => b.id === branchId)?.name || "N/A";


  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.manifestId || !formData.receivingBranchId) { 
        toast({ title: "Missing Fields", description: "Manifest and Receiving Branch are required.", variant: "destructive" });
        return;
    }

    if (editingReceipt) {
      const updatedReceipt: GoodsReceipt = { ...formData, id: editingReceipt.id };
      setGoodsReceipts(goodsReceipts.map(r => r.id === editingReceipt.id ? updatedReceipt : r));
      toast({ title: "Goods Receipt Updated", description: `Receipt ${updatedReceipt.id} updated.` });
    } else {
      const newReceipt: GoodsReceipt = { ...formData, id: generateReceiptNo() };
      setGoodsReceipts(prevReceipts => [...prevReceipts, newReceipt]);
      setManifestsPendingReceipt(prevManifests => 
        prevManifests.map(m => m.id === newReceipt.manifestId ? {...m, status: "Received"} : m)
                     .filter(m => m.id !== newReceipt.manifestId || m.status !== "Received") 
      );
      toast({ title: "Goods Receipt Created", description: `Receipt ${newReceipt.id} created. Manifest ${newReceipt.manifestId} (simulated) marked as 'Received'.` });
    }
    setIsFormDialogOpen(false);
    setEditingReceipt(null);
    setSelectedManifest(null);
    setSelectedReceivingBranch(null);
  };

  const handleDeleteClick = (receipt: GoodsReceipt) => {
    setReceiptToDelete(receipt);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (receiptToDelete) {
      setGoodsReceipts(goodsReceipts.filter((r) => r.id !== receiptToDelete.id));
      const originalManifest = initialManifestsPendingReceipt.find(m => m.id === receiptToDelete.manifestId);
      if(originalManifest && !manifestsPendingReceipt.find(m => m.id === receiptToDelete.manifestId)){
        setManifestsPendingReceipt(prev => [...prev, {...originalManifest, status: "In Transit"}]);
      }
      toast({ title: "Goods Receipt Deleted", description: `Receipt ${receiptToDelete.id} deleted. Manifest status (simulated) may need to be reverted to 'In Transit'.` });
    }
    setIsDeleteDialogOpen(false);
    setReceiptToDelete(null);
  };

  const filteredReceipts = goodsReceipts.filter(receipt => 
    receipt.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    receipt.manifestId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const manifestsForSelection = manifestsPendingReceipt.filter(m => m.status === "In Transit" || (editingReceipt && m.id === editingReceipt.manifestId));

  return (
    <div className="space-y-6">
       <SmartManifestSelectDialog
        isOpen={isManifestSelectOpen}
        onOpenChange={setIsManifestSelectOpen}
        manifests={manifestsForSelection}
        branches={branches} 
        onManifestSelect={handleManifestSelect}
        dialogTitle="Select Manifest"
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
          <p className="text-muted-foreground ml-11">Mark goods as received at branch/godown.</p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => {
            setIsFormDialogOpen(isOpen);
            if (!isOpen) {
              setEditingReceipt(null); 
              setSelectedManifest(null);
              setSelectedReceivingBranch(null);
            }
        }}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm}>
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
                  <Label htmlFor="miti" className="text-right md:col-span-1 col-span-4">Miti (Date)</Label>
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
                  <Label htmlFor="manifestIdButton" className="text-right md:col-span-1 col-span-4">Manifest</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    id="manifestIdButton"
                    className="md:col-span-3 col-span-4 justify-start" 
                    onClick={() => setIsManifestSelectOpen(true)}
                  >
                    {selectedManifest ? `${selectedManifest.id} (To: ${getBranchName(selectedManifest.toBranchId)})` : "Select Manifest..."}
                  </Button>
                  <Input type="hidden" value={formData.manifestId} />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="receivingBranchIdButton" className="text-right md:col-span-1 col-span-4">Receiving Branch</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    id="receivingBranchIdButton"
                    className="md:col-span-3 col-span-4 justify-start" 
                    onClick={() => setIsBranchSelectOpen(true)}
                  >
                    {selectedReceivingBranch ? selectedReceivingBranch.name : "Select Receiving Branch..."}
                  </Button>
                   <Input type="hidden" value={formData.receivingBranchId} />
                </div>
                
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="remarks" className="text-right pt-2 md:col-span-1 col-span-4">Remarks</Label>
                  <Textarea id="remarks" name="remarks" value={formData.remarks} onChange={handleInputChange} placeholder="Note any shortages, damages, or other observations." className="md:col-span-3 col-span-4" rows={4}/>
                </div>
              </div>
              <DialogFooter className="pt-4 border-t">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit">{editingReceipt ? "Update Receipt" : "Save Receipt"}</Button>
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
            <Input placeholder="Search Receipts (No, Manifest No)..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt No.</TableHead>
                <TableHead>Miti</TableHead>
                <TableHead>Manifest No.</TableHead>
                <TableHead>Receiving Branch</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReceipts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center h-24">No goods receipts found.</TableCell></TableRow>}
              {filteredReceipts.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell className="font-medium">{receipt.id}</TableCell>
                  <TableCell>{format(receipt.miti, "PP")}</TableCell>
                  <TableCell>{receipt.manifestId}</TableCell>
                  <TableCell>{getBranchName(receipt.receivingBranchId)}</TableCell>
                  <TableCell className="max-w-xs truncate">{receipt.remarks || "N/A"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="icon" aria-label="Edit Receipt" onClick={() => openEditForm(receipt)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog open={isDeleteDialogOpen && receiptToDelete?.id === receipt.id} onOpenChange={(open) => { if(!open) setReceiptToDelete(null); setIsDeleteDialogOpen(open);}}>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="icon" aria-label="Delete Receipt" onClick={() => handleDeleteClick(receipt)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete Goods Receipt "{receiptToDelete?.id}". This might require manual adjustments to related manifest/bilti statuses.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {setReceiptToDelete(null); setIsDeleteDialogOpen(false);}}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
    
