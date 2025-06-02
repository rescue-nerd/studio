
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

// Mock data for demonstration
const mockUsers = [
  { id: "usr001", name: "Sanjay Sharma", email: "sanjay@example.com", role: "Manager" },
  { id: "usr002", name: "Bina Karki", email: "bina@example.com", role: "Operator" },
  { id: "usr003", name: "Admin User", email: "admin@example.com", role: "Super Admin" },
];

const mockBranchesData = [
  { id: "BRN001", name: "Kathmandu Main" },
  { id: "BRN002", name: "Pokhara Hub" },
  { id: "BRN003", name: "Biratnagar Depot" },
  { id: "BRN004", name: "Butwal Office" },
];

interface UserBranchAssignment {
  [userId: string]: Set<string>; // Maps userId to a Set of branchIds
}

export default function SettingsPage() {
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
  const [selectedUserForBranches, setSelectedUserForBranches] = useState<(typeof mockUsers[0]) | null>(null);
  const [userBranchAssignments, setUserBranchAssignments] = useState<UserBranchAssignment>({
    "usr001": new Set(["BRN001", "BRN002"]),
    "usr002": new Set(["BRN001"]),
    "usr003": new Set(mockBranchesData.map(b => b.id)), // Super admin has all
  });
  const [tempSelectedBranches, setTempSelectedBranches] = useState<Set<string>>(new Set());


  const openBranchDialog = (user: typeof mockUsers[0]) => {
    setSelectedUserForBranches(user);
    setTempSelectedBranches(new Set(userBranchAssignments[user.id] || []));
    setIsBranchDialogOpen(true);
  };

  const handleBranchCheckboxChange = (branchId: string, checked: boolean | string) => {
    setTempSelectedBranches(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(branchId);
      } else {
        newSet.delete(branchId);
      }
      return newSet;
    });
  };

  const saveBranchAssignments = () => {
    if (selectedUserForBranches) {
      setUserBranchAssignments(prev => ({
        ...prev,
        [selectedUserForBranches.id]: tempSelectedBranches,
      }));
    }
    setIsBranchDialogOpen(false);
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your application preferences and configurations.</p>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">User Profile</CardTitle>
          <CardDescription>Update your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" defaultValue="Current User Name" />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" defaultValue="user@example.com" />
            </div>
          </div>
          <div>
            <Label htmlFor="password">Change Password</Label>
            <Input id="password" type="password" placeholder="Enter new password" />
          </div>
          <Button>Update Profile</Button>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">User Management (Simulated)</CardTitle>
          <CardDescription>Manage users, roles, and branch privileges. (UI Demo Only)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Note: This section is a UI demonstration. User creation, role assignment, and branch restrictions would be managed by a backend system.
          </p>
          {mockUsers.map(user => (
            <div key={user.id} className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <p className="font-medium">{user.name} <span className="text-xs text-muted-foreground">({user.role})</span></p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Assigned Branches: {
                    Array.from(userBranchAssignments[user.id] || [])
                         .map(branchId => mockBranchesData.find(b => b.id === branchId)?.name || branchId)
                         .join(', ') || (user.role === "Super Admin" ? "All (Super Admin)" : "None")
                  }
                </p>
              </div>
              {user.role !== "Super Admin" && (
                <Button variant="outline" size="sm" onClick={() => openBranchDialog(user)}>Manage Branches</Button>
              )}
            </div>
          ))}
           <Dialog open={isBranchDialogOpen} onOpenChange={setIsBranchDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Manage Branch Access for {selectedUserForBranches?.name}</DialogTitle>
                <DialogDescription>Select the branches this user can access.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-60 p-1">
                <div className="space-y-2 py-2">
                {mockBranchesData.map(branch => (
                  <div key={branch.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`branch-${branch.id}`}
                      checked={tempSelectedBranches.has(branch.id)}
                      onCheckedChange={(checked) => handleBranchCheckboxChange(branch.id, checked)}
                    />
                    <Label htmlFor={`branch-${branch.id}`} className="font-normal">{branch.name}</Label>
                  </div>
                ))}
                </div>
              </ScrollArea>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="button" onClick={saveBranchAssignments}>Save Assignments</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>


      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Application Preferences</CardTitle>
          <CardDescription>Customize application behavior.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notifications" className="font-medium">Enable Email Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive updates and alerts via email.</p>
            </div>
            <Switch id="notifications" defaultChecked />
          </div>
           <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="darkMode" className="font-medium">Dark Mode</Label>
              <p className="text-sm text-muted-foreground">Toggle dark theme for the application.</p>
            </div>
            <Switch id="darkMode" />
          </div>
           <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="dataSync" className="font-medium">Automatic Data Sync</Label>
              <p className="text-sm text-muted-foreground">Keep your data synchronized across devices.</p>
            </div>
            <Switch id="dataSync" defaultChecked />
          </div>
        </CardContent>
      </Card>
       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">API Integrations</CardTitle>
          <CardDescription>Manage connections to external services.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
              <Label htmlFor="mapsApiKey">Google Maps API Key</Label>
              <Input id="mapsApiKey" placeholder="Enter your Google Maps API Key" />
            </div>
             <div>
              <Label htmlFor="weatherApiKey">Weather Service API Key</Label>
              <Input id="weatherApiKey" placeholder="Enter your Weather API Key" />
            </div>
            <Button>Save API Keys</Button>
        </CardContent>
      </Card>
    </div>
  );
}
