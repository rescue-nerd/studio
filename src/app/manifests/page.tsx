
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function ManifestsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold text-foreground">Manifest Creation</h1>
        <p className="text-muted-foreground">Consolidate multiple Biltis/Invoices into truck trips.</p>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Manifest Management</CardTitle>
          <CardDescription>This section will allow you to create new manifests, assign trucks/drivers, and attach Biltis for a trip.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Feature under development. Coming soon!</p>
        </CardContent>
      </Card>
    </div>
  );
}
