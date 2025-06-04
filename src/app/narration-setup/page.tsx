
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context"; // Import useAuth
import type {
    CreateNarrationTemplatePayload,
    DeleteNarrationTemplatePayload,
    UpdateNarrationTemplatePayload
} from "@/functions/src/types";
import { useToast } from "@/hooks/use-toast";
import { db, functions } from "@/lib/firebase";
import type { NarrationTemplate as FirestoreNarrationTemplate } from "@/types/firestore";
import {
    collection,
    getDocs,
    orderBy,
    query
} from "firebase/firestore";
import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { Edit, Loader2, PlusCircle, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation"; // Import useRouter
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

interface NarrationTemplate extends FirestoreNarrationTemplate {}

const defaultFormData: Omit<NarrationTemplate, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> = {
  title: "",
  template: "",
  applicableTo: [], 
};

const createNarrationTemplateFn = httpsCallable<CreateNarrationTemplatePayload, {success: boolean, id: string, message: string}>(functions, 'createNarrationTemplate');
const updateNarrationTemplateFn = httpsCallable<UpdateNarrationTemplatePayload, {success: boolean, message: string}>(functions, 'updateNarrationTemplate');
const deleteNarrationTemplateFn = httpsCallable<DeleteNarrationTemplatePayload, {success: boolean, message: string}>(functions, 'deleteNarrationTemplate');


export default function NarrationSetupPage() {
  const [templates, setTemplates] = useState<NarrationTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NarrationTemplate | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<NarrationTemplate | null>(null);
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth(); // Get authenticated user
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authUser, authLoading, router]);

  const fetchTemplates = async () => {
    if (!authUser) return;
    setIsLoading(true);
    try {
      const templatesCollectionRef = collection(db, "narrationTemplates");
      const q = query(templatesCollectionRef, orderBy("title"));
      const querySnapshot = await getDocs(q);
      const fetchedTemplates: NarrationTemplate[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data() as FirestoreNarrationTemplate;
        return { ...data, id: docSnap.id };
      });
      setTemplates(fetchedTemplates);
    } catch (error) {
      console.error("Error fetching narration templates: ", error);
      toast({ title: "Error", description: "Failed to fetch narration templates.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authUser) {
      fetchTemplates();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openAddForm = () => {
    setEditingTemplate(null);
    setFormData(defaultFormData);
    setIsFormOpen(true);
  };

  const openEditForm = (template: NarrationTemplate) => {
    setEditingTemplate(template);
    const { id, createdAt, createdBy, updatedAt, updatedBy, ...editableData } = template;
    setFormData(editableData);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) {
        toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
        return;
    }
    if (!formData.title.trim() || !formData.template.trim()) {
      toast({ title: "Validation Error", description: "Title and Template text are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    try {
      if (editingTemplate) {
        // Update existing template
        const payload: UpdateNarrationTemplatePayload = {
          templateId: editingTemplate.id,
          ...formData,
        };

        const result: HttpsCallableResult<{success: boolean, message: string}> = await updateNarrationTemplateFn(payload);
        
        if (result.data.success) {
          toast({ title: "Success", description: result.data.message || "Narration template updated." });
        } else {
          throw new Error(result.data.message || "Failed to update template");
        }
      } else {
        // Create new template
        const payload: CreateNarrationTemplatePayload = {
          ...formData,
        };

        const result: HttpsCallableResult<{success: boolean, id: string, message: string}> = await createNarrationTemplateFn(payload);
        
        if (result.data.success) {
          toast({ title: "Success", description: result.data.message || "Narration template added." });
        } else {
          throw new Error(result.data.message || "Failed to create template");
        }
      }
      
      fetchTemplates();
      setIsFormOpen(false);
    } catch (error) {
      console.error("Error saving template: ", error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to save template.", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (template: NarrationTemplate) => {
    setTemplateToDelete(template);
    setIsDeleteAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    setIsSubmitting(true);
    try {
      const payload: DeleteNarrationTemplatePayload = {
        templateId: templateToDelete.id
      };

      const result: HttpsCallableResult<{success: boolean, message: string}> = await deleteNarrationTemplateFn(payload);
      
      if (result.data.success) {
        toast({ title: "Success", description: result.data.message || `Template "${templateToDelete.title}" deleted.` });
        fetchTemplates();
      } else {
        throw new Error(result.data.message || "Failed to delete template");
      }
    } catch (error) {
      console.error("Error deleting template: ", error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to delete template.", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
      setIsDeleteAlertOpen(false);
      setTemplateToDelete(null);
    }
  };

  const filteredTemplates = templates.filter(template =>
    template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.template.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || (!authUser && !authLoading) || (isLoading && !templates.length)) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">
          {authLoading ? "Authenticating..." : isLoading ? "Loading templates..." : "Redirecting to login..."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground">Narration Setup</h1>
          <p className="text-muted-foreground">Create and manage reusable invoice narration templates.</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Edit Template" : "Add New Template"}</DialogTitle>
              <DialogDescription>
                {editingTemplate ? "Update the details of this narration template." : "Create a new reusable narration template."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div>
                <Label htmlFor="title">Template Title</Label>
                <Input id="title" name="title" value={formData.title} onChange={handleInputChange} placeholder="e.g., Standard Delivery Charges" required />
              </div>
              <div>
                <Label htmlFor="template">Template Text</Label>
                <Textarea id="template" name="template" value={formData.template} onChange={handleInputChange} placeholder="Enter narration text. Use {{variable_name}} for placeholders." rows={4} required />
                <p className="text-xs text-muted-foreground mt-1">Example: Being charges for shipment {{shipment_id}}.</p>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Template
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Narration Templates</CardTitle>
          <CardDescription>Available templates for quick use in billing.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search templates by title or content..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading templates...</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Template Preview</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={3} className="text-center h-24">No narration templates found.</TableCell></TableRow>
                )}
                {filteredTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-md" title={template.template}>{template.template}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" aria-label="Edit Template" onClick={() => openEditForm(template)} disabled={isSubmitting}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog open={isDeleteAlertOpen && templateToDelete?.id === template.id} onOpenChange={(open) => { if(!open) setTemplateToDelete(null); setIsDeleteAlertOpen(open);}}>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" aria-label="Delete Template" onClick={() => handleDeleteClick(template)} disabled={isSubmitting}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete the template "{templateToDelete?.title}".</AlertDialogDescription>
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
