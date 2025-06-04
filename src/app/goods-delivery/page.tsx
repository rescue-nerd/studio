
"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Search, Edit, Trash2, PackageOpen, ListChecks, Loader2 } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import SmartBiltiMultiSelectDialog from "@/components/shared/smart-bilti-multi-select-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { db, functions } from "@/lib/firebase";
import { 
  collection, 
  getDocs, 
  Timestamp,
  query,
  orderBy
} from "firebase/firestore";
import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { handleFirebaseError, logError } from "@/lib/firebase-error-handler";
import type { 
  GoodsDeliveryCreateRequest, 
  GoodsDeliveryUpdateRequest, 
  GoodsDeliveryDeleteRequest,
  CloudFunctionResponse
} from "@/types/firestore";
import type { 
  GoodsDelivery as FirestoreGoodsDelivery, 
  Bilti as FirestoreBilti, 
  Party as FirestoreParty,
  DeliveredBiltiItem as FirestoreDeliveredBiltiItem
} from "@/types/firestore";


// Local Interfaces
interface GoodsDelivery extends Omit<FirestoreGoodsDelivery, 'miti' | 'createdAt' | 'updatedAt' | 'deliveredBiltis'> {
  id: string;
  miti: Date;
  deliveredBiltis: DeliveredBiltiItemUI[]; // UI version with full Bilti data
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}
// For UI, to hold full Bilti data. When saving to Firestore, only biltiId and rebate/discount info are stored.
interface DeliveredBiltiItemUI {
  biltiId: string;
  biltiData?: Bilti; // Full bilti data for display and context, not stored directly in Firestore sub-object
  rebateAmount: number;
  rebateReason: string; // Required if rebateAmount > 0
  discountAmount: number;
  discountReason: string; // Required if discountAmount > 0
}
interface Bilti extends Omit<FirestoreBilti, 'miti' | 'createdAt' | 'updatedAt'> {
  id: string;
  miti: Date;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}
interface Party extends FirestoreParty {}


const defaultGoodsDeliveryFormData: Omit<GoodsDelivery, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> = {
  miti: new Date(),
  deliveredBiltis: [],
  overallRemarks: "",
  nepaliMiti: "",
  deliveredToName: "",
  deliveredToContact: "",
};

const PLACEHOLDER_USER_ID = "system_user_placeholder";

