
"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Search, Edit, Trash2, PackageOpen } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Interfaces
interface Party { // From invoicing/page.tsx or shared
  id: string;
  name: string;
}
interface Bilti { // From invoicing/page.tsx
  id: string;
  miti: Date;
  consignorId: string;
  consigneeId: string;
  destination: string;
  status?: "Pending" | "Manifested" | "Received" | "Delivered" | "Cancelled";
}
interface GoodsDelivery {
  id: string; // Delivery Note No.
  miti: Date;
  biltiId: string;
  remarks: string; // For extra charges, rebates, POD info etc.
}

// Mock Data
const initialMockParties: Party[] = [
  { id: "PTY001", name: "Global Traders (KTM)"},
  { id: "PTY002", name: "National Distributors (PKR)"},
];
const initialBiltisPendingDelivery: Bilti[] = [
  { id: "BLT-001", miti: new Date("2024-07-01"), consignorId: "PTY001", consigneeId: "PTY002", destination: "Pokhara Hub", status: "Received" },
  { id: "BLT-002", miti: new Date("2024-07-02"), consignorId: "PTY002", consigneeId: "PTY001", destination: "Biratnagar Depot", status: "Received" },
  { id: "BLT-003", miti: new Date("2024-07-03"), consignorId: "PTY001", consigneeId: "PTY001", destination: "Kathmandu Main", status: "Received" },
];

const defaultGoodsDeliveryFormData: Omit<GoodsDelivery, 'id'> = {
  miti: new Date(),
  biltiId: "",
  remarks: "",
};

