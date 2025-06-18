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
  AlertDialogTrigger,
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
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { handleSupabaseError, logError } from "@/lib/supabase-error-handler";
import type { Branch as CanonicalBranch, Godown as CanonicalGodown } from "@/types/database";
import { Edit, Loader2, PlusCircle, Search, Trash2, Warehouse } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

// Use canonical types
interface Godown extends CanonicalGodown {}
interface Branch extends CanonicalBranch {} 

// Define form data types based on the canonical Godown type
// Manually define Insert and Update types if not exported from database.ts
type GodownInsert = Omit<Godown, 'id' | 'createdAt' | 'updatedAt'>;
type GodownUpdate = Partial<Omit<Godown, 'id' | 'createdAt' | 'updatedAt'>>;

type GodownFormDataCallable = Omit<Godown, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateGodownFormDataCallable = Partial<GodownFormDataCallable> & { godownId: string };

// const godownStatuses: Godown["status"][] = ["Active", "Inactive", "Operational"]; // Status field not in canonical Godown, use isActive

const defaultGodownFormData: GodownFormDataCallable = {
  name: "",
  branchId: "", 
  // location: "", // location field not in canonical Godown, use address
  address: "", // Use address from canonical Godown
  // status: "Active", // status field not in canonical Godown, use isActive
  isActive: true, // Use isActive from canonical Godown
  contactNo: "", // Added contactNo as it is in canonical Godown
};

const createGodownFn = async (data: GodownInsert) => {
  const response = await supabase.functions.invoke('create-godown', { body: data });
  return response.data as {success: boolean, id: string, message: string};
};

const updateGodownFn = async (data: { godownId: string } & GodownUpdate) => {
  const { godownId, ...updateData } = data;
  const response = await supabase.functions.invoke('update-godown', { body: { godownId, ...updateData } });
  return response.data as {success: boolean, id: string, message: string};
};

const deleteGodownFn = async (data: {godownId: string}) => {
  const response = await supabase.functions.invoke('delete-godown', { body: data });
  return response.data as {success: boolean, id: string, message: string};
};

