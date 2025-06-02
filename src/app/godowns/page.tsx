
"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Search, Edit, Trash2, Warehouse } from "lucide-react";
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

interface Godown {
  id: string;
  name: string;
  branchId: string; 
  location: string;
  status: "Active" | "Inactive";
}

interface MockBranch {
  id: string;
  name: string;
}

// Mock data for branches (normally this would come from a store or API)
const mockBranches: MockBranch[] = [
  { id: "BRN001", name: "Kathmandu Main" },
  { id: "BRN002", name: "Pokhara Hub" },
  { id: "BRN003", name: "Biratnagar Depot" },
  { id: "BRN004", name: "Butwal Office" },
];

const godownStatuses: Godown["status"][] = ["Active", "Inactive"];

const initialGodowns: Godown[] = [
  { id: "GDN001", name: "KTM Central Godown", branchId: "BRN001", location: "Near Ring Road, KTM", status: "Active" },
  { id: "GDN002", name: "Pokhara Lakeside Storage", branchId: "BRN002", location: "Lakeside Area, PKR", status: "Active" },
  { id: "GDN003", name: "KTM Backup Godown", branchId: "BRN001", location: "Industrial Area, KTM", status: "Inactive" },
];

const defaultGodownFormData: Omit<Godown, 'id'> = {
  name: "",
  branchId: mockBranches[0]?.id || "", // Default to first branch or empty if no branches
  location: "",
  status: "Active",
};

export default function GodownsPage() {
  const [godowns, setGodowns] = useState<Godown[]>(initialGodowns);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingGodown, setEditingGodown] = useState<Godown | null>(null);
  const [formData, setFormData] = useState<Omit<Godown, 'id'> & { id?: string }>(defaultGodownFormData);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [godownToDelete, setGodownToDelete] = useState<Godown | null>(null);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleSelectChange = (name: keyof Omit<Godown, 'id'>) => (value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openAddForm = () => {
    setEditingGodown(null);
    // Ensure default branchId is valid or reset
    setFormData({...defaultGodownFormData, branchId: mockBranches[0]?.id || ""});
    setIsFormDialogOpen(true);
  };

  const openEditForm = (godown: Godown) => {
    setEditingGodown(godown);
    setFormData(godown);
    setIsFormDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.branchId || !formData.location) {
        alert("Please fill all required fields: Name, Linked Branch, and Location.");
        return;
    }

    if (editingGodown) {
      setGodowns(
        godowns.map((g) =>
          g.id === editingGodown.id ? { ...editingGodown, ...formData } : g
        )
      );
    } else {
      const newId = `GDN${String(godowns.length + 1 + Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
      setGodowns([...godowns, { id: newId, ...formData } as Godown]);
    }
    setIsFormDialogOpen(false);
    setEditingGodown(null);
  };

  const handleDeleteClick = (godown: Godown) => {
    setGodownToDelete(godown);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (godownToDelete) {
      setGodowns(godowns.filter((g) => g.id !== godownToDelete.id));
    }
    setIsDeleteDialogOpen(false);
    setGodownToDelete(null);
  };

  const getBranchNameById = (branchId: string): string => {
    return mockBranches.find(b => b.id === branchId)?.name || "N/A";
  }

  const filteredGodowns = godowns.filter(godown =>
    godown.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    godown.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getBranchNameById(godown.branchId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadgeVariant = (status: Godown["status"]): "default" | "destructive" => {
    return status === "Active" ? "default" : "destructive";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground flex items-center"><Warehouse className="mr-3 h-8 w-8 text-primary"/>Manage Godowns</h1>
          <p className="text-muted-foreground ml-11">Add, edit, and view godown details and their linked branches.</p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Godown
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingGodown ? "Edit Godown" : "Add New Godown"}</DialogTitle>
              <DialogDescription>
                {editingGodown ? "Update the details of the godown." : "Enter the details for the new godown."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleInputChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="branchId" className="text-right">Linked Branch</Label>
                <Select value={formData.branchId} onValueChange={handleSelectChange('branchId') as (value: string) => void} required>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockBranches.map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="location" className="text-right pt-2">Location/Address</Label>
                <Textarea id="location" name="location" value={formData.location} onChange={handleInputChange} className="col-span-3" required rows={3}/>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">Status</Label>
                <Select value={formData.status} onValueChange={handleSelectChange('status') as (value: Godown["status"]) => void}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {godownStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                   <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit">Save Godown</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Godown List</CardTitle>
          <CardDescription>View, edit, or add new godowns.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Name, Location, Branch..."
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
                <TableHead>Linked Branch</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGodowns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">No godowns found.</TableCell>
                </TableRow>
              )}
              {filteredGodowns.map((godown) => (
                <TableRow key={godown.id}>
                  <TableCell className="font-medium">{godown.id}</TableCell>
                  <TableCell>{godown.name}</TableCell>
                  <TableCell>{getBranchNameById(godown.branchId)}</TableCell>
                  <TableCell>{godown.location}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={getStatusBadgeVariant(godown.status)} 
                      className={godown.status === "Active" ? "bg-accent text-accent-foreground" : ""}
                    >
                      {godown.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" aria-label="Edit Godown" onClick={() => openEditForm(godown)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog open={isDeleteDialogOpen && godownToDelete?.id === godown.id} onOpenChange={(open) => { if(!open) setGodownToDelete(null); setIsDeleteDialogOpen(open);}}>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" aria-label="Delete Godown" onClick={() => handleDeleteClick(godown)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the godown "{godownToDelete?.name}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {setGodownToDelete(null); setIsDeleteDialogOpen(false);}}>Cancel</AlertDialogCancel>
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

    