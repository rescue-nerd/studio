"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { handleSupabaseError } from "@/lib/supabase-error-handler";
import auth from "@/lib/supabase-auth";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

export default function SettingsPage() {
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);

  // Profile State
  const [currentUserProfile, setCurrentUserProfile] = useState<any | null>(null);
  const [profileFormData, setProfileFormData] = useState<any>({});

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authUser, authLoading, router]);

  const fetchProfile = async () => {
    if (!authUser) return;
    setIsLoadingPageData(true);
    try {
      const profile = await auth.getUserProfile(authUser.id);
      setCurrentUserProfile(profile);
      setProfileFormData({
        displayName: profile.display_name || "",
        email: profile.email || "",
        enableEmailNotifications: profile.enable_email_notifications || false,
        darkModeEnabled: profile.dark_mode_enabled || false,
        autoDataSyncEnabled: profile.auto_data_sync_enabled || false,
      });
    } catch (error) {
      toast({ title: "Error", description: "Could not load your user profile.", variant: "destructive" });
    } finally {
      setIsLoadingPageData(false);
    }
  };

  useEffect(() => {
    if (authUser) {
      fetchProfile();
    }
  }, [authUser]);

  const handleProfileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleProfileSwitchChange = (name: string, checked: boolean) => {
    setProfileFormData((prev: any) => ({ ...prev, [name]: checked }));
  };

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUserProfile?.uid) {
      toast({ title: "Error", description: "No user profile loaded to update.", variant: "destructive" });
      return;
    }
    setIsSubmittingProfile(true);
    try {
      await auth.updateUserProfile(currentUserProfile.uid, {
        display_name: profileFormData.displayName,
        enable_email_notifications: profileFormData.enableEmailNotifications,
        dark_mode_enabled: profileFormData.darkModeEnabled,
        auto_data_sync_enabled: profileFormData.autoDataSyncEnabled,
      });
      toast({ title: "Success", description: "Profile updated successfully." });
      setCurrentUserProfile((prev: any) => prev ? ({
        ...prev,
        display_name: profileFormData.displayName,
        enable_email_notifications: profileFormData.enableEmailNotifications,
        dark_mode_enabled: profileFormData.darkModeEnabled,
        auto_data_sync_enabled: profileFormData.autoDataSyncEnabled,
      }) : null);
    } catch (error) {
      handleSupabaseError(error, toast);
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  // Replace Firebase error handling with Supabase error handling
  const handleError = (error: unknown) => {
    handleSupabaseError(error, toast);
  };

  if (authLoading || isLoadingPageData) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-lg text-muted-foreground">Please log in to view settings.</p>
        <Button onClick={() => router.push('/login')} className="mt-4">Go to Login</Button>
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
          <CardDescription>Update your personal information (Viewing as: {currentUserProfile?.display_name || currentUserProfile?.email || "N/A"}).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentUserProfile?.uid ? (
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
                <Input id="password" type="password" placeholder="Enter new password (UI Placeholder)" disabled />
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
      {/* User Management and API Integrations sections can be migrated similarly if needed */}
    </div>
  );
}