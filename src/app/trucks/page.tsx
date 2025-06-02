
"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Search, Edit, Trash2 } from "lucide-react";
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

interface Truck {
  id: string;
  truckNo: string;
  type: string;
  capacity?: string; // Made optional
  ownerName: string;
  ownerPAN?: string;
  status: "Active" | "Inactive" | "Maintenance";
  assignedLedger: string;
}

const truckTypes = ["6-Wheeler", "10-Wheeler", "12-Wheeler", "Trailer", "Container Truck", "Tanker", "Tipper"];
const truckStatuses: Truck["status"][] = ["Active", "Inactive", "Maintenance"];

const initialTrucks: Truck[] = [
  { id: "TRK001", truckNo: "BA 1 KA 1234", type: "6-Wheeler", capacity: "10 Ton", ownerName: "Ram Transport", ownerPAN: "123456789", status: "Active", assignedLedger: "Ledger-RamT" },
  { id: "TRK002", truckNo: "NA 5 KHA 5678", type: "10-Wheeler", capacity: "16 Ton", ownerName: "Sita Logistics", status: "Active", assignedLedger: "Ledger-SitaL" },
  { id: "TRK003", truckNo: "GA 2 PA 9101", type: "Trailer", capacity: "25 Ton", ownerName: "Himalayan Carriers", ownerPAN: "987654321", status: "Maintenance", assignedLedger: "Ledger-HimalC" },
  { id: "TRK004", truckNo: "LU 3 CHA 1121", type: "Container Truck", ownerName: "Everest Freight", status: "Inactive", assignedLedger: "Ledger-EverestF" },
];

const defaultTruckFormData: Omit<Truck, 'id'> = {
  truckNo: "",
  type: truckTypes[0],
  capacity: "",
  ownerName: "",
  ownerPAN: "",
  status: "Active",
  assignedLedger: "",
};

export default function TrucksPage() {
  const [trucks, setTrucks] = useState<Truck[]>(initialTrucks);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [formData, setFormData] = useState<Omit<Truck, 'id'> & { id?: string }>(defaultTruckFormData);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [truckToDelete, setTruckToDelete] = useState<Truck | null>(null);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof Omit<Truck, 'id'>) => (value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openAddForm = () => {
    setEditingTruck(null);
    setFormData(defaultTruckFormData);
    setIsFormDialogOpen(true);
  };

  const openEditForm = (truck: Truck) => {
    setEditingTruck(truck);
    setFormData(truck);
    setIsFormDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.truckNo || !formData.ownerName || !formData.assignedLedger) {
        alert("Truck No., Owner Name, and Assigned Ledger are required.");
        return;
    }
    if (editingTruck) {
      setTrucks(
        trucks.map((t) =>
          t.id === editingTruck.id ? { ...editingTruck, ...formData } : t
        )
      );
    } else {
      const newId = `TRK${String(trucks.length + 1 + Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
      setTrucks([...trucks, { id: newId, ...formData } as Truck]);
    }
    setIsFormDialogOpen(false);
    setEditingTruck(null);
  };

  const handleDeleteClick = (truck: Truck) => {
    setTruckToDelete(truck);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (truckToDelete) {
      setTrucks(trucks.filter((t) => t.id !== truckToDelete.id));
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
      case "Active":
        return "default"; // uses accent color
      case "Inactive":
        return "destructive";
      case "Maintenance":
        return "secondary"; // uses muted/secondary color
      default:
        return "default";
    }
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
            <Button onClick={openAddForm}>
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
                <Label htmlFor="truckNo" className="text-right">
                  Truck No.
                </Label>
                <Input id="truckNo" name="truckNo" value={formData.truckNo} onChange={handleInputChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">
                  Type
                </Label>
                <Select value={formData.type} onValueChange={handleSelectChange('type')}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {truckTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="capacity" className="text-right">
                  Capacity
                </Label>
                <Input id="capacity" name="capacity" value={formData.capacity || ""} onChange={handleInputChange} className="col-span-3" placeholder="e.g., 10 Ton (Optional)" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="ownerName" className="text-right">
                  Owner Name
                </Label>
                <Input id="ownerName" name="ownerName" value={formData.ownerName} onChange={handleInputChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="ownerPAN" className="text-right">
                  Owner PAN
                </Label>
                <Input id="ownerPAN" name="ownerPAN" value={formData.ownerPAN || ""} onChange={handleInputChange} className="col-span-3" placeholder="(Optional)" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  Status
                </Label>
                <Select value={formData.status} onValueChange={handleSelectChange('status') as (value: Truck["status"]) => void}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {truckStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="assignedLedger" className="text-right">
                  Ledger A/C
                </Label>
                <Input id="assignedLedger" name="assignedLedger" value={formData.assignedLedger} onChange={handleInputChange} className="col-span-3" placeholder="e.g., Ledger-TRK001" required />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                   <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit">Save Truck</Button>
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
            <Input
              placeholder="Search trucks by No, Owner, Type..."
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
                <TableHead>Truck No.</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTrucks.map((truck) => (
                <TableRow key={truck.id}>
                  <TableCell className="font-medium">{truck.id}</TableCell>
                  <TableCell>{truck.truckNo}</TableCell>
                  <TableCell>{truck.type}</TableCell>
                  <TableCell>{truck.capacity || 'N/A'}</TableCell>
                  <TableCell>{truck.ownerName}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={getStatusBadgeVariant(truck.status)} 
                      className={truck.status === "Active" ? "bg-accent text-accent-foreground" : ""}
                    >
                      {truck.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" aria-label="Edit Truck" onClick={() => openEditForm(truck)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog open={isDeleteDialogOpen && truckToDelete?.id === truck.id} onOpenChange={(open) => { if(!open) setTruckToDelete(null); setIsDeleteDialogOpen(open);}}>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" aria-label="Delete Truck" onClick={() => handleDeleteClick(truck)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the truck
                              "{truckToDelete?.truckNo}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {setTruckToDelete(null); setIsDeleteDialogOpen(false);}}>Cancel</AlertDialogCancel>
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

    
