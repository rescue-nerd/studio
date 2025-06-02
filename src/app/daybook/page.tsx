
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpenCheck } from "lucide-react";

export default function DaybookPage() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BookOpenCheck className="mr-2 h-6 w-6 text-primary" />
            Daybook Module (Minimal Placeholder)
          </CardTitle>
          <CardDescription>
            This is a minimal placeholder for the Daybook page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>If you see this, the basic routing to the Daybook page is working.</p>
          <p className="mt-4 text-sm text-muted-foreground">
            The original Daybook component is temporarily simplified for debugging.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
