
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function PartiesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold text-foreground">Manage Parties</h1>
        <p className="text-muted-foreground">Add, edit, and view consignor/consignee details for GorkhaTrans.</p>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Party Management</CardTitle>
          <CardDescription>This section will allow you to manage party (consignor/consignee) information, contacts, PAN, and ledger assignments.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Feature under development. Coming soon!</p>
        </CardContent>
      </Card>
    </div>
  );
}
