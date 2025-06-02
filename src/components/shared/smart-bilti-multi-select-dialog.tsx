
"use client";

import { useState, type ChangeEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import type { Bilti, Party } from "@/app/invoicing/page"; // Assuming interfaces are in invoicing or a shared types file
import { format } from "date-fns";

interface SmartBiltiMultiSelectDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  availableBiltis: Bilti[];
  parties: Party[];
  selectedBiltiIds: Set<string>;
  onSelectionConfirm: (selectedIds: Set<string>) => void;
  dialogTitle: string;
}

export default function SmartBiltiMultiSelectDialog({
  isOpen,
  onOpenChange,
  availableBiltis,
  parties,
  selectedBiltiIds: initialSelectedBiltiIds,
  onSelectionConfirm,
  dialogTitle,
}: SmartBiltiMultiSelectDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentSelectedBiltiIds, setCurrentSelectedBiltiIds] = useState<Set<string>>(initialSelectedBiltiIds);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setCurrentSelectedBiltiIds(new Set(initialSelectedBiltiIds)); // Reset/initialize based on prop
    }
  }, [isOpen, initialSelectedBiltiIds]);

  const getPartyName = (partyId: string) => parties.find(p => p.id === partyId)?.name || "N/A";

  const filteredBiltis = availableBiltis.filter((bilti) => {
    const consignorName = getPartyName(bilti.consignorId).toLowerCase();
    const consigneeName = getPartyName(bilti.consigneeId).toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    return (
      bilti.id.toLowerCase().includes(searchLower) ||
      consignorName.includes(searchLower) ||
      consigneeName.includes(searchLower) ||
      bilti.destination.toLowerCase().includes(searchLower)
    );
  });

  const handleBiltiSelectionChange = (biltiId: string, checked: boolean) => {
    setCurrentSelectedBiltiIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(biltiId);
      } else {
        newSet.delete(biltiId);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    onSelectionConfirm(currentSelectedBiltiIds);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>Search and select Biltis for delivery. Check the boxes to select multiple Biltis.</DialogDescription>
        </DialogHeader>
        
        <div className="relative my-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Bilti No, Consignor, Consignee, Destination..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <ScrollArea className="flex-grow pr-2">
          {filteredBiltis.length > 0 ? (
            filteredBiltis.map((bilti) => (
              <div
                key={bilti.id}
                className="p-3 mb-2 border rounded-md flex items-start gap-3 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Checkbox
                  id={`bilti-select-${bilti.id}`}
                  checked={currentSelectedBiltiIds.has(bilti.id)}
                  onCheckedChange={(checked) => handleBiltiSelectionChange(bilti.id, !!checked)}
                  className="mt-1"
                />
                <label htmlFor={`bilti-select-${bilti.id}`} className="flex-grow cursor-pointer">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-primary">{bilti.id}</p>
                    <p className="text-xs text-muted-foreground">Miti: {format(bilti.miti, "PP")}</p>
                  </div>
                  <p className="text-sm">
                    Consignor: <span className="font-medium">{getPartyName(bilti.consignorId)}</span>
                  </p>
                  <p className="text-sm">
                    Consignee: <span className="font-medium">{getPartyName(bilti.consigneeId)}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Destination: {bilti.destination} | Pkgs: {bilti.packages} | Amt: {bilti.totalAmount.toFixed(2)}
                  </p>
                </label>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-4">No Biltis found matching your search or available for delivery.</p>
          )}
        </ScrollArea>
        <DialogFooter className="pt-4 border-t">
           <p className="text-sm text-muted-foreground mr-auto">Selected: {currentSelectedBiltiIds.size} Bilti(s)</p>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleConfirm}>
            Confirm Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