export default function GoodsDeliveryPage() {
  const [goodsDeliveries, setGoodsDeliveries] = useState<GoodsDelivery[]>([]);
  const [biltisPendingDelivery, setBiltisPendingDelivery] = useState<Bilti[]>(initialBiltisPendingDelivery);
  const [parties] = useState<Party[]>(initialMockParties);

  const [searchTerm, setSearchTerm] = useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<GoodsDelivery | null>(null);
  const [formData, setFormData] = useState<Omit<GoodsDelivery, 'id'>>(defaultGoodsDeliveryFormData);
  
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deliveryToDelete, setDeliveryToDelete] = useState<GoodsDelivery | null>(null);
  
  const [selectedBiltiForForm, setSelectedBiltiForForm] = useState<Bilti | null>(null);

  useEffect(() => {
    if (formData.biltiId) {
      const bilti = biltisPendingDelivery.find(b => b.id === formData.biltiId) || initialBiltisPendingDelivery.find(b => b.id === formData.biltiId);
      setSelectedBiltiForForm(bilti || null);
    } else {
      setSelectedBiltiForForm(null);
    }
  }, [formData.biltiId, biltisPendingDelivery]);


  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof Omit<GoodsDelivery, 'id'>) => (value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => ({ ...prev, miti: date }));
    }
  };

  const generateDeliveryNoteNo = (): string => {
    const nextId = goodsDeliveries.length + 1 + Math.floor(Math.random() * 100);
    return `GDN-${String(nextId).padStart(3, '0')}`; // GDN for Goods Delivery Note
  };

  const openAddForm = () => {
    setEditingDelivery(null);
    setFormData({...defaultGoodsDeliveryFormData, miti: new Date() });
    setSelectedBiltiForForm(null);
    setIsFormDialogOpen(true);
  };

  const openEditForm = (delivery: GoodsDelivery) => {
    setEditingDelivery(delivery);
    setFormData(delivery);
    const bilti = biltisPendingDelivery.find(b => b.id === delivery.biltiId) || initialBiltisPendingDelivery.find(b => b.id === delivery.biltiId); // Check original list too
    setSelectedBiltiForForm(bilti || null);
    setIsFormDialogOpen(true);
  };
  
  const getPartyName = (partyId?: string) => parties.find(p => p.id === partyId)?.name || "N/A";
  const getBiltiDisplay = (biltiId: string) => {
     const bilti = biltisPendingDelivery.find(b => b.id === biltiId) || initialBiltisPendingDelivery.find(b=>b.id === biltiId);
     if (!bilti) return "N/A";
     return `${bilti.id} (To: ${getPartyName(bilti.consigneeId)}, Dest: ${bilti.destination})`;
  }


  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.biltiId) { 
        toast({ title: "Missing Fields", description: "Bilti selection is required.", variant: "destructive" });
        return;
    }

    if (editingDelivery) {
      const updatedDelivery: GoodsDelivery = { ...formData, id: editingDelivery.id };
      setGoodsDeliveries(goodsDeliveries.map(d => d.id === editingDelivery.id ? updatedDelivery : d));
      toast({ title: "Goods Delivery Updated", description: `Delivery Note ${updatedDelivery.id} updated.` });
    } else {
      const newDelivery: GoodsDelivery = { ...formData, id: generateDeliveryNoteNo() };
      setGoodsDeliveries(prevDeliveries => [...prevDeliveries, newDelivery]);
      // Simulate updating Bilti status to "Delivered" and removing from pending list
      setBiltisPendingDelivery(prevBiltis => 
        prevBiltis.map(b => b.id === newDelivery.biltiId ? {...b, status: "Delivered"} : b)
                  .filter(b => b.id !== newDelivery.biltiId || b.status !== "Delivered") 
      );
      toast({ title: "Goods Delivery Recorded", description: `Delivery Note ${newDelivery.id} created. Bilti ${newDelivery.biltiId} (simulated) marked as 'Delivered'.` });
    }
    setIsFormDialogOpen(false);
    setEditingDelivery(null);
    setSelectedBiltiForForm(null);
  };

  const handleDeleteClick = (delivery: GoodsDelivery) => {
    setDeliveryToDelete(delivery);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deliveryToDelete) {
      setGoodsDeliveries(goodsDeliveries.filter((d) => d.id !== deliveryToDelete.id));
      // Simulate reverting Bilti status if needed.
      const originalBilti = initialBiltisPendingDelivery.find(b => b.id === deliveryToDelete.biltiId);
      if(originalBilti && !biltisPendingDelivery.find(b => b.id === deliveryToDelete.biltiId)){
         setBiltisPendingDelivery(prev => [...prev, {...originalBilti, status: "Received"}]);
      }
      toast({ title: "Goods Delivery Deleted", description: `Delivery Note ${deliveryToDelete.id} deleted. Bilti status (simulated) may need to be reverted to 'Received'.` });
    }
    setIsDeleteDialogOpen(false);
    setDeliveryToDelete(null);
  };

  const filteredDeliveries = goodsDeliveries.filter(delivery => 
    delivery.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    delivery.biltiId.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const availableBiltisForSelection = biltisPendingDelivery.filter(b => b.status === "Received" || (editingDelivery && b.id === editingDelivery.biltiId));


  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground flex items-center"><PackageOpen className="mr-3 h-8 w-8 text-primary"/>Goods Delivery</h1>
          <p className="text-muted-foreground ml-11">Mark goods as delivered to the consignee.</p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => {
            setIsFormDialogOpen(isOpen);
            if (!isOpen) {setEditingDelivery(null); setSelectedBiltiForForm(null);}
        }}>
          <DialogTrigger asChild>
            <Button onClick={openAddForm}>
              <PlusCircle className="mr-2 h-4 w-4" /> New Goods Delivery
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingDelivery ? "Edit Goods Delivery" : "Record New Goods Delivery"}</DialogTitle>
              <DialogDescription>
                Select a Bilti and record delivery details.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
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
                  <Label htmlFor="biltiId" className="text-right md:col-span-1 col-span-4">Bilti</Label>
                  <Select name="biltiId" value={formData.biltiId} onValueChange={handleSelectChange('biltiId')} required>
                    <SelectTrigger className="md:col-span-3 col-span-4"><SelectValue placeholder="Select Bilti for Delivery" /></SelectTrigger>
                    <SelectContent>
                      {availableBiltisForSelection.map(b => 
                        <SelectItem key={b.id} value={b.id}>{b.id} (To: {getPartyName(b.consigneeId)})</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                 {selectedBiltiForForm && (
                  <div className="md:col-span-4 col-span-4 p-3 border rounded-md bg-secondary/50 text-sm">
                    <p><strong>Consignee:</strong> {getPartyName(selectedBiltiForForm.consigneeId)}</p>
                    <p><strong>Destination:</strong> {selectedBiltiForForm.destination}</p>
                  </div>
                )}
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="remarks" className="text-right pt-2 md:col-span-1 col-span-4">Delivery Remarks / POD</Label>
                  <Textarea id="remarks" name="remarks" value={formData.remarks} onChange={handleInputChange} placeholder="Note any delivery specifics, POD number, extra charges, etc." className="md:col-span-3 col-span-4" rows={4}/>
                </div>
              </div>
              <DialogFooter className="pt-4 border-t">
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
                <TableHead>Bilti No.</TableHead>
                <TableHead>Consignee</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeliveries.length === 0 && <TableRow><TableCell colSpan={6} className="text-center h-24">No goods deliveries found.</TableCell></TableRow>}
              {filteredDeliveries.map((delivery) => {
                const bilti = initialBiltisPendingDelivery.find(b => b.id === delivery.biltiId) || // Check original if already delivered
                                goodsDeliveries.map(gd => initialBiltisPendingDelivery.find(b => b.id === gd.biltiId)).find(b => b && b.id === delivery.biltiId);

                return (
                <TableRow key={delivery.id}>
                  <TableCell className="font-medium">{delivery.id}</TableCell>
                  <TableCell>{format(delivery.miti, "PP")}</TableCell>
                  <TableCell>{delivery.biltiId}</TableCell>
                  <TableCell>{bilti ? getPartyName(bilti.consigneeId) : "N/A"}</TableCell>
                  <TableCell className="max-w-xs truncate">{delivery.remarks || "N/A"}</TableCell>
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
                            <AlertDialogDescription>This will permanently delete Delivery Note "{deliveryToDelete?.id}". This might require manual adjustments to Bilti status.</AlertDialogDescription>
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
      </Card>
    </div>
  );
}

    