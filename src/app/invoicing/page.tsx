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
import { Badge, badgeVariants } from "@/components/ui/badge"; // Modified import
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase"; // Direct client, consider if db wrapper is better for consistency
import { db } from "@/lib/supabase-db"; // db wrapper
import { handleSupabaseError, logError } from "@/lib/supabase-error-handler";
import { cn } from "@/lib/utils";
// Import canonical types
import type {
    Bilti as CanonicalBilti,
    Branch as CanonicalBranch // For branchId in Bilti and for location options if branches are locations
    ,
    Driver as CanonicalDriver,
    Location as CanonicalLocation,
    Party as CanonicalParty,
    Truck as CanonicalTruck,
    Unit as CanonicalUnit
} from "@/types/database";
import { type VariantProps } from "class-variance-authority"; // Added import
import { format, parseISO } from "date-fns";
import { CalendarIcon, Edit, Loader2, PlusCircle, Printer, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

// Use canonical types directly
type Bilti = CanonicalBilti;
type Party = CanonicalParty;
type Truck = CanonicalTruck;
type Driver = CanonicalDriver;
type Location = CanonicalLocation;
type Unit = CanonicalUnit;
type Branch = CanonicalBranch;


// Type for data passed to createBilti/updateBilti Cloud Functions
// This should align with the canonical Bilti structure or what the backend function expects.
// Assuming backend functions now expect fields from CanonicalBilti.
type BiltiFunctionPayload = Omit<CanonicalBilti, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber'> & { documentNumber?: string }; // doc num might be backend generated

// Form data type, derived from CanonicalBilti
// Exclude fields that are auto-generated or managed differently in the form
type BiltiFormData = Omit<CanonicalBilti, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber' | 'amount'> & {
    nepaliMiti?: string; // Keep for UI if needed, not in canonical Bilti for DB
    // 'amount' will be calculated and then set before submitting, or handled by backend.
};

const defaultBiltiFormData: BiltiFormData = {
  branchId: "", // Needs a default or to be set from user context
  date: new Date().toISOString(), // Store as ISO string
  consignorId: "",
  consigneeId: "",
  fromLocationId: "",
  toLocationId: "",
  goodsDescription: "",
  quantity: 0,
  unitId: "", // Needs a default or selection
  rate: 0,
  status: "draft", // Default status
  nepaliMiti: "", 
  // truckId was removed as it's not part of canonical Bilti
};

// Helper function to map Bilti status to Badge variant
const getBiltiStatusVariant = (status: Bilti['status']): VariantProps<typeof badgeVariants>['variant'] => {
  switch (status) {
    case 'draft':
      return 'secondary';
    case 'issued':
      return 'default'; 
    case 'manifested':
      return 'outline'; 
    case 'delivered':
      return 'default'; 
    case 'cancelled':
      return 'destructive';
    default:
      return 'secondary';
  }
};


// Update Supabase function names if they changed, e.g. to use 'canonical-bilti'
const createBiltiFn = async (data: BiltiFunctionPayload) => {
  const response = await supabase.functions.invoke('create-bilti', { body: data });
  // Ensure response structure matches what the actual function returns
  return response.data as {success: boolean, data: CanonicalBilti, message: string} | {success: boolean, id?: string, message: string, error?:any};
};

const updateBiltiFn = async (biltiId: string, data: Partial<BiltiFunctionPayload>) => {
  const response = await supabase.functions.invoke('update-bilti', { body: { biltiId, ...data } });
  return response.data as {success: boolean, data: CanonicalBilti, message: string} | {success: boolean, id?: string, message: string, error?:any};
};

const deleteBiltiFn = async (biltiId: string) => {
  const response = await supabase.functions.invoke('delete-bilti', { body: { biltiId } });
  return response.data as {success: boolean, message: string, error?:any};
};

