
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function TrucksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold text-foreground">Manage Trucks</h1>
        <p className="text-muted-foreground">Add, edit, and view truck details for GorkhaTrans.</p>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Truck Management</CardTitle>
          <CardDescription>This section will allow you to manage truck information, types, capacity, and assignments.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Feature under development. Coming soon!</p>
        </CardContent>
      </Card>
    </div>
  );
}
