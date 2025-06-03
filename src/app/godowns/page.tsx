
"use client";

import { useState, type ChangeEvent, type FormEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Search, Edit, Trash2, Warehouse, Loader2 } from "lucide-react";
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
import { db } from "@/lib/firebase";
import { getFunctions, httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import type { Godown as FirestoreGodown, Branch as FirestoreBranch } from "@/types/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";

interface Godown extends FirestoreGodown {}
interface Branch extends FirestoreBranch {} 

type GodownFormDataCallable = Omit<FirestoreGodown, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>;
type UpdateGodownFormDataCallable = Partial<GodownFormDataCallable> & { godownId: string };

const godownStatuses: FirestoreGodown["status"][] = ["Active", "Inactive", "Operational"];

const defaultGodownFormData: Omit<Godown, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> = {
  name: "",
  branchId: "", 
  location: "",
  status: "Active",
};

const functionsInstance = getFunctions(db.app);
const createGodownFn = httpsCallable<GodownFormDataCallable, {success: boolean, id: string, message: string}>(functionsInstance, 'createGodown');
const updateGodownFn = httpsCallable<UpdateGodownFormDataCallable, {success: boolean, id: string, message: string}>(functionsInstance, 'updateGodown');
const deleteGodownFn = httpsCallable<{godownId: string}, {success: boolean, id: string, message: string}>(functionsInstance, 'deleteGodown');


export default function GodownsPage() {
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]); 
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingGodown, setEditingGodown] = useState<Godown | null>(null);
  const [formData, setFormData] = useState<Omit<Godown, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>>(defaultGodownFormData);
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
      const branchesCollectionRef = collection(db, "branches");
      const q = query(branchesCollectionRef, orderBy("name"));
      const querySnapshot = await getDocs(q);
      const fetchedBranches: Branch[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data() as FirestoreBranch;
        return { ...data, id: docSnap.id };
      });
      setBranches(fetchedBranches);
      if (fetchedBranches.length > 0 && !formData.branchId) {
          setFormData(prev => ({...prev, branchId: fetchedBranches[0].id}));
      }
    } catch (error) {
      console.error("Error fetching branches: ", error);
      toast({ title: "Error", description: "Failed to fetch branches for dropdown.", variant: "destructive" });
    } finally {
      setIsLoadingBranches(false);
    }
  };
  
  const fetchGodowns = async () => {
    if (!authUser) return;
    setIsLoading(true);
    try {
      const godownsCollectionRef = collection(db, "godowns");
      const q = query(godownsCollectionRef, orderBy("name"));
      const querySnapshot = await getDocs(q);
      const fetchedGodowns: Godown[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data() as FirestoreGodown;
        return { ...data, id: docSnap.id };
      });
      setGodowns(fetchedGodowns);
    } catch (error) {
      console.error("Error fetching godowns: ", error);
      toast({ title: "Error", description: "Failed to fetch godowns.", variant: "destructive" });
    } finally {
      setIsLoading(false);
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
  
  const handleSelectChange = (name: keyof Omit<Godown, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => (value: string) => {
    if (name === 'status') {
        setFormData((prev) => ({ ...prev, [name]: value as FirestoreGodown['status'] }));
    } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const openAddForm = () => {
    setEditingGodown(null);
    setFormData({...defaultGodownFormData, branchId: branches[0]?.id || ""});
    setIsFormDialogOpen(true);
  };

  const openEditForm = (godown: Godown) => {
    setEditingGodown(godown);
    const { id, createdAt, createdBy, updatedAt, updatedBy, ...editableData } = godown;
    setFormData(editableData);
    setIsFormDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive"});
      return;
    }
    if (!formData.name || !formData.branchId || !formData.location) {
        toast({ title: "Validation Error", description: "Name, Linked Branch, and Location are required.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);

    const godownDataPayload: GodownFormDataCallable = { ...formData };

    try {
      let result: HttpsCallableResult<{success: boolean; id: string; message: string}>;
      if (editingGodown) {
        result = await updateGodownFn({ godownId: editingGodown.id, ...godownDataPayload });
      } else {
        result = await createGodownFn(godownDataPayload);
      }

      if (result.data.success) {
        toast({ title: "Success", description: result.data.message });
        fetchGodowns();
        setIsFormDialogOpen(false);
        setEditingGodown(null);
      } else {
        toast({ title: "Error", description: result.data.message, variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error saving godown:", error);
      toast({ title: "Error", description: error.message || "Failed to save godown.", variant: "destructive" });
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
        if (result.data.success) {
          toast({ title: "Success", description: result.data.message});
          fetchGodowns();
        } else {
          toast({ title: "Error", description: result.data.message, variant: "destructive" });
        }
      } catch (error: any) {
        console.error("Error deleting godown: ", error);
        toast({ title: "Error", description: error.message || "Failed to delete godown.", variant: "destructive" });
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
    godown.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getBranchNameById(godown.branchId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadgeVariant = (status: Godown["status"]): "default" | "destructive" | "secondary" => {
    switch (status) {
      case "Active":
      case "Operational":
        return "default";
      case "Inactive":
        return "destructive";
      default:
        return "default";
    }
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
          <p className="text-muted-foreground ml-11">Add, edit, and view godown details and their linked branches.</p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm} disabled={isSubmitting || isLoadingBranches || branches.length === 0}>
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
                <Select value={formData.branchId} onValueChange={handleSelectChange('branchId') as (value: string) => void} required disabled={isLoadingBranches || branches.length === 0}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder={isLoadingBranches ? "Loading branches..." : (branches.length === 0 ? "No branches found" : "Select branch")} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="location" className="text-right pt-2">Location/Address</Label>
                <Textarea id="location" name="location" value={formData.location} onChange={handleInputChange} className="col-span-3" required rows={3}/>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">Status</Label>
                <Select value={formData.status} onValueChange={handleSelectChange('status') as (value: FirestoreGodown["status"]) => void}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>{godownStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting || isLoadingBranches || branches.length === 0}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Godown
                </Button>
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
            <Input placeholder="Search by Name, Location, Branch..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading godowns...</p></div>
          ) : (
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
                {filteredGodowns.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={6} className="text-center h-24">No godowns found.</TableCell></TableRow>
                )}
                {filteredGodowns.map((godown) => (
                  <TableRow key={godown.id}>
                    <TableCell className="font-medium">{godown.id}</TableCell>
                    <TableCell>{godown.name}</TableCell>
                    <TableCell>{getBranchNameById(godown.branchId)}</TableCell>
                    <TableCell>{godown.location}</TableCell>
                    <TableCell><Badge variant={getStatusBadgeVariant(godown.status)} className={(godown.status === "Active" || godown.status === "Operational") ? "bg-accent text-accent-foreground" : ""}>{godown.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" aria-label="Edit Godown" onClick={() => openEditForm(godown)} disabled={isSubmitting}><Edit className="h-4 w-4" /></Button>
                        <AlertDialog open={isDeleteDialogOpen && godownToDelete?.id === godown.id} onOpenChange={(open) => { if(!open) setGodownToDelete(null); setIsDeleteDialogOpen(open);}}>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" aria-label="Delete Godown" onClick={() => handleDeleteClick(godown)} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the godown "{godownToDelete?.name}".</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => {setGodownToDelete(null); setIsDeleteDialogOpen(false);}} disabled={isSubmitting}>Cancel</AlertDialogCancel>
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
