"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Party as DatabaseParty } from "@/types/database"; // Import canonical Party type
import { PlusCircle, Search } from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

interface SmartPartySelectDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  parties: DatabaseParty[]; 
  onPartySelect: (party: DatabaseParty) => void; 
  onPartyAdd: (party: DatabaseParty) => void; 
  dialogTitle: string;
}

const partyTypes: DatabaseParty["type"][] = ["customer", "supplier", "both"];

interface NewPartyFormData {
  name: string;
  contactNo: string;
  address: string;
  type: DatabaseParty["type"];
  isActive: boolean; 
  branchId: string; 
  assignedLedgerId: string; 
  email: string; // Added email to form data
}

const defaultNewPartyFormData: NewPartyFormData = {
  name: "",
  contactNo: "",
  address: "",
  type: "both",
  isActive: true,
  branchId: "", 
  assignedLedgerId: "", 
  email: "", // Default email
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

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setShowAddForm(false);
      setNewPartyData(defaultNewPartyFormData);
    }
  }, [isOpen]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewPartyData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setNewPartyData((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSelectChange = (name: keyof NewPartyFormData) => (value: string) => {
    setNewPartyData((prev) => ({ ...prev, [name]: value as DatabaseParty["type"] }));
  };

  const handleAddNewParty = (e: FormEvent) => {
    e.preventDefault();
    if (!newPartyData.name.trim() || !newPartyData.branchId.trim() || !newPartyData.assignedLedgerId.trim()) {
      alert("Party Name, Branch ID, and Assigned Ledger ID are required.");
      return;
    }

    const newParty: DatabaseParty = {
      id: `PTYNEW-${Date.now()}-${Math.floor(Math.random() * 1000)}`, 
      name: newPartyData.name.trim(),
      contactNo: newPartyData.contactNo.trim(),
      address: newPartyData.address.trim(),
      type: newPartyData.type,
      isActive: newPartyData.isActive,
      branchId: newPartyData.branchId.trim(),
      assignedLedgerId: newPartyData.assignedLedgerId.trim(),
      email: newPartyData.email.trim(), 
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onPartyAdd(newParty); 
    onPartySelect(newParty); 
    onOpenChange(false); 
  };

  const filteredParties = parties.filter(
    (party) =>
      party.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (party.contactNo && party.contactNo.toLowerCase().includes(searchTerm.toLowerCase()))
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
                placeholder="Search by Name, Contact..."
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
                       Contact: {party.contactNo || "N/A"}
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
              <Label htmlFor="newPartyContactNo">Contact Number</Label>
              <Input id="newPartyContactNo" name="contactNo" value={newPartyData.contactNo} onChange={handleInputChange} />
            </div>
            <div>
              <Label htmlFor="newPartyAddress">Address</Label>
              <Input id="newPartyAddress" name="address" value={newPartyData.address} onChange={handleInputChange} />
            </div>
            <div>
              <Label htmlFor="newPartyEmail">Email</Label>
              <Input id="newPartyEmail" name="email" type="email" value={newPartyData.email} onChange={handleInputChange} />
            </div>
            <div>
              <Label htmlFor="newPartyBranchId">Branch ID <span className="text-destructive">*</span></Label>
              <Input id="newPartyBranchId" name="branchId" value={newPartyData.branchId} onChange={handleInputChange} placeholder="Enter assigned branch ID" required />
            </div>
            <div>
              <Label htmlFor="newPartyAssignedLedgerId">Assigned Ledger ID <span className="text-destructive">*</span></Label>
              <Input id="newPartyAssignedLedgerId" name="assignedLedgerId" value={newPartyData.assignedLedgerId} onChange={handleInputChange} placeholder="Enter assigned ledger ID" required />
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
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="newPartyIsActive" name="isActive" checked={newPartyData.isActive} onChange={handleCheckboxChange} className="form-checkbox h-4 w-4 text-primary transition duration-150 ease-in-out" />
              <Label htmlFor="newPartyIsActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">Is Active</Label>
            </div>
            <DialogFooter className="pt-4 border-t">
              <Button type="submit">Add Party</Button>
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
