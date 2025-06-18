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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { handleSupabaseError, logError } from "@/lib/supabase-error-handler";
// import type { Party as FirestoreParty } from "@/types/firestore";
import type { Party as CanonicalParty } from "@/types/database";
import { Edit, Loader2, PlusCircle, Search, Trash2, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

// Use canonical types
interface Party extends CanonicalParty {}

// Define form data types based on the canonical Party type
// Manually define Insert and Update types if not exported from database.ts
type PartyInsert = Omit<Party, 'id' | 'createdAt' | 'updatedAt'>;
type PartyUpdate = Partial<Omit<Party, 'id' | 'createdAt' | 'updatedAt'>>;

type PartyFormDataCallable = Omit<Party, 'id' | 'createdAt' | 'updatedAt'>;
type UpdatePartyFormDataCallable = Partial<PartyFormDataCallable> & { partyId: string };


const partyTypes: Array<Party['type']> = ["customer", "supplier", "both"]; // Use canonical types
// const partyStatuses: Party["status"][] = ["Active", "Inactive"]; // Status field not in canonical Party, use isActive

const defaultPartyFormData: PartyFormDataCallable = {
  name: "",
  type: "customer", // Default to customer
  contactNo: "",
  // panNo: "", // panNo field not in canonical Party
  address: "",
  // city: "", // city field not in canonical Party
  // state: "", // state field not in canonical Party
  // country: "", // country field not in canonical Party
  email: "", // Added email as it is in canonical Party
  assignedLedgerId: "",
  // status: "Active", // status field not in canonical Party, use isActive
  isActive: true, // Use isActive from canonical Party
  branchId: "", // Assuming branchId is required, add a default or fetch from context
};

const createPartyFn = async (data: PartyInsert) => {
  const response = await supabase.functions.invoke('create-party', { body: data });
  return response.data as {success: boolean, id: string, message: string};
};

const updatePartyFn = async (data: { partyId: string } & PartyUpdate) => {
  const { partyId, ...updateData } = data;
  const response = await supabase.functions.invoke('update-party', { body: { partyId, ...updateData } });
  return response.data as {success: boolean, id: string, message: string};
};

const deletePartyFn = async (data: {partyId: string}) => {
  const response = await supabase.functions.invoke('delete-party', { body: data });
  return response.data as {success: boolean, id: string, message: string};
};

export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [formData, setFormData] = useState<PartyFormDataCallable>(defaultPartyFormData);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [partyToDelete, setPartyToDelete] = useState<Party | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authUser, authLoading, router]);

  const fetchParties = async () => {
    try {
      const { data, error } = await supabase
        .from('parties') // Correct table name
        .select('*')
        .order('name');
      
      if (error) throw error;
      setParties((data as Party[]) || []); // Cast to Party[]
    } catch (error) {
      console.error("Error fetching parties: ", error);
      handleSupabaseError(error, toast);
    }
  };

  useEffect(() => {
    if(authUser){
      fetchParties();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleSelectChange = (name: keyof PartyFormDataCallable) => (value: string | boolean) => {
    if (name === 'type') {
        setFormData((prev) => ({ ...prev, [name]: value as Party['type'] }));
    // } else if (name === 'status') { // Removed status handling
    //     setFormData((prev) => ({ ...prev, [name]: value as Party['status'] }));
    } else if (name === 'isActive') {
        setFormData(prev => ({ ...prev, [name]: value as boolean }));
    } else {
        setFormData((prev) => ({ ...prev, [name]: value as string }));
    }
  };

  const openAddForm = () => {
    setEditingParty(null);
    setFormData(defaultPartyFormData);
    setIsFormDialogOpen(true);
  };

  const openEditForm = (party: Party) => {
    setEditingParty(party);
    const { id, createdAt, updatedAt, ...editableData } = party;
    // Ensure all fields in editableData exist in PartyFormDataCallable
    const currentFormData: PartyFormDataCallable = {
        name: editableData.name,
        type: editableData.type,
        contactNo: editableData.contactNo || "",
        address: editableData.address || "",
        email: editableData.email || "",
        assignedLedgerId: editableData.assignedLedgerId,
        isActive: editableData.isActive,
        branchId: editableData.branchId,
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
    // Update validation to match canonical Party type fields
    if (!formData.name || !formData.contactNo || !formData.assignedLedgerId || !formData.branchId) {
        toast({ title: "Validation Error", description: "Name, Contact No., Ledger A/C ID, and Branch ID are required.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);

    const partyDataPayload: PartyInsert | PartyUpdate = { ...formData };

    try {
      let result;
      if (editingParty) {
        result = await updatePartyFn({ partyId: editingParty.id, ...(partyDataPayload as PartyUpdate) });
      } else {
        result = await createPartyFn(partyDataPayload as PartyInsert);
      }

      if (result.success) {
        toast({ title: "Success", description: result.message });
        fetchParties();
        setIsFormDialogOpen(false);
        setEditingParty(null);
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      logError(error, "Failed to save party");
      handleSupabaseError(error, toast);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (party: Party) => {
    setPartyToDelete(party);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (partyToDelete) {
      setIsSubmitting(true);
      try {
        const result = await deletePartyFn({ partyId: partyToDelete.id });
        if (result.success) {
          toast({ title: "Success", description: result.message});
          fetchParties();
        } else {
          toast({ title: "Error", description: result.message, variant: "destructive" });
        }
      } catch (error) {
        logError(error, "Error deleting party");
        handleSupabaseError(error, toast);
      } finally {
        setIsSubmitting(false);
        setIsDeleteDialogOpen(false);
        setPartyToDelete(null);
      }
    }
  };

  const filteredParties = parties.filter(party =>
    party.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (party.contactNo && party.contactNo.includes(searchTerm)) || // Check if contactNo exists
    (party.email && party.email.toLowerCase().includes(searchTerm.toLowerCase())) // Check if email exists
    // (party.panNo && party.panNo.toLowerCase().includes(searchTerm.toLowerCase())) // panNo not in canonical Party
  );

  // Removed getStatusBadgeVariant as 'status' field is not in canonical Party.
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
          <h1 className="text-3xl font-headline font-bold text-foreground flex items-center"><UsersRound className="mr-3 h-8 w-8 text-primary"/>Manage Parties</h1>
          <p className="text-muted-foreground ml-11">Add, edit, and view consignor/consignee details.</p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm} disabled={isSubmitting || isLoading}>
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
                <Select value={formData.type} onValueChange={handleSelectChange('type') as (value: Party['type']) => void}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{partyTypes.map(type => <SelectItem key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="contactNo" className="text-right">Contact No.</Label>
                <Input id="contactNo" name="contactNo" value={formData.contactNo || ""} onChange={handleInputChange} className="col-span-3" required />
              </div>
              {/* Removed PAN No. field */}
              {/* <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="panNo" className="text-right">PAN No.</Label>
                <Input id="panNo" name="panNo" value={formData.panNo || ""} onChange={handleInputChange} className="col-span-3" placeholder="(Optional)" />
              </div> */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">Email</Label>
                <Input id="email" name="email" type="email" value={formData.email || ""} onChange={handleInputChange} className="col-span-3" placeholder="(Optional)" />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="address" className="text-right pt-2">Address</Label>
                <Textarea id="address" name="address" value={formData.address || ""} onChange={handleInputChange} className="col-span-3" placeholder="(Optional)" rows={3}/>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="branchId" className="text-right">Branch ID</Label>
                <Input id="branchId" name="branchId" value={formData.branchId || ''} onChange={handleInputChange} className="col-span-3" placeholder="e.g., Branch-XYZ" required />
              </div>
              {/* city, state, country fields can be added similarly if needed */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="assignedLedgerId" className="text-right">Ledger A/C ID</Label>
                <Input id="assignedLedgerId" name="assignedLedgerId" value={formData.assignedLedgerId} onChange={handleInputChange} className="col-span-3" required />
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
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Party
                </Button>
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
            <Input placeholder="Search by Name, Contact, PAN..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center items-center h-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading parties...</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact No.</TableHead>
                  {/* <TableHead>PAN No.</TableHead> */}
                  <TableHead>Email</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Branch ID</TableHead>
                  <TableHead>Status</TableHead> {/* Changed from Status to Is Active */} 
                  <TableHead>Ledger A/C ID</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParties.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={8} className="text-center h-24">No parties found.</TableCell></TableRow>
                )}
                {filteredParties.map((party) => (
                  <TableRow key={party.id}>
                    <TableCell className="font-medium">{party.id}</TableCell>
                    <TableCell>{party.name}</TableCell>
                    <TableCell>{party.type.charAt(0).toUpperCase() + party.type.slice(1)}</TableCell>
                    <TableCell>{party.contactNo || 'N/A'}</TableCell>
                    {/* <TableCell>{party.panNo || 'N/A'}</TableCell> */}
                    <TableCell>{party.email || 'N/A'}</TableCell>
                    <TableCell>{party.address || 'N/A'}</TableCell>
                    <TableCell>{party.branchId}</TableCell>
                    <TableCell><Badge variant={getIsActiveBadgeVariant(party.isActive)} className={party.isActive ? "bg-accent text-accent-foreground" : ""}>{party.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell>{party.assignedLedgerId}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" aria-label="Edit Party" onClick={() => openEditForm(party)} disabled={isSubmitting}><Edit className="h-4 w-4" /></Button>
                        <AlertDialog open={isDeleteDialogOpen && partyToDelete?.id === party.id} onOpenChange={(open) => { if(!open) setPartyToDelete(null); setIsDeleteDialogOpen(open);}}>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" aria-label="Delete Party" onClick={() => handleDeleteClick(party)} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the party "{partyToDelete?.name}".</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => {setPartyToDelete(null); setIsDeleteDialogOpen(false);}} disabled={isSubmitting}>Cancel</AlertDialogCancel>
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
