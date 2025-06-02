
"use client";

import { useState, type ChangeEvent, type FormEvent, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlusCircle, Search } from "lucide-react";
import { Party } from "@/app/invoicing/page"; // Assuming Party interface is exported from invoicing or a shared types file
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SmartPartySelectDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  parties: Party[];
  onPartySelect: (party: Party) => void;
  onPartyAdd: (party: Party) => void; // Callback to inform parent about the new party
  dialogTitle: string;
}

const partyTypes: Party["type"][] = ["Consignor", "Consignee", "Both"];
const partyStatuses: Party["status"][] = ["Active", "Inactive"];

interface NewPartyFormData {
  name: string;
  panNo: string;
  contactNo: string;
  address: string;
  type: Party["type"];
  status: Party["status"];
}

const defaultNewPartyFormData: NewPartyFormData = {
  name: "",
  panNo: "",
  contactNo: "",
  address: "",
  type: "Both",
  status: "Active",
};

export default function SmartPartySelectDialog({
  isOpen,
  onOpenChange,
  parties,
  onPartySelect,
  onPartyAdd,
  dialogTitle,
}: SmartPartySelectDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPartyData, setNewPartyData] = useState<NewPartyFormData>(defaultNewPartyFormData);
  const [panError, setPanError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setShowAddForm(false);
      setNewPartyData(defaultNewPartyFormData);
      setPanError(null);
    }
  }, [isOpen]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewPartyData((prev) => ({ ...prev, [name]: value }));
    if (name === "panNo") {
      setPanError(null); // Clear PAN error on change
    }
  };

  const handleSelectChange = (name: keyof NewPartyFormData) => (value: string) => {
    setNewPartyData((prev) => ({ ...prev, [name]: value as Party["type"] | Party["status"] }));
  };

  const handleAddNewParty = (e: FormEvent) => {
    e.preventDefault();
    if (!newPartyData.name.trim() || !newPartyData.panNo.trim()) {
      alert("Party Name and PAN Number are required.");
      return;
    }
    if (parties.some(p => p.panNo?.toLowerCase() === newPartyData.panNo.toLowerCase().trim())) {
      setPanError("A party with this PAN number already exists.");
      return;
    }
    setPanError(null);

    const newParty: Party = {
      id: `PTYNEW-${Date.now()}-${Math.floor(Math.random() * 1000)}`, // More robust unique ID for local state
      name: newPartyData.name.trim(),
      panNo: newPartyData.panNo.trim(),
      contactNo: newPartyData.contactNo.trim(),
      address: newPartyData.address.trim(),
      type: newPartyData.type,
      status: newPartyData.status,
      assignedLedger: `LEDGER-${newPartyData.panNo.trim().toUpperCase() || `GEN${Date.now()}`}`, // Auto-generate ledger ID
    };
    onPartyAdd(newParty); // Inform parent
    onPartySelect(newParty); // Auto-select the new party
    onOpenChange(false); // Close dialog
  };

  const filteredParties = parties.filter(
    (party) =>
      party.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (party.panNo && party.panNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      party.contactNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          {!showAddForm && (
            <DialogDescription>Search for an existing party or add a new one.</DialogDescription>
          )}
        </DialogHeader>

        {!showAddForm ? (
          <>
            <div className="relative my-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Name, PAN, Contact..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <ScrollArea className="flex-grow pr-6">
              {filteredParties.length > 0 ? (
                filteredParties.map((party) => (
                  <div
                    key={party.id}
                    className="p-3 mb-2 border rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer"
                    onClick={() => {
                      onPartySelect(party);
                      onOpenChange(false);
                    }}
                  >
                    <p className="font-semibold">{party.name}</p>
                    <p className="text-sm text-muted-foreground">
                      PAN: {party.panNo || "N/A"} | Contact: {party.contactNo || "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">{party.address || "No address"}</p>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">No parties found matching your search.</p>
              )}
            </ScrollArea>
            <DialogFooter className="pt-4 border-t">
              <Button variant="outline" onClick={() => setShowAddForm(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Party
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleAddNewParty} className="space-y-3 py-2 flex-grow overflow-y-auto pr-1">
            <DialogDescription>Enter the details for the new party.</DialogDescription>
            <div>
              <Label htmlFor="newPartyName">Party Name <span className="text-destructive">*</span></Label>
              <Input id="newPartyName" name="name" value={newPartyData.name} onChange={handleInputChange} required />
            </div>
            <div>
              <Label htmlFor="newPartyPanNo">PAN Number <span className="text-destructive">*</span></Label>
              <Input id="newPartyPanNo" name="panNo" value={newPartyData.panNo} onChange={handleInputChange} required />
              {panError && <p className="text-sm text-destructive mt-1">{panError}</p>}
            </div>
            <div>
              <Label htmlFor="newPartyContactNo">Contact Number</Label>
              <Input id="newPartyContactNo" name="contactNo" value={newPartyData.contactNo} onChange={handleInputChange} />
            </div>
            <div>
              <Label htmlFor="newPartyAddress">Address</Label>
              <Input id="newPartyAddress" name="address" value={newPartyData.address} onChange={handleInputChange} />
            </div>
             <div>
              <Label htmlFor="newPartyType">Type <span className="text-destructive">*</span></Label>
              <Select name="type" value={newPartyData.type} onValueChange={handleSelectChange('type')} required>
                <SelectTrigger id="newPartyType"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {partyTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="newPartyStatus">Status <span className="text-destructive">*</span></Label>
               <Select name="status" value={newPartyData.status} onValueChange={handleSelectChange('status')} required>
                <SelectTrigger id="newPartyStatus"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  {partyStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4 border-t sticky bottom-0 bg-background pb-2">
              <Button type="button" variant="outline" onClick={() => { setShowAddForm(false); setPanError(null); setNewPartyData(defaultNewPartyFormData); }}>
                Back to Search
              </Button>
              <Button type="submit">Save New Party</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
