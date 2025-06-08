"use client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
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
    DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { handleSupabaseError } from "@/lib/supabase-error-handler";
import { db } from "@/lib/supabase-db";
import type { Branch } from "@/types/database";
import { Edit, Loader2, PlusCircle, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

interface BranchFormData {
  name: string;
  location: string;
  managerName: string;
  status: "Active" | "Inactive";
  contactEmail?: string;
  contactPhone?: string;
  managerUserId?: string;
}

const defaultBranchFormData: BranchFormData = {
  name: "",
  location: "",
  managerName: "",
  status: "Active",
};

export default function BranchManagementPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState<BranchFormData>(defaultBranchFormData);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      const fetchedBranches = await db.getBranches();
      setBranches(fetchedBranches);
    } catch (error) {
      console.error("Error fetching branches:", error);
      handleSupabaseError(error, toast);
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
    setFormData((prev) => ({ ...prev, status: value }));
  };

  const openAddForm = () => {
    setEditingBranch(null);
    setFormData(defaultBranchFormData);
    setIsFormDialogOpen(true);
  };

  const openEditForm = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      location: branch.address || "",
      managerName: branch.managerName || "",
      status: branch.isActive ? "Active" : "Inactive",
      contactEmail: branch.email,
      contactPhone: branch.contactNo,
      managerUserId: branch.managerUserId,
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

    try {
      if (editingBranch) {
        const updatedBranch = await db.updateBranch(editingBranch.id, {
          name: formData.name,
          address: formData.location,
          managerName: formData.managerName,
          isActive: formData.status === "Active",
          email: formData.contactEmail,
          contactNo: formData.contactPhone,
          managerUserId: formData.managerUserId
        });
        toast({ title: "Success", description: "Branch updated successfully" });
      } else {
        const newBranch = await db.createBranch({
          name: formData.name,
          address: formData.location,
          managerName: formData.managerName,
          isActive: formData.status === "Active",
          email: formData.contactEmail,
          contactNo: formData.contactPhone,
          managerUserId: formData.managerUserId
        });
        toast({ title: "Success", description: "Branch created successfully" });
      }
      setIsFormDialogOpen(false);
      setEditingBranch(null);
      fetchBranches();
    } catch (error) {
      console.error("Error saving branch:", error);
      handleSupabaseError(error, toast);
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
        await db.deleteBranch(branchToDelete.id);
        toast({ title: "Success", description: "Branch deleted successfully" });
        fetchBranches();
      } catch (error) {
        console.error("Error deleting branch:", error);
        handleSupabaseError(error, toast);
      } finally {
        setIsDeleting(false);
      }
    }
    setIsDeleteDialogOpen(false);
    setBranchToDelete(null);
  };

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (branch.address && branch.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
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

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Branch Management</CardTitle>
          <CardDescription>Manage your branches and their details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search branches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button onClick={openAddForm}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Branch
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBranches.length === 0 && !isLoading && (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">
                            No branches found. Add one to get started!
                        </TableCell>
                    </TableRow>
                )}
                {filteredBranches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell>{branch.address || branch.location || 'N/A'}</TableCell>
                    <TableCell>{branch.managerName || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={branch.isActive ? "default" : "destructive"} className={branch.isActive ? "bg-accent text-accent-foreground" : ""}>
                        {branch.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
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

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBranch ? "Edit Branch" : "Add Branch"}</DialogTitle>
            <DialogDescription>
              {editingBranch
                ? "Update the details of the branch."
                : "Fill in the branch details below."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Branch Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="managerName">Manager Name</Label>
                <Input
                  id="managerName"
                  name="managerName"
                  value={formData.managerName || ''}
                  onChange={handleInputChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmittingForm}>
                {isSubmittingForm && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingBranch ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the branch
              and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}