export default function GoodsDeliveryPage() {
  const [goodsDeliveries, setGoodsDeliveries] = useState<GoodsDelivery[]>([]);
  const [biltisForSelection, setBiltisForSelection] = useState<Bilti[]>([]);
  const [allBiltisMaster, setAllBiltisMaster] = useState<Bilti[]>([]);
  const [parties, setParties] = useState<Party[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<GoodsDelivery | null>(null);
  const [formData, setFormData] = useState<Omit<GoodsDelivery, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>>(defaultGoodsDeliveryFormData);
  
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deliveryToDelete, setDeliveryToDelete] = useState<GoodsDelivery | null>(null);
  
  const [isBiltiSelectDialogOpen, setIsBiltiSelectDialogOpen] = useState(false);

  const fetchMasterData = async () => {
    try {
      const [biltisSnap, partiesSnap] = await Promise.all([
        getDocs(query(collection(db, "biltis"))), // Fetch all biltis
        getDocs(query(collection(db, "parties"), orderBy("name"))),
      ]);

      const allFetchedBiltis = biltisSnap.docs.map(d => {
        const data = d.data() as FirestoreBilti;
        return { ...data, id: d.id, miti: data.miti.toDate() } as Bilti;
      });
      setAllBiltisMaster(allFetchedBiltis);
      setBiltisForSelection(allFetchedBiltis.filter(b => b.status === "Received"));

      setParties(partiesSnap.docs.map(d => ({ ...d.data(), id: d.id } as Party)));

    } catch (error) {
      logError(error, "Error fetching master data for goods delivery");
      handleFirebaseError(error, toast, {
        "permission-denied": "You don't have permission to access this data."
      });
    }
  };

  const fetchGoodsDeliveries = async () => {
    try {
      const deliveriesCollectionRef = collection(db, "goodsDeliveries");
      const q = query(deliveriesCollectionRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedDeliveries: GoodsDelivery[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data() as FirestoreGoodsDelivery;
        // Populate biltiData for UI display
        const populatedDeliveredBiltis: DeliveredBiltiItemUI[] = data.deliveredBiltis.map(item => ({
            ...item,
            biltiData: allBiltisMaster.find(b => b.id === item.biltiId)
        }));
        return { 
            ...data, 
            id: docSnap.id, 
            miti: data.miti.toDate(),
            deliveredBiltis: populatedDeliveredBiltis
        };
      });
      setGoodsDeliveries(fetchedDeliveries);
    } catch (error) {
      logError(error, "Error fetching goods deliveries");
      handleFirebaseError(error, toast, {
        "permission-denied": "You don't have permission to view goods deliveries."
      });
    }
  };

  useEffect(() => {
    const loadAllData = async () => {
        setIsLoading(true);
        await fetchMasterData();
        await fetchGoodsDeliveries(); // Depends on allBiltisMaster being populated from fetchMasterData
        setIsLoading(false);
    }
    loadAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handlePerBiltiInputChange = (biltiId: string, fieldName: keyof Omit<DeliveredBiltiItemUI, 'biltiId'|'biltiData'>, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      deliveredBiltis: prev.deliveredBiltis.map(item => 
        item.biltiId === biltiId ? { ...item, [fieldName]: typeof value === 'string' ? value : Number(value) } : item
      )
    }));
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => ({ ...prev, miti: date }));
    }
  };
  
  const handleBiltiSelectionConfirm = (selectedIds: Set<string>) => {
    const newDeliveredBiltisUI: DeliveredBiltiItemUI[] = Array.from(selectedIds).map(id => {
      const existingItem = formData.deliveredBiltis.find(item => item.biltiId === id);
      if (existingItem) return existingItem;
      
      const biltiData = allBiltisMaster.find(b => b.id === id);
      return {
        biltiId: id,
        biltiData: biltiData,
        rebateAmount: 0,
        rebateReason: "",
        discountAmount: 0,
        discountReason: "",
      };
    });
    setFormData(prev => ({ ...prev, deliveredBiltis: newDeliveredBiltisUI }));
  };

  const openAddForm = () => {
    setEditingDelivery(null);
    setFormData({...defaultGoodsDeliveryFormData, miti: new Date() });
    setBiltisForSelection(allBiltisMaster.filter(b => b.status === "Received"));
    setIsFormDialogOpen(true);
  };

  const openEditForm = (delivery: GoodsDelivery) => {
    setEditingDelivery(delivery);
    const { id, createdAt, createdBy, updatedAt, updatedBy, ...editableData } = delivery;
    // Ensure biltiData is populated for editing, if not already from fetch
    const populatedBiltis = editableData.deliveredBiltis.map(item => ({
        ...item,
        biltiData: item.biltiData || allBiltisMaster.find(b => b.id === item.biltiId)
    }));
    setFormData({...editableData, deliveredBiltis: populatedBiltis, nepaliMiti: delivery.nepaliMiti || ""});
    setBiltisForSelection(allBiltisMaster.filter(b => b.status === "Received" || delivery.deliveredBiltis.some(db => db.biltiId === b.id)));
    setIsFormDialogOpen(true);
  };
  
  const getPartyName = (partyId?: string) => parties.find(p => p.id === partyId)?.name || "N/A";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (formData.deliveredBiltis.length === 0) { 
        toast({ title: "No Biltis Selected", description: "Please select at least one Bilti for delivery.", variant: "destructive" });
        return;
    }

    for (const item of formData.deliveredBiltis) {
      if (item.rebateAmount > 0 && !item.rebateReason.trim()) {
        toast({ title: "Missing Rebate Reason", description: `Please provide a reason for rebate on Bilti ${item.biltiData?.id || item.biltiId}.`, variant: "destructive" });
        return;
      }
      if (item.discountAmount > 0 && !item.discountReason.trim()) {
        toast({ title: "Missing Discount Reason", description: `Please provide a reason for discount on Bilti ${item.biltiData?.id || item.biltiId}.`, variant: "destructive" });
        return;
      }
    }
    setIsSubmitting(true);

    // Prepare deliveredBiltis for Cloud Function (without biltiData)
    const deliveredBiltis: FirestoreDeliveredBiltiItem[] = formData.deliveredBiltis.map(item => ({
        biltiId: item.biltiId,
        rebateAmount: item.rebateAmount,
        rebateReason: item.rebateReason,
        discountAmount: item.discountAmount,
        discountReason: item.discountReason,
    }));

    try {
      if (editingDelivery) {
        // Update existing delivery
        const updateGoodsDelivery = httpsCallable<GoodsDeliveryUpdateRequest, CloudFunctionResponse>(functions, 'updateGoodsDelivery');
        const updateData: GoodsDeliveryUpdateRequest = {
          deliveryId: editingDelivery.id,
          miti: formData.miti.toISOString(),
          nepaliMiti: formData.nepaliMiti,
          deliveredBiltis: deliveredBiltis,
          overallRemarks: formData.overallRemarks,
          deliveredToName: formData.deliveredToName,
          deliveredToContact: formData.deliveredToContact,
        };
        
        const result = await updateGoodsDelivery(updateData);
        if (result.data.success) {
          toast({ title: "Goods Delivery Updated", description: result.data.message });
        } else {
          throw new Error(result.data.message);
        }
      } else {
        // Create new delivery
        const createGoodsDelivery = httpsCallable<GoodsDeliveryCreateRequest, CloudFunctionResponse>(functions, 'createGoodsDelivery');
        const createData: GoodsDeliveryCreateRequest = {
          miti: formData.miti.toISOString(),
          nepaliMiti: formData.nepaliMiti,
          deliveredBiltis: deliveredBiltis,
          overallRemarks: formData.overallRemarks,
          deliveredToName: formData.deliveredToName,
          deliveredToContact: formData.deliveredToContact,
        };
        
        const result = await createGoodsDelivery(createData);
        if (result.data.success) {
          toast({ title: "Goods Delivery Recorded", description: result.data.message });
        } else {
          throw new Error(result.data.message);
        }
      }
    } catch (error) {
      logError(error, `Error with goods delivery ${editingDelivery ? 'update' : 'create'} operation`);
      handleFirebaseError(error, toast, {
        "permission-denied": `You don't have permission to ${editingDelivery ? 'update' : 'create'} goods deliveries.`,
        "unauthenticated": "Please log in to continue."
      });
    }

    setIsSubmitting(false);
    setIsFormDialogOpen(false);
    setEditingDelivery(null);
    fetchGoodsDeliveries();
    fetchMasterData(); // Refresh biltis list for selection
  };

  const handleDeleteClick = (delivery: GoodsDelivery) => {
    setDeliveryToDelete(delivery);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (deliveryToDelete) {
      setIsSubmitting(true);
      try {
        const deleteGoodsDelivery = httpsCallable<GoodsDeliveryDeleteRequest, CloudFunctionResponse>(functions, 'deleteGoodsDelivery');
        const deleteData: GoodsDeliveryDeleteRequest = {
          deliveryId: deliveryToDelete.id
        };
        
        const result = await deleteGoodsDelivery(deleteData);
        if (result.data.success) {
          toast({ title: "Goods Delivery Deleted", description: result.data.message });
          fetchGoodsDeliveries();
          fetchMasterData(); // Refresh biltis
        } else {
          throw new Error(result.data.message);
        }
      } catch (error) {
        logError(error, "Error deleting goods delivery");
        handleFirebaseError(error, toast, {
          "permission-denied": "You don't have permission to delete goods deliveries.",
          "unauthenticated": "Please log in to continue."
        });
      } finally {
        setIsSubmitting(false);
      }
    }
    setIsDeleteDialogOpen(false);
    setDeliveryToDelete(null);
  };

  const filteredDeliveries = goodsDeliveries.filter(delivery => 
    delivery.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    delivery.deliveredBiltis.some(db => db.biltiId.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (delivery.nepaliMiti && delivery.nepaliMiti.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  return (
    <div className="space-y-6">
       <SmartBiltiMultiSelectDialog
        isOpen={isBiltiSelectDialogOpen}
        onOpenChange={setIsBiltiSelectDialogOpen}
        availableBiltis={biltisForSelection} // Pass only "Received" or current editing's biltis
        parties={parties}
        selectedBiltiIds={new Set(formData.deliveredBiltis.map(item => item.biltiId))}
        onSelectionConfirm={handleBiltiSelectionConfirm}
        dialogTitle="Select Biltis for Delivery"
      />

      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground flex items-center"><PackageOpen className="mr-3 h-8 w-8 text-primary"/>Goods Delivery</h1>
          <p className="text-muted-foreground ml-11">Mark goods as delivered, manage rebates & discounts.</p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => {
            setIsFormDialogOpen(isOpen);
            if (!isOpen) {setEditingDelivery(null);}
        }}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm} disabled={isSubmitting || isLoading}>
              <PlusCircle className="mr-2 h-4 w-4" /> New Goods Delivery
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editingDelivery ? "Edit Goods Delivery" : "Record New Goods Delivery"}</DialogTitle>
              <DialogDescription>
                Select Biltis, record delivery details, and manage rebates/discounts.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
              <ScrollArea className="flex-grow pr-1">
                <div className="grid gap-4 py-4 ">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="deliveryNoteNo" className="text-right md:col-span-1 col-span-4">Delivery Note No.</Label>
                    <Input id="deliveryNoteNo" value={editingDelivery ? editingDelivery.id : "Auto-Generated"} readOnly className="bg-muted md:col-span-3 col-span-4" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="miti" className="text-right md:col-span-1 col-span-4">Miti (AD)</Label>
                    <Popover>
                      <PopoverTrigger asChild className="md:col-span-3 col-span-4">
                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !formData.miti && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.miti ? format(formData.miti, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.miti} onSelect={handleDateChange} initialFocus /></PopoverContent>
                    </Popover>
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="nepaliMiti" className="text-right md:col-span-1 col-span-4">Nepali Miti</Label>
                    <Input id="nepaliMiti" name="nepaliMiti" value={formData.nepaliMiti || ""} onChange={handleInputChange} className="md:col-span-3 col-span-4" placeholder="e.g., 2081-04-01" />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="biltiSelectionButton" className="text-right md:col-span-1 col-span-4">Select Biltis</Label>
                    <Button 
                        type="button" 
                        variant="outline" 
                        id="biltiSelectionButton"
                        className="md:col-span-3 col-span-4 justify-start" 
                        onClick={() => setIsBiltiSelectDialogOpen(true)}
                        disabled={isLoading || biltisForSelection.length === 0}
                    >
                        <ListChecks className="mr-2 h-4 w-4"/>
                        {formData.deliveredBiltis.length > 0 ? `Selected ${formData.deliveredBiltis.length} Bilti(s)` : (isLoading ? "Loading Biltis..." : (biltisForSelection.length === 0 ? "No Biltis (status 'Received')" : "Click to Select Biltis..."))}
                    </Button>
                  </div>

                  {formData.deliveredBiltis.length > 0 && (
                    <Card className="col-span-4 mt-2">
                      <CardHeader><CardTitle className="text-md">Selected Biltis for Delivery</CardTitle></CardHeader>
                      <CardContent className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {formData.deliveredBiltis.map((item, index) => (
                          <div key={item.biltiId} className="p-3 border rounded-md bg-secondary/30 space-y-2">
                            <div className="flex justify-between items-center">
                                <p className="font-semibold text-sm">{item.biltiData?.id || item.biltiId} - {getPartyName(item.biltiData?.consigneeId)}</p>
                                <p className="text-xs text-muted-foreground">To: {item.biltiData?.destination}</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                               <div>
                                <Label htmlFor={`rebateAmount-${index}`} className="text-xs">Rebate Amount</Label>
                                <Input type="number" id={`rebateAmount-${index}`} value={item.rebateAmount} onChange={(e) => handlePerBiltiInputChange(item.biltiId, 'rebateAmount', parseFloat(e.target.value) || 0)} placeholder="0.00" className="h-8 text-xs"/>
                               </div>
                               <div>
                                <Label htmlFor={`rebateReason-${index}`} className="text-xs">Rebate Reason {item.rebateAmount > 0 && <span className="text-destructive">*</span>}</Label>
                                <Input id={`rebateReason-${index}`} value={item.rebateReason} onChange={(e) => handlePerBiltiInputChange(item.biltiId, 'rebateReason', e.target.value)} placeholder="Reason" className="h-8 text-xs"/>
                               </div>
                            </div>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                               <div>
                                <Label htmlFor={`discountAmount-${index}`} className="text-xs">Discount Amount</Label>
                                <Input type="number" id={`discountAmount-${index}`} value={item.discountAmount} onChange={(e) => handlePerBiltiInputChange(item.biltiId, 'discountAmount', parseFloat(e.target.value) || 0)} placeholder="0.00" className="h-8 text-xs"/>
                               </div>
                               <div>
                                <Label htmlFor={`discountReason-${index}`} className="text-xs">Discount Reason {item.discountAmount > 0 && <span className="text-destructive">*</span>}</Label>
                                <Input id={`discountReason-${index}`} value={item.discountReason} onChange={(e) => handlePerBiltiInputChange(item.biltiId, 'discountReason', e.target.value)} placeholder="Reason" className="h-8 text-xs"/>
                               </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="deliveredToName" className="text-right md:col-span-1 col-span-4">Delivered To Name</Label>
                    <Input id="deliveredToName" name="deliveredToName" value={formData.deliveredToName || ""} onChange={handleInputChange} className="md:col-span-3 col-span-4" placeholder="(Optional)"/>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="deliveredToContact" className="text-right md:col-span-1 col-span-4">Delivered To Contact</Label>
                    <Input id="deliveredToContact" name="deliveredToContact" value={formData.deliveredToContact || ""} onChange={handleInputChange} className="md:col-span-3 col-span-4" placeholder="(Optional)"/>
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4 mt-2">
                    <Label htmlFor="overallRemarks" className="text-right pt-2 md:col-span-1 col-span-4">Overall Remarks</Label>
                    <Textarea id="overallRemarks" name="overallRemarks" value={formData.overallRemarks} onChange={handleInputChange} placeholder="General remarks for this delivery note..." className="md:col-span-3 col-span-4" rows={3}/>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="pt-4 border-t mt-auto">
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting || isLoading}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingDelivery ? "Update Delivery" : "Save Delivery"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Goods Delivery List</CardTitle>
          <CardDescription>View all recorded goods deliveries.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search Deliveries (Note No, Bilti No, BS Date)..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
         {isLoading && goodsDeliveries.length === 0 ? (
            <div className="flex justify-center items-center h-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading deliveries...</p></div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Delivery Note No.</TableHead>
                <TableHead>Miti (AD)</TableHead>
                <TableHead>Miti (BS)</TableHead>
                <TableHead># Biltis</TableHead>
                <TableHead>Total Rebate</TableHead>
                <TableHead>Total Discount</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeliveries.length === 0 && !isLoading && <TableRow><TableCell colSpan={7} className="text-center h-24">No goods deliveries found.</TableCell></TableRow>}
              {filteredDeliveries.map((delivery) => {
                const totalRebate = delivery.deliveredBiltis.reduce((sum, item) => sum + item.rebateAmount, 0);
                const totalDiscount = delivery.deliveredBiltis.reduce((sum, item) => sum + item.discountAmount, 0);
                return (
                <TableRow key={delivery.id}>
                  <TableCell className="font-medium">{delivery.id}</TableCell>
                  <TableCell>{format(delivery.miti, "PP")}</TableCell>
                  <TableCell>{delivery.nepaliMiti || "N/A"}</TableCell>
                  <TableCell>{delivery.deliveredBiltis.length}</TableCell>
                  <TableCell>{totalRebate.toFixed(2)}</TableCell>
                  <TableCell>{totalDiscount.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="icon" aria-label="Edit Delivery" onClick={() => openEditForm(delivery)} disabled={isSubmitting}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog open={isDeleteDialogOpen && deliveryToDelete?.id === delivery.id} onOpenChange={(open) => { if(!open) setDeliveryToDelete(null); setIsDeleteDialogOpen(open);}}>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="icon" aria-label="Delete Delivery" onClick={() => handleDeleteClick(delivery)} disabled={isSubmitting}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete Delivery Note "{deliveryToDelete?.id}" and revert associated Bilti statuses.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {setDeliveryToDelete(null); setIsDeleteDialogOpen(false);}} disabled={isSubmitting}>Cancel</AlertDialogCancel>
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
              )})}
            </TableBody>
          </Table>
          )}
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">
                Ledger updates for rebates/discounts are simulated. Bilti statuses are updated in Firestore.
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}

    