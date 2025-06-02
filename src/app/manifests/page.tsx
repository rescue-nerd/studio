
"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, Search, Edit, Trash2, ClipboardList } from "lucide-react";
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

// Interfaces (redefine or import from shared types if available)
interface Party {
  id: string;
  name: string;
  type: "Consignor" | "Consignee" | "Both";
  contactNo: string;
  panNo?: string;
  address?: string;
  assignedLedger: string;
  status: "Active" | "Inactive";
}
interface Truck {
  id: string;
  truckNo: string;
  type: string;
  capacity: string;
  ownerName: string;
  status: "Active" | "Inactive" | "Maintenance";
  assignedLedger: string;
}
interface Driver {
  id: string;
  name: string;
  licenseNo: string;
  contactNo: string;
  status: "Active" | "Inactive" | "On Leave";
  assignedLedger: string;
}
interface Branch {
  id: string;
  name: string;
  location: string;
  manager: string;
  status: "Active" | "Inactive";
}
interface Bilti {
  id: string;
  miti: Date;
  nepaliMiti?: string; // Added for Bikram Sambat date
  consignorId: string;
  consigneeId: string;
  origin: string;
  destination: string;
  description: string;
  packages: number;
  totalAmount: number;
  payMode: "Paid" | "To Pay" | "Due";
  truckId: string; 
  driverId: string; 
  status?: "Pending" | "Manifested" | "Received" | "Delivered" | "Cancelled";
}
interface Manifest {
  id: string;
  miti: Date;
  nepaliMiti?: string; // Added for Bikram Sambat date
  truckId: string;
  driverId: string;
  fromBranchId: string;
  toBranchId: string;
  attachedBiltiIds: string[];
  remarks?: string;
  status?: "Open" | "In Transit" | "Completed" | "Cancelled";
}

// Mock Data (replace with actual data fetching)
const initialMockParties: Party[] = [
  { id: "PTY001", name: "Global Traders (KTM)", type: "Both", contactNo: "9800000001", panNo: "PAN123KTM", address: "Kathmandu", assignedLedger: "LEDGER-PTY001", status: "Active" },
  { id: "PTY002", name: "National Distributors (PKR)", type: "Both", contactNo: "9800000002", panNo: "PAN456PKR", address: "Pokhara", assignedLedger: "LEDGER-PTY002", status: "Active" },
];
const initialMockTrucks: Truck[] = [
  { id: "TRK001", truckNo: "BA 1 KA 1234", type: "6-Wheeler", capacity: "10 Ton", ownerName: "Ram Transport", status: "Active", assignedLedger: "Ledger-RamT" },
  { id: "TRK002", truckNo: "NA 5 KHA 5678", type: "10-Wheeler", capacity: "16 Ton", ownerName: "Sita Logistics", status: "Active", assignedLedger: "Ledger-SitaL" },
];
const initialMockDrivers: Driver[] = [
  { id: "DRV001", name: "Suresh Kumar", licenseNo: "LIC-12345", contactNo: "9876543210", status: "Active", assignedLedger: "Ledger-SK" },
  { id: "DRV002", name: "Bimala Rai", licenseNo: "LIC-67890", contactNo: "9876543211", status: "Active", assignedLedger: "Ledger-BR" },
];
const initialMockBranches: Branch[] = [
  { id: "BRN001", name: "Kathmandu Main", location: "Kathmandu", manager: "Admin", status: "Active" },
  { id: "BRN002", name: "Pokhara Hub", location: "Pokhara", manager: "Admin", status: "Active" },
  { id: "BRN003", name: "Biratnagar Depot", location: "Biratnagar", manager: "Admin", status: "Active" },
];
const initialAvailableBiltis: Bilti[] = [
  { id: "BLT-001", miti: new Date("2024-07-01"), nepaliMiti: "2081-03-17", consignorId: "PTY001", consigneeId: "PTY002", origin: "Kathmandu Main", destination: "Pokhara Hub", description: "Electronics", packages: 10, totalAmount: 5000, payMode: "To Pay", truckId: "TRK001", driverId: "DRV001", status: "Pending" },
  { id: "BLT-002", miti: new Date("2024-07-02"), nepaliMiti: "2081-03-18", consignorId: "PTY002", consigneeId: "PTY001", origin: "Pokhara Hub", destination: "Biratnagar Depot", description: "Garments", packages: 25, totalAmount: 12000, payMode: "Paid", truckId: "TRK002", driverId: "DRV002", status: "Pending" },
  { id: "BLT-003", miti: new Date("2024-07-03"), nepaliMiti: "2081-03-19", consignorId: "PTY001", consigneeId: "PTY001", origin: "Kathmandu Main", destination: "Kathmandu Main", description: "Hardware", packages: 5, totalAmount: 2500, payMode: "To Pay", truckId: "TRK001", driverId: "DRV001", status: "Pending" },
];