export default function GodownsPage() {
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]); 
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingGodown, setEditingGodown] = useState<Godown | null>(null);
  const [formData, setFormData] = useState<GodownFormDataCallable>(defaultGodownFormData);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [godownToDelete, setGodownToDelete] = useState<Godown | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    setIsLoadingBranches(true);
    try {
      const { data, error } = await supabase
        .from('branches') // Correct table name
        .select('*')
        .order('name');
      if (error) throw error;
      setBranches((data as Branch[]) || []); // Cast to Branch[]
      if (data && data.length > 0 && !formData.branchId) {
        setFormData(prev => ({...prev, branchId: data[0].id}));
      }
    } catch (error) {
      logError(error, "Error fetching branches");
      handleSupabaseError(error, toast);
    } finally {
      setIsLoadingBranches(false);
    }
  };
  
  const fetchGodowns = async () => {
    try {
      const { data, error } = await supabase
        .from('godowns') // Correct table name
        .select('*')
        .order('name');
      
      if (error) throw error;
      setGodowns((data as Godown[]) || []); // Cast to Godown[]
    } catch (error) {
      console.error("Error fetching godowns: ", error);
      handleSupabaseError(error, toast);
    }
  };

  useEffect(() => {
    if(authUser){
      fetchBranches(); 
      fetchGodowns();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleSelectChange = (name: keyof GodownFormDataCallable) => (value: string | boolean) => {
    // Removed 'status' handling as it is not in canonical Godown
    // For isActive (boolean)
    if (name === 'isActive') {
        setFormData(prev => ({ ...prev, [name]: value as boolean }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value as string }));
    }
  };

  const openAddForm = () => {
    setEditingGodown(null);
    setFormData({...defaultGodownFormData, branchId: branches[0]?.id || ""});
    setIsFormDialogOpen(true);
  };

  const openEditForm = (godown: Godown) => {
    setEditingGodown(godown);
    const { id, createdAt, updatedAt, ...editableData } = godown;
    // Ensure all fields in editableData exist in GodownFormDataCallable
    const currentFormData: GodownFormDataCallable = {
        name: editableData.name,
        branchId: editableData.branchId,
        address: editableData.address || "", // Use address
        contactNo: editableData.contactNo || "",
        isActive: editableData.isActive,
    };
    setFormData(currentFormData);
    setIsFormDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive"});
      return;
    }
    // Update validation to match canonical Godown type fields
    if (!formData.name || !formData.branchId || !formData.address) {
        toast({ title: "Validation Error", description: "Name, Linked Branch, and Address are required.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);

    const godownDataPayload: GodownInsert | GodownUpdate = { ...formData };

    try {
      let result;
      if (editingGodown) {
        result = await updateGodownFn({ godownId: editingGodown.id, ...(godownDataPayload as GodownUpdate) });
      } else {
        result = await createGodownFn(godownDataPayload as GodownInsert);
      }

      if (result.success) {
        toast({ title: "Success", description: result.message });
        fetchGodowns();
        setIsFormDialogOpen(false);
        setEditingGodown(null);
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      logError(error, "Error saving godown");
      handleSupabaseError(error, toast);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (godown: Godown) => {
    setGodownToDelete(godown);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (godownToDelete) {
      setIsSubmitting(true);
      try {
        const result = await deleteGodownFn({ godownId: godownToDelete.id });
        if (result.success) {
          toast({ title: "Success", description: result.message});
          fetchGodowns();
        } else {
          toast({ title: "Error", description: result.message, variant: "destructive" });
        }
      } catch (error) {
        logError(error, "Error deleting godown");
        handleSupabaseError(error, toast);
      } finally {
        setIsSubmitting(false);
        setIsDeleteDialogOpen(false);
        setGodownToDelete(null);
      }
    }
  };

  const getBranchNameById = (branchId: string): string => {
    return branches.find(b => b.id === branchId)?.name || "N/A";
  };

  const filteredGodowns = godowns.filter(godown =>
    godown.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (godown.address && godown.address.toLowerCase().includes(searchTerm.toLowerCase())) || // Use address for filtering
    getBranchNameById(godown.branchId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Removed getStatusBadgeVariant as 'status' field is not in canonical Godown.
  // Use 'isActive' field for similar logic if needed.
  const getIsActiveBadgeVariant = (isActive: boolean | undefined): "default" | "secondary" => {
    return isActive ? "default" : "secondary";
  };

  if (authLoading || (!authUser && !authLoading)) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">{authLoading ? "Authenticating..." : "Redirecting to login..."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground flex items-center"><Warehouse className="mr-3 h-8 w-8 text-primary"/>Manage Godowns</h1>
          <p className="text-muted-foreground ml-11">Add, edit, and view godown details for GorkhaTrans.</p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm} disabled={isSubmitting || isLoading}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Godown
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
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
                <Select value={formData.branchId} onValueChange={handleSelectChange('branchId') as (value: string) => void}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="address" className="text-right">Address</Label> 
                <Input id="address" name="address" value={formData.address || ""} onChange={handleInputChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="contactNo" className="text-right">Contact No.</Label>
                <Input id="contactNo" name="contactNo" value={formData.contactNo || ""} onChange={handleInputChange} className="col-span-3" placeholder="(Optional)"/>
              </div>
              {/* Removed Status field, using isActive instead */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isActive" className="text-right">Active</Label>
                <Select value={formData.isActive ? "true" : "false"} onValueChange={(value) => handleSelectChange('isActive')(value === "true")}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingGodown ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    editingGodown ? "Update Godown" : "Create Godown"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Godowns List</CardTitle>
          <CardDescription>
            View and manage all godowns in the system.
          </CardDescription>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search godowns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Address</TableHead> {/* Changed from Location to Address */} 
                  <TableHead>Contact No.</TableHead>
                  <TableHead>Status</TableHead> {/* Changed from Status to Is Active */} 
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGodowns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No godowns found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGodowns.map((godown) => (
                    <TableRow key={godown.id}>
                      <TableCell>{godown.name}</TableCell>
                      <TableCell>{getBranchNameById(godown.branchId)}</TableCell>
                      <TableCell>{godown.address || "N/A"}</TableCell> {/* Use address */} 
                      <TableCell>{godown.contactNo || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant={getIsActiveBadgeVariant(godown.isActive)} className={godown.isActive ? "bg-accent text-accent-foreground" : ""}>
                          {godown.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditForm(godown)}
                          disabled={isSubmitting}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog open={isDeleteDialogOpen && godownToDelete?.id === godown.id} onOpenChange={setIsDeleteDialogOpen}>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(godown)}
                              disabled={isSubmitting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the godown
                                and all associated data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting}>
                                {isSubmitting ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  "Delete"
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
