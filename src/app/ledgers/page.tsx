
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function LedgersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold text-foreground">Ledger / Accounting</h1>
        <p className="text-muted-foreground">Track income, expenses, and balances for trucks, drivers, and parties.</p>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Ledger Management</CardTitle>
          <CardDescription>
            View statements, add manual entries, and manage financial records. 
            Ledger entries related to Bilti/Invoice operations (creation, updates, deletions) 
            are automatically posted (simulated in this frontend version).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Feature under development. Full ledger viewing and manual entry capabilities coming soon!</p>
           <ul className="list-disc list-inside mt-4 text-sm text-muted-foreground">
            <li>View detailed transaction history for any Party, Truck, or Driver.</li>
            <li>See running balances.</li>
            <li>(Planned) Add manual journal entries or adjustments.</li>
            <li>(Planned) Export ledger statements.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

