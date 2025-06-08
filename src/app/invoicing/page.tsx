"use client";

import SmartPartySelectDialog from "@/components/shared/smart-party-select-dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/supabase-db";
import { handleSupabaseError, logError } from "@/lib/supabase-error-handler";
import { cn } from "@/lib/utils";
import type {
    Bilti as FirestoreBilti,
    Branch as FirestoreBranch,
    City as FirestoreCity,
    Driver as FirestoreDriver,
    Godown as FirestoreGodown,
    Party as FirestoreParty,
    Truck as FirestoreTruck
} from "@/types/firestore";
import { format } from "date-fns";
import { CalendarIcon, Edit, Loader2, PlusCircle, Printer, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

// Interfaces (aligning with Firestore types)
export interface Party extends FirestoreParty {} 
export interface Truck extends FirestoreTruck {} 
export interface Driver extends FirestoreDriver {} 
export interface Bilti extends Omit<FirestoreBilti, 'miti' | 'createdAt' | 'updatedAt'> {
  id: string;
  miti: Date; 
  createdAt?: Date;
  updatedAt?: Date;
}
export interface City extends FirestoreCity {}
export interface Godown extends FirestoreGodown {}
export interface Branch extends FirestoreBranch {}

const payModes: FirestoreBilti["payMode"][] = ["Paid", "To Pay", "Due"];

// Type for data passed to createBilti/updateBilti Cloud Functions
type BiltiCallableData = Omit<FirestoreBilti, 'id' | 'miti' | 'totalAmount' | 'status' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'ledgerProcessed'> & { miti: string };

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

const createBiltiFn = async (data: BiltiCallableData) => {
  const response = await supabase.functions.invoke('create-bilti', {
    body: data
  });
  return response.data as {success: boolean, id: string, message: string};
};

const updateBiltiFn = async (data: {biltiId: string} & Partial<BiltiCallableData>) => {
  const response = await supabase.functions.invoke('update-bilti', {
    body: data
  });
  return response.data as {success: boolean, id: string, message: string};
};

const deleteBiltiFn = async (data: {biltiId: string}) => {
  const response = await supabase.functions.invoke('delete-bilti', {
    body: data
  });
  return response.data as {success: boolean, id: string, message: string};
};

export default function InvoicingPage() {
  const [biltis, setBiltis] = useState<Bilti[]>([]);
  const [parties, setParties] = useState<Party[]>([]); 
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [branchesForLocations, setBranchesForLocations] = useState<Branch[]>([]);

  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingBilti, setEditingBilti] = useState<Bilti | null>(null);
  const [formData, setFormData] = useState<Omit<Bilti, 'id' | 'totalAmount' | 'status' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>>(defaultBiltiFormData);
  const [totalAmount, setTotalAmount] = useState(0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [biltiToDelete, setBiltiToDelete] = useState<Bilti | null>(null);

  const [isConsignorSelectOpen, setIsConsignorSelectOpen] = useState(false);
  const [isConsigneeSelectOpen, setIsConsigneeSelectOpen] = useState(false);

  const [selectedConsignor, setSelectedConsignor] = useState<Party | null>(null);
  const [selectedConsignee, setSelectedConsignee] = useState<Party | null>(null);

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authUser, authLoading, router]);

  const fetchMasterData = async () => {
    if (!authUser) return;
    try {
      const [
        { data: partiesData, error: partiesError },
        { data: trucksData, error: trucksError },
        { data: driversData, error: driversError },
        { data: citiesData, error: citiesError },
        { data: godownsData, error: godownsError },
        { data: branchesData, error: branchesError }
      ] = await Promise.all([
        supabase.from('parties').select('*').order('name'),
        supabase.from('trucks').select('*').order('truckNo'),
        supabase.from('drivers').select('*').order('name'),
        supabase.from('cities').select('*').order('name'),
        supabase.from('godowns').select('*').order('name'),
        supabase.from('branches').select('*').order('name')
      ]);

      if (partiesError) throw partiesError;
      if (trucksError) throw trucksError;
      if (driversError) throw driversError;
      if (citiesError) throw citiesError;
      if (godownsError) throw godownsError;
      if (branchesError) throw branchesError;

      setParties(partiesData);
      setTrucks(trucksData);
      setDrivers(driversData);
      setCities(citiesData);
      setGodowns(godownsData);
      setBranchesForLocations(branchesData);
      
      if (!editingBilti) {
        setFormData(prev => ({
          ...prev,
          truckId: trucksData.length > 0 ? trucksData[0].id : "",
          driverId: driversData.length > 0 ? driversData[0].id : "",
        }));
      }
    } catch (error) {
      logError(error, "Error fetching master data");
      handleSupabaseError(error, toast);
    }
  };
  
  const fetchBiltis = async () => {
    if (!authUser) return;
    try {
      const { data, error } = await supabase
        .from('biltis')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const fetchedBiltis: Bilti[] = data.map(bilti => ({
        ...bilti,
        miti: new Date(bilti.miti),
        createdAt: bilti.created_at ? new Date(bilti.created_at) : undefined,
        updatedAt: bilti.updated_at ? new Date(bilti.updated_at) : undefined,
      }));

      setBiltis(fetchedBiltis);
    } catch (error) {
      logError(error, "Error fetching biltis");
      handleSupabaseError(error, toast);
    }
  };
  
  useEffect(() => {
    if (authUser) {
      const loadAllData = async () => {
        setIsLoading(true);
        await fetchMasterData();
        await fetchBiltis();
        setIsLoading(false);
      }
      loadAllData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

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
    // Make sure to destructure only known fields from Bilti to avoid passing unknown props to formData
    const { id, totalAmount: biltiTotalAmount, status, createdAt, createdBy, updatedAt, updatedBy, ...editableData } = bilti; 
    setFormData({
      ...editableData, 
      nepaliMiti: bilti.nepaliMiti || ""
    }); 
    setSelectedConsignor(parties.find(p => p.id === bilti.consignorId) || null);
    setSelectedConsignee(parties.find(p => p.id === bilti.consigneeId) || null);
    setTotalAmount(biltiTotalAmount); 
    setIsFormDialogOpen(true);
  };

  const handlePartyAdd = async (newPartyData: Omit<Party, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => {
    if (!authUser) return null;
    setIsSubmitting(true); // Potentially use a different loading state for this sub-action
    try {
      const partyPayload: Omit<FirestoreParty, 'id'> & {createdBy: string, createdAt: Timestamp} = { // ensure audit fields
        ...newPartyData,
        assignedLedgerId: newPartyData.assignedLedgerId || `LEDGER-${newPartyData.panNo?.toUpperCase() || Date.now()}`,
        createdAt: Timestamp.now(),
        createdBy: authUser.uid,
      };
      const docRef = await addDoc(collection(db, "parties"), partyPayload);
      const newParty: Party = { ...partyPayload, id: docRef.id, createdAt: partyPayload.createdAt.toDate() };
      setParties(prev => [...prev, newParty].sort((a,b) => a.name.localeCompare(b.name)));
      toast({ title: "Party Added", description: `${newParty.name} has been added.` });
      return newParty; 
    } catch (error) {
      console.error("Error adding party from dialog: ", error);
      toast({ title: "Error", description: "Failed to add new party.", variant: "destructive" });
      return null;
    } finally {
      setIsSubmitting(false); // Reset general submitting state or specific one
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
    if (!authUser) {
        toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive"});
        return;
    }
    if (!formData.consignorId || !formData.consigneeId || !formData.truckId || !formData.driverId || !formData.origin || !formData.destination || !formData.description) {
        toast({
            title: "Missing Fields",
            description: "Consignor, Consignee, Origin, Destination, Description, Truck, and Driver are required.",
            variant: "destructive",
        });
        return;
    }
    setIsSubmitting(true);
    
    // Prepare payload for the backend function
    const { miti, ...restOfFormData } = formData;
    const biltiDataPayload: BiltiCallableData = {
      ...restOfFormData,
      miti: miti.toISOString(), // Send date as ISO string
      // totalAmount will be calculated by the backend function
      // status will be set by the backend function on creation
    };

    try {
      let result: {success: boolean; id: string; message: string};
      if (editingBilti) {
        result = await updateBiltiFn({ biltiId: editingBilti.id, ...biltiDataPayload });
      } else {
        result = await createBiltiFn(biltiDataPayload);
      }

      if (result.success) {
        toast({ title: "Success", description: result.message });
        fetchBiltis(); // Refresh list
        setIsFormDialogOpen(false);
        setEditingBilti(null);
        setSelectedConsignor(null);
        setSelectedConsignee(null);
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
        console.error("Error saving Bilti:", error);
        const errorMessage = error.message || (editingBilti ? "Failed to update Bilti." : "Failed to create Bilti.");
        toast({ title: "Operation Failed", description: errorMessage, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
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
      setIsSubmitting(true); // Use general isSubmitting for delete as well
      try {
        const result = await deleteBiltiFn({ biltiId: biltiToDelete.id });
        if (result.success) {
            toast({ title: "Bilti Deleted", description: result.message });
            fetchBiltis(); // Refresh list
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
      } catch (error: any) {
         console.error("Error deleting Bilti: ", error);
        toast({ title: "Deletion Failed", description: error.message || "Failed to delete Bilti.", variant: "destructive" });
      } finally {
        setIsSubmitting(false);
        setIsDeleteDialogOpen(false);
        setBiltiToDelete(null);
      }
    }
  };
  
  if (authLoading || (!authUser && !authLoading && !isLoading)) { // Ensure isLoading check too if it covers master data
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">{authLoading ? "Authenticating..." : "Redirecting to login..."}</p>
      </div>
    );
  }

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
                        bilti.status === "Paid" ? "bg-accent text-accent-foreground" : // Added Paid status styling
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
                      <Button variant="outline" size="icon" aria-label="Edit Bilti" onClick={() => openEditForm(bilti)} disabled={isSubmitting || bilti.status !== 'Pending'}>
                        <Edit className="h-4 w-4" />
                      </Button>
                       <AlertDialog open={isDeleteDialogOpen && biltiToDelete?.id === bilti.id} onOpenChange={(open) => { if(!open) setBiltiToDelete(null); setIsDeleteDialogOpen(open);}}>
                         <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="icon" aria-label="Delete Bilti" onClick={() => handleDeleteClick(bilti)} disabled={isSubmitting || bilti.status !== 'Pending'}>
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
                Bilti CRUD operations are now handled by backend functions. Ledger posting upon creation is handled by a separate Firestore trigger.
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
    

    

