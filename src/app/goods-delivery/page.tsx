
"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Search, Edit, Trash2, PackageOpen, ListChecks } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import SmartBiltiMultiSelectDialog from "@/components/shared/smart-bilti-multi-select-dialog";
import type { Party, Bilti } from "@/app/invoicing/page"; // Assuming interfaces are from invoicing
import { ScrollArea } from "@/components/ui/scroll-area";


interface DeliveredBiltiItem {
  biltiId: string;
  biltiData?: Bilti; // Full bilti data for display and context
  rebateAmount: number;
  rebateReason: string;
  discountAmount: number;
  discountReason: string;
}

interface GoodsDelivery {
  id: string; // Delivery Note No.
  miti: Date;
  deliveredBiltis: DeliveredBiltiItem[];
  overallRemarks: string; 
}

// Mock Data
const initialMockParties: Party[] = [
  { id: "PTY001", name: "Global Traders (KTM)", type: "Both", contactNo:"98001", panNo:"PAN1", address:"KTM", assignedLedger:"L1", status:"Active"},
  { id: "PTY002", name: "National Distributors (PKR)", type: "Both", contactNo:"98002", panNo:"PAN2", address:"PKR", assignedLedger:"L2", status:"Active"},
];
const initialBiltisPendingDelivery: Bilti[] = [
  { id: "BLT-001", miti: new Date("2024-07-01"), consignorId: "PTY001", consigneeId: "PTY002", origin: "KTM", destination: "Pokhara Hub", description:"E", packages:10, totalAmount:500, payMode:"To Pay", truckId:"T1", driverId:"D1", status: "Received" },
  { id: "BLT-002", miti: new Date("2024-07-02"), consignorId: "PTY002", consigneeId: "PTY001", origin: "PKR", destination: "Biratnagar Depot", description:"G", packages:5, totalAmount:200, payMode:"Paid", truckId:"T2", driverId:"D2", status: "Received" },
  { id: "BLT-003", miti: new Date("2024-07-03"), consignorId: "PTY001", consigneeId: "PTY001", origin: "KTM", destination: "Kathmandu Main", description:"H", packages:12, totalAmount:600, payMode:"To Pay", truckId:"T1", driverId:"D1", status: "Received" },
  { id: "BLT-004", miti: new Date("2024-07-04"), consignorId: "PTY001", consigneeId: "PTY002", origin: "KTM", destination: "Pokhara Hub", description:"X", packages:8, totalAmount:400, payMode:"Paid", truckId:"T1", driverId:"D1", status: "Received" },
];

const defaultGoodsDeliveryFormData: Omit<GoodsDelivery, 'id'> = {
  miti: new Date(),
  deliveredBiltis: [],
  overallRemarks: "",
};

