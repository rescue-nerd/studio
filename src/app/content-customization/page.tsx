
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
import { useAuth } from "@/contexts/auth-context"; // Import useAuth
import type {
    CreateInvoiceLineCustomizationPayload,
    DeleteInvoiceLineCustomizationPayload,
    UpdateInvoiceLineCustomizationPayload
} from "@/functions/src/types";
import { useToast } from "@/hooks/use-toast";
import { db, functions } from "@/lib/firebase";
import type { InvoiceLineCustomization as FirestoreInvoiceLineCustomization, InvoiceLineType } from "@/types/firestore";
import {
    collection,
    getDocs,
    orderBy,
    query
} from "firebase/firestore";
import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { Edit, Loader2, PlusCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation"; // Import useRouter
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

interface InvoiceLineCustomization extends FirestoreInvoiceLineCustomization {}

const lineTypes: InvoiceLineType[] = ["Text", "Number", "Currency", "Percentage", "Date", "Textarea", "Boolean", "Select"];

const createInvoiceLineCustomizationFn = httpsCallable<CreateInvoiceLineCustomizationPayload, {success: boolean, id: string, message: string}>(functions, 'createInvoiceLineCustomization');
const updateInvoiceLineCustomizationFn = httpsCallable<UpdateInvoiceLineCustomizationPayload, {success: boolean, message: string}>(functions, 'updateInvoiceLineCustomization');
const deleteInvoiceLineCustomizationFn = httpsCallable<DeleteInvoiceLineCustomizationPayload, {success: boolean, message: string}>(functions, 'deleteInvoiceLineCustomization');

const generateFieldName = (label: string) => {
  return label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/gi, '');
};

const defaultFormData: Omit<InvoiceLineCustomization, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'order'> = {
  label: "",
  fieldName: "",
  type: "Text",
  required: false,
  isEnabled: true,
  options: [],
  defaultValue: "",
};

