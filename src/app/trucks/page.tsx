"use client";

import { useState, type ChangeEvent, type FormEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Search, Edit, Trash2, Loader2 } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, Timestamp, query, orderBy } from "firebase/firestore";
import type { Truck as FirestoreTruck } from "@/types/firestore";
import { useToast } from "@/hooks/use-toast";

// Local interface for UI state, id is part of it
interface Truck extends FirestoreTruck {}

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

const PLACEHOLDER_USER_ID = "system_user_placeholder";

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

  const fetchTrucks = async () => {
    setIsLoading(true);
    try {
      const trucksCollectionRef = collection(db, "trucks");
      const q = query(trucksCollectionRef, orderBy("truckNo"));
      const querySnapshot = await getDocs(q);
      const fetchedTrucks: Truck[] = querySnapshot.docs.map(doc => {
        const data = doc.data() as FirestoreTruck;
        return { ...data, id: doc.id };
      });
      setTrucks(fetchedTrucks);
    } catch (error) {
      console.error("Error fetching trucks: ", error);
      toast({ title: "Error", description: "Failed to fetch trucks.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrucks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!formData.truckNo || !formData.ownerName || !formData.assignedLedgerId) {
        toast({ title: "Validation Error", description: "Truck No., Owner Name, and Ledger A/C are required.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);

    const truckDataPayload: Omit<FirestoreTruck, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> & Partial<Pick<FirestoreTruck, 'updatedAt' | 'updatedBy' | 'createdAt' | 'createdBy'>> = {
        ...formData,
    };

    if (editingTruck) {
      try {
        const truckDocRef = doc(db, "trucks", editingTruck.id);
        await updateDoc(truckDocRef, {
            ...truckDataPayload,
            updatedAt: Timestamp.now(),
            updatedBy: PLACEHOLDER_USER_ID,
        });
        toast({ title: "Success", description: "Truck updated successfully." });
      } catch (error) {
        console.error("Error updating truck: ", error);
        toast({ title: "Error", description: "Failed to update truck.", variant: "destructive" });
      }
    } else {
      try {
        await addDoc(collection(db, "trucks"), {
            ...truckDataPayload,
            createdAt: Timestamp.now(),
            createdBy: PLACEHOLDER_USER_ID,
        });
        toast({ title: "Success", description: "Truck added successfully." });
      } catch (error) {
        console.error("Error adding truck: ", error);
        toast({ title: "Error", description: "Failed to add truck.", variant: "destructive" });
      }
    }
    setIsSubmitting(false);
    setIsFormDialogOpen(false);
    setEditingTruck(null);
    fetchTrucks();
  };

  const handleDeleteClick = (truck: Truck) => {
    setTruckToDelete(truck);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (truckToDelete) {
      setIsSubmitting(true);
      try {
        const truckDocRef = doc(db, "trucks", truckToDelete.id);
        await deleteDoc(truckDocRef);
        toast({ title: "Success", description: `Truck "${truckToDelete.truckNo}" deleted.` });
        fetchTrucks();
      } catch (error) {
        console.error("Error deleting truck: ", error);
        toast({ title: "Error", description: "Failed to delete truck.", variant: "destructive" });
      } finally {
        setIsSubmitting(false);
      }
    }
    setIsDeleteDialogOpen(false);
    setTruckToDelete(null);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground">Manage Trucks</h1>
          <p className="text-muted-foreground">Add, edit, and view truck details for GorkhaTrans.</p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm} disabled={isSubmitting}>
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