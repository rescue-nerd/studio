
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function InvoicingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold text-foreground">Bilti / Invoicing</h1>
        <p className="text-muted-foreground">Create and manage shipment billing entries (Biltis/Invoices).</p>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Bilti Creation</CardTitle>
          <CardDescription>This section will allow you to create new Biltis, manage shipment details, and handle payments.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Feature under development. Coming soon!</p>
        </CardContent>
      </Card>
    </div>
  );
}
