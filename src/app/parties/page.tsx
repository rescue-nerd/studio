
"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Search, Edit, Trash2, UsersRound } from "lucide-react";
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

interface Party {
  id: string;
  name: string;
  type: "Consignor" | "Consignee" | "Both";
  contactNo: string;
  panNo?: string;
  address?: string;
  assignedLedger: string;
  status: "Active" | "Inactive";
}

const partyTypes: Party["type"][] = ["Consignor", "Consignee", "Both"];
const partyStatuses: Party["status"][] = ["Active", "Inactive"];

const initialParties: Party[] = [
  { id: "PTY001", name: "Global Traders", type: "Consignor", contactNo: "9800000001", panNo: "PAN123", address: "Kathmandu", assignedLedger: "Ledger-GT", status: "Active" },
  { id: "PTY002", name: "National Distributors", type: "Consignee", contactNo: "9800000002", address: "Pokhara", assignedLedger: "Ledger-ND", status: "Active" },
  { id: "PTY003", name: "Himalayan Goods Co.", type: "Both", contactNo: "9800000003", panNo: "PAN456", assignedLedger: "Ledger-HGC", status: "Inactive" },
  { id: "PTY004", name: "Everest Supplies", type: "Consignor", contactNo: "9800000004", assignedLedger: "Ledger-ES", status: "Active" },
];

const defaultPartyFormData: Omit<Party, 'id'> = {
  name: "",
  type: "Consignor",
  contactNo: "",
  panNo: "",
  address: "",
  assignedLedger: "",
  status: "Active",
};

export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>(initialParties);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [formData, setFormData] = useState<Omit<Party, 'id'> & { id?: string }>(defaultPartyFormData);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [partyToDelete, setPartyToDelete] = useState<Party | null>(null);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleSelectChange = (name: keyof Omit<Party, 'id'>) => (value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openAddForm = () => {
    setEditingParty(null);
    setFormData(defaultPartyFormData);
    setIsFormDialogOpen(true);
  };

  const openEditForm = (party: Party) => {
    setEditingParty(party);
    setFormData(party);
    setIsFormDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.contactNo || !formData.assignedLedger) {
        alert("Please fill all required fields: Name, Contact No, and Assigned Ledger.");
        return;
    }

    if (editingParty) {
      setParties(
        parties.map((p) =>
          p.id === editingParty.id ? { ...editingParty, ...formData } : p
        )
      );
    } else {
      const newId = `PTY${String(parties.length + 1 + Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
      setParties([...parties, { id: newId, ...formData } as Party]);
    }
    setIsFormDialogOpen(false);
    setEditingParty(null);
  };

  const handleDeleteClick = (party: Party) => {
    setPartyToDelete(party);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (partyToDelete) {
      setParties(parties.filter((p) => p.id !== partyToDelete.id));
    }
    setIsDeleteDialogOpen(false);
    setPartyToDelete(null);
  };

  const filteredParties = parties.filter(party =>
    party.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    party.contactNo.includes(searchTerm) ||
    (party.panNo && party.panNo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusBadgeVariant = (status: Party["status"]): "default" | "destructive" => {
    return status === "Active" ? "default" : "destructive";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground flex items-center"><UsersRound className="mr-3 h-8 w-8 text-primary"/>Manage Parties</h1>
          <p className="text-muted-foreground ml-11">Add, edit, and view consignor/consignee details.</p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Party
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingParty ? "Edit Party" : "Add New Party"}</DialogTitle>
              <DialogDescription>
                {editingParty ? "Update the details of the party." : "Enter the details for the new party."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleInputChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">Type</Label>
                <Select value={formData.type} onValueChange={handleSelectChange('type') as (value: Party["type"]) => void}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {partyTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="contactNo" className="text-right">Contact No.</Label>
                <Input id="contactNo" name="contactNo" value={formData.contactNo} onChange={handleInputChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="panNo" className="text-right">PAN No.</Label>
                <Input id="panNo" name="panNo" value={formData.panNo || ""} onChange={handleInputChange} className="col-span-3" placeholder="(Optional)" />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="address" className="text-right pt-2">Address</Label>
                <Textarea id="address" name="address" value={formData.address || ""} onChange={handleInputChange} className="col-span-3" placeholder="(Optional)" rows={3}/>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="assignedLedger" className="text-right">Ledger A/C</Label>
                <Input id="assignedLedger" name="assignedLedger" value={formData.assignedLedger} onChange={handleInputChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">Status</Label>
                <Select value={formData.status} onValueChange={handleSelectChange('status') as (value: Party["status"]) => void}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {partyStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                   <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit">Save Party</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Party List</CardTitle>
          <CardDescription>View, edit, or add new parties (consignors/consignees).</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Name, Contact, PAN..."
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
                <TableHead>Type</TableHead>
                <TableHead>Contact No.</TableHead>
                <TableHead>PAN No.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ledger A/C</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParties.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">No parties found.</TableCell>
                </TableRow>
              )}
              {filteredParties.map((party) => (
                <TableRow key={party.id}>
                  <TableCell className="font-medium">{party.id}</TableCell>
                  <TableCell>{party.name}</TableCell>
                  <TableCell>{party.type}</TableCell>
                  <TableCell>{party.contactNo}</TableCell>
                  <TableCell>{party.panNo || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={getStatusBadgeVariant(party.status)} 
                      className={party.status === "Active" ? "bg-accent text-accent-foreground" : ""}
                    >
                      {party.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{party.assignedLedger}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" aria-label="Edit Party" onClick={() => openEditForm(party)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog open={isDeleteDialogOpen && partyToDelete?.id === party.id} onOpenChange={(open) => { if(!open) setPartyToDelete(null); setIsDeleteDialogOpen(open);}}>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" aria-label="Delete Party" onClick={() => handleDeleteClick(party)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the party "{partyToDelete?.name}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {setPartyToDelete(null); setIsDeleteDialogOpen(false);}}>Cancel</AlertDialogCancel>
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

    