
"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Printer, Search, Edit, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import SmartPartySelectDialog from "@/components/shared/smart-party-select-dialog";


// Interfaces
export interface Party {
  id: string;
  name: string;
  type: "Consignor" | "Consignee" | "Both";
  contactNo: string;
  panNo?: string;
  address?: string;
  assignedLedger: string; // Crucial for ledger linking
  status: "Active" | "Inactive";
}
interface Truck {
  id: string;
  truckNo: string;
  assignedLedger: string; // Crucial for ledger linking
}
interface Driver {
  id: string;
  name: string;
  assignedLedger: string; // Crucial for ledger linking
}
export interface Bilti {
  id: string; 
  miti: Date;
  nepaliMiti?: string; // Added for Bikram Sambat date
  consignorId: string;
  consigneeId: string;
  origin: string;
  destination: string;
  description: string;
  packages: number;
  weight?: number; 
  rate: number;
  totalAmount: number;
  payMode: "Paid" | "To Pay" | "Due";
  truckId: string;
  driverId: string;
  status?: string; 
}

// Mock data for master lists
const initialMockParties: Party[] = [
  { id: "PTY001", name: "Global Traders (KTM)", type: "Both", contactNo: "9800000001", panNo: "PAN123KTM", address: "Kathmandu", assignedLedger: "LEDGER-PTY001", status: "Active" },
  { id: "PTY002", name: "National Distributors (PKR)", type: "Both", contactNo: "9800000002", panNo: "PAN456PKR", address: "Pokhara", assignedLedger: "LEDGER-PTY002", status: "Active" },
  { id: "PTY003", name: "Himalayan Goods Co. (BRT)", type: "Both", contactNo: "9800000003", panNo: "PAN789BRT", address: "Biratnagar", assignedLedger: "LEDGER-PTY003", status: "Inactive" },
];
const mockTrucks: Truck[] = [
  { id: "TRK001", truckNo: "BA 1 KA 1234", assignedLedger: "LEDGER-TRK001" },
  { id: "TRK002", truckNo: "NA 5 KHA 5678", assignedLedger: "LEDGER-TRK002" },
];
const mockDrivers: Driver[] = [
  { id: "DRV001", name: "Suresh Kumar", assignedLedger: "LEDGER-DRV001" },
  { id: "DRV002", name: "Bimala Rai", assignedLedger: "LEDGER-DRV002" },
];

const mockMasterBranches: Array<{ id: string; name: string }> = [
  { id: "BRN001", name: "Kathmandu Main Branch" },
  { id: "BRN002", name: "Pokhara Hub" },
  { id: "BRN003", name: "Biratnagar Depot" },
  { id: "BRN004", name: "Butwal Office" },
];

const mockMasterCities: Array<{ id: string; name: string; stateId: string }> = [
  { id: "CT001", name: "Kathmandu City", stateId: "S001" },
  { id: "CT002", name: "Pokhara City", stateId: "S002" },
  { id: "CT003", name: "Lucknow", stateId: "S003" },
  { id: "CT004", name: "Birgunj", stateId: "S001" },
  { id: "CT005", name: "Nepalgunj", stateId: "S001" },
];

const locationOptions = Array.from(
  new Set([
    ...mockMasterBranches.map((b) => b.name),
    ...mockMasterCities.map((c) => c.name),
  ])
).sort().map(loc => ({ value: loc, label: loc }));


const payModes: Bilti["payMode"][] = ["Paid", "To Pay", "Due"];

const defaultBiltiFormData: Omit<Bilti, 'id' | 'totalAmount' | 'status'> = {
  miti: new Date(),
  nepaliMiti: "",
  consignorId: "",
  consigneeId: "",
  origin: locationOptions[0]?.value || "",
  destination: locationOptions[1]?.value || "",
  description: "",
  packages: 1,
  weight: 0,
  rate: 0,
  payMode: "To Pay",
  truckId: mockTrucks[0]?.id || "",
  driverId: mockDrivers[0]?.id || "",
};

