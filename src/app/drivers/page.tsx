
"use client";

import { useState, type ChangeEvent, type FormEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Search, Edit, Trash2, Car } from "lucide-react";
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
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Driver {
  id: string;
  name: string;
  licenseNo: string;
  contactNo: string;
  status: "Active" | "Inactive" | "On Leave";
  assignedLedger: string;
  joiningDate?: Date;
  address?: string;
}

const driverStatuses: Driver["status"][] = ["Active", "Inactive", "On Leave"];

const initialDrivers: Driver[] = [
  { id: "DRV001", name: "Suresh Kumar", licenseNo: "LIC-12345", contactNo: "9876543210", status: "Active", assignedLedger: "Ledger-SK", joiningDate: new Date("2022-01-15"), address: "Kathmandu, Nepal" },
  { id: "DRV002", name: "Bimala Rai", licenseNo: "LIC-67890", contactNo: "9876543211", status: "Active", assignedLedger: "Ledger-BR", joiningDate: new Date("2021-06-20"), address: "Pokhara, Nepal" },
  { id: "DRV003", name: "Rajesh Thapa", licenseNo: "LIC-11223", contactNo: "9876543212", status: "On Leave", assignedLedger: "Ledger-RT", joiningDate: new Date("2023-03-10"), address: "Biratnagar, Nepal" },
  { id: "DRV004", name: "Anita Gurung", licenseNo: "LIC-44556", contactNo: "9876543213", status: "Inactive", assignedLedger: "Ledger-AG", joiningDate: new Date("2020-11-05"), address: "Butwal, Nepal" },
];

const defaultDriverFormData: Omit<Driver, 'id'> = {
  name: "",
  licenseNo: "",
  contactNo: "",
  status: "Active",
  assignedLedger: "",
  joiningDate: new Date(),
  address: "",
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState<Omit<Driver, 'id'> & { id?: string }>(defaultDriverFormData);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleSelectChange = (name: keyof Omit<Driver, 'id'>) => (value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => ({ ...prev, joiningDate: date }));
    }
  };

  const openAddForm = () => {
    setEditingDriver(null);
    setFormData({...defaultDriverFormData, joiningDate: new Date()}); // Ensure fresh date
    setIsFormDialogOpen(true);
  };

  const openEditForm = (driver: Driver) => {
    setEditingDriver(driver);
    setFormData({...driver, joiningDate: driver.joiningDate || new Date()});
    setIsFormDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.licenseNo || !formData.contactNo || !formData.assignedLedger) {
        // Basic validation, can be enhanced
        alert("Please fill all required fields.");
        return;
    }

    if (editingDriver) {
      setDrivers(
        drivers.map((d) =>
          d.id === editingDriver.id ? { ...editingDriver, ...formData } : d
        )
      );
    } else {
      const newId = `DRV${String(drivers.length + 1 + Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
      setDrivers([...drivers, { id: newId, ...formData } as Driver]);
    }
    setIsFormDialogOpen(false);
    setEditingDriver(null);
  };

  const handleDeleteClick = (driver: Driver) => {
    setDriverToDelete(driver);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (driverToDelete) {
      setDrivers(drivers.filter((d) => d.id !== driverToDelete.id));
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
      case "Active":
        return "default"; // uses accent color
      case "Inactive":
        return "destructive";
      case "On Leave":
        return "secondary"; // uses muted/secondary color
      default:
        return "default";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground flex items-center"><Car className="mr-3 h-8 w-8 text-primary"/>Manage Drivers</h1>
          <p className="text-muted-foreground ml-11">Add, edit, and view driver details for GorkhaTrans.</p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm}>
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
                    <Button
                      variant={"outline"}
                      className={cn(
                        "col-span-3 justify-start text-left font-normal",
                        !formData.joiningDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.joiningDate ? format(formData.joiningDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.joiningDate}
                      onSelect={handleDateChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">Status</Label>
                <Select value={formData.status} onValueChange={handleSelectChange('status') as (value: Driver["status"]) => void}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {driverStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="assignedLedger" className="text-right">Ledger A/C</Label>
                <Input id="assignedLedger" name="assignedLedger" value={formData.assignedLedger} onChange={handleInputChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="address" className="text-right pt-2">Address</Label>
                <Textarea id="address" name="address" value={formData.address || ""} onChange={handleInputChange} className="col-span-3" placeholder="(Optional)" rows={3}/>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                   <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit">Save Driver</Button>
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
            <Input
              placeholder="Search by Name, License, Contact..."
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
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>License No.</TableHead>
                <TableHead>Contact No.</TableHead>
                <TableHead>Joining Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ledger A/C</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDrivers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">No drivers found.</TableCell>
                </TableRow>
              )}
              {filteredDrivers.map((driver) => (
                <TableRow key={driver.id}>
                  <TableCell className="font-medium">{driver.id}</TableCell>
                  <TableCell>{driver.name}</TableCell>
                  <TableCell>{driver.licenseNo}</TableCell>
                  <TableCell>{driver.contactNo}</TableCell>
                  <TableCell>{driver.joiningDate ? format(driver.joiningDate, "PP") : 'N/A'}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={getStatusBadgeVariant(driver.status)} 
                      className={driver.status === "Active" ? "bg-accent text-accent-foreground" : ""}
                    >
                      {driver.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{driver.assignedLedger}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" aria-label="Edit Driver" onClick={() => openEditForm(driver)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog open={isDeleteDialogOpen && driverToDelete?.id === driver.id} onOpenChange={(open) => { if(!open) setDriverToDelete(null); setIsDeleteDialogOpen(open);}}>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" aria-label="Delete Driver" onClick={() => handleDeleteClick(driver)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the driver
                              "{driverToDelete?.name}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {setDriverToDelete(null); setIsDeleteDialogOpen(false);}}>Cancel</AlertDialogCancel>
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

    