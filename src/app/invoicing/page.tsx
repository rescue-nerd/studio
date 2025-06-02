
"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Printer, Search, Edit, Trash2, CalendarIcon, Loader2 } from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import SmartPartySelectDialog from "@/components/shared/smart-party-select-dialog";
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
  type DocumentData,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import type { 
  Party as FirestoreParty, 
  Truck as FirestoreTruck, 
  Driver as FirestoreDriver,
  Bilti as FirestoreBilti,
  City as FirestoreCity,
  Godown as FirestoreGodown,
  Branch as FirestoreBranch
} from "@/types/firestore";
import { ScrollArea } from "@/components/ui/scroll-area";


// Interfaces (aligning with Firestore types)
export interface Party extends FirestoreParty {} 
export interface Truck extends FirestoreTruck {} 
export interface Driver extends FirestoreDriver {} 
export interface Bilti extends Omit<FirestoreBilti, 'miti' | 'createdAt' | 'updatedAt'> {
  id: string;
  miti: Date; 
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}
export interface City extends FirestoreCity {}
export interface Godown extends FirestoreGodown {}
export interface Branch extends FirestoreBranch {}


const payModes: FirestoreBilti["payMode"][] = ["Paid", "To Pay", "Due"];

const defaultBiltiFormData: Omit<Bilti, 'id' | 'totalAmount' | 'status' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> = {
  miti: new Date(),
  nepaliMiti: "",
  consignorId: "",
  consigneeId: "",
  origin: "",
  destination: "",
  description: "",
  packages: 1,
  weight: 0,
  rate: 0,
  payMode: "To Pay",
  truckId: "", 
  driverId: "",
};

const PLACEHOLDER_USER_ID = "system_user_placeholder";