const defaultManifestFormData: Omit<Manifest, 'id' | 'status'> = {
  miti: new Date(),
  nepaliMiti: "",
  truckId: "",
  driverId: "",
  fromBranchId: "",
  toBranchId: "",
  attachedBiltiIds: [],
  remarks: "",
};

export default function ManifestsPage() {
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [availableBiltis, setAvailableBiltis] = useState<Bilti[]>(initialAvailableBiltis);
  const [trucks] = useState<Truck[]>(initialMockTrucks);
  const [drivers] = useState<Driver[]>(initialMockDrivers);
  const [branches] = useState<Branch[]>(initialMockBranches);
  const [parties] = useState<Party[]>(initialMockParties);

  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingManifest, setEditingManifest] = useState<Manifest | null>(null);
  const [formData, setFormData] = useState<Omit<Manifest, 'id' | 'status'>>(defaultManifestFormData);
  
  const [selectedBiltiIdsInForm, setSelectedBiltiIdsInForm] = useState<Set<string>>(new Set());

  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [manifestToDelete, setManifestToDelete] = useState<Manifest | null>(null);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof Omit<Manifest, 'id' | 'status' | 'attachedBiltiIds' | 'nepaliMiti'>) => (value: string) => {
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

  const generateManifestNo = (): string => {
    const nextId = manifests.length + 1 + Math.floor(Math.random() * 100);
    return `MAN-${String(nextId).padStart(3, '0')}`;
  };

  const openAddForm = () => {
    setEditingManifest(null);
    setFormData({...defaultManifestFormData, miti: new Date(), nepaliMiti: "" });
    setSelectedBiltiIdsInForm(new Set());
    setIsFormDialogOpen(true);
  };

  const openEditForm = (manifest: Manifest) => {
    setEditingManifest(manifest);
    const { status, ...editableData } = manifest;
    setFormData({...editableData, nepaliMiti: manifest.nepaliMiti || ""});
    setSelectedBiltiIdsInForm(new Set(manifest.attachedBiltiIds));
    setIsFormDialogOpen(true);
  };
  
  const getPartyName = (partyId: string) => parties.find(p => p.id === partyId)?.name || "N/A";
  const getTruckNo = (truckId: string) => trucks.find(t => t.id === truckId)?.truckNo || "N/A";
  const getDriverName = (driverId: string) => drivers.find(d => d.id === driverId)?.name || "N/A";
  const getBranchName = (branchId: string) => branches.find(b => b.id === branchId)?.name || "N/A";


  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.truckId || !formData.driverId || !formData.fromBranchId || !formData.toBranchId) {
        toast({ title: "Missing Fields", description: "Truck, Driver, From Branch, and To Branch are required.", variant: "destructive" });
        return;
    }
    if (selectedBiltiIdsInForm.size === 0) {
        toast({ title: "No Biltis Selected", description: "Please select at least one Bilti to attach to the manifest.", variant: "destructive" });
        return;
    }

    const finalFormData = { ...formData, attachedBiltiIds: Array.from(selectedBiltiIdsInForm) };

    if (editingManifest) {
      const updatedManifest: Manifest = {
        ...finalFormData,
        id: editingManifest.id,
        status: editingManifest.status || "Open",
        nepaliMiti: formData.nepaliMiti,
      };
      setManifests(manifests.map(m => m.id === editingManifest.id ? updatedManifest : m));
      setAvailableBiltis(prevBiltis => prevBiltis.map(b => {
        if (updatedManifest.attachedBiltiIds.includes(b.id)) return {...b, status: "Manifested"};
        if (editingManifest.attachedBiltiIds.includes(b.id) && !updatedManifest.attachedBiltiIds.includes(b.id)) return {...b, status: "Pending"};
        return b;
      }));
      toast({ title: "Manifest Updated", description: `Manifest ${updatedManifest.id} updated. Attached Biltis' statuses (simulated) updated to 'Manifested'.` });
    } else {
      const newManifest: Manifest = {
        ...finalFormData,
        id: generateManifestNo(),
        status: "Open",
        nepaliMiti: formData.nepaliMiti,
      };
      setManifests(prevManifests => [...prevManifests, newManifest]);
      setAvailableBiltis(prevBiltis => prevBiltis.map(b => 
        newManifest.attachedBiltiIds.includes(b.id) ? {...b, status: "Manifested"} : b
      ).filter(b => !newManifest.attachedBiltiIds.includes(b.id))); 
      toast({ title: "Manifest Created", description: `Manifest ${newManifest.id} created. Attached Biltis' statuses (simulated) updated to 'Manifested'.` });
    }
    setIsFormDialogOpen(false);
    setEditingManifest(null);
    setSelectedBiltiIdsInForm(new Set());
  };

  const handleDeleteClick = (manifest: Manifest) => {
    setManifestToDelete(manifest);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (manifestToDelete) {
      setManifests(manifests.filter((m) => m.id !== manifestToDelete.id));
      setAvailableBiltis(prevBiltis => {
        const restoredBiltis = initialAvailableBiltis.filter(b => manifestToDelete.attachedBiltiIds.includes(b.id)).map(b => ({...b, status: "Pending" as Bilti["status"]}));
        const currentNonAffectedBiltis = prevBiltis.filter(b => !manifestToDelete.attachedBiltiIds.includes(b.id));
        const updatedAvailableBiltis = [...currentNonAffectedBiltis];
        restoredBiltis.forEach(rb => {
          if(!updatedAvailableBiltis.find(ab => ab.id === rb.id)) updatedAvailableBiltis.push(rb);
        });
        return updatedAvailableBiltis;
      });
      toast({ title: "Manifest Deleted", description: `Manifest ${manifestToDelete.id} deleted. Attached Biltis' statuses (simulated) reverted to 'Pending'.` });
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
  
  const biltisForSelection = availableBiltis.filter(b => b.status === "Pending" || (editingManifest && editingManifest.attachedBiltiIds.includes(b.id)));


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
            <Button onClick={openAddForm}>
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
                   {/* Empty div for spacing to align next row correctly if needed */}
                  <div className="md:col-span-1"></div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="truckId">Truck</Label>
                    <Select value={formData.truckId} onValueChange={handleSelectChange('truckId')} required>
                      <SelectTrigger><SelectValue placeholder="Select Truck" /></SelectTrigger>
                      <SelectContent>{trucks.map(t => <SelectItem key={t.id} value={t.id}>{t.truckNo} ({t.type})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="driverId">Driver</Label>
                    <Select value={formData.driverId} onValueChange={handleSelectChange('driverId')} required>
                      <SelectTrigger><SelectValue placeholder="Select Driver" /></SelectTrigger>
                      <SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fromBranchId">From Branch</Label>
                    <Select value={formData.fromBranchId} onValueChange={handleSelectChange('fromBranchId')} required>
                      <SelectTrigger><SelectValue placeholder="Select Origin Branch" /></SelectTrigger>
                      <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="toBranchId">To Branch</Label>
                    <Select value={formData.toBranchId} onValueChange={handleSelectChange('toBranchId')} required>
                      <SelectTrigger><SelectValue placeholder="Select Destination Branch" /></SelectTrigger>
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
                        {biltisForSelection.length === 0 && <TableRow><TableCell colSpan={6} className="text-center h-24">No Biltis available for manifesting.</TableCell></TableRow>}
                        {biltisForSelection.map(bilti => (
                          <TableRow key={bilti.id} className={selectedBiltiIdsInForm.has(bilti.id) ? "bg-primary/10" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={selectedBiltiIdsInForm.has(bilti.id)}
                                onCheckedChange={(checked) => handleBiltiSelectionChange(bilti.id, !!checked)}
                                id={`bilti-${bilti.id}`}
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
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit">{editingManifest ? "Update Manifest" : "Save Manifest"}</Button>
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
              {filteredManifests.length === 0 && <TableRow><TableCell colSpan={10} className="text-center h-24">No manifests found.</TableCell></TableRow>}
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
                        manifest.status === "In Transit" ? "bg-yellow-200 text-yellow-800" :
                        manifest.status === "Completed" ? "bg-green-200 text-green-800" : "bg-gray-200 text-gray-800"
                     )}>{manifest.status || "N/A"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="icon" aria-label="Edit Manifest" onClick={() => openEditForm(manifest)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                       <AlertDialog open={isDeleteDialogOpen && manifestToDelete?.id === manifest.id} onOpenChange={(open) => { if(!open) setManifestToDelete(null); setIsDeleteDialogOpen(open);}}>
                         <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="icon" aria-label="Delete Manifest" onClick={() => handleDeleteClick(manifest)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                         </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>This action cannot be undone. This will permanently delete Manifest "{manifestToDelete?.id}".</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {setManifestToDelete(null); setIsDeleteDialogOpen(false);}}>Cancel</AlertDialogCancel>
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
    
