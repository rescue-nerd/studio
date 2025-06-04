
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
  AlertDialogTrigger, 
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db, functions } from "@/lib/firebase"; 
import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { 
  collection, 
  getDocs, 
  Timestamp, // Timestamp can still be used for client-side display if needed
  query,
  orderBy
} from "firebase/firestore";
import type { Branch as FirestoreBranch } from "@/types/firestore"; 
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { handleFirebaseError, logError } from "@/lib/firebase-error-handler";

interface Branch extends Omit<FirestoreBranch, 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> {
  id: string; 
  createdAt?: Date | Timestamp; 
  updatedAt?: Date | Timestamp;
  createdBy?: string;
  updatedBy?: string;
}

// Type for data passed to createBranch/updateBranch Cloud Functions
type BranchCallableData = Omit<FirestoreBranch, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>;
type UpdateBranchCallableData = Partial<BranchCallableData> & { branchId: string };


const defaultBranchFormData: Omit<Branch, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> = {
  name: "",
  location: "",
  managerName: "", 
  status: "Active",
};

const createBranchFn = httpsCallable<BranchCallableData, {success: boolean, id: string, message: string}>(functions, 'createBranch');
const updateBranchFn = httpsCallable<UpdateBranchCallableData, {success: boolean, id: string, message: string}>(functions, 'updateBranch');
const deleteBranchFn = httpsCallable<{branchId: string}, {success: boolean, id: string, message: string}>(functions, 'deleteBranch');


export default function BranchManagementPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState<Omit<Branch, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>>(defaultBranchFormData);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Combined loading state
  const [isSubmittingForm, setIsSubmittingForm] = useState(false); // For form submission spinner
  const [isDeleting, setIsDeleting] = useState(false); // For delete action spinner

  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authUser, authLoading, router]);

  const fetchBranches = async () => {
    if (!authUser) return;
    setIsLoading(true);
    try {
      const branchesCollectionRef = collection(db, "branches");
      const q = query(branchesCollectionRef, orderBy("createdAt", "desc")); // Or "name" if preferred
      const querySnapshot = await getDocs(q);
      const fetchedBranches: Branch[] = querySnapshot.docs.map(doc => {
        const data = doc.data() as FirestoreBranch; 
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt, // Convert if needed
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
        };
      });
      setBranches(fetchedBranches);
    } catch (error) {
      logError(error, "Fetching branches");
      handleFirebaseError(error, toast);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if(authUser) {
      fetchBranches();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);


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
    if (!authUser) {
        toast({ title: "Authentication Error", description: "You must be logged in to perform this action.", variant: "destructive"});
        return;
    }
    if (!formData.name || !formData.location) {
      toast({ title: "Validation Error", description: "Branch Name and Location are required.", variant: "destructive" });
      return;
    }
    
    setIsSubmittingForm(true);

    const branchDataPayload: BranchCallableData = {
      name: formData.name,
      location: formData.location,
      managerName: formData.managerName || null, 
      status: formData.status,
      contactEmail: formData.contactEmail || "",
      contactPhone: formData.contactPhone || "",
      managerUserId: formData.managerUserId || "",
    };

    try {
      if (editingBranch) {
        const updatePayload: UpdateBranchCallableData = { ...branchDataPayload, branchId: editingBranch.id };
        const result = await updateBranchFn(updatePayload);
        if (result.data.success) {
            toast({ title: "Success", description: result.data.message });
        } else {
            toast({ title: "Update Failed", description: result.data.message || "Could not update branch.", variant: "destructive" });
        }
      } else {
        const result = await createBranchFn(branchDataPayload);
         if (result.data.success) {
            toast({ title: "Success", description: result.data.message });
        } else {
            toast({ title: "Creation Failed", description: result.data.message || "Could not create branch.", variant: "destructive" });
        }
      }
      setIsFormDialogOpen(false);
      setEditingBranch(null);
      fetchBranches(); 
    } catch (error: any) {
        console.error("Error saving branch: ", error);
        const message = error.message || (editingBranch ? "Failed to update branch." : "Failed to add branch.");
        toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
        setIsSubmittingForm(false);
    }
  };

  const handleDeleteClick = (branch: Branch) => {
    setBranchToDelete(branch);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (branchToDelete) {
      setIsDeleting(true);
      try {
        const result = await deleteBranchFn({ branchId: branchToDelete.id });
        if (result.data.success) {
            toast({ title: "Success", description: result.data.message });
            fetchBranches(); 
        } else {
            toast({ title: "Deletion Failed", description: result.data.message || "Could not delete branch.", variant: "destructive" });
        }
      } catch (error: any) {
        console.error("Error deleting branch: ", error);
        toast({ title: "Error", description: error.message || "Failed to delete branch.", variant: "destructive" });
      } finally {
        setIsDeleting(false);
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

  if (authLoading || (!authUser && !authLoading)) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">{authLoading ? "Loading authentication..." : "Redirecting to login..."}</p>
      </div>
    );
  }
  
  const formatDate = (dateInput: Date | Timestamp | undefined): string => {
    if (!dateInput) return 'N/A';
    const date = dateInput instanceof Timestamp ? dateInput.toDate() : dateInput;
    return date.toLocaleDateString();
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground">Branch Management</h1>
          <p className="text-muted-foreground">Manage your company's branches and their details.</p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm} disabled={isSubmittingForm || isLoading}>
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
                   <Button type="button" variant="outline" disabled={isSubmittingForm}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmittingForm}>
                  {isSubmittingForm && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
          {isLoading ? (
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
                    <TableCell>{formatDate(branch.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" aria-label="Edit Branch" onClick={() => openEditForm(branch)} disabled={isSubmittingForm || isDeleting}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog open={isDeleteDialogOpen && branchToDelete?.id === branch.id} onOpenChange={(open) => { if(!open) setBranchToDelete(null); setIsDeleteDialogOpen(open);}}>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" aria-label="Delete Branch" onClick={() => handleDeleteClick(branch)} disabled={isSubmittingForm || isDeleting}>
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
                              <AlertDialogCancel onClick={() => {setBranchToDelete(null); setIsDeleteDialogOpen(false);}} disabled={isDeleting}>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
                                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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

