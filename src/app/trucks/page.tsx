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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { handleSupabaseError } from "@/lib/supabase-error-handler";
import type { Truck as CanonicalTruck } from "@/types/database"; // Import specific types
import { Edit, Loader2, PlusCircle, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

// Define Truck using the canonical type from database.ts
type Truck = CanonicalTruck;

// Define form data types based on the canonical Truck type
// Manually define Insert and Update types if not exported from database.ts
type TruckInsert = Omit<Truck, 'id' | 'createdAt' | 'updatedAt'> & { created_by?: string }; // created_by might be handled by db
type TruckUpdate = Partial<Omit<Truck, 'id' | 'createdAt' | 'updatedAt'>> & { updated_by?: string }; // updated_by might be handled by db

type TruckFormDataCallable = Omit<Truck, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateTruckFormDataCallable = Partial<Omit<Truck, 'id' | 'createdAt' | 'updatedAt'>> & { truck_id: string };

// Fields like 'type', 'capacity', 'owner_pan', 'status' are not in the canonical Truck type.
// These will be removed or commented out. If they are needed, the database.ts schema must be updated.

// const truckTypes = ["6-Wheeler", "10-Wheeler", "12-Wheeler", "Trailer", "Container Truck", "Tanker", "Tipper"];
// const truckStatuses: Array<Truck['status'] | null> = ["Active", "Inactive", "Maintenance", null];

const defaultTruckFormData: TruckFormDataCallable = {
  truckNo: "",
  // type: truckTypes[0], // Not in canonical Truck
  // capacity: null, // Not in canonical Truck
  ownerName: "",
  // owner_pan: null, // Not in canonical Truck
  // status: "Active", // Not in canonical Truck. Use isActive from canonical type.
  isActive: true, // Default to active
  assignedLedgerId: "",
  branchId: "", // Assuming branchId is required, add a default or fetch from context
  // created_by will be set by the backend or a Supabase function trigger
};

const createTruckFn = async (data: TruckInsert) => {
  try {
    const response = await supabase.functions.invoke('create-truck', { 
      body: data,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error("Error calling create-truck function:", error);
    throw error;
  }
};

const updateTruckFn = async (data: { truck_id: string } & TruckUpdate) => {
  try {
    const { truck_id, ...updateData } = data;
    const response = await supabase.functions.invoke('update-truck', { 
      body: { truckId: truck_id, ...updateData }, // Ensure payload matches function expectation
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error("Error calling update-truck function:", error);
    throw error;
  }
};

const deleteTruckFn = async (data: { truckId: string }) => {
  try {
    const response = await supabase.functions.invoke('delete-truck', { 
      body: data,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error("Error calling delete-truck function:", error);
    throw error;
  }
};


export default function TrucksPage() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [formData, setFormData] = useState<TruckFormDataCallable>(defaultTruckFormData);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [truckToDelete, setTruckToDelete] = useState<Truck | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authUser, authLoading, router]);


  const fetchTrucks = async () => {
    setIsLoading(true); // Start loading
    try {
      const { data, error, statusText } = await supabase
        .from('trucks') 
        .select('*')
        .order('truck_no'); // Changed from truckNo to truck_no
      
      if (error) {
        // Throw a new error with more context if Supabase error object is not informative
        throw new Error(`Supabase error fetching trucks: ${error.message || statusText || 'Unknown error'}`);
      }
      setTrucks((data as Truck[]) || []); 
    } catch (error) {
      console.error("Error fetching trucks: ", error); // Now error should have a message
      handleSupabaseError(error, toast);
    } finally {
      setIsLoading(false); // Stop loading
    }
  };

  useEffect(() => {
    if (authUser) {
      fetchTrucks();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof TruckFormDataCallable) => (value: string | boolean) => {
    // Removed 'status' and 'type' handling as they are not in canonical Truck
    // For isActive (boolean)
    if (name === 'isActive') {
        setFormData(prev => ({ ...prev, [name]: value as boolean }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value as string }));
    }
  };

  const openAddForm = () => {
    setEditingTruck(null);
    setFormData(defaultTruckFormData);
    setIsFormDialogOpen(true);
  };

  const openEditForm = (truck: Truck) => {
    setEditingTruck(truck);
    // Adjust destructuring to match canonical Truck type
    const { id, createdAt, updatedAt, ...editableData } = truck;
    // Ensure all fields in editableData exist in TruckFormDataCallable
    const currentFormData: TruckFormDataCallable = {
        truckNo: editableData.truckNo,
        ownerName: editableData.ownerName,
        ownerContactNo: editableData.ownerContactNo || undefined, // Handle optional fields
        assignedLedgerId: editableData.assignedLedgerId,
        isActive: editableData.isActive,
        branchId: editableData.branchId,
    };
    setFormData(currentFormData);
    setIsFormDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) {
        toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive"});
        return;
    }
    // Update validation to match canonical Truck type fields
    if (!formData.truckNo || !formData.ownerName || !formData.assignedLedgerId || !formData.branchId) {
        toast({ title: "Validation Error", description: "Truck No., Owner Name, Ledger A/C, and Branch ID are required.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);

    // Ensure payload matches TruckInsert or TruckUpdate type
    const truckDataPayload: TruckInsert | TruckUpdate = {
        ...formData,
        // created_by and updated_by should be handled by Supabase functions or triggers if needed
    };

    try {
      let result;
      if (editingTruck) {
        result = await updateTruckFn({ truck_id: editingTruck.id, ...(truckDataPayload as TruckUpdate) });
      } else {
        result = await createTruckFn(truckDataPayload as TruckInsert);
      }

      if (result && result.success) {
        toast({ title: "Success", description: result.message });
        fetchTrucks();
        setIsFormDialogOpen(false);
        setEditingTruck(null);
      } else {
        toast({ 
          title: "Error", 
          description: result?.message || (editingTruck ? "Failed to update truck" : "Failed to create truck"), 
          variant: "destructive" 
        });
      }
    } catch (error: any) {
        console.error("Error saving truck:", error);
        toast({ title: "Error", description: error.message || "Failed to save truck.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (truck: Truck) => {
    setTruckToDelete(truck);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (truckToDelete) {
      setIsSubmitting(true);
      try {
        const result = await deleteTruckFn({ truckId: truckToDelete.id });
        if (result && result.success) {
            toast({ title: "Success", description: result.message });
            fetchTrucks();
        } else {
            toast({ 
              title: "Error", 
              description: result?.message || "Could not delete truck.", 
              variant: "destructive" 
            });
        }
      } catch (error: any) {
        console.error("Error deleting truck: ", error);
        toast({ title: "Error", description: error.message || "Failed to delete truck.", variant: "destructive" });
      } finally {
        setIsSubmitting(false);
        setIsDeleteDialogOpen(false);
        setTruckToDelete(null);
      }
    }
  };

  // Ensure trucks is an array before filtering
  const filteredTrucks = trucks && Array.isArray(trucks) 
    ? trucks.filter(truck =>
        truck.truckNo?.toLowerCase().includes(searchTerm.toLowerCase()) || // Use truckNo
        truck.ownerName?.toLowerCase().includes(searchTerm.toLowerCase()) // Use ownerName
        // Removed truck.type filter as it's not in canonical Truck
      )
    : [];

  // Removed getStatusBadgeVariant as 'status' field is not in canonical Truck.
  // Use 'isActive' field for similar logic if needed.
  const getIsActiveBadgeVariant = (isActive: boolean | undefined): "default" | "secondary" => {
    return isActive ? "default" : "secondary";
  };

  if (authLoading || (!authUser && !authLoading)) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">{authLoading ? "Authenticating..." : "Redirecting to login..."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground">Manage Trucks</h1>
          <p className="text-muted-foreground">Add, edit, and view truck details for GorkhaTrans.</p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm} disabled={isSubmitting || isLoading}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Truck
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTruck ? "Edit Truck" : "Add New Truck"}</DialogTitle>
              <DialogDescription>
                {editingTruck ? "Update the details of the truck." : "Enter the details for the new truck."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="truckNo" className="text-right">Truck No.</Label>
                <Input id="truckNo" name="truckNo" value={formData.truckNo || ''} onChange={handleInputChange} className="col-span-3" required />
              </div>
              {/* Removed Type and Capacity fields as they are not in canonical Truck */}
              {/* <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">Type</Label>
                <Select value={formData.type || undefined} onValueChange={handleSelectChange('type') as (value: string) => void}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{truckTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="capacity" className="text-right">Capacity</Label>
                <Input id="capacity" name="capacity" value={formData.capacity || ""} onChange={handleInputChange} className="col-span-3" placeholder="e.g., 10 Ton (Optional)" />
              </div> */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="ownerName" className="text-right">Owner Name</Label>
                <Input id="ownerName" name="ownerName" value={formData.ownerName || ''} onChange={handleInputChange} className="col-span-3" required />
              </div>
              {/* Removed Owner PAN field as it's not in canonical Truck */}
              {/* <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="ownerPAN" className="text-right">Owner PAN</Label>
                <Input id="ownerPAN" name="owner_pan" value={formData.owner_pan || ""} onChange={handleInputChange} className="col-span-3" placeholder="(Optional)" />
              </div> */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="ownerContactNo" className="text-right">Owner Contact</Label>
                <Input id="ownerContactNo" name="ownerContactNo" value={formData.ownerContactNo || ""} onChange={handleInputChange} className="col-span-3" placeholder="(Optional)" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="branchId" className="text-right">Branch ID</Label>
                <Input id="branchId" name="branchId" value={formData.branchId || ''} onChange={handleInputChange} className="col-span-3" placeholder="e.g., Branch-XYZ" required />
              </div>
              {/* Removed Status field, using isActive instead */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isActive" className="text-right">Active</Label>
                <Select value={formData.isActive ? "true" : "false"} onValueChange={(value) => handleSelectChange('isActive')(value === "true")}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="assignedLedgerId" className="text-right">Ledger A/C ID</Label>
                <Input id="assignedLedgerId" name="assignedLedgerId" value={formData.assignedLedgerId || ''} onChange={handleInputChange} className="col-span-3" placeholder="e.g., Ledger-TRK001" required />
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Truck
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Truck List</CardTitle>
          <CardDescription>View, edit, or add new trucks.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search trucks by No, Owner, Type..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading trucks...</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Truck No.</TableHead>
                  {/* <TableHead>Type</TableHead> */}
                  {/* <TableHead>Capacity</TableHead> */}
                  <TableHead>Owner</TableHead>
                  <TableHead>Owner Contact</TableHead>
                  <TableHead>Branch ID</TableHead>
                  <TableHead>Status</TableHead> {/* Changed from Status to Is Active */} 
                  <TableHead>Ledger A/C ID</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrucks.length === 0 && !isLoading && (
                    <TableRow><TableCell colSpan={8} className="text-center h-24">No trucks found.</TableCell></TableRow>
                )}
                {filteredTrucks.map((truck) => (
                  <TableRow key={truck.id}>{/* Removed newline and whitespace here */}
                    <TableCell className="font-medium">{truck.id}</TableCell>
                    <TableCell>{truck.truckNo}</TableCell>
                    {/* <TableCell>{truck.type}</TableCell> */}
                    {/* <TableCell>{truck.capacity || \'N/A\'}</TableCell> */}
                    <TableCell>{truck.ownerName}</TableCell>
                    <TableCell>{truck.ownerContactNo || 'N/A'}</TableCell>
                    <TableCell>{truck.branchId}</TableCell>
                    <TableCell><Badge variant={getIsActiveBadgeVariant(truck.isActive)} className={truck.isActive ? "bg-accent text-accent-foreground" : ""}>{truck.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell>{truck.assignedLedgerId}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" aria-label="Edit Truck" onClick={() => openEditForm(truck)} disabled={isSubmitting}><Edit className="h-4 w-4" /></Button>
                        <AlertDialog open={isDeleteDialogOpen && truckToDelete?.id === truck.id} onOpenChange={(open) => { if(!open) setTruckToDelete(null); setIsDeleteDialogOpen(open);}}>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" aria-label="Delete Truck" onClick={() => handleDeleteClick(truck)} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the truck \"{truckToDelete?.truckNo}\".</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => {setTruckToDelete(null); setIsDeleteDialogOpen(false);}} disabled={isSubmitting}>Cancel</AlertDialogCancel>
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