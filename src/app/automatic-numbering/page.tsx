
"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Edit, Trash2, Search, Loader2 } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { db } from "@/lib/firebase";
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
import type { DocumentNumberingConfig as FirestoreDocumentNumberingConfig, Branch as FirestoreBranch } from "@/types/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context"; // Import useAuth
import { useRouter } from "next/navigation"; // Import useRouter

interface DocumentNumberingConfig extends FirestoreDocumentNumberingConfig {}
interface Branch extends FirestoreBranch {}

const documentTypes = ["Invoice", "Waybill", "Receipt", "Credit Note", "Purchase Order", "Manifest", "GoodsReceipt", "GoodsDelivery"];

const defaultFormData: Omit<DocumentNumberingConfig, 'id' | 'lastGeneratedNumber' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> = {
  documentType: documentTypes[0],
  prefix: "",
  suffix: "",
  startingNumber: 1,
  perBranch: false,
  branchId: "Global", 
  minLength: 0,
};


export default function AutomaticNumberingPage() {
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth(); // Get authenticated user
  const router = useRouter();

  const [configs, setConfigs] = useState<DocumentNumberingConfig[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<DocumentNumberingConfig | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<DocumentNumberingConfig | null>(null);

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authUser, authLoading, router]);

  const fetchBranches = async () => {
    if (!authUser) return;
    try {
      const branchesCollectionRef = collection(db, "branches");
      const q = query(branchesCollectionRef, orderBy("name"));
      const querySnapshot = await getDocs(q);
      const fetchedBranches: Branch[] = querySnapshot.docs.map(docSnap => ({ ...docSnap.data() as FirestoreBranch, id: docSnap.id }));
      setBranches([{ id: "Global", name: "Global (Non-Branch Specific)" } as Branch, ...fetchedBranches]);
    } catch (error) {
      console.error("Error fetching branches: ", error);
      toast({ title: "Error", description: "Failed to fetch branches.", variant: "destructive" });
    }
  };

  const fetchConfigs = async () => {
     if (!authUser) return;
    try {
      const configsCollectionRef = collection(db, "documentNumberingConfigs");
      const q = query(configsCollectionRef, orderBy("documentType"));
      const querySnapshot = await getDocs(q);
      const fetchedConfigs: DocumentNumberingConfig[] = querySnapshot.docs.map(docSnap => ({ ...docSnap.data() as FirestoreDocumentNumberingConfig, id: docSnap.id }));
      setConfigs(fetchedConfigs);
    } catch (error) {
      console.error("Error fetching numbering configs: ", error);
      toast({ title: "Error", description: "Failed to fetch numbering configurations.", variant: "destructive" });
    }
  };
  
  useEffect(() => {
    if (authUser) {
        const loadData = async () => {
            setIsLoading(true);
            await fetchBranches();
            await fetchConfigs();
            setIsLoading(false);
        }
        loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked, branchId: checked ? (branches.length > 1 ? branches[1].id : "") : "Global" }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? 0 : parseInt(value, 10) }));
    } 
    else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (name: keyof Omit<DocumentNumberingConfig, 'id' | 'lastGeneratedNumber' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };


  const openAddForm = () => {
    setEditingConfig(null);
    setFormData({...defaultFormData, branchId: branches[0]?.id || "Global"});
    setIsFormOpen(true);
  };

  const openEditForm = (config: DocumentNumberingConfig) => {
    setEditingConfig(config);
    const { id, createdAt, createdBy, updatedAt, updatedBy, lastGeneratedNumber, ...editableData } = config;
    setFormData({
        ...editableData,
        branchId: config.perBranch && config.branchId ? config.branchId : "Global",
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!formData.documentType || (formData.perBranch && !formData.branchId)) {
      toast({ title: "Validation Error", description: "Document Type and Branch (if specific) are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const payload: Omit<FirestoreDocumentNumberingConfig, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> & Partial<Pick<FirestoreDocumentNumberingConfig, 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>> = {
      ...formData,
      branchId: formData.perBranch ? formData.branchId : "Global",
      lastGeneratedNumber: editingConfig ? editingConfig.lastGeneratedNumber : (formData.startingNumber -1)
    };

    try {
      if (editingConfig) {
        const configDocRef = doc(db, "documentNumberingConfigs", editingConfig.id);
        await updateDoc(configDocRef, { ...payload, updatedAt: Timestamp.now(), updatedBy: authUser.uid });
        toast({ title: "Success", description: "Configuration updated." });
      } else {
        await addDoc(collection(db, "documentNumberingConfigs"), { ...payload, createdAt: Timestamp.now(), createdBy: authUser.uid });
        toast({ title: "Success", description: "Configuration added." });
      }
      fetchConfigs();
      setIsFormOpen(false);
    } catch (error) {
      console.error("Error saving config: ", error);
      toast({ title: "Error", description: "Failed to save configuration.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (config: DocumentNumberingConfig) => {
    setConfigToDelete(config);
    setIsDeleteAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!configToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "documentNumberingConfigs", configToDelete.id));
      toast({ title: "Success", description: `Configuration for "${configToDelete.documentType}" deleted.` });
      fetchConfigs();
    } catch (error) {
      console.error("Error deleting config: ", error);
      toast({ title: "Error", description: "Failed to delete configuration.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setIsDeleteAlertOpen(false);
      setConfigToDelete(null);
    }
  };
  
  const getBranchNameForDisplay = (branchId: string | undefined) => {
    if (!branchId || branchId === "Global") return "Global";
    return branches.find(b => b.id === branchId)?.name || branchId;
  }

  const filteredConfigs = configs.filter(config =>
    config.documentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (config.prefix && config.prefix.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (config.branchId && getBranchNameForDisplay(config.branchId).toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  if (authLoading || (!authUser && !authLoading) || (isLoading && !configs.length)) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">
          {authLoading ? "Authenticating..." : isLoading ? "Loading configurations..." : "Redirecting to login..."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground">Automatic Numbering</h1>
          <p className="text-muted-foreground">Configure auto-numbering schemes for various document types.</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm} disabled={isSubmitting || isLoading}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Configuration
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
             <DialogHeader>
              <DialogTitle>{editingConfig ? "Edit Configuration" : "Add New Configuration"}</DialogTitle>
              <DialogDescription>
                Define a new document numbering series.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div>
                <Label htmlFor="docType">Document Type</Label>
                <Select name="documentType" value={formData.documentType} onValueChange={(value) => handleSelectChange('documentType', value)} required>
                  <SelectTrigger id="docType"><SelectValue placeholder="Select document type" /></SelectTrigger>
                  <SelectContent>
                    {documentTypes.map(type => <SelectItem key={type} value={type.toLowerCase().replace(/\s+/g, '-')}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="prefix">Prefix</Label>
                  <Input id="prefix" name="prefix" value={formData.prefix || ""} onChange={handleInputChange} placeholder="e.g., INV-" />
                </div>
                <div>
                  <Label htmlFor="suffix">Suffix</Label>
                  <Input id="suffix" name="suffix" value={formData.suffix || ""} onChange={handleInputChange} placeholder="e.g., /2024" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <Label htmlFor="startNum">Starting Number</Label>
                    <Input id="startNum" name="startingNumber" type="number" value={formData.startingNumber} onChange={handleInputChange} placeholder="e.g., 1001" min="1" required/>
                  </div>
                  <div>
                    <Label htmlFor="minLength">Min. Length (incl. prefix/suffix)</Label>
                    <Input id="minLength" name="minLength" type="number" value={formData.minLength || 0} onChange={handleInputChange} placeholder="e.g., 8 (for INV-001)" min="0"/>
                  </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="perBranch" name="perBranch" checked={formData.perBranch} onCheckedChange={(checked) => handleSelectChange('perBranch', String(checked))} />
                <Label htmlFor="perBranch">Branch Specific Numbering</Label>
              </div>
              {formData.perBranch && (
                <div>
                  <Label htmlFor="branchSelect">Branch <span className="text-destructive">*</span></Label>
                  <Select name="branchId" value={formData.branchId} onValueChange={(value) => handleSelectChange('branchId', value)} required={formData.perBranch} disabled={branches.length <=1}>
                    <SelectTrigger id="branchSelect">
                      <SelectValue placeholder={branches.length <=1 ? "No branches configured" : "Select branch"} />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.filter(b => b.id !== "Global").map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting || (formData.perBranch && branches.length <=1)}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Configuration
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Numbering Configurations</CardTitle>
          <CardDescription>Manage document numbering series.</CardDescription>
           <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search configurations..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading configurations...</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Suffix</TableHead>
                  <TableHead>Start No.</TableHead>
                  <TableHead>Min. Length</TableHead>
                  <TableHead>Per Branch</TableHead>
                  <TableHead>Branch/Scope</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConfigs.length === 0 && !isLoading && (
                    <TableRow><TableCell colSpan={8} className="text-center h-24">No numbering configurations found.</TableCell></TableRow>
                )}
                {filteredConfigs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">{config.documentType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</TableCell>
                    <TableCell>{config.prefix || "N/A"}</TableCell>
                    <TableCell>{config.suffix || "N/A"}</TableCell>
                    <TableCell>{config.startingNumber}</TableCell>
                    <TableCell>{config.minLength || "N/A"}</TableCell>
                    <TableCell>
                      <Checkbox checked={config.perBranch} aria-label={config.perBranch ? "Yes" : "No"} disabled />
                    </TableCell>
                    <TableCell>{getBranchNameForDisplay(config.branchId)}</TableCell>
                    <TableCell>
                       <div className="flex gap-2">
                        <Button variant="outline" size="icon" aria-label="Edit Config" onClick={() => openEditForm(config)} disabled={isSubmitting}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog open={isDeleteAlertOpen && configToDelete?.id === config.id} onOpenChange={(open) => {if(!open) setConfigToDelete(null); setIsDeleteAlertOpen(open);}}>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" aria-label="Delete Config" onClick={() => handleDeleteClick(config)} disabled={isSubmitting}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete the numbering configuration for "{configToDelete?.documentType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}".</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setIsDeleteAlertOpen(false)} disabled={isSubmitting}>Cancel</AlertDialogCancel>
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
