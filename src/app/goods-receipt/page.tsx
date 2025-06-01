
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function GoodsReceiptPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold text-foreground">Goods Receipt</h1>
        <p className="text-muted-foreground">Mark goods as received at branch/godown.</p>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Goods Receipt Processing</CardTitle>
          <CardDescription>This section will allow you to record the receipt of goods, noting any discrepancies.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Feature under development. Coming soon!</p>
        </CardContent>
      </Card>
    </div>
  );
}