export default function InvoicingPage() {
  const [biltis, setBiltis] = useState<Bilti[]>([]);
  const [parties, setParties] = useState<Party[]>([]); 
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [branchesForLocations, setBranchesForLocations] = useState<Branch[]>([]);


  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingBilti, setEditingBilti] = useState<Bilti | null>(null);
  const [formData, setFormData] = useState<Omit<Bilti, 'id' | 'totalAmount' | 'status' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>>(defaultBiltiFormData);
  const [totalAmount, setTotalAmount] = useState(0);
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [biltiToDelete, setBiltiToDelete] = useState<Bilti | null>(null);

  const [isConsignorSelectOpen, setIsConsignorSelectOpen] = useState(false);
  const [isConsigneeSelectOpen, setIsConsigneeSelectOpen] = useState(false);

  const [selectedConsignor, setSelectedConsignor] = useState<Party | null>(null);
  const [selectedConsignee, setSelectedConsignee] = useState<Party | null>(null);

  
  const fetchMasterData = async () => {
    setIsLoading(true); // Ensure loading is true at the start
    try {
      const [partiesSnapshot, trucksSnapshot, driversSnapshot, citiesSnapshot, godownsSnapshot, branchesSnapshot] = await Promise.all([
        getDocs(query(collection(db, "parties"), orderBy("name"))),
        getDocs(query(collection(db, "trucks"), orderBy("truckNo"))),
        getDocs(query(collection(db, "drivers"), orderBy("name"))),
        getDocs(query(collection(db, "cities"), orderBy("name"))),
        getDocs(query(collection(db, "godowns"), orderBy("name"))),
        getDocs(query(collection(db, "branches"), orderBy("name")))
      ]);
      setParties(partiesSnapshot.docs.map(doc => ({ ...doc.data() as FirestoreParty, id: doc.id })));
      setTrucks(trucksSnapshot.docs.map(doc => ({ ...doc.data() as FirestoreTruck, id: doc.id })));
      setDrivers(driversSnapshot.docs.map(doc => ({ ...doc.data() as FirestoreDriver, id: doc.id })));
      setCities(citiesSnapshot.docs.map(doc => ({ ...doc.data() as FirestoreCity, id: doc.id })));
      setGodowns(godownsSnapshot.docs.map(doc => ({ ...doc.data() as FirestoreGodown, id: doc.id })));
      setBranchesForLocations(branchesSnapshot.docs.map(doc => ({ ...doc.data() as FirestoreBranch, id: doc.id })));
      
      if (!editingBilti) {
        setFormData(prev => ({
          ...prev,
          truckId: trucksSnapshot.docs.length > 0 ? trucksSnapshot.docs[0].id : "",
          driverId: driversSnapshot.docs.length > 0 ? driversSnapshot.docs[0].id : "",
        }));
      }

    } catch (error) {
      console.error("Error fetching master data: ", error);
      toast({ title: "Error", description: "Failed to load master data.", variant: "destructive" });
    } finally {
      // This will be set after fetchBiltis completes in the main useEffect
    }
  };
  
  const fetchBiltis = async () => {
    // setIsLoading(true); // isLoading is handled by the calling useEffect
    try {
      const biltisCollectionRef = collection(db, "biltis");
      const q = query(biltisCollectionRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedBiltis: Bilti[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data() as FirestoreBilti;
        return {
          ...data,
          id: docSnap.id,
          miti: data.miti.toDate(), 
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        };
      });
      setBiltis(fetchedBiltis);
    } catch (error) {
      console.error("Error fetching biltis: ", error);
      toast({ title: "Error", description: "Failed to fetch Biltis.", variant: "destructive" });
    } finally {
      // setIsLoading(false); // isLoading is handled by the calling useEffect
    }
  };
  
  useEffect(() => {
    const loadAllData = async () => {
        setIsLoading(true);
        await fetchMasterData();
        await fetchBiltis();
        setIsLoading(false);
    }
    loadAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dynamicLocationOptions = useMemo(() => {
    const cityNames = cities.map(c => ({ value: c.name, label: `${c.name} (City)` }));
    const godownNames = godowns.map(g => ({ value: g.name, label: `${g.name} (Godown)` }));
    const branchNames = branchesForLocations.map(b => ({ value: b.name, label: `${b.name} (Branch)` }));

    const allOptions = [...cityNames, ...godownNames, ...branchNames];
    const uniqueValues = new Set<string>();
    const uniqueOptions = allOptions.filter(opt => {
        if (uniqueValues.has(opt.value)) {
            return false;
        }
        uniqueValues.add(opt.value);
        return true;
    });
    
    return uniqueOptions.sort((a, b) => a.label.localeCompare(b.label));
  }, [cities, godowns, branchesForLocations]);


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

  const handleSelectChange = (name: keyof Omit<Bilti, 'id' | 'totalAmount' | 'status' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'miti' >) => (value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => ({ ...prev, miti: date }));
    }
  };

  const openAddForm = () => {
    setEditingBilti(null);
    const defaultTruckId = trucks.length > 0 ? trucks[0].id : "";
    const defaultDriverId = drivers.length > 0 ? drivers[0].id : "";
    setFormData({...defaultBiltiFormData, miti: new Date(), nepaliMiti: "", truckId: defaultTruckId, driverId: defaultDriverId });
    setSelectedConsignor(null);
    setSelectedConsignee(null);
    setTotalAmount(0);
    setIsFormDialogOpen(true);
  };

  const openEditForm = (bilti: Bilti) => {
    setEditingBilti(bilti);
    const { totalAmount, status, consignorId, consigneeId, createdAt, createdBy, updatedAt, updatedBy, ...editableData } = bilti; 
    setFormData({...editableData, consignorId, consigneeId, nepaliMiti: bilti.nepaliMiti || ""}); 
    setSelectedConsignor(parties.find(p => p.id === consignorId) || null);
    setSelectedConsignee(parties.find(p => p.id === consigneeId) || null);
    setTotalAmount(bilti.totalAmount); 
    setIsFormDialogOpen(true);
  };

  const handlePartyAdd = async (newPartyData: Omit<Party, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => {
    setIsSubmitting(true);
    try {
      const partyPayload: Omit<FirestoreParty, 'id'> = {
        ...newPartyData,
        assignedLedgerId: newPartyData.assignedLedgerId || `LEDGER-${newPartyData.panNo?.toUpperCase() || Date.now()}`,
        createdAt: Timestamp.now(),
        createdBy: PLACEHOLDER_USER_ID,
      };
      const docRef = await addDoc(collection(db, "parties"), partyPayload);
      const newParty: Party = { ...partyPayload, id: docRef.id };
      setParties(prev => [...prev, newParty].sort((a,b) => a.name.localeCompare(b.name)));
      toast({ title: "Party Added", description: `${newParty.name} has been added.` });
      return newParty; 
    } catch (error) {
      console.error("Error adding party from dialog: ", error);
      toast({ title: "Error", description: "Failed to add new party.", variant: "destructive" });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleConsignorSelect = (party: Party) => {
    setFormData(prev => ({...prev, consignorId: party.id}));
    setSelectedConsignor(party);
  };
  const handleConsigneeSelect = (party: Party) => {
     setFormData(prev => ({...prev, consigneeId: party.id}));
    setSelectedConsignee(party);
  };


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.consignorId || !formData.consigneeId || !formData.truckId || !formData.driverId || !formData.origin || !formData.destination || !formData.description) {
        toast({
            title: "Missing Fields",
            description: "Consignor, Consignee, Origin, Destination, Description, Truck, and Driver are required.",
            variant: "destructive",
        });
        return;
    }
    setIsSubmitting(true);
    
    const currentTotalAmount = (formData.packages || 0) * (formData.rate || 0);

    const biltiDataPayload: Omit<FirestoreBilti, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'status' > & Partial<Pick<FirestoreBilti, 'status' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>> = {
      ...formData,
      miti: Timestamp.fromDate(formData.miti),
      totalAmount: currentTotalAmount,
    };


    if (editingBilti) {
      try {
        const biltiDocRef = doc(db, "biltis", editingBilti.id);
        await updateDoc(biltiDocRef, {
          ...biltiDataPayload,
          status: editingBilti.status, 
          updatedAt: Timestamp.now(),
          updatedBy: PLACEHOLDER_USER_ID,
        });
        toast({ title: "Bilti Updated", description: `Bilti ${editingBilti.id} updated.`});
      } catch (error) {
        console.error("Error updating bilti: ", error);
        toast({ title: "Error", description: "Failed to update Bilti.", variant: "destructive" });
      }
    } else {
      try {
        await addDoc(collection(db, "biltis"), {
          ...biltiDataPayload,
          status: "Pending" as FirestoreBilti["status"], 
          createdAt: Timestamp.now(),
          createdBy: PLACEHOLDER_USER_ID,
        });
        toast({ title: "Bilti Created", description: `New Bilti created.` });
      } catch (error) {
        console.error("Error adding Bilti: ", error);
        toast({ title: "Error", description: "Failed to create Bilti.", variant: "destructive" });
      }
    }
    setIsSubmitting(false);
    setIsFormDialogOpen(false);
    setEditingBilti(null);
    setSelectedConsignor(null);
    setSelectedConsignee(null);
    fetchBiltis(); 
  };
  
  const getPartyName = (partyId: string) => parties.find(p => p.id === partyId)?.name || "N/A";
  const getTruckNo = (truckId: string) => trucks.find(t => t.id === truckId)?.truckNo || "N/A";
  const getDriverName = (driverId: string) => drivers.find(d => d.id === driverId)?.name || "N/A";

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

  const confirmDelete = async () => {
    if (biltiToDelete) {
      setIsSubmitting(true);
      try {
        await deleteDoc(doc(db, "biltis", biltiToDelete.id));
        toast({ title: "Bilti Deleted", description: `Bilti ${biltiToDelete.id} deleted.` });
        fetchBiltis();
      } catch (error) {
         console.error("Error deleting Bilti: ", error);
        toast({ title: "Error", description: "Failed to delete Bilti.", variant: "destructive" });
      } finally {
        setIsSubmitting(false);
      }
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
            <Button onClick={openAddForm} disabled={isSubmitting || isLoading || parties.length === 0 || trucks.length === 0 || drivers.length === 0}>
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
             <ScrollArea className="max-h-[70vh] p-1">
              <div className="grid gap-4 py-4">
                <div className="grid md:grid-cols-3 items-center gap-4">
                  <div className="md:col-span-1">
                    <Label htmlFor="biltiNo" className="text-right">Bilti No.</Label>
                    <Input id="biltiNo" value={editingBilti ? editingBilti.id : "Auto-Generated by Firestore"} readOnly className="bg-muted" />
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
                    <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setIsConsignorSelectOpen(true)} disabled={parties.length === 0 || isLoading}>
                        {selectedConsignor ? selectedConsignor.name : (parties.length === 0 && !isLoading ? "No Parties Available" : (isLoading ? "Loading parties..." : "Select Consignor"))}
                    </Button>
                     <Input type="hidden" value={formData.consignorId} />
                  </div>
                  <div>
                    <Label htmlFor="consigneeId">Consignee</Label>
                     <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setIsConsigneeSelectOpen(true)} disabled={parties.length === 0 || isLoading}>
                        {selectedConsignee ? selectedConsignee.name : (parties.length === 0 && !isLoading ? "No Parties Available" : (isLoading ? "Loading parties..." : "Select Consignee"))}
                    </Button>
                    <Input type="hidden" value={formData.consigneeId} />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="origin">Origin</Label>
                    <Select value={formData.origin} onValueChange={handleSelectChange('origin')} required disabled={dynamicLocationOptions.length === 0 || isLoading}>
                      <SelectTrigger id="origin">
                        <SelectValue placeholder={isLoading ? "Loading locations..." : (dynamicLocationOptions.length === 0 ? "No locations" : "Select Origin Location")} />
                      </SelectTrigger>
                      <SelectContent>
                        {dynamicLocationOptions.map(loc => <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="destination">Destination</Label>
                     <Select value={formData.destination} onValueChange={handleSelectChange('destination')} required disabled={dynamicLocationOptions.length === 0 || isLoading}>
                      <SelectTrigger id="destination">
                         <SelectValue placeholder={isLoading ? "Loading locations..." : (dynamicLocationOptions.length === 0 ? "No locations" : "Select Destination Location")} />
                      </SelectTrigger>
                      <SelectContent>
                        {dynamicLocationOptions.map(loc => <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>)}
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
                    <Select value={formData.payMode} onValueChange={handleSelectChange('payMode') as (value: FirestoreBilti["payMode"])=>void} required>
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
                    <Select value={formData.truckId} onValueChange={handleSelectChange('truckId')} required disabled={trucks.length === 0 || isLoading}>
                      <SelectTrigger><SelectValue placeholder={isLoading ? "Loading trucks..." : (trucks.length === 0 ? "No trucks" : "Select Truck")} /></SelectTrigger>
                      <SelectContent>
                        {trucks.map(t => <SelectItem key={t.id} value={t.id}>{t.truckNo}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="driverId">Driver</Label>
                    <Select value={formData.driverId} onValueChange={handleSelectChange('driverId')} required disabled={drivers.length === 0 || isLoading}>
                      <SelectTrigger><SelectValue placeholder={isLoading ? "Loading drivers..." : (drivers.length === 0 ? "No drivers" : "Select Driver")} /></SelectTrigger>
                      <SelectContent>
                        {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              </ScrollArea>
              <DialogFooter className="pt-4 border-t mt-2">
                <DialogClose asChild>
                   <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting || isLoading || parties.length === 0 || trucks.length === 0 || drivers.length === 0 || dynamicLocationOptions.length === 0}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingBilti ? "Update Bilti" : "Save Bilti"}
                </Button>
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
              placeholder="Search Biltis (ID, Consignor, Consignee, Destination, BS Date)..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
         {isLoading ? (
            <div className="flex justify-center items-center h-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading biltis...</p></div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bilti No. (ID)</TableHead>
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
              {filteredBiltis.length === 0 && !isLoading && (
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
                        bilti.status === "Received" ? "bg-orange-200 text-orange-800" :
                        bilti.status === "Delivered" ? "bg-green-200 text-green-800" :
                        bilti.status === "Cancelled" ? "bg-red-200 text-red-800" : 
                        "bg-gray-200 text-gray-800"
                     )}>
                        {bilti.status || "N/A"}
                     </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="icon" aria-label="Print Bilti" onClick={() => alert(`Print Bilti ${bilti.id} (not implemented)`)} disabled={isSubmitting}>
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" aria-label="Edit Bilti" onClick={() => openEditForm(bilti)} disabled={isSubmitting}>
                        <Edit className="h-4 w-4" />
                      </Button>
                       <AlertDialog open={isDeleteDialogOpen && biltiToDelete?.id === bilti.id} onOpenChange={(open) => { if(!open) setBiltiToDelete(null); setIsDeleteDialogOpen(open);}}>
                         <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="icon" aria-label="Delete Bilti" onClick={() => handleDeleteClick(bilti)} disabled={isSubmitting}>
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
                            <AlertDialogCancel onClick={() => {setBiltiToDelete(null); setIsDeleteDialogOpen(false);}} disabled={isSubmitting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting}>
                                {isSubmitting && isDeleteDialogOpen && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
        <CardFooter>
            <p className="text-xs text-muted-foreground">
                Origin/Destination now dynamically populated. Ledger updates (simulated) would occur server-side upon these operations in a full system.
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
    

    