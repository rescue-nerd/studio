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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { db } from "@/lib/supabase-db";
import { getSupabaseErrorMessage } from "@/lib/supabase-error-handler";
import type { Branch as SupabaseBranch, DocumentNumberingConfig as SupabaseDocumentNumberingConfig, DocumentType as SupabaseDocumentType } from "@/types/database";
import { Edit, Loader2, PlusCircle, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

// Canonical types from database.ts are aliased for clarity
interface DocumentNumberingConfig extends SupabaseDocumentNumberingConfig {}
interface Branch extends SupabaseBranch {}

// Form state interface
interface DocumentNumberingFormState {
  documentType: SupabaseDocumentType;
  prefix: string;
  suffix: string;
  startingNumber: number;
  minLength: number; // UI only, not in DB config
  perBranch: boolean;
  branchId: string;
  fiscalYear: string;
}

// Payloads for Supabase functions (aligned with DocumentNumberingConfig fields)
interface CreateConfigPayload {
  documentType: SupabaseDocumentType;
  prefix?: string;
  suffix?: string;
  lastNumber: number;
  branchId: string;
  fiscalYear: string;
}

interface UpdateConfigPayload {
  configId: string; // ID of the config to update
  documentType?: SupabaseDocumentType;
  prefix?: string;
  suffix?: string;
  lastNumber?: number;
  branchId?: string;
  fiscalYear?: string;
}

interface DeleteConfigPayload {
  configId: string;
}

const documentTypes: SupabaseDocumentType[] = ["bilti", "manifest", "goods_receipt", "goods_delivery", "daybook"];

const defaultFormData: DocumentNumberingFormState = {
  documentType: documentTypes[0],
  prefix: "",
  suffix: "",
  startingNumber: 1,
  minLength: 0, // Default for UI, not stored in DB
  perBranch: false,
  branchId: "Global",
  fiscalYear: new Date().getFullYear().toString(),
};

// Supabase Edge Function wrappers
const createDocumentNumberingConfigFn = async (data: CreateConfigPayload) => {
  const {data: result, error} = await supabase.functions.invoke('create-document-numbering-config', { body: data });
  if(error) throw error;
  return result as { success: boolean; message?: string };
};

const updateDocumentNumberingConfigFn = async (data: UpdateConfigPayload) => {
  const {data: result, error} = await supabase.functions.invoke('update-document-numbering-config', { body: data });
  if(error) throw error;
  return result as { success: boolean; message?: string };
};

const deleteDocumentNumberingConfigFn = async (data: DeleteConfigPayload) => {
  const {data: result, error} = await supabase.functions.invoke('delete-document-numbering-config', { body: data });
  if(error) throw error;
  return result as { success: boolean; message?: string };
};


export default function AutomaticNumberingPage() {
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [configs, setConfigs] = useState<DocumentNumberingConfig[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<DocumentNumberingConfig | null>(null);
  const [formData, setFormData] = useState<DocumentNumberingFormState>(defaultFormData);
  
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<DocumentNumberingConfig | null>(null);

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authUser, authLoading, router]);

  const fetchBranches = async () => {
    if (!authUser || !supabase) return;
    try {
      const branchesFromDb: SupabaseBranch[] = await db.getBranches(); 
      const globalBranch: Branch = { 
        id: "Global", 
        name: "Global (Non-Branch Specific)", 
        code: "GLBL",
        address: "N/A",
        location: "N/A",
        contactNo: "N/A",
        email: "N/A",
        isActive: true,
        managerName: "N/A",
        createdAt: new Date().toISOString(),
      };
      setBranches([globalBranch, ...branchesFromDb]);
    } catch (error) {
      console.error("Error fetching branches: ", error);
      toast({ title: "Error", description: getSupabaseErrorMessage(error), variant: "destructive" });
    }
  };

  const fetchConfigs = async () => {
     if (!authUser || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('document_numbering_configs')
        .select('*')
        .order('documentType');
      
      if (error) throw error;
      setConfigs((data as DocumentNumberingConfig[]) || []);
    } catch (error) {
      console.error("Error fetching numbering configs: ", error);
      toast({ title: "Error", description: getSupabaseErrorMessage(error), variant: "destructive" });
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
    setFormData(prev => {
      const newFormData = { ...prev } as DocumentNumberingFormState; // Assert type here
      if (type === 'checkbox') {
        // Ensure name is a valid key of DocumentNumberingFormState before assignment
        if (name in newFormData) {
          (newFormData as any)[name] = checked;
        }
        if (name === 'perBranch') {
          newFormData.branchId = checked ? (branches.length > 1 && branches[1] ? branches[1].id : "") : "Global";
        }
      } else if (type === 'number') {
        if (name in newFormData) {
            // Ensure that the target property can accept a number
            if (name === 'startingNumber' || name === 'minLength') {
                (newFormData as any)[name] = value === '' ? 0 : parseInt(value, 10);
            } else {
                 (newFormData as any)[name] = value; // Or handle as error/default
            }
        }
      } else {
        if (name in newFormData) {
          (newFormData as any)[name] = value;
        }
      }
      return newFormData;
    });
  };
  

  const handleSelectChange = (name: keyof DocumentNumberingFormState, value: string | boolean) => {
    setFormData(prev => ({
         ...prev,
         [name]: value,
         ...(name === 'perBranch' && { branchId: value ? (branches.length > 1 ? branches[1].id : "") : "Global" }),
     }));
  };


  const openAddForm = () => {
    setEditingConfig(null);
    setFormData({...defaultFormData, branchId: branches[0]?.id || "Global", fiscalYear: new Date().getFullYear().toString()});
    setIsFormOpen(true);
  };

  const openEditForm = (config: DocumentNumberingConfig) => {
    setEditingConfig(config);
    setFormData({
        documentType: config.documentType,
        prefix: config.prefix || "",
        suffix: config.suffix || "",
        startingNumber: config.lastNumber + 1,
        minLength: 0, // Reset to default as it's not stored in DB
        perBranch: config.branchId !== "Global",
        branchId: config.branchId,
        fiscalYear: config.fiscalYear,
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!formData.documentType || (formData.perBranch && !formData.branchId) || !formData.fiscalYear.trim()) {
      toast({ title: "Validation Error", description: "Document Type, Fiscal Year, and Branch (if specific) are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    try {
      if (editingConfig) {
        const payload: UpdateConfigPayload = {
          configId: editingConfig.id,
          documentType: formData.documentType,
          prefix: formData.prefix || undefined,
          suffix: formData.suffix || undefined,
          lastNumber: formData.startingNumber - 1,
          branchId: formData.perBranch ? formData.branchId : "Global",
          fiscalYear: formData.fiscalYear,
        };
        const result = await updateDocumentNumberingConfigFn(payload);
        if (result.success) {
          toast({ title: "Success", description: result.message || "Configuration updated." });
        } else {
          throw new Error(result.message || "Failed to update configuration");
        }
      } else {
        const payload: CreateConfigPayload = {
          documentType: formData.documentType,
          prefix: formData.prefix || undefined,
          suffix: formData.suffix || undefined,
          lastNumber: formData.startingNumber - 1,
          branchId: formData.perBranch ? formData.branchId : "Global",
          fiscalYear: formData.fiscalYear,
        };
        const result = await createDocumentNumberingConfigFn(payload);
        if (result.success) {
          toast({ title: "Success", description: result.message || "Configuration added." });
        } else {
          throw new Error(result.message || "Failed to create configuration");
        }
      }
      fetchConfigs();
      setIsFormOpen(false);
    } catch (error) {
      console.error("Error saving config: ", error);
      toast({ 
        title: "Error", 
        description: getSupabaseErrorMessage(error),
        variant: "destructive" 
      });
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
      const payload: DeleteConfigPayload = {
        configId: configToDelete.id
      };
      const result = await deleteDocumentNumberingConfigFn(payload);
      if (result.success) {
        toast({ title: "Success", description: result.message || `Configuration for "${configToDelete.documentType}" deleted.` });
        fetchConfigs();
      } else {
        throw new Error(result.message || "Failed to delete configuration");
      }
    } catch (error) {
      console.error("Error deleting config: ", error);
      toast({ 
        title: "Error", 
        description: getSupabaseErrorMessage(error),
        variant: "destructive" 
      });
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
  
  if (authLoading || (!authUser && !authLoading) || (isLoading && !configs.length && !branches.length)) {
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
                <Label htmlFor="docType">Document Type <span className="text-destructive">*</span></Label>
                <Select value={formData.documentType} onValueChange={(value) => handleSelectChange('documentType', value as SupabaseDocumentType)} required>
                  <SelectTrigger id="docType"><SelectValue placeholder="Select document type" /></SelectTrigger>
                  <SelectContent>
                    {documentTypes.map(type => <SelectItem key={type} value={type}>{type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="prefix">Prefix</Label>
                  <Input id="prefix" name="prefix" value={formData.prefix} onChange={handleInputChange} placeholder="e.g., INV-" />
                </div>
                <div>
                  <Label htmlFor="suffix">Suffix</Label>
                  <Input id="suffix" name="suffix" value={formData.suffix} onChange={handleInputChange} placeholder="e.g., /2024" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <Label htmlFor="startNum">Starting Number <span className="text-destructive">*</span></Label>
                    <Input id="startNum" name="startingNumber" type="number" value={formData.startingNumber} onChange={handleInputChange} placeholder="e.g., 1001" min="1" required/>
                  </div>
                  <div>
                    <Label htmlFor="minLength">Min. Number Length (UI)</Label> 
                    <Input id="minLength" name="minLength" type="number" value={formData.minLength} onChange={handleInputChange} placeholder="e.g., 8" min="0"/>
                  </div>
              </div>
              <div>
                <Label htmlFor="fiscalYear">Fiscal Year <span className="text-destructive">*</span></Label>
                <Input id="fiscalYear" name="fiscalYear" value={formData.fiscalYear} onChange={handleInputChange} placeholder="e.g., 2024" required />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="perBranch" name="perBranch" checked={formData.perBranch} onCheckedChange={(checked) => handleSelectChange('perBranch', Boolean(checked))} />
                <Label htmlFor="perBranch">Branch Specific Numbering</Label>
              </div>
              {formData.perBranch && (
                <div>
                  <Label htmlFor="branchSelect">Branch <span className="text-destructive">*</span></Label>
                  <Select value={formData.branchId} onValueChange={(value) => handleSelectChange('branchId', value)} required={formData.perBranch} disabled={branches.length <=1 && !branches.find(b=>b.id !== "Global")}>
                    <SelectTrigger id="branchSelect">
                      <SelectValue placeholder={branches.length <=1 && !branches.find(b=>b.id !== "Global") ? "No branches configured" : "Select branch"} />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.filter(b => b.id !== "Global").map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting || (formData.perBranch && branches.length <=1 && formData.branchId === 'Global')}>
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
                  <TableHead>Last Used No.</TableHead> 
                  <TableHead>Fiscal Year</TableHead>
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
                    <TableCell className="font-medium">{(config.documentType as string).replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</TableCell>
                    <TableCell>{config.prefix || "N/A"}</TableCell>
                    <TableCell>{config.suffix || "N/A"}</TableCell>
                    <TableCell>{config.lastNumber}</TableCell>
                    <TableCell>{config.fiscalYear}</TableCell>
                    <TableCell>
                      <Checkbox checked={config.branchId !== "Global"} aria-label={config.branchId !== "Global" ? "Yes" : "No"} disabled />
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
                              <AlertDialogDescription>This will permanently delete the numbering configuration for "{configToDelete?.documentType ? (configToDelete.documentType as string).replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()): 'this item'}".</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => {setIsDeleteAlertOpen(false); setConfigToDelete(null);}} disabled={isSubmitting}>Cancel</AlertDialogCancel>
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