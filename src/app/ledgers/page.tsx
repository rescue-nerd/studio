
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
          <CardDescription>This section will allow you to view statements, add manual entries, and manage financial records.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Feature under development. Coming soon!</p>
        </CardContent>
      </Card>
    </div>
  );
}
