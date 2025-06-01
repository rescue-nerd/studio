import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { PlusCircle, Search, Edit, Trash2 } from "lucide-react";

// Mock data for narration templates
const narrationTemplates = [
  { id: "NAR001", title: "Standard Freight Charge", template: "Being freight charges for consignment no. {{consignment_no}} from {{origin}} to {{destination}}." },
  { id: "NAR002", title: "Advance Payment Received", template: "Being advance payment received against proforma invoice no. {{proforma_invoice_no}}." },
  { id: "NAR003", title: "Late Delivery Penalty", template: "Being penalty charged for late delivery of consignment no. {{consignment_no}} as per agreement." },
];

export default function NarrationSetupPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground">Narration Setup</h1>
          <p className="text-muted-foreground">Create and manage reusable invoice narration templates.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Template
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Narration Templates</CardTitle>
          <CardDescription>Available templates for quick use in billing.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search templates..." className="pl-8" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Template Preview</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {narrationTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-md">{template.template}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" aria-label="Edit Template">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" aria-label="Delete Template">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Add/Edit Narration Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="templateTitle">Template Title</Label>
            <Input id="templateTitle" placeholder="e.g., Standard Delivery Charges" />
          </div>
          <div>
            <Label htmlFor="templateText">Template Text</Label>
            <Textarea id="templateText" placeholder="Enter narration text. Use {{variable_name}} for placeholders." rows={4} />
            <p className="text-xs text-muted-foreground mt-1">Example: Being charges for shipment {'{{shipment_id}}'}.</p>
          </div>
          <Button>Save Template</Button>
        </CardContent>
      </Card>
    </div>
  );
}
