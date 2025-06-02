
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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import type { Manifest, Branch } from "@/app/goods-receipt/page"; // Assuming interfaces are exported or defined here
import { format } from "date-fns";

interface SmartManifestSelectDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  manifests: Manifest[];
  branches: Branch[]; // Pass branches to resolve branch names
  onManifestSelect: (manifest: Manifest) => void;
  dialogTitle: string;
}

export default function SmartManifestSelectDialog({
  isOpen,
  onOpenChange,
  manifests,
  branches,
  onManifestSelect,
  dialogTitle,
}: SmartManifestSelectDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  const getBranchName = (branchId?: string) => branches.find(b => b.id === branchId)?.name || "N/A";

  const filteredManifests = manifests.filter(
    (manifest) =>
      manifest.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getBranchName(manifest.fromBranchId).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getBranchName(manifest.toBranchId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>Search for an existing manifest.</DialogDescription>
        </DialogHeader>
        
        <div className="relative my-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Manifest No, From/To Branch..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <ScrollArea className="flex-grow pr-6">
          {filteredManifests.length > 0 ? (
            filteredManifests.map((manifest) => (
              <div
                key={manifest.id}
                className="p-3 mb-2 border rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer"
                onClick={() => {
                  onManifestSelect(manifest);
                  onOpenChange(false);
                }}
              >
                <p className="font-semibold">{manifest.id}</p>
                <p className="text-sm text-muted-foreground">
                  Miti: {format(manifest.miti, "PP")} | Truck: {manifest.truckId}
                </p>
                <p className="text-sm text-muted-foreground">
                  From: {getBranchName(manifest.fromBranchId)} To: {getBranchName(manifest.toBranchId)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Biltis: {manifest.attachedBiltiIds.length} | Status: {manifest.status || "N/A"}
                </p>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-4">No manifests found matching your search.</p>
          )}
        </ScrollArea>
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
