"use client";

import { useState, type ChangeEvent, type FormEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Search, Edit, Trash2, Car, CalendarIcon, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, Timestamp, query, orderBy } from "firebase/firestore";
import type { Driver as FirestoreDriver } from "@/types/firestore";
import { useToast } from "@/hooks/use-toast";

// Local interface for UI state
interface Driver extends Omit<FirestoreDriver, 'joiningDate' | 'createdAt' | 'updatedAt'> {
  id: string;
  joiningDate?: Date; // Use Date for form, convert to Timestamp for Firestore
  createdAt?: Date | Timestamp; // Allow both for local state vs. Firestore
  updatedAt?: Date | Timestamp;
}

const driverStatuses: FirestoreDriver["status"][] = ["Active", "Inactive", "On Leave"];

const defaultDriverFormData: Omit<Driver, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> = {
  name: "",
  licenseNo: "",
  contactNo: "",
  status: "Active",
  assignedLedgerId: "",
  joiningDate: new Date(),
  address: "",
};

const PLACEHOLDER_USER_ID = "system_user_placeholder";

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState<Omit<Driver, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>>(defaultDriverFormData);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchDrivers = async () => {
    setIsLoading(true);
    try {
      const driversCollectionRef = collection(db, "drivers");
      const q = query(driversCollectionRef, orderBy("name"));
      const querySnapshot = await getDocs(q);
      const fetchedDrivers: Driver[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data() as FirestoreDriver;
        return {
          ...data,
          id: docSnap.id,
          joiningDate: data.joiningDate ? data.joiningDate.toDate() : undefined,
        };
      });
      setDrivers(fetchedDrivers);
    } catch (error) {
      console.error("Error fetching drivers: ", error);
      toast({ title: "Error", description: "Failed to fetch drivers.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleSelectChange = (name: keyof Omit<Driver, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'joiningDate'>) => (value: string) => {
     if (name === 'status') {
        setFormData((prev) => ({ ...prev, [name]: value as FirestoreDriver['status'] }));
     } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
     }
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => ({ ...prev, joiningDate: date }));
    }
  };

  const openAddForm = () => {
    setEditingDriver(null);
    setFormData({...defaultDriverFormData, joiningDate: new Date()});
    setIsFormDialogOpen(true);
  };

  const openEditForm = (driver: Driver) => {
    setEditingDriver(driver);
    const { id, createdAt, createdBy, updatedAt, updatedBy, ...editableData } = driver;
    setFormData({...editableData, joiningDate: driver.joiningDate || new Date()});
    setIsFormDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.licenseNo || !formData.contactNo || !formData.assignedLedgerId) {
        toast({ title: "Validation Error", description: "Name, License No., Contact No., and Ledger A/C ID are required.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);

    const driverDataPayload: Omit<FirestoreDriver, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> & Partial<Pick<FirestoreDriver, 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>> = {
        ...formData,
        joiningDate: formData.joiningDate ? Timestamp.fromDate(formData.joiningDate) : undefined,
    };

    if (editingDriver) {
      try {
        const driverDocRef = doc(db, "drivers", editingDriver.id);
        await updateDoc(driverDocRef, {
            ...driverDataPayload,
            updatedAt: Timestamp.now(),
            updatedBy: PLACEHOLDER_USER_ID,
        });
        toast({ title: "Success", description: "Driver updated successfully." });
      } catch (error) {
        console.error("Error updating driver: ", error);
        toast({ title: "Error", description: "Failed to update driver.", variant: "destructive" });
      }
    } else {
      try {
        await addDoc(collection(db, "drivers"), {
            ...driverDataPayload,
            createdAt: Timestamp.now(),
            createdBy: PLACEHOLDER_USER_ID,
        });
        toast({ title: "Success", description: "Driver added successfully." });
      } catch (error) {
        console.error("Error adding driver: ", error);
        toast({ title: "Error", description: "Failed to add driver.", variant: "destructive" });
      }
    }
    setIsSubmitting(false);
    setIsFormDialogOpen(false);
    setEditingDriver(null);
    fetchDrivers();
  };

  const handleDeleteClick = (driver: Driver) => {
    setDriverToDelete(driver);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (driverToDelete) {
      setIsSubmitting(true);
      try {
        await deleteDoc(doc(db, "drivers", driverToDelete.id));
        toast({ title: "Success", description: `Driver "${driverToDelete.name}" deleted.`});
        fetchDrivers();
      } catch (error) {
        console.error("Error deleting driver: ", error);
        toast({ title: "Error", description: "Failed to delete driver.", variant: "destructive" });
      } finally {
        setIsSubmitting(false);
      }
    }
    setIsDeleteDialogOpen(false);
    setDriverToDelete(null);
  };

  const filteredDrivers = drivers.filter(driver =>
    driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.licenseNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.contactNo.includes(searchTerm)
  );

  const getStatusBadgeVariant = (status: Driver["status"]): "default" | "destructive" | "secondary" => {
    switch (status) {
      case "Active": return "default";
      case "Inactive": return "destructive";
      case "On Leave": return "secondary";
      default: return "default";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground flex items-center"><Car className="mr-3 h-8 w-8 text-primary"/>Manage Drivers</h1>
          <p className="text-muted-foreground ml-11">Add, edit, and view driver details for GorkhaTrans.</p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm} disabled={isSubmitting}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Driver
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingDriver ? "Edit Driver" : "Add New Driver"}</DialogTitle>
              <DialogDescription>
                {editingDriver ? "Update the details of the driver." : "Enter the details for the new driver."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleInputChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="licenseNo" className="text-right">License No.</Label>
                <Input id="licenseNo" name="licenseNo" value={formData.licenseNo} onChange={handleInputChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="contactNo" className="text-right">Contact No.</Label>
                <Input id="contactNo" name="contactNo" value={formData.contactNo} onChange={handleInputChange} className="col-span-3" required />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="joiningDate" className="text-right">Joining Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={"outline"} className={cn("col-span-3 justify-start text-left font-normal", !formData.joiningDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.joiningDate ? format(formData.joiningDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.joiningDate} onSelect={handleDateChange} initialFocus /></PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">Status</Label>
                <Select value={formData.status} onValueChange={handleSelectChange('status') as (value: FirestoreDriver["status"]) => void}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>{driverStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="assignedLedgerId" className="text-right">Ledger A/C ID</Label>
                <Input id="assignedLedgerId" name="assignedLedgerId" value={formData.assignedLedgerId} onChange={handleInputChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="address" className="text-right pt-2">Address</Label>
                <Textarea id="address" name="address" value={formData.address || ""} onChange={handleInputChange} className="col-span-3" placeholder="(Optional)" rows={3}/>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Driver
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Driver List</CardTitle>
          <CardDescription>View, edit, or add new drivers.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by Name, License, Contact..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading drivers...</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>License No.</TableHead>
                  <TableHead>Contact No.</TableHead>
                  <TableHead>Joining Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ledger A/C ID</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrivers.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={8} className="text-center h-24">No drivers found.</TableCell></TableRow>
                )}
                {filteredDrivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">{driver.id}</TableCell>
                    <TableCell>{driver.name}</TableCell>
                    <TableCell>{driver.licenseNo}</TableCell>
                    <TableCell>{driver.contactNo}</TableCell>
                    <TableCell>{driver.joiningDate ? format(driver.joiningDate, "PP") : 'N/A'}</TableCell>
                    <TableCell><Badge variant={getStatusBadgeVariant(driver.status)} className={driver.status === "Active" ? "bg-accent text-accent-foreground" : ""}>{driver.status}</Badge></TableCell>
                    <TableCell>{driver.assignedLedgerId}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" aria-label="Edit Driver" onClick={() => openEditForm(driver)} disabled={isSubmitting}><Edit className="h-4 w-4" /></Button>
                        <AlertDialog open={isDeleteDialogOpen && driverToDelete?.id === driver.id} onOpenChange={(open) => { if(!open) setDriverToDelete(null); setIsDeleteDialogOpen(open);}}>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" aria-label="Delete Driver" onClick={() => handleDeleteClick(driver)} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the driver "{driverToDelete?.name}".</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => {setDriverToDelete(null); setIsDeleteDialogOpen(false);}} disabled={isSubmitting}>Cancel</AlertDialogCancel>
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