export default function InvoicingPage() {
  const [biltis, setBiltis] = useState<Bilti[]>([]);
  const [parties, setParties] = useState<Party[]>([]); 
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const { toast } = useToast();
  const { user: authUser, profile, loading: authLoading } = useAuth(); // Use profile
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingBilti, setEditingBilti] = useState<Bilti | null>(null);
  
  const [formData, setFormData] = useState<BiltiFormData>(() => {
      const userBranchId = profile?.assignedBranchIds?.[0] || ""; // Use profile
      return {
        ...defaultBiltiFormData,
        branchId: userBranchId,
      };
  });
  
  const [calculatedAmount, setCalculatedAmount] = useState(0);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [biltiToDelete, setBiltiToDelete] = useState<Bilti | null>(null);

  const [isConsignorSelectOpen, setIsConsignorSelectOpen] = useState(false);
  const [isConsigneeSelectOpen, setIsConsigneeSelectOpen] = useState(false);

  const [selectedConsignor, setSelectedConsignor] = useState<Party | null>(null);
  const [selectedConsignee, setSelectedConsignee] = useState<Party | null>(null);

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    } else if (profile && formData.branchId === "") { // Use profile
        const userBranchId = profile.assignedBranchIds?.[0] || "";
        setFormData(prev => ({...prev, branchId: userBranchId}));
    }
  }, [authUser, profile, authLoading, router, formData.branchId]); // Added profile

  const fetchMasterData = async () => {
    if (!profile) return; // Use profile
    try {
      const [
        partiesData,
        trucksData, // Still fetch if used elsewhere, but not for Bilti form directly
        driversData, // Still fetch if used elsewhere
        locationsData,
        unitsData,
        branchesData,
      ] = await Promise.all([
        db.query<Party>('parties', { orderBy: { column: 'name' } }),
        db.query<Truck>('trucks', { orderBy: { column: 'truckNo' } }),
        db.query<Driver>('drivers', { orderBy: { column: 'name' } }),
        db.query<Location>('locations', { orderBy: { column: 'name' } }), // Fetch canonical locations
        db.query<Unit>('units', { orderBy: { column: 'name' } }), // Fetch canonical units
        db.query<Branch>('branches', { orderBy: { column: 'name' } }),
      ]);

      setParties(partiesData);
      setTrucks(trucksData);
      setDrivers(driversData);
      setLocations(locationsData);
      setUnits(unitsData);
      setBranches(branchesData);
      
      if (!editingBilti) { // Set default unit if available
        setFormData(prev => ({
          ...prev,
          unitId: unitsData.length > 0 ? unitsData[0].id : "",
          // branchId is already set from authUser or default
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
      // Assuming biltis are fetched via a view or direct table that matches CanonicalBilti
      const fetchedBiltis = await db.query<Bilti>('biltis', { orderBy: { column: 'createdAt', ascending: false } });
      setBiltis(fetchedBiltis.map(b => ({...b, date: b.date || new Date().toISOString() }))); // Ensure date is valid string
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

  // For location dropdowns (fromLocationId, toLocationId)
  const locationOptions = useMemo(() => {
    // You might want to distinguish between different types of locations or use all
    return locations.map(loc => ({ value: loc.id, label: `${loc.name} (${loc.type})` }))
      .concat(branches.map(b => ({ value: b.id, label: `${b.name} (Branch)`}))) // If branches can be locations
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [locations, branches]);

  useEffect(() => {
    const calculated = (formData.quantity || 0) * (formData.rate || 0);
    setCalculatedAmount(calculated);
  }, [formData.quantity, formData.rate]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let parsedValue: string | number = value;
    if (name === "quantity" || name === "rate") {
      parsedValue = value === "" ? 0 : parseFloat(value);
      if (isNaN(parsedValue as number) || parsedValue < 0) parsedValue = 0;
    }
    setFormData((prev) => ({ ...prev, [name]: parsedValue as any })); // Use 'as any' carefully or type check 'name'
  };

  const handleSelectChange = (name: keyof BiltiFormData) => (value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => ({ ...prev, date: date.toISOString() }));
    }
  };

  const openAddForm = () => {
    setEditingBilti(null);
    const userBranchId = profile?.assignedBranchIds?.[0] || branches[0]?.id || ""; // Use profile
    const defaultUnitId = units.length > 0 ? units[0].id : "";
    setFormData({
        ...defaultBiltiFormData, 
        date: new Date().toISOString(), 
        branchId: userBranchId,
        unitId: defaultUnitId,
    });
    setSelectedConsignor(null);
    setSelectedConsignee(null);
    setCalculatedAmount(0);
    setIsFormDialogOpen(true);
  };

  const openEditForm = (bilti: Bilti) => {
    setEditingBilti(bilti);
    const { id, documentNumber, createdAt, updatedAt, amount, ...editableData } = bilti; 
    setFormData({
      ...defaultBiltiFormData, // Ensure all form fields are initialized
      ...editableData, 
      nepaliMiti: "", // Initialize nepaliMiti for the form, or derive if conversion from bilti.date is available
      date: bilti.date || new Date().toISOString(), // Ensure date is a string
    }); 
    setSelectedConsignor(parties.find(p => p.id === bilti.consignorId) || null);
    setSelectedConsignee(parties.find(p => p.id === bilti.consigneeId) || null);
    setCalculatedAmount(amount); 
    setIsFormDialogOpen(true);
  };

  // Refactor handlePartyAdd to use Supabase
  const handlePartyAdd = async (newPartyData: Omit<Party, 'id' | 'createdAt' | 'updatedAt' | 'branchId'>) => {
    if (!profile) return null; // Use profile
    setIsSubmitting(true);
    try {
      const userBranchId = profile.assignedBranchIds?.[0] || branches[0]?.id || ""; // Use profile
      if (!userBranchId) {
          toast({ title: "Error", description: "Cannot determine branch for new party.", variant: "destructive" });
          return null;
      }
      const partyPayload: Omit<Party, 'id' | 'createdAt' | 'updatedAt'> = {
        ...newPartyData,
        branchId: userBranchId, // Assign to current user's branch or a selected one
        isActive: true, // Default to active
      };
      // Assuming db.create returns the created record
      const createdParty = await db.create<Party>('parties', partyPayload);
      
      setParties(prev => [...prev, createdParty].sort((a,b) => a.name.localeCompare(b.name)));
      toast({ title: "Party Added", description: `${createdParty.name} has been added.` });
      return createdParty; 
    } catch (error) {
      logError(error, "Error adding party from dialog");
      handleSupabaseError(error, toast);
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
    if (!profile) { // Use profile
        toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive"});
        return;
    }
    // Update validation based on CanonicalBilti fields
    if (!formData.branchId || !formData.consignorId || !formData.consigneeId || !formData.fromLocationId || !formData.toLocationId || !formData.goodsDescription || !formData.unitId) {
        toast({
            title: "Missing Fields",
            description: "Branch, Consignor, Consignee, From/To Location, Goods Description, and Unit are required.",
            variant: "destructive",
        });
        return;
    }
    setIsSubmitting(true);
    
    const finalAmount = (formData.quantity || 0) * (formData.rate || 0);

    // Prepare payload for the backend function based on CanonicalBilti
    const { nepaliMiti, ...restOfFormData } = formData; // Exclude nepaliMiti if not part of backend payload
    
    const biltiPayload: BiltiFunctionPayload = {
      ...restOfFormData,
      date: typeof formData.date === 'string' ? formData.date : new Date(formData.date).toISOString(),
      amount: finalAmount,
      // documentNumber might be generated by backend, or needs to be handled if form includes it
    };

    try {
      let result;
      if (editingBilti) {
        result = await updateBiltiFn(editingBilti.id, biltiPayload);
      } else {
        result = await createBiltiFn(biltiPayload);
      }

      if (result.success) {
        toast({ title: "Success", description: result.message });
        fetchBiltis(); 
        setIsFormDialogOpen(false);
        setEditingBilti(null);
        setSelectedConsignor(null);
        setSelectedConsignee(null);
      } else {
        toast({ title: "Error", description: result.message || "Operation failed", variant: "destructive" });
        const errorHolder = result as { error?: any };
        if (errorHolder.error) {
            const errorPayload = errorHolder.error;
            const contextMessage = editingBilti ? "Update Bilti Error" : "Create Bilti Error";
            if (typeof errorPayload === 'object' && errorPayload !== null && 'message' in errorPayload) {
                logError(errorPayload, contextMessage);
            } else {
                logError({ message: String(errorPayload) }, contextMessage);
            }
        }
      }
    } catch (error: any) {
        logError(error, "Error saving Bilti");
        handleSupabaseError(error, toast); // Corrected call
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const getPartyName = (partyId: string) => parties.find(p => p.id === partyId)?.name || "N/A";
  // const getTruckNo = (truckId: string) => trucks.find(t => t.id === truckId)?.truckNo || "N/A"; // Not in Bilti
  // const getDriverName = (driverId: string) => drivers.find(d => d.id === driverId)?.name || "N/A"; // Not in Bilti
  const getLocationName = (locationId: string) => {
      const loc = locations.find(l => l.id === locationId);
      if (loc) return loc.name;
      const branchLoc = branches.find(b => b.id === locationId); // If branches are used as locations
      if (branchLoc) return branchLoc.name;
      return "N/A";
  }
  const getUnitName = (unitId: string) => units.find(u => u.id === unitId)?.name || "N/A";
  const getBranchName = (branchId: string) => branches.find(b => b.id === branchId)?.name || "N/A";


  const filteredBiltis = biltis.filter(bilti => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
        (bilti.documentNumber && bilti.documentNumber.toLowerCase().includes(searchTermLower)) ||
        getPartyName(bilti.consignorId).toLowerCase().includes(searchTermLower) ||
        getPartyName(bilti.consigneeId).toLowerCase().includes(searchTermLower) ||
        getLocationName(bilti.toLocationId).toLowerCase().includes(searchTermLower)
        // Removed: ( (bilti as any).nepaliMiti && (bilti as any).nepaliMiti.toLowerCase().includes(searchTermLower)) 
    );
  });

  const handleDeleteClick = (bilti: Bilti) => {
    setBiltiToDelete(bilti);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (biltiToDelete) {
      setIsSubmitting(true);
      try {
        const result = await deleteBiltiFn(biltiToDelete.id);
        if (result.success) {
            toast({ title: "Bilti Deleted", description: result.message });
            fetchBiltis(); 
        } else {
            toast({ title: "Error", description: result.message || "Deletion failed", variant: "destructive" });
            const errorHolder = result as { error?: any };
            if (errorHolder.error) {
                const errorPayload = errorHolder.error;
                const contextMessage = "Delete Bilti Error";
                if (typeof errorPayload === 'object' && errorPayload !== null && 'message' in errorPayload) {
                    logError(errorPayload, contextMessage);
                } else {
                    logError({ message: String(errorPayload) }, contextMessage);
                }
            }
        }
      } catch (error: any) {
        logError(error, "Error deleting Bilti");
        handleSupabaseError(error, toast); // Corrected call
      } finally {
        setIsSubmitting(false);
        setIsDeleteDialogOpen(false);
        setBiltiToDelete(null);
      }
    }
  };
  
  if (authLoading || (!authUser && !authLoading && !isLoading)) { 
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
            <Button 
                onClick={openAddForm} 
                disabled={isSubmitting || isLoading || parties.length === 0 || locations.length === 0 || units.length === 0 || branches.length === 0}
            >
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
                {/* Row 1: Bilti No (Doc No), Date (AD), Nepali Miti */}
                <div className="grid md:grid-cols-3 items-end gap-4">
                  <div>
                    <Label htmlFor="documentNumber">Bilti No.</Label>
                    <Input id="documentNumber" value={editingBilti ? editingBilti.documentNumber : "Auto-Generated"} readOnly className="bg-muted" />
                  </div>
                  <div>
                    <Label htmlFor="date">Date (AD)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"} // Corrected variant
                          className={cn("w-full justify-start text-left font-normal", !formData.date && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.date ? format(parseISO(formData.date), "PPP") : <span>Pick AD date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={formData.date ? parseISO(formData.date) : undefined} onSelect={handleDateChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label htmlFor="nepaliMiti">Nepali Miti (BS)</Label>
                    <Input id="nepaliMiti" name="nepaliMiti" value={formData.nepaliMiti || ""} onChange={handleInputChange} placeholder="YYYY-MM-DD" />
                  </div>
                </div>

                {/* Row 2: Branch, Consignor, Consignee */}
                <div className="grid md:grid-cols-3 items-end gap-4">
                  <div>
                    <Label htmlFor="branchId">Branch</Label>
                    <Select value={formData.branchId} onValueChange={handleSelectChange('branchId')}>
                      <SelectTrigger><SelectValue placeholder="Select Branch" /></SelectTrigger>
                      <SelectContent>
                        {branches.map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Consignor</Label>
                    <Button variant="outline" className="w-full justify-start" onClick={() => setIsConsignorSelectOpen(true)}> // Corrected variant
                      {selectedConsignor ? selectedConsignor.name : "Select Consignor"}
                    </Button>
                    <Input type="hidden" value={formData.consignorId} />
                  </div>
                  <div>
                    <Label>Consignee</Label>
                    <Button variant="outline" className="w-full justify-start" onClick={() => setIsConsigneeSelectOpen(true)}> // Corrected variant
                      {selectedConsignee ? selectedConsignee.name : "Select Consignee"}
                    </Button>
                    <Input type="hidden" value={formData.consigneeId} />
                  </div>
                </div>

                {/* Row 3: From Location, To Location */}
                <div className="grid md:grid-cols-2 items-end gap-4">
                  <div>
                    <Label htmlFor="fromLocationId">From Location</Label>
                    <Select value={formData.fromLocationId} onValueChange={handleSelectChange('fromLocationId')}>
                      <SelectTrigger><SelectValue placeholder="Select From Location" /></SelectTrigger>
                      <SelectContent>
                        {locationOptions.map(loc => <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="toLocationId">To Location</Label>
                    <Select value={formData.toLocationId} onValueChange={handleSelectChange('toLocationId')}>
                      <SelectTrigger><SelectValue placeholder="Select To Location" /></SelectTrigger>
                      <SelectContent>
                        {locationOptions.map(loc => <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Row 4: Goods Description */}
                <div>
                  <Label htmlFor="goodsDescription">Goods Description</Label>
                  <Textarea id="goodsDescription" name="goodsDescription" value={formData.goodsDescription} onChange={handleInputChange} placeholder="Enter details of goods..." required />
                </div>

                {/* Row 5: Quantity, Unit, Rate, Amount */}
                <div className="grid md:grid-cols-4 items-end gap-4">
                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input id="quantity" name="quantity" type="number" value={formData.quantity} onChange={handleInputChange} min="0" required />
                  </div>
                  <div>
                    <Label htmlFor="unitId">Unit</Label>
                    <Select value={formData.unitId} onValueChange={handleSelectChange('unitId')}>
                      <SelectTrigger><SelectValue placeholder="Select Unit" /></SelectTrigger>
                      <SelectContent>
                        {units.map(unit => <SelectItem key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="rate">Rate</Label>
                    <Input id="rate" name="rate" type="number" value={formData.rate} onChange={handleInputChange} min="0" step="any" required />
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input value={calculatedAmount.toFixed(2)} readOnly className="bg-muted" />
                  </div>
                </div>
                
                {/* Row 6: Status (Bilti Status) */}
                <div>
                    <Label htmlFor="status">Bilti Status</Label>
                    <Select value={formData.status} onValueChange={handleSelectChange('status')}>
                        <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="issued">Issued</SelectItem>
                            <SelectItem value="manifested">Manifested</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Removed Truck, Driver, PayMode as they are not in CanonicalBilti */}

              </div>
             </ScrollArea>
              <DialogFooter className="mt-4">
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose> // Corrected variant
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingBilti ? "Update Bilti" : "Create Bilti"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Bilti / Invoice List</CardTitle>
          <CardDescription>Manage existing Biltis/Invoices.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by Bilti No, Consignor, Consignee, Destination..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading biltis...</p></div>
          ) : (
            <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bilti No.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Consignor</TableHead>
                  <TableHead>Consignee</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBiltis.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={11} className="text-center h-24">No biltis found.</TableCell></TableRow>
                )}
                {filteredBiltis.map((bilti) => (
                  <TableRow key={bilti.id}>
                    <TableCell className="font-medium">{bilti.documentNumber}</TableCell>
                    <TableCell>{format(parseISO(bilti.date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{getPartyName(bilti.consignorId)}</TableCell>
                    <TableCell>{getPartyName(bilti.consigneeId)}</TableCell>
                    <TableCell>{getLocationName(bilti.fromLocationId)}</TableCell>
                    <TableCell>{getLocationName(bilti.toLocationId)}</TableCell>
                    <TableCell>{bilti.quantity}</TableCell>
                    <TableCell>{getUnitName(bilti.unitId)}</TableCell>
                    <TableCell>{bilti.amount.toFixed(2)}</TableCell>
                    <TableCell><Badge variant={getBiltiStatusVariant(bilti.status)}>{bilti.status.charAt(0).toUpperCase() + bilti.status.slice(1)}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" aria-label="Edit Bilti" onClick={() => openEditForm(bilti)} disabled={isSubmitting}><Edit className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" aria-label="Print Bilti" onClick={() => alert(`Print Bilti ID: ${bilti.id}`)} disabled={isSubmitting}><Printer className="h-4 w-4" /></Button>
                        <AlertDialog open={isDeleteDialogOpen && biltiToDelete?.id === bilti.id} onOpenChange={(open) => { if(!open) setBiltiToDelete(null); setIsDeleteDialogOpen(open);}}>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" aria-label="Delete Bilti" onClick={() => handleDeleteClick(bilti)} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete Bilti No. "{biltiToDelete?.documentNumber}".</AlertDialogDescription></AlertDialogHeader> // Corrected quote escaping
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => {setBiltiToDelete(null); setIsDeleteDialogOpen(false);}} disabled={isSubmitting}>Cancel</AlertDialogCancel>
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
                ))}
              </TableBody>
            </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}