export default function InvoicingPage() {
  const [biltis, setBiltis] = useState<Bilti[]>([]);
  const [parties, setParties] = useState<Party[]>(initialMockParties); 
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingBilti, setEditingBilti] = useState<Bilti | null>(null);
  const [formData, setFormData] = useState<Omit<Bilti, 'id' | 'totalAmount' | 'status'>>(defaultBiltiFormData);
  const [totalAmount, setTotalAmount] = useState(0);
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [biltiToDelete, setBiltiToDelete] = useState<Bilti | null>(null);

  const [isConsignorSelectOpen, setIsConsignorSelectOpen] = useState(false);
  const [isConsigneeSelectOpen, setIsConsigneeSelectOpen] = useState(false);

  const [selectedConsignor, setSelectedConsignor] = useState<Party | null>(null);
  const [selectedConsignee, setSelectedConsignee] = useState<Party | null>(null);


  useEffect(() => {
    const calculatedTotal = (formData.packages || 0) * (formData.rate || 0);
    setTotalAmount(calculatedTotal);
  }, [formData.packages, formData.rate]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let parsedValue: string | number = value;
    if (name === "packages" || name === "weight" || name === "rate") {
      parsedValue = value === "" ? 0 : parseFloat(value);
      if (isNaN(parsedValue as number) || parsedValue < 0) parsedValue = 0;
    }
    setFormData((prev) => ({ ...prev, [name]: parsedValue }));
  };

  const handleSelectChange = (name: keyof Omit<Bilti, 'id' | 'totalAmount' | 'status'>) => (value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => ({ ...prev, miti: date }));
    }
  };

  const generateBiltiNo = (): string => {
    const nextId = biltis.length + 1 + Math.floor(Math.random() * 100);
    return `BLT-${String(nextId).padStart(3, '0')}`;
  };

  const openAddForm = () => {
    setEditingBilti(null);
    setFormData({...defaultBiltiFormData, miti: new Date(), nepaliMiti: "" });
    setSelectedConsignor(null);
    setSelectedConsignee(null);
    setTotalAmount(0);
    setIsFormDialogOpen(true);
  };

  const openEditForm = (bilti: Bilti) => {
    setEditingBilti(bilti);
    const { totalAmount, status, consignorId, consigneeId, ...editableData } = bilti; // Exclude totalAmount and status
    setFormData({...editableData, consignorId, consigneeId, nepaliMiti: bilti.nepaliMiti || ""}); 
    setSelectedConsignor(parties.find(p => p.id === consignorId) || null);
    setSelectedConsignee(parties.find(p => p.id === consigneeId) || null);
    setTotalAmount(bilti.totalAmount); 
    setIsFormDialogOpen(true);
  };

  const handlePartyAdd = (newParty: Party) => {
    setParties(prevParties => [...prevParties, newParty]);
     toast({ title: "Party Added", description: `${newParty.name} has been added to master records. Ledger: ${newParty.assignedLedger}` });
  };

  const handleConsignorSelect = (party: Party) => {
    setFormData(prev => ({...prev, consignorId: party.id}));
    setSelectedConsignor(party);
  };
  const handleConsigneeSelect = (party: Party) => {
     setFormData(prev => ({...prev, consigneeId: party.id}));
    setSelectedConsignee(party);
  };


  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.consignorId || !formData.consigneeId || !formData.truckId || !formData.driverId || !formData.origin || !formData.destination || !formData.description) {
        toast({
            title: "Missing Fields",
            description: "Please fill all required fields for the Bilti (Consignor, Consignee, Origin, Destination, Description, Truck, Driver).",
            variant: "destructive",
        });
        return;
    }
    
    const currentTotalAmount = (formData.packages || 0) * (formData.rate || 0);

    if (editingBilti) {
      const updatedBilti: Bilti = {
        ...formData,
        id: editingBilti.id,
        totalAmount: currentTotalAmount,
        status: editingBilti.status, 
        nepaliMiti: formData.nepaliMiti,
      };
      setBiltis(biltis.map(b => b.id === editingBilti.id ? updatedBilti : b));
      toast({ 
        title: "Bilti Updated", 
        description: `Bilti ${updatedBilti.id} updated. Ledger entries (simulated) adjusted for Party, Truck, and Driver.` 
      });
    } else {
      const newBilti: Bilti = {
        ...formData,
        id: generateBiltiNo(),
        totalAmount: currentTotalAmount,
        status: "Pending", 
        nepaliMiti: formData.nepaliMiti,
      };
      setBiltis(prevBiltis => [...prevBiltis, newBilti]);
      toast({ 
        title: "Bilti Created", 
        description: `Bilti ${newBilti.id} created. Ledger entries (simulated) posted for Party, Truck, and Driver.` 
      });
    }
    setIsFormDialogOpen(false);
    setEditingBilti(null);
    setSelectedConsignor(null);
    setSelectedConsignee(null);
  };
  
  const getPartyName = (partyId: string) => parties.find(p => p.id === partyId)?.name || "N/A";
  const getTruckNo = (truckId: string) => mockTrucks.find(t => t.id === truckId)?.truckNo || "N/A";
  const getDriverName = (driverId: string) => mockDrivers.find(d => d.id === driverId)?.name || "N/A";

  const filteredBiltis = biltis.filter(bilti => 
    bilti.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getPartyName(bilti.consignorId).toLowerCase().includes(searchTerm.toLowerCase()) ||
    getPartyName(bilti.consigneeId).toLowerCase().includes(searchTerm.toLowerCase()) ||
    bilti.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (bilti.nepaliMiti && bilti.nepaliMiti.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDeleteClick = (bilti: Bilti) => {
    setBiltiToDelete(bilti);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (biltiToDelete) {
      setBiltis(biltis.filter((b) => b.id !== biltiToDelete.id));
      toast({ 
        title: "Bilti Deleted", 
        description: `Bilti ${biltiToDelete.id} deleted. Corresponding ledger entries (simulated) reversed for Party, Truck, and Driver.` 
      });
    }
    setIsDeleteDialogOpen(false);
    setBiltiToDelete(null);
  };

  return (
    <div className="space-y-6">
      <SmartPartySelectDialog 
        isOpen={isConsignorSelectOpen}
        onOpenChange={setIsConsignorSelectOpen}
        parties={parties}
        onPartySelect={handleConsignorSelect}
        onPartyAdd={handlePartyAdd}
        dialogTitle="Select Consignor"
      />
      <SmartPartySelectDialog 
        isOpen={isConsigneeSelectOpen}
        onOpenChange={setIsConsigneeSelectOpen}
        parties={parties}
        onPartySelect={handleConsigneeSelect}
        onPartyAdd={handlePartyAdd}
        dialogTitle="Select Consignee"
      />

      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground">Bilti / Invoicing</h1>
          <p className="text-muted-foreground">Create and manage shipment billing entries (Biltis/Invoices).</p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => {
            setIsFormDialogOpen(isOpen);
            if (!isOpen) {
                setEditingBilti(null); 
                setSelectedConsignor(null);
                setSelectedConsignee(null);
            }
        }}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm}>
              <PlusCircle className="mr-2 h-4 w-4" /> New Bilti / Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingBilti ? "Edit Bilti" : "Create New Bilti / Invoice"}</DialogTitle>
              <DialogDescription>
                {editingBilti ? "Update the details for this Bilti." : "Fill in the details to create a new shipment invoice."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto p-2">
                <div className="grid md:grid-cols-3 items-center gap-4">
                  <div className="md:col-span-1">
                    <Label htmlFor="biltiNo" className="text-right">Bilti No.</Label>
                    <Input id="biltiNo" value={editingBilti ? editingBilti.id : "Auto-Generated"} readOnly className="bg-muted" />
                  </div>
                  <div className="md:col-span-1">
                    <Label htmlFor="miti">Miti (AD)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn("w-full justify-start text-left font-normal", !formData.miti && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.miti ? format(formData.miti, "PPP") : <span>Pick AD date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={formData.miti} onSelect={handleDateChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="md:col-span-1">
                    <Label htmlFor="nepaliMiti">Nepali Miti (BS)</Label>
                    <Input id="nepaliMiti" name="nepaliMiti" value={formData.nepaliMiti || ""} onChange={handleInputChange} placeholder="e.g., 2081-04-01" />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="consignorId">Consignor</Label>
                    <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setIsConsignorSelectOpen(true)}>
                        {selectedConsignor ? selectedConsignor.name : "Select Consignor"}
                    </Button>
                     <Input type="hidden" value={formData.consignorId} />
                  </div>
                  <div>
                    <Label htmlFor="consigneeId">Consignee</Label>
                     <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setIsConsigneeSelectOpen(true)}>
                        {selectedConsignee ? selectedConsignee.name : "Select Consignee"}
                    </Button>
                    <Input type="hidden" value={formData.consigneeId} />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="origin">Origin</Label>
                    <Select value={formData.origin} onValueChange={handleSelectChange('origin')} required>
                      <SelectTrigger id="origin">
                        <SelectValue placeholder="Select Origin Location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locationOptions.map(loc => <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="destination">Destination</Label>
                     <Select value={formData.destination} onValueChange={handleSelectChange('destination')} required>
                      <SelectTrigger id="destination">
                        <SelectValue placeholder="Select Destination Location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locationOptions.map(loc => <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                    <Label htmlFor="description">Shipment Description</Label>
                    <Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} placeholder="e.g., Electronics, Garments" required rows={3}/>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                    <div>
                        <Label htmlFor="packages">No. of Packages</Label>
                        <Input id="packages" name="packages" type="number" value={formData.packages} onChange={handleInputChange} min="1" required/>
                    </div>
                    <div>
                        <Label htmlFor="weight">Weight (kg, optional)</Label>
                        <Input id="weight" name="weight" type="number" value={formData.weight || ""} onChange={handleInputChange} placeholder="e.g., 500"/>
                    </div>
                    <div>
                        <Label htmlFor="rate">Rate (per package/unit)</Label>
                        <Input id="rate" name="rate" type="number" value={formData.rate} onChange={handleInputChange} min="0" required/>
                    </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4 items-center">
                  <div>
                      <Label htmlFor="totalAmountDisplay">Total Amount</Label>
                      <Input id="totalAmountDisplay" value={totalAmount.toFixed(2)} readOnly className="font-bold text-lg bg-muted" />
                  </div>
                   <div>
                    <Label htmlFor="payMode">Pay Mode</Label>
                    <Select value={formData.payMode} onValueChange={handleSelectChange('payMode') as (value: Bilti["payMode"])=>void} required>
                      <SelectTrigger><SelectValue placeholder="Select Pay Mode" /></SelectTrigger>
                      <SelectContent>
                        {payModes.map(mode => <SelectItem key={mode} value={mode}>{mode}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="truckId">Truck</Label>
                    <Select value={formData.truckId} onValueChange={handleSelectChange('truckId')} required>
                      <SelectTrigger><SelectValue placeholder="Select Truck" /></SelectTrigger>
                      <SelectContent>
                        {mockTrucks.map(t => <SelectItem key={t.id} value={t.id}>{t.truckNo}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="driverId">Driver</Label>
                    <Select value={formData.driverId} onValueChange={handleSelectChange('driverId')} required>
                      <SelectTrigger><SelectValue placeholder="Select Driver" /></SelectTrigger>
                      <SelectContent>
                        {mockDrivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter className="pt-4 border-t mt-2">
                <DialogClose asChild>
                   <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit">{editingBilti ? "Update Bilti" : "Save Bilti"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Bilti / Invoice List</CardTitle>
          <CardDescription>View and manage all your Biltis.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search Biltis (No, Consignor, Consignee, Destination, BS Date)..."
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
                <TableHead>Bilti No.</TableHead>
                <TableHead>Miti (AD)</TableHead>
                <TableHead>Miti (BS)</TableHead>
                <TableHead>Consignor</TableHead>
                <TableHead>Consignee</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Total Amt.</TableHead>
                <TableHead>Pay Mode</TableHead>
                <TableHead>Truck</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBiltis.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center h-24">No Biltis found. Create one to get started!</TableCell>
                </TableRow>
              )}
              {filteredBiltis.map((bilti) => (
                <TableRow key={bilti.id}>
                  <TableCell className="font-medium">{bilti.id}</TableCell>
                  <TableCell>{format(bilti.miti, "PP")}</TableCell>
                  <TableCell>{bilti.nepaliMiti || "N/A"}</TableCell>
                  <TableCell>{getPartyName(bilti.consignorId)}</TableCell>
                  <TableCell>{getPartyName(bilti.consigneeId)}</TableCell>
                  <TableCell>{bilti.destination}</TableCell>
                  <TableCell>{bilti.totalAmount.toFixed(2)}</TableCell>
                  <TableCell>{bilti.payMode}</TableCell>
                  <TableCell>{getTruckNo(bilti.truckId)}</TableCell>
                  <TableCell>
                     <span className={cn("px-2 py-1 text-xs rounded-full", 
                        bilti.status === "Pending" ? "bg-yellow-200 text-yellow-800" : 
                        bilti.status === "Manifested" ? "bg-blue-200 text-blue-800" :
                        bilti.status === "Delivered" ? "bg-green-200 text-green-800" : "bg-gray-200 text-gray-800"
                     )}>
                        {bilti.status || "N/A"}
                     </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="icon" aria-label="Print Bilti" onClick={() => alert(`Print Bilti ${bilti.id} (not implemented)`)}>
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" aria-label="Edit Bilti" onClick={() => openEditForm(bilti)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                       <AlertDialog open={isDeleteDialogOpen && biltiToDelete?.id === bilti.id} onOpenChange={(open) => { if(!open) setBiltiToDelete(null); setIsDeleteDialogOpen(open);}}>
                         <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="icon" aria-label="Delete Bilti" onClick={() => handleDeleteClick(bilti)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                         </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete Bilti "{biltiToDelete?.id}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {setBiltiToDelete(null); setIsDeleteDialogOpen(false);}}>Cancel</AlertDialogCancel>
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
        <CardFooter>
            <p className="text-xs text-muted-foreground">
                Ledger updates for parties, trucks, and drivers are automatically (simulated as) posted upon Bilti creation, modification, or deletion.
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}

    