export default function ContentCustomizationPage() {
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth(); // Get authenticated user
  const router = useRouter();

  const [invoiceLines, setInvoiceLines] = useState<InvoiceLineCustomization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<InvoiceLineCustomization | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [lineToDelete, setLineToDelete] = useState<InvoiceLineCustomization | null>(null);

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authUser, authLoading, router]);

  const fetchInvoiceLines = async () => {
    if (!authUser) return;
    setIsLoading(true);
    try {
      const linesCollectionRef = collection(db, "invoiceLineCustomizations");
      const q = query(linesCollectionRef, orderBy("order"));
      const querySnapshot = await getDocs(q);
      const fetchedLines: InvoiceLineCustomization[] = querySnapshot.docs.map(docSnap => ({ ...docSnap.data() as FirestoreInvoiceLineCustomization, id: docSnap.id }));
      setInvoiceLines(fetchedLines);
    } catch (error) {
      console.error("Error fetching invoice lines: ", error);
      toast({ title: "Error", description: "Failed to fetch invoice line configurations.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (authUser) {
      fetchInvoiceLines();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'label') {
      setFormData(prev => ({ ...prev, [name]: value, fieldName: generateFieldName(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCheckboxChange = (name: keyof Omit<InvoiceLineCustomization, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'order' | 'label' | 'fieldName' | 'type' | 'options' | 'defaultValue'>, checked: boolean | string) => {
    setFormData(prev => ({ ...prev, [name]: Boolean(checked) }));
  };
  
  const handleSelectChange = (name: keyof Omit<InvoiceLineCustomization, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'order' | 'label' | 'fieldName' | 'required' | 'isEnabled' | 'options' | 'defaultValue'>, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value as InvoiceLineType }));
  };

  const handleOptionsChange = (e: ChangeEvent<HTMLInputElement>) => {
    const optionsArray = e.target.value.split(',').map(opt => opt.trim()).filter(opt => opt !== "");
    setFormData(prev => ({ ...prev, options: optionsArray }));
  };

  const openAddForm = () => {
    setEditingLine(null);
    setFormData(defaultFormData);
    setIsFormOpen(true);
  };

  const openEditForm = (line: InvoiceLineCustomization) => {
    setEditingLine(line);
    const { id, createdAt, createdBy, updatedAt, updatedBy, ...editableData } = line;
    setFormData({
        ...editableData,
        options: line.options || [], 
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) {
        toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
        return;
    }
    if (!formData.label.trim() || !formData.fieldName.trim()) {
      toast({ title: "Validation Error", description: "Label is required (Field Name is auto-generated).", variant: "destructive" });
      return;
    }
    if (formData.type === "Select" && (!formData.options || formData.options.length === 0)) {
        toast({ title: "Validation Error", description: "For 'Select' type, please provide comma-separated options.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);

    try {
      if (editingLine) {
        // Update existing customization
        const payload: UpdateInvoiceLineCustomizationPayload = {
          customizationId: editingLine.id,
          ...formData,
          order: editingLine.order,
          options: formData.type === "Select" ? formData.options : [], 
        };

        const result: HttpsCallableResult<{success: boolean, message: string}> = await updateInvoiceLineCustomizationFn(payload);
        
        if (result.data.success) {
          toast({ title: "Success", description: result.data.message || "Line configuration updated." });
        } else {
          throw new Error(result.data.message || "Failed to update line configuration");
        }
      } else {
        // Create new customization
        const payload: CreateInvoiceLineCustomizationPayload = {
          ...formData,
          order: invoiceLines.length > 0 ? Math.max(...invoiceLines.map(l => l.order)) + 1 : 1,
          options: formData.type === "Select" ? formData.options : [], 
        };

        const result: HttpsCallableResult<{success: boolean, id: string, message: string}> = await createInvoiceLineCustomizationFn(payload);
        
        if (result.data.success) {
          toast({ title: "Success", description: result.data.message || "Line configuration added." });
        } else {
          throw new Error(result.data.message || "Failed to create line configuration");
        }
      }
      
      fetchInvoiceLines();
      setIsFormOpen(false);
    } catch (error) {
      console.error("Error saving line config: ", error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to save line configuration.", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (line: InvoiceLineCustomization) => {
    setLineToDelete(line);
    setIsDeleteAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!lineToDelete) return;
    setIsSubmitting(true);
    try {
      const payload: DeleteInvoiceLineCustomizationPayload = {
        customizationId: lineToDelete.id
      };

      const result: HttpsCallableResult<{success: boolean, message: string}> = await deleteInvoiceLineCustomizationFn(payload);
      
      if (result.data.success) {
        toast({ title: "Success", description: result.data.message || `Line "${lineToDelete.label}" deleted.` });
        fetchInvoiceLines(); 
      } else {
        throw new Error(result.data.message || "Failed to delete line configuration");
      }
    } catch (error) {
      console.error("Error deleting line: ", error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to delete line configuration.", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
      setIsDeleteAlertOpen(false);
      setLineToDelete(null);
    }
  };

  if (authLoading || (!authUser && !authLoading) || (isLoading && !invoiceLines.length)) {
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
          <h1 className="text-3xl font-headline font-bold text-foreground">Content Customization</h1>
          <p className="text-muted-foreground">Customize fields and lines for your invoices and bills.</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm} disabled={isSubmitting || isLoading}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Line Item
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
             <DialogHeader>
              <DialogTitle>{editingLine ? "Edit Line Item" : "Add New Line Item"}</DialogTitle>
              <DialogDescription>
                Define a new line item for financial documents.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div>
                <Label htmlFor="label">Label <span className="text-destructive">*</span></Label>
                <Input id="label" name="label" value={formData.label} onChange={handleInputChange} placeholder="e.g., Item Description" required/>
              </div>
              <div>
                <Label htmlFor="fieldName">Field Name (Auto-generated)</Label>
                <Input id="fieldName" name="fieldName" value={formData.fieldName} readOnly className="bg-muted"/>
              </div>
              <div>
                <Label htmlFor="type">Type <span className="text-destructive">*</span></Label>
                <Select name="type" value={formData.type} onValueChange={(value) => handleSelectChange('type', value)} required>
                  <SelectTrigger id="type"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {lineTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {formData.type === "Select" && (
                 <div>
                    <Label htmlFor="options">Options (comma-separated) <span className="text-destructive">*</span></Label>
                    <Input id="options" name="options" value={(formData.options || []).join(', ')} onChange={handleOptionsChange} placeholder="e.g., Option A, Option B"/>
                 </div>
              )}
              <div>
                <Label htmlFor="defaultValue">Default Value (Optional)</Label>
                <Input id="defaultValue" name="defaultValue" value={String(formData.defaultValue || "")} onChange={handleInputChange} placeholder="e.g., 0 or N/A"/>
              </div>
               <div className="flex items-center space-x-2">
                <Checkbox id="required" name="required" checked={formData.required} onCheckedChange={(checked) => handleCheckboxChange('required', checked)} />
                <Label htmlFor="required">Required</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="isEnabled" name="isEnabled" checked={formData.isEnabled} onCheckedChange={(checked) => handleCheckboxChange('isEnabled', checked)} />
                <Label htmlFor="isEnabled">Enabled (Visible)</Label>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingLine ? "Update Line Item" : "Save Line Item"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Invoice/Bill Line Configuration</CardTitle>
          <CardDescription>Define the structure of your financial documents. Order reflects display order.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading configurations...</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Label (Field Name)</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoiceLines.length === 0 && !isLoading && (
                    <TableRow><TableCell colSpan={6} className="text-center h-24">No line configurations found.</TableCell></TableRow>
                )}
                {invoiceLines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.order}</TableCell>
                    <TableCell className="font-medium">{line.label} <span className="text-xs text-muted-foreground">({line.fieldName})</span></TableCell>
                    <TableCell>{line.type}</TableCell>
                    <TableCell>
                      <Checkbox checked={line.required} disabled aria-label={line.required ? "Yes" : "No"} />
                    </TableCell>
                     <TableCell>
                      <Checkbox checked={line.isEnabled} disabled aria-label={line.isEnabled ? "Yes" : "No"} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" aria-label="Edit Line" onClick={() => openEditForm(line)} disabled={isSubmitting}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog open={isDeleteAlertOpen && lineToDelete?.id === line.id} onOpenChange={(open) => {if(!open) setLineToDelete(null); setIsDeleteAlertOpen(open);}}>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" aria-label="Delete Line" onClick={() => handleDeleteClick(line)} disabled={isSubmitting}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete the line item configuration "{lineToDelete?.label}".</AlertDialogDescription>
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
