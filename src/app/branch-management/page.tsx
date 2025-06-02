
"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
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
  AlertDialogTrigger, // Added AlertDialogTrigger here
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/firebase"; // Import Firestore instance
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  Timestamp,
  query,
  orderBy
} from "firebase/firestore";
import type { Branch as FirestoreBranch } from "@/types/firestore"; // Import the Firestore Branch type
import { useToast } from "@/hooks/use-toast";


// The local Branch interface should align with FirestoreBranch but 'id' is part of it.
// Timestamps will be converted to Date objects for easier use in the form if needed,
// but for display, we can format Firestore Timestamps directly or convert them.
interface Branch extends Omit<FirestoreBranch, 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> {
  id: string; // Explicitly add id here for local state management
  createdAt?: Date | Timestamp; // Allow both for local state vs. Firestore
  updatedAt?: Date | Timestamp;
  createdBy?: string;
  updatedBy?: string;
}

const defaultBranchFormData: Omit<Branch, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> = {
  name: "",
  location: "",
  managerName: "", // Corresponds to managerName in FirestoreBranch
  status: "Active",
  // contactEmail and contactPhone are not in the simplified form for now
};

const PLACEHOLDER_USER_ID = "system_user_placeholder"; // Replace with actual auth user UID later

export default function BranchManagementPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  // Ensure formData can hold all fields from Branch interface, including optional ones
  const [formData, setFormData] = useState<Omit<Branch, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>>(defaultBranchFormData);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchBranches = async () => {
    setIsLoading(true);
    try {
      const branchesCollectionRef = collection(db, "branches");
      const q = query(branchesCollectionRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedBranches: Branch[] = querySnapshot.docs.map(doc => {
        const data = doc.data() as FirestoreBranch; // Cast to FirestoreBranch
        return {
          ...data,
          id: doc.id,
          // Timestamps are directly used from Firestore
        };
      });
      setBranches(fetchedBranches);
    } catch (error) {
      console.error("Error fetching branches: ", error);
      toast({
        title: "Error",
        description: "Failed to fetch branches. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleStatusChange = (value: "Active" | "Inactive") => {
    setFormData((prev) => ({ ...prev, status: value as FirestoreBranch['status'] }));
  };

  const openAddForm = () => {
    setEditingBranch(null);
    setFormData(defaultBranchFormData);
    setIsFormDialogOpen(true);
  };

  const openEditForm = (branch: Branch) => {
    setEditingBranch(branch);
    // Prepare formData for editing, ensure all relevant fields are included
    const { id, createdAt, updatedAt, createdBy, updatedBy, ...editableData } = branch;
    setFormData({
        name: editableData.name,
        location: editableData.location,
        managerName: editableData.managerName || "",
        status: editableData.status || "Active",
        contactEmail: editableData.contactEmail,
        contactPhone: editableData.contactPhone,
        managerUserId: editableData.managerUserId,
    });
    setIsFormDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.location) {
      toast({ title: "Validation Error", description: "Branch Name and Location are required.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true); // For the operation itself

    const branchDataPayload: Omit<FirestoreBranch, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> & { updatedAt?: Timestamp, createdAt?: Timestamp, createdBy?: string, updatedBy?: string } = {
      name: formData.name,
      location: formData.location,
      managerName: formData.managerName || null, // managerName is correct for FirestoreBranch
      status: formData.status,
      contactEmail: formData.contactEmail || "",
      contactPhone: formData.contactPhone || "",
      managerUserId: formData.managerUserId || "",
    };


    if (editingBranch) {
      // Edit existing branch
      try {
        const branchDocRef = doc(db, "branches", editingBranch.id);
        await updateDoc(branchDocRef, {
            ...branchDataPayload,
            updatedAt: Timestamp.now(),
            updatedBy: PLACEHOLDER_USER_ID, 
        });
        toast({ title: "Success", description: "Branch updated successfully." });
      } catch (error) {
        console.error("Error updating branch: ", error);
        toast({ title: "Error", description: "Failed to update branch.", variant: "destructive" });
      }
    } else {
      // Add new branch
      try {
        await addDoc(collection(db, "branches"), {
            ...branchDataPayload,
            createdAt: Timestamp.now(),
            createdBy: PLACEHOLDER_USER_ID, 
        });
        toast({ title: "Success", description: "Branch added successfully." });
      } catch (error) {
        console.error("Error adding branch: ", error);
        toast({ title: "Error", description: "Failed to add branch.", variant: "destructive" });
      }
    }
    setIsFormDialogOpen(false);
    setEditingBranch(null);
    fetchBranches(); 
  };

  const handleDeleteClick = (branch: Branch) => {
    setBranchToDelete(branch);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (branchToDelete) {
      setIsLoading(true);
      try {
        const branchDocRef = doc(db, "branches", branchToDelete.id);
        await deleteDoc(branchDocRef);
        toast({ title: "Success", description: `Branch "${branchToDelete.name}" deleted.` });
        fetchBranches(); 
      } catch (error) {
        console.error("Error deleting branch: ", error);
        toast({ title: "Error", description: "Failed to delete branch.", variant: "destructive" });
        setIsLoading(false);
      }
    }
    setIsDeleteDialogOpen(false);
    setBranchToDelete(null);
  };

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (branch.managerName && branch.managerName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground">Branch Management</h1>
          <p className="text-muted-foreground">Manage your company's branches and their details.</p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Branch
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingBranch ? "Edit Branch" : "Add New Branch"}</DialogTitle>
              <DialogDescription>
                {editingBranch ? "Update the details of the branch." : "Enter the details for the new branch."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input id="name" name="name" value={formData.name} onChange={handleInputChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="location" className="text-right">
                  Location
                </Label>
                <Input id="location" name="location" value={formData.location} onChange={handleInputChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="managerName" className="text-right">
                  Manager
                </Label>
                <Input id="managerName" name="managerName" value={formData.managerName || ""} onChange={handleInputChange} className="col-span-3" placeholder="Manager's Name (Optional)"/>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="contactEmail" className="text-right">
                  Email
                </Label>
                <Input id="contactEmail" name="contactEmail" type="email" value={formData.contactEmail || ""} onChange={handleInputChange} className="col-span-3" placeholder="Contact Email (Optional)"/>
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="contactPhone" className="text-right">
                  Phone
                </Label>
                <Input id="contactPhone" name="contactPhone" value={formData.contactPhone || ""} onChange={handleInputChange} className="col-span-3" placeholder="Contact Phone (Optional)"/>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  Status
                </Label>
                <Select value={formData.status} onValueChange={handleStatusChange} >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                   <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isLoading && (isFormDialogOpen || isDeleteDialogOpen)}>
                  {(isLoading && isFormDialogOpen) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Branch
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Branch List</CardTitle>
          <CardDescription>View, edit, or add new branches.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search branches..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && branches.length === 0 ? (
            <div className="flex justify-center items-center h-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading branches...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBranches.length === 0 && !isLoading && (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center h-24">
                            No branches found. Add one to get started!
                        </TableCell>
                    </TableRow>
                )}
                {filteredBranches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell>{branch.location}</TableCell>
                    <TableCell>{branch.managerName || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={branch.status === "Active" ? "default" : "destructive"} className={branch.status === "Active" ? "bg-accent text-accent-foreground" : ""}>
                        {branch.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {branch.createdAt instanceof Timestamp ? branch.createdAt.toDate().toLocaleDateString() : 
                       branch.createdAt ? new Date(branch.createdAt as any).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" aria-label="Edit Branch" onClick={() => openEditForm(branch)} disabled={isLoading && isFormDialogOpen}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog open={isDeleteDialogOpen && branchToDelete?.id === branch.id} onOpenChange={(open) => { if(!open) setBranchToDelete(null); setIsDeleteDialogOpen(open);}}>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" aria-label="Delete Branch" onClick={() => handleDeleteClick(branch)} disabled={isLoading && (isFormDialogOpen || isDeleteDialogOpen)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the branch
                                "{branchToDelete?.name}".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => {setBranchToDelete(null); setIsDeleteDialogOpen(false);}}>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={confirmDelete} disabled={isLoading && isDeleteDialogOpen}>
                                {isLoading && isDeleteDialogOpen && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
