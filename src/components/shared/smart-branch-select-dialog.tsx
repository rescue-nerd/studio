
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
import type { Branch } from "@/app/goods-receipt/page"; // Assuming Branch interface is exported or defined here

interface SmartBranchSelectDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  branches: Branch[];
  onBranchSelect: (branch: Branch) => void;
  onBranchAdd: (branch: Branch) => void; 
  dialogTitle: string;
}

interface NewBranchFormData {
  name: string;
  location: string;
}

const defaultNewBranchFormData: NewBranchFormData = {
  name: "",
  location: "",
};

export default function SmartBranchSelectDialog({
  isOpen,
  onOpenChange,
  branches,
  onBranchSelect,
  onBranchAdd,
  dialogTitle,
}: SmartBranchSelectDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBranchData, setNewBranchData] = useState<NewBranchFormData>(defaultNewBranchFormData);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setShowAddForm(false);
      setNewBranchData(defaultNewBranchFormData);
    }
  }, [isOpen]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewBranchData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddNewBranch = (e: FormEvent) => {
    e.preventDefault();
    if (!newBranchData.name.trim()) {
      alert("Branch Name is required.");
      return;
    }

    const newBranch: Branch = {
      id: `BRNNEW-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: newBranchData.name.trim(),
      location: newBranchData.location.trim(),
      // Other default fields for a Branch if necessary, like status: "Active"
    };
    onBranchAdd(newBranch); 
    onBranchSelect(newBranch); 
    onOpenChange(false); 
  };

  const filteredBranches = branches.filter(
    (branch) =>
      branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (branch.location && branch.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          {!showAddForm && (
            <DialogDescription>Search for an existing branch or add a new one.</DialogDescription>
          )}
        </DialogHeader>

        {!showAddForm ? (
          <>
            <div className="relative my-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Name, Location..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <ScrollArea className="flex-grow pr-6">
              {filteredBranches.length > 0 ? (
                filteredBranches.map((branch) => (
                  <div
                    key={branch.id}
                    className="p-3 mb-2 border rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer"
                    onClick={() => {
                      onBranchSelect(branch);
                      onOpenChange(false);
                    }}
                  >
                    <p className="font-semibold">{branch.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Location: {branch.location || "N/A"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">No branches found matching your search.</p>
              )}
            </ScrollArea>
            <DialogFooter className="pt-4 border-t">
              <Button variant="outline" onClick={() => setShowAddForm(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Branch
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleAddNewBranch} className="space-y-3 py-2 flex-grow overflow-y-auto pr-1">
            <DialogDescription>Enter the details for the new branch.</DialogDescription>
            <div>
              <Label htmlFor="newBranchName">Branch Name <span className="text-destructive">*</span></Label>
              <Input id="newBranchName" name="name" value={newBranchData.name} onChange={handleInputChange} required />
            </div>
            <div>
              <Label htmlFor="newBranchLocation">Location</Label>
              <Input id="newBranchLocation" name="location" value={newBranchData.location} onChange={handleInputChange} />
            </div>
            {/* Add other simplified branch fields if necessary, e.g., status */}
            <DialogFooter className="pt-4 border-t sticky bottom-0 bg-background pb-2">
              <Button type="button" variant="outline" onClick={() => { setShowAddForm(false); setNewBranchData(defaultNewBranchFormData); }}>
                Back to Search
              </Button>
              <Button type="submit">Save New Branch</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
