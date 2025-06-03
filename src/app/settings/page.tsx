
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, Timestamp, query, orderBy } from "firebase/firestore";
import type { User as FirestoreUser, Branch as FirestoreBranch } from "@/types/firestore";
import { Loader2 } from "lucide-react";

// Extend with local 'id' if not directly using uid as document ID
interface User extends FirestoreUser { id: string; } // Assuming Firestore doc ID is separate from uid for now
interface Branch extends FirestoreBranch { id: string; }

// Placeholder for the current logged-in user's ID. 
// In a real app, this would come from Firebase Auth.
const SIMULATED_CURRENT_USER_ID = "usr001"; // We'll try to load this user for the profile section.

export default function SettingsPage() {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isSubmittingAssignments, setIsSubmittingAssignments] = useState(false);

  // Profile State
  const [currentUserProfile, setCurrentUserProfile] = useState<Partial<User>>({});
  const [profileFormData, setProfileFormData] = useState<Partial<User>>({});

  // User Management State
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
  const [selectedUserForBranches, setSelectedUserForBranches] = useState<User | null>(null);
  const [tempSelectedBranches, setTempSelectedBranches] = useState<Set<string>>(new Set());

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const usersQuery = query(collection(db, "users"), orderBy("displayName"));
      const branchesQuery = query(collection(db, "branches"), orderBy("name"));

      const [usersSnapshot, branchesSnapshot] = await Promise.all([
        getDocs(usersQuery),
        getDocs(branchesQuery),
      ]);

      const fetchedUsers: User[] = usersSnapshot.docs.map(docSnap => ({ ...docSnap.data() as FirestoreUser, id: docSnap.id }));
      setAllUsers(fetchedUsers);

      const fetchedBranches: Branch[] = branchesSnapshot.docs.map(docSnap => ({ ...docSnap.data() as FirestoreBranch, id: docSnap.id }));
      setAllBranches(fetchedBranches);

      // Load profile for the simulated current user
      const simCurrentUser = fetchedUsers.find(u => u.id === SIMULATED_CURRENT_USER_ID);
      if (simCurrentUser) {
        setCurrentUserProfile(simCurrentUser);
        setProfileFormData({
          displayName: simCurrentUser.displayName || "",
          email: simCurrentUser.email || "", // Email typically not editable here
          enableEmailNotifications: simCurrentUser.enableEmailNotifications || false,
          darkModeEnabled: simCurrentUser.darkModeEnabled || false,
          autoDataSyncEnabled: simCurrentUser.autoDataSyncEnabled || false,
        });
      } else if (fetchedUsers.length > 0) {
        // Fallback to first user if simulated ID not found, for demo purposes
        setCurrentUserProfile(fetchedUsers[0]);
         setProfileFormData({
          displayName: fetchedUsers[0].displayName || "",
          email: fetchedUsers[0].email || "",
          enableEmailNotifications: fetchedUsers[0].enableEmailNotifications || false,
          darkModeEnabled: fetchedUsers[0].darkModeEnabled || false,
          autoDataSyncEnabled: fetchedUsers[0].autoDataSyncEnabled || false,
        });
      }

    } catch (error) {
      console.error("Error fetching settings data:", error);
      toast({ title: "Error", description: "Failed to load settings data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProfileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileSwitchChange = (name: keyof User, checked: boolean) => {
    setProfileFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUserProfile?.id) {
      toast({ title: "Error", description: "No user profile loaded to update.", variant: "destructive"});
      return;
    }
    setIsSubmittingProfile(true);
    try {
      const userDocRef = doc(db, "users", currentUserProfile.id);
      const dataToUpdate: Partial<FirestoreUser> = {
        displayName: profileFormData.displayName || null,
        enableEmailNotifications: profileFormData.enableEmailNotifications,
        darkModeEnabled: profileFormData.darkModeEnabled,
        autoDataSyncEnabled: profileFormData.autoDataSyncEnabled,
        updatedAt: Timestamp.now(), // Assuming an updatedAt field
      };
      await updateDoc(userDocRef, dataToUpdate);
      toast({ title: "Success", description: "Profile updated successfully." });
      // Re-fetch or update local state
      setCurrentUserProfile(prev => ({...prev, ...dataToUpdate, displayName: dataToUpdate.displayName || undefined }));
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    } finally {
      setIsSubmittingProfile(false);
    }
  };


  const openBranchDialog = (user: User) => {
    setSelectedUserForBranches(user);
    setTempSelectedBranches(new Set(user.assignedBranchIds || []));
    setIsBranchDialogOpen(true);
  };

  const handleBranchCheckboxChange = (branchId: string, checked: boolean | string) => {
    setTempSelectedBranches(prev => {
      const newSet = new Set(prev);
      if (Boolean(checked)) {
        newSet.add(branchId);
      } else {
        newSet.delete(branchId);
      }
      return newSet;
    });
  };

  const saveBranchAssignments = async () => {
    if (!selectedUserForBranches) return;
    setIsSubmittingAssignments(true);
    try {
      const userDocRef = doc(db, "users", selectedUserForBranches.id);
      await updateDoc(userDocRef, {
        assignedBranchIds: Array.from(tempSelectedBranches),
        updatedAt: Timestamp.now(), // Assuming an updatedAt field
      });
      toast({ title: "Success", description: `Branch assignments for ${selectedUserForBranches.displayName} updated.` });
      // Update local state for allUsers
      setAllUsers(prevUsers => prevUsers.map(u => 
        u.id === selectedUserForBranches.id ? { ...u, assignedBranchIds: Array.from(tempSelectedBranches) } : u
      ));
      setIsBranchDialogOpen(false);
    } catch (error) {
      console.error("Error updating branch assignments:", error);
      toast({ title: "Error", description: "Failed to update branch assignments.", variant: "destructive" });
    } finally {
      setIsSubmittingAssignments(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your application preferences and configurations.</p>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">User Profile</CardTitle>
          <CardDescription>Update your personal information (Viewing as: {currentUserProfile?.displayName || "N/A"}).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentUserProfile?.id ? (
            <form onSubmit={handleUpdateProfile}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="displayName">Full Name</Label>
                  <Input id="displayName" name="displayName" value={profileFormData.displayName || ""} onChange={handleProfileInputChange} />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={profileFormData.email || ""} readOnly className="bg-muted" />
                </div>
              </div>
              <div className="mt-4">
                <Label htmlFor="password">Change Password</Label>
                <Input id="password" type="password" placeholder="Enter new password (UI Placeholder)" />
              </div>
              <h3 className="text-md font-medium mt-6 mb-2">Preferences</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableEmailNotifications" className="font-normal">Enable Email Notifications</Label>
                  <Switch id="enableEmailNotifications" checked={profileFormData.enableEmailNotifications || false} onCheckedChange={(checked) => handleProfileSwitchChange('enableEmailNotifications', checked)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="darkModeEnabled" className="font-normal">Dark Mode</Label>
                  <Switch id="darkModeEnabled" checked={profileFormData.darkModeEnabled || false} onCheckedChange={(checked) => handleProfileSwitchChange('darkModeEnabled', checked)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="autoDataSyncEnabled" className="font-normal">Automatic Data Sync</Label>
                  <Switch id="autoDataSyncEnabled" checked={profileFormData.autoDataSyncEnabled || false} onCheckedChange={(checked) => handleProfileSwitchChange('autoDataSyncEnabled', checked)} />
                </div>
              </div>
              <Button type="submit" className="mt-6" disabled={isSubmittingProfile}>
                {isSubmittingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Profile
              </Button>
            </form>
          ) : (
            <p className="text-muted-foreground">No user profile loaded. This section requires a logged-in user.</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">User Management</CardTitle>
          <CardDescription>Manage users, roles, and branch privileges. (Assumes Admin Privileges)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {allUsers.length === 0 && !isLoading && <p>No users found.</p>}
          {allUsers.map(user => (
            <div key={user.id} className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <p className="font-medium">{user.displayName || user.email} <span className="text-xs text-muted-foreground">({user.role})</span></p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Assigned Branches: {
                    (user.assignedBranchIds && user.assignedBranchIds.length > 0)
                         ? user.assignedBranchIds.map(branchId => allBranches.find(b => b.id === branchId)?.name || branchId).join(', ')
                         : (user.role === "superAdmin" ? "All (Super Admin)" : "None")
                  }
                </p>
              </div>
              {user.role !== "superAdmin" && (
                <Button variant="outline" size="sm" onClick={() => openBranchDialog(user)} disabled={isSubmittingAssignments || allBranches.length === 0}>
                  {allBranches.length === 0 ? "No Branches" : "Manage Branches"}
                </Button>
              )}
            </div>
          ))}
           <Dialog open={isBranchDialogOpen} onOpenChange={setIsBranchDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Manage Branch Access for {selectedUserForBranches?.displayName || selectedUserForBranches?.email}</DialogTitle>
                <DialogDescription>Select the branches this user can access.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-60 p-1">
                <div className="space-y-2 py-2">
                {allBranches.map(branch => (
                  <div key={branch.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`branch-${branch.id}`}
                      checked={tempSelectedBranches.has(branch.id)}
                      onCheckedChange={(checked) => handleBranchCheckboxChange(branch.id, Boolean(checked))}
                    />
                    <Label htmlFor={`branch-${branch.id}`} className="font-normal">{branch.name}</Label>
                  </div>
                ))}
                {allBranches.length === 0 && <p className="text-sm text-muted-foreground">No branches available to assign.</p>}
                </div>
              </ScrollArea>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingAssignments}>Cancel</Button></DialogClose>
                <Button type="button" onClick={saveBranchAssignments} disabled={isSubmittingAssignments}>
                   {isSubmittingAssignments && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                   Save Assignments
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">API Integrations (UI Placeholder)</CardTitle>
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
            <Button onClick={() => toast({title: "Placeholder", description: "API Key saving not implemented."})}>Save API Keys</Button>
        </CardContent>
      </Card>
    </div>
  );
}

    