
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function GoodsDeliveryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold text-foreground">Goods Delivery</h1>
        <p className="text-muted-foreground">Mark goods as delivered to the consignee.</p>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Goods Delivery Processing</CardTitle>
          <CardDescription>This section will allow you to record the delivery of goods and complete shipments.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Feature under development. Coming soon!</p>
        </CardContent>
      </Card>
    </div>
  );
}
