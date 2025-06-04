
"use client";

import { useState, type ChangeEvent, type FormEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Search, Edit, Trash2, UsersRound, Loader2 } from "lucide-react";
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
import { db, functions } from "@/lib/firebase";
import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import type { Party as FirestoreParty } from "@/types/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { handleFirebaseError, logError } from "@/lib/firebase-error-handler";

interface Party extends FirestoreParty {}
type PartyFormDataCallable = Omit<FirestoreParty, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>;
type UpdatePartyFormDataCallable = Partial<PartyFormDataCallable> & { partyId: string };


const partyTypes: FirestoreParty["type"][] = ["Consignor", "Consignee", "Both"];
const partyStatuses: FirestoreParty["status"][] = ["Active", "Inactive"];

const defaultPartyFormData: Omit<Party, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> = {
  name: "",
  type: "Consignor",
  contactNo: "",
  panNo: "",
  address: "",
  city: "",
  state: "",
  country: "",
  assignedLedgerId: "",
  status: "Active",
};

const createPartyFn = httpsCallable<PartyFormDataCallable, {success: boolean, id: string, message: string}>(functions, 'createParty');
const updatePartyFn = httpsCallable<UpdatePartyFormDataCallable, {success: boolean, id: string, message: string}>(functions, 'updateParty');
const deletePartyFn = httpsCallable<{partyId: string}, {success: boolean, id: string, message: string}>(functions, 'deleteParty');


export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [formData, setFormData] = useState<Omit<Party, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>>(defaultPartyFormData);
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
    if(!authUser) return;
    setIsLoading(true);
    try {
      const partiesCollectionRef = collection(db, "parties");
      const q = query(partiesCollectionRef, orderBy("name"));
      const querySnapshot = await getDocs(q);
      const fetchedParties: Party[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data() as FirestoreParty;
        return { ...data, id: docSnap.id };
      });
      setParties(fetchedParties);
    } catch (error) {
      logError(error, "Failed to fetch parties");
      handleFirebaseError(error, toast, {
        "permission-denied": "You don't have permission to view parties.",
        "unauthenticated": "Please log in to view parties."
      });
    } finally {
      setIsLoading(false);
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
  
  const handleSelectChange = (name: keyof Omit<Party, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => (value: string) => {
    if (name === 'type') {
        setFormData((prev) => ({ ...prev, [name]: value as FirestoreParty['type'] }));
    } else if (name === 'status') {
        setFormData((prev) => ({ ...prev, [name]: value as FirestoreParty['status'] }));
    } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const openAddForm = () => {
    setEditingParty(null);
    setFormData(defaultPartyFormData);
    setIsFormDialogOpen(true);
  };

  const openEditForm = (party: Party) => {
    setEditingParty(party);
    const { id, createdAt, createdBy, updatedAt, updatedBy, ...editableData } = party;
    setFormData(editableData);
    setIsFormDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive"});
      return;
    }
    if (!formData.name || !formData.contactNo || !formData.assignedLedgerId) {
        toast({ title: "Validation Error", description: "Name, Contact No., and Ledger A/C ID are required.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);

    const partyDataPayload: PartyFormDataCallable = { ...formData };

    try {
      let result: HttpsCallableResult<{success: boolean; id: string; message: string}>;
      if (editingParty) {
        result = await updatePartyFn({ partyId: editingParty.id, ...partyDataPayload });
      } else {
        result = await createPartyFn(partyDataPayload);
      }

      if (result.data.success) {
        toast({ title: "Success", description: result.data.message });
        fetchParties();
        setIsFormDialogOpen(false);
        setEditingParty(null);
      } else {
        toast({ title: "Error", description: result.data.message, variant: "destructive" });
      }
    } catch (error) {
      logError(error, "Failed to save party");
      handleFirebaseError(error, toast, {
        "permission-denied": "You don't have permission to modify parties.",
        "unauthenticated": "Please log in to continue."
      });
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
        if (result.data.success) {
          toast({ title: "Success", description: result.data.message});
          fetchParties();
        } else {
          toast({ title: "Error", description: result.data.message, variant: "destructive" });
        }
      } catch (error: any) {
        console.error("Error deleting party: ", error);
        toast({ title: "Error", description: error.message || "Failed to delete party.", variant: "destructive" });
      } finally {
        setIsSubmitting(false);
        setIsDeleteDialogOpen(false);
        setPartyToDelete(null);
      }
    }
  };

  const filteredParties = parties.filter(party =>
    party.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    party.contactNo.includes(searchTerm) ||
    (party.panNo && party.panNo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusBadgeVariant = (status: Party["status"]): "default" | "destructive" => {
    return status === "Active" ? "default" : "destructive";
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
                <Select value={formData.type} onValueChange={handleSelectChange('type') as (value: FirestoreParty["type"]) => void}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{partyTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
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
              {/* city, state, country fields can be added similarly if needed */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="assignedLedgerId" className="text-right">Ledger A/C ID</Label>
                <Input id="assignedLedgerId" name="assignedLedgerId" value={formData.assignedLedgerId} onChange={handleInputChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">Status</Label>
                <Select value={formData.status} onValueChange={handleSelectChange('status') as (value: FirestoreParty["status"]) => void}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>{partyStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
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
                  <TableHead>PAN No.</TableHead>
                  <TableHead>Status</TableHead>
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
                    <TableCell>{party.type}</TableCell>
                    <TableCell>{party.contactNo}</TableCell>
                    <TableCell>{party.panNo || 'N/A'}</TableCell>
                    <TableCell><Badge variant={getStatusBadgeVariant(party.status)} className={party.status === "Active" ? "bg-accent text-accent-foreground" : ""}>{party.status}</Badge></TableCell>
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
