import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
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