export default function GoodsDeliveryPage() {
  const [goodsDeliveries, setGoodsDeliveries] = useState<GoodsDelivery[]>([]);
  const [biltisMasterList, setBiltisMasterList] = useState<Bilti[]>(initialBiltisPendingDelivery); // Master list of all Biltis
  const [parties] = useState<Party[]>(initialMockParties);

  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<GoodsDelivery | null>(null);
  const [formData, setFormData] = useState<Omit<GoodsDelivery, 'id'>>(defaultGoodsDeliveryFormData);
  
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deliveryToDelete, setDeliveryToDelete] = useState<GoodsDelivery | null>(null);
  
  const [isBiltiSelectDialogOpen, setIsBiltiSelectDialogOpen] = useState(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handlePerBiltiInputChange = (biltiId: string, fieldName: keyof Omit<DeliveredBiltiItem, 'biltiId'|'biltiData'>, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      deliveredBiltis: prev.deliveredBiltis.map(item => 
        item.biltiId === biltiId ? { ...item, [fieldName]: value } : item
      )
    }));
  };


  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => ({ ...prev, miti: date }));
    }
  };
  
  const handleBiltiSelectionConfirm = (selectedIds: Set<string>) => {
    const newDeliveredBiltis: DeliveredBiltiItem[] = Array.from(selectedIds).map(id => {
      // Find if this bilti was already in formData to preserve its rebate/discount details
      const existingItem = formData.deliveredBiltis.find(item => item.biltiId === id);
      if (existingItem) return existingItem;
      
      // If new, add it with default rebate/discount
      const biltiData = biltisMasterList.find(b => b.id === id);
      return {
        biltiId: id,
        biltiData: biltiData || undefined, // Store full bilti data
        rebateAmount: 0,
        rebateReason: "",
        discountAmount: 0,
        discountReason: "",
      };
    });
    setFormData(prev => ({ ...prev, deliveredBiltis: newDeliveredBiltis }));
  };


  const generateDeliveryNoteNo = (): string => {
    const nextId = goodsDeliveries.length + 1 + Math.floor(Math.random() * 100);
    return `GDN-${String(nextId).padStart(3, '0')}`;
  };

  const openAddForm = () => {
    setEditingDelivery(null);
    setFormData({...defaultGoodsDeliveryFormData, miti: new Date() });
    setIsFormDialogOpen(true);
  };

  const openEditForm = (delivery: GoodsDelivery) => {
    setEditingDelivery(delivery);
    // Ensure biltiData is populated for editing
    const populatedDeliveredBiltis = delivery.deliveredBiltis.map(item => ({
        ...item,
        biltiData: biltisMasterList.find(b => b.id === item.biltiId)
    }));
    setFormData({...delivery, deliveredBiltis: populatedDeliveredBiltis});
    setIsFormDialogOpen(true);
  };
  
  const getPartyName = (partyId?: string) => parties.find(p => p.id === partyId)?.name || "N/A";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (formData.deliveredBiltis.length === 0) { 
        toast({ title: "No Biltis Selected", description: "Please select at least one Bilti for delivery.", variant: "destructive" });
        return;
    }

    // Validation for rebate/discount reasons
    for (const item of formData.deliveredBiltis) {
      if (item.rebateAmount > 0 && !item.rebateReason.trim()) {
        toast({ title: "Missing Rebate Reason", description: `Please provide a reason for rebate on Bilti ${item.biltiId}.`, variant: "destructive" });
        return;
      }
      if (item.discountAmount > 0 && !item.discountReason.trim()) {
        toast({ title: "Missing Discount Reason", description: `Please provide a reason for discount on Bilti ${item.biltiId}.`, variant: "destructive" });
        return;
      }
    }

    if (editingDelivery) {
      const updatedDelivery: GoodsDelivery = { ...formData, id: editingDelivery.id };
      setGoodsDeliveries(goodsDeliveries.map(d => d.id === editingDelivery.id ? updatedDelivery : d));
      // Simulate updating Bilti statuses (complex if a Bilti is removed from delivery note)
      // For simplicity, we'll just show a success message
      toast({ title: "Goods Delivery Updated", description: `Delivery Note ${updatedDelivery.id} updated. Ledger entries for rebates/discounts (simulated) adjusted.` });
    } else {
      const newDelivery: GoodsDelivery = { ...formData, id: generateDeliveryNoteNo() };
      setGoodsDeliveries(prevDeliveries => [...prevDeliveries, newDelivery]);
      
      // Simulate updating Bilti statuses to "Delivered"
      setBiltisMasterList(prevBiltis => 
        prevBiltis.map(b => 
          newDelivery.deliveredBiltis.some(db => db.biltiId === b.id) ? {...b, status: "Delivered"} : b
        )
      );
      toast({ title: "Goods Delivery Recorded", description: `Delivery Note ${newDelivery.id} created. Selected Biltis (simulated) marked 'Delivered'. Ledger entries for rebates/discounts (simulated) posted.` });
    }
    setIsFormDialogOpen(false);
    setEditingDelivery(null);
  };

  const handleDeleteClick = (delivery: GoodsDelivery) => {
    setDeliveryToDelete(delivery);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deliveryToDelete) {
      setGoodsDeliveries(goodsDeliveries.filter((d) => d.id !== deliveryToDelete.id));
      
      // Simulate reverting Bilti statuses to "Received"
      setBiltisMasterList(prevBiltis => 
         prevBiltis.map(b => 
          deliveryToDelete.deliveredBiltis.some(db => db.biltiId === b.id) ? {...b, status: "Received"} : b
        )
      );
      toast({ title: "Goods Delivery Deleted", description: `Delivery Note ${deliveryToDelete.id} deleted. Bilti statuses (simulated) reverted. Ledger entries (simulated) reversed.` });
    }
    setIsDeleteDialogOpen(false);
    setDeliveryToDelete(null);
  };

  const filteredDeliveries = goodsDeliveries.filter(delivery => 
    delivery.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    delivery.deliveredBiltis.some(db => db.biltiId.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const availableBiltisForSelection = biltisMasterList.filter(b => b.status === "Received" || (editingDelivery && editingDelivery.deliveredBiltis.some(db => db.biltiId === b.id)));


  return (
    <div className="space-y-6">
       <SmartBiltiMultiSelectDialog
        isOpen={isBiltiSelectDialogOpen}
        onOpenChange={setIsBiltiSelectDialogOpen}
        availableBiltis={availableBiltisForSelection}
        parties={parties}
        selectedBiltiIds={new Set(formData.deliveredBiltis.map(item => item.biltiId))}
        onSelectionConfirm={handleBiltiSelectionConfirm}
        dialogTitle="Select Biltis for Delivery"
      />

      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground flex items-center"><PackageOpen className="mr-3 h-8 w-8 text-primary"/>Goods Delivery</h1>
          <p className="text-muted-foreground ml-11">Mark goods as delivered to the consignee, manage rebates & discounts.</p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => {
            setIsFormDialogOpen(isOpen);
            if (!isOpen) {setEditingDelivery(null);}
        }}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm}>
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
                    <Label htmlFor="miti" className="text-right md:col-span-1 col-span-4">Miti (Date)</Label>
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
                    <Label htmlFor="biltiSelectionButton" className="text-right md:col-span-1 col-span-4">Select Biltis</Label>
                    <Button 
                        type="button" 
                        variant="outline" 
                        id="biltiSelectionButton"
                        className="md:col-span-3 col-span-4 justify-start" 
                        onClick={() => setIsBiltiSelectDialogOpen(true)}
                    >
                        <ListChecks className="mr-2 h-4 w-4"/>
                        {formData.deliveredBiltis.length > 0 ? `Selected ${formData.deliveredBiltis.length} Bilti(s)` : "Click to Select Biltis..."}
                    </Button>
                  </div>

                  {formData.deliveredBiltis.length > 0 && (
                    <Card className="col-span-4 mt-2">
                      <CardHeader><CardTitle className="text-md">Selected Biltis for Delivery</CardTitle></CardHeader>
                      <CardContent className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {formData.deliveredBiltis.map((item, index) => (
                          <div key={item.biltiId} className="p-3 border rounded-md bg-secondary/30 space-y-2">
                            <div className="flex justify-between items-center">
                                <p className="font-semibold text-sm">{item.biltiId} - {getPartyName(item.biltiData?.consigneeId)}</p>
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

                  <div className="grid grid-cols-4 items-start gap-4 mt-2">
                    <Label htmlFor="overallRemarks" className="text-right pt-2 md:col-span-1 col-span-4">Overall Remarks</Label>
                    <Textarea id="overallRemarks" name="overallRemarks" value={formData.overallRemarks} onChange={handleInputChange} placeholder="General remarks for this delivery note..." className="md:col-span-3 col-span-4" rows={3}/>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="pt-4 border-t mt-auto">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit">{editingDelivery ? "Update Delivery" : "Save Delivery"}</Button>
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
            <Input placeholder="Search Deliveries (Note No, Bilti No)..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Delivery Note No.</TableHead>
                <TableHead>Miti</TableHead>
                <TableHead># Biltis</TableHead>
                <TableHead>Total Rebate</TableHead>
                <TableHead>Total Discount</TableHead>
                <TableHead>Overall Remarks</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeliveries.length === 0 && <TableRow><TableCell colSpan={7} className="text-center h-24">No goods deliveries found.</TableCell></TableRow>}
              {filteredDeliveries.map((delivery) => {
                const totalRebate = delivery.deliveredBiltis.reduce((sum, item) => sum + item.rebateAmount, 0);
                const totalDiscount = delivery.deliveredBiltis.reduce((sum, item) => sum + item.discountAmount, 0);
                return (
                <TableRow key={delivery.id}>
                  <TableCell className="font-medium">{delivery.id}</TableCell>
                  <TableCell>{format(delivery.miti, "PP")}</TableCell>
                  <TableCell>{delivery.deliveredBiltis.length}</TableCell>
                  <TableCell>{totalRebate.toFixed(2)}</TableCell>
                  <TableCell>{totalDiscount.toFixed(2)}</TableCell>
                  <TableCell className="max-w-xs truncate">{delivery.overallRemarks || "N/A"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="icon" aria-label="Edit Delivery" onClick={() => openEditForm(delivery)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog open={isDeleteDialogOpen && deliveryToDelete?.id === delivery.id} onOpenChange={(open) => { if(!open) setDeliveryToDelete(null); setIsDeleteDialogOpen(open);}}>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="icon" aria-label="Delete Delivery" onClick={() => handleDeleteClick(delivery)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete Delivery Note "{deliveryToDelete?.id}". This might require manual adjustments to Bilti status and ledger entries.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {setDeliveryToDelete(null); setIsDeleteDialogOpen(false);}}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">
                Ledger updates for rebates/discounts (simulated) are posted upon saving a delivery. Bilti statuses are also updated (simulated).
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
