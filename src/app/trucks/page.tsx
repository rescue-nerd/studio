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
import { handleFirebaseError, logError } from "@/lib/firebase-error-handler";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/supabase-db";
import type { Truck as FirestoreTruck } from "@/types/firestore";
import { Edit, Loader2, PlusCircle, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";


interface Truck extends FirestoreTruck {}
type TruckFormDataCallable = Omit<FirestoreTruck, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>;
type UpdateTruckFormDataCallable = Partial<TruckFormDataCallable> & { truckId: string };


const truckTypes = ["6-Wheeler", "10-Wheeler", "12-Wheeler", "Trailer", "Container Truck", "Tanker", "Tipper"];
const truckStatuses: FirestoreTruck["status"][] = ["Active", "Inactive", "Maintenance"];

const defaultTruckFormData: Omit<Truck, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> = {
  truckNo: "",
  type: truckTypes[0],
  capacity: "",
  ownerName: "",
  ownerPAN: "",
  status: "Active",
  assignedLedgerId: "",
};

const createTruckFn = async (data: TruckFormDataCallable) => {
  const response = await supabase.functions.invoke('create-truck', { body: data });
  return response.data;
};

const updateTruckFn = async (data: UpdateTruckFormDataCallable) => {
  const response = await supabase.functions.invoke('update-truck', { body: data });
  return response.data;
};

const deleteTruckFn = async (data: { truckId: string }) => {
  const response = await supabase.functions.invoke('delete-truck', { body: data });
  return response.data;
};


export default function TrucksPage() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [formData, setFormData] = useState<Omit<Truck, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>>(defaultTruckFormData);
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
    if (!authUser) return;
    setIsLoading(true);
    try {
      const { data, error } = await db.query('trucks', { select: '*', orderBy: { column: 'truckNo', ascending: true } });
      if (error) throw error;
      setTrucks(data);
    } catch (error) {
      logError(error, "Error fetching trucks");
      handleFirebaseError(error, toast, {
        "permission-denied": "You don't have permission to view trucks."
      });
    } finally {
      setIsLoading(false);
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

  const handleSelectChange = (name: keyof Omit<Truck, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => (value: string) => {
     if (name === 'status') {
        setFormData((prev) => ({ ...prev, [name]: value as FirestoreTruck['status'] }));
     } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
     }
  };

  const openAddForm = () => {
    setEditingTruck(null);
    setFormData(defaultTruckFormData);
    setIsFormDialogOpen(true);
  };

  const openEditForm = (truck: Truck) => {
    setEditingTruck(truck);
    const { id, createdAt, createdBy, updatedAt, updatedBy, ...editableData } = truck;
    setFormData(editableData);
    setIsFormDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) {
        toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive"});
        return;
    }
    if (!formData.truckNo || !formData.ownerName || !formData.assignedLedgerId) {
        toast({ title: "Validation Error", description: "Truck No., Owner Name, and Ledger A/C are required.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);

    const truckDataPayload: TruckFormDataCallable = {
        ...formData,
    };

    try {
      let result: any;
      if (editingTruck) {
        result = await updateTruckFn({ truckId: editingTruck.id, ...truckDataPayload });
      } else {
        result = await createTruckFn(truckDataPayload);
      }

      if (result.success) {
        toast({ title: "Success", description: result.message });
        fetchTrucks();
        setIsFormDialogOpen(false);
        setEditingTruck(null);
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
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
        if (result.success) {
            toast({ title: "Success", description: result.message });
            fetchTrucks();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
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

  const filteredTrucks = trucks.filter(truck =>
    truck.truckNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    truck.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    truck.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadgeVariant = (status: Truck["status"]): "default" | "destructive" | "secondary" => {
    switch (status) {
      case "Active": return "default";
      case "Inactive": return "destructive";
      case "Maintenance": return "secondary";
      default: return "default";
    }
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
                <Input id="truckNo" name="truckNo" value={formData.truckNo} onChange={handleInputChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">Type</Label>
                <Select value={formData.type} onValueChange={handleSelectChange('type')}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{truckTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="capacity" className="text-right">Capacity</Label>
                <Input id="capacity" name="capacity" value={formData.capacity || ""} onChange={handleInputChange} className="col-span-3" placeholder="e.g., 10 Ton (Optional)" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="ownerName" className="text-right">Owner Name</Label>
                <Input id="ownerName" name="ownerName" value={formData.ownerName} onChange={handleInputChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="ownerPAN" className="text-right">Owner PAN</Label>
                <Input id="ownerPAN" name="ownerPAN" value={formData.ownerPAN || ""} onChange={handleInputChange} className="col-span-3" placeholder="(Optional)" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">Status</Label>
                <Select value={formData.status} onValueChange={handleSelectChange('status') as (value: FirestoreTruck["status"]) => void}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>{truckStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="assignedLedgerId" className="text-right">Ledger A/C ID</Label>
                <Input id="assignedLedgerId" name="assignedLedgerId" value={formData.assignedLedgerId} onChange={handleInputChange} className="col-span-3" placeholder="e.g., Ledger-TRK001" required />
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
                  <TableHead>Type</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ledger A/C ID</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrucks.length === 0 && !isLoading && (
                    <TableRow><TableCell colSpan={8} className="text-center h-24">No trucks found.</TableCell></TableRow>
                )}
                {filteredTrucks.map((truck) => (
                  <TableRow key={truck.id}>
                    <TableCell className="font-medium">{truck.id}</TableCell>
                    <TableCell>{truck.truckNo}</TableCell>
                    <TableCell>{truck.type}</TableCell>
                    <TableCell>{truck.capacity || 'N/A'}</TableCell>
                    <TableCell>{truck.ownerName}</TableCell>
                    <TableCell><Badge variant={getStatusBadgeVariant(truck.status)} className={truck.status === "Active" ? "bg-accent text-accent-foreground" : ""}>{truck.status}</Badge></TableCell>
                    <TableCell>{truck.assignedLedgerId}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" aria-label="Edit Truck" onClick={() => openEditForm(truck)} disabled={isSubmitting}><Edit className="h-4 w-4" /></Button>
                        <AlertDialog open={isDeleteDialogOpen && truckToDelete?.id === truck.id} onOpenChange={(open) => { if(!open) setTruckToDelete(null); setIsDeleteDialogOpen(open);}}>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" aria-label="Delete Truck" onClick={() => handleDeleteClick(truck)} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the truck "{truckToDelete?.truckNo}".</AlertDialogDescription></AlertDialogHeader>
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
