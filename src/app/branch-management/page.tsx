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
    AlertDialogTrigger
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
import { db } from "@/lib/supabase-db";
import { handleSupabaseError } from "@/lib/supabase-error-handler";
import type { Branch } from "@/types/database";
import { Edit, Loader2, PlusCircle, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

interface BranchFormData {
  name: string;
  location: string; // Matches Branch.location
  managerName?: string;
  status: 'Active' | 'Inactive'; // Form handles Active/Inactive
  contactEmail?: string;
  contactPhone?: string;
  managerUserId?: string;
  code?: string; // Corresponds to Branch.branch_code
}

const defaultBranchFormData: BranchFormData = {
  name: "",
  location: "",
  managerName: "",
  status: "Active", // Default to Active
  contactEmail: "",
  contactPhone: "",
  managerUserId: "",
  code: "",
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

  const handleStatusChange = (value: string) => { // Value will be "Active" or "Inactive"
    setFormData((prev) => ({ ...prev, status: value as 'Active' | 'Inactive' }));
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
      location: branch.location, // Use location
      managerName: branch.manager_name || "",
      status: branch.status === 'Inactive' ? 'Inactive' : 'Active', // Map DB status to form status
      contactEmail: branch.contact_email || "",
      contactPhone: branch.contact_phone || "",
      managerUserId: branch.manager_user_id || "",
      code: branch.branch_code || "",
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

    const branchPayload = {
        name: formData.name,
        location: formData.location, // Use location
        managerName: formData.managerName || null, // camelCase for Edge Function
        status: formData.status, // Use status
        contactEmail: formData.contactEmail || null, // camelCase for Edge Function
        contactPhone: formData.contactPhone || null, // camelCase for Edge Function
        managerUserId: formData.managerUserId || null, // camelCase for Edge Function
        branchCode: formData.code || null, // camelCase for Edge Function
    };

    // Adjust payload for createBranch if its type is more specific
    const createPayload = {
      ...branchPayload,
      name: formData.name, // ensure required fields
      location: formData.location, // ensure required fields
      branchCode: formData.code || undefined, // Match expected type for create (if different)
      status: formData.status as 'Active' | 'Inactive', // Match expected type for create
    };


    try {
      if (editingBranch) {
        await db.updateBranch(editingBranch.id, branchPayload as Partial<Branch>);
        toast({ title: "Success", description: "Branch updated successfully" });
      } else {
        // Pass a payload that matches createBranch's expected type
        // This might need adjustment based on the exact signature of db.createBranch
        await db.createBranch(createPayload as any); 
        toast({ title: "Success", description: "Branch created successfully" });
      }
      setIsFormDialogOpen(false);
      setEditingBranch(null);
      fetchBranches(); // Refresh the list
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
        fetchBranches(); // Refresh the list
      } catch (error) {
        console.error("Error deleting branch:", error);
        handleSupabaseError(error, toast);
      } finally {
        setIsDeleting(false);
        // It's important to close the dialog and clear branchToDelete in both success and error cases
        // if the operation itself (delete) is done.
        setIsDeleteDialogOpen(false); 
        setBranchToDelete(null);
      }
    }
    // These lines were outside the if block, moved them into finally for safety.
    // setIsDeleteDialogOpen(false);
    // setBranchToDelete(null);
  };

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (branch.location && branch.location.toLowerCase().includes(searchTerm.toLowerCase())) || // Use location
    (branch.manager_name && branch.manager_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (branch.branch_code && branch.branch_code.toLowerCase().includes(searchTerm.toLowerCase()))
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
            <Button onClick={openAddForm} disabled={isLoading || isSubmittingForm}>
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
                  <TableHead>Code</TableHead>
                  <TableHead>Location/Address</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Status</TableHead>
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
                    <TableCell>{branch.branch_code || 'N/A'}</TableCell>
                    <TableCell>{branch.location || 'N/A'}</TableCell> 
                    <TableCell>{branch.manager_name || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={branch.status === 'Active' ? "default" : "secondary"} 
                        className={branch.status === 'Active' 
                                    ? "bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100" 
                                    : "bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100"}
                      >
                        {branch.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" aria-label="Edit Branch" onClick={() => openEditForm(branch)} disabled={isSubmittingForm || isDeleting}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {/* AlertDialog for delete confirmation */}
                        <AlertDialog 
                            open={isDeleteDialogOpen && branchToDelete?.id === branch.id} 
                            onOpenChange={(open) => { 
                                if(!open) setBranchToDelete(null); // Clear selection if dialog is closed
                                setIsDeleteDialogOpen(open);
                            }}
                        >
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
                              <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
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

      {/* Form Dialog */}
      <Dialog open={isFormDialogOpen} onOpenChange={(open) => {
          if (!open) {
              setEditingBranch(null); // Clear editing state when dialog closes
              setFormData(defaultBranchFormData); // Reset form
          }
          setIsFormDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBranch ? "Edit Branch" : "Add New Branch"}</DialogTitle>
            <DialogDescription>
              {editingBranch
                ? "Update the details of the existing branch."
                : "Fill in the details for the new branch."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Branch Name</Label>
              <Input id="name" name="name" value={formData.name} onChange={handleInputChange} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="code">Branch Code</Label>
              <Input id="code" name="code" value={formData.code || ''} onChange={handleInputChange} placeholder="(Optional)"/>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Location/Address</Label>
              <Input id="location" name="location" value={formData.location} onChange={handleInputChange} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="managerName">Manager Name</Label>
              <Input id="managerName" name="managerName" value={formData.managerName || ''} onChange={handleInputChange} placeholder="(Optional)"/>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input id="contactPhone" name="contactPhone" type="tel" value={formData.contactPhone || ''} onChange={handleInputChange} placeholder="(Optional)"/>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input id="contactEmail" name="contactEmail" type="email" value={formData.contactEmail || ''} onChange={handleInputChange} placeholder="(Optional)"/>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="managerUserId">Manager User ID</Label>
              <Input id="managerUserId" name="managerUserId" value={formData.managerUserId || ''} onChange={handleInputChange} placeholder="(Optional, User ID)"/>
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
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmittingForm}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmittingForm}>
                {isSubmittingForm && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingBranch ? "Update Branch" : "Create Branch"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}