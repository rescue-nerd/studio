import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Edit, Trash2, GripVertical } from "lucide-react";

// Mock data for invoice lines
const invoiceLines = [
  { id: "LN001", label: "Item Description", type: "Text", required: true, order: 1 },
  { id: "LN002", label: "Quantity", type: "Number", required: true, order: 2 },
  { id: "LN003", label: "Unit Price", type: "Currency", required: true, order: 3 },
  { id: "LN004", label: "Discount", type: "Percentage", required: false, order: 4 },
  { id: "LN005", label: "Notes", type: "Textarea", required: false, order: 5 },
];

export default function ContentCustomizationPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground">Content Customization</h1>
          <p className="text-muted-foreground">Customize fields and lines for your invoices and bills.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Line Item
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Invoice/Bill Line Configuration</CardTitle>
          <CardDescription>Define the structure of your financial documents. Drag to reorder.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoiceLines.sort((a,b) => a.order - b.order).map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="cursor-grab">
                     <GripVertical className="h-5 w-5 text-muted-foreground" />
                  </TableCell>
                  <TableCell className="font-medium">{line.label}</TableCell>
                  <TableCell>{line.type}</TableCell>
                  <TableCell>
                    <Checkbox checked={line.required} aria-label={line.required ? "Required" : "Not Required"} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" aria-label="Edit Line">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" aria-label="Delete Line">
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

      {/* Example of an Add/Edit Form (simplified) */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Add/Edit Line Item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="lineLabel">Label</Label>
            <Input id="lineLabel" placeholder="e.g., Item SKU" />
          </div>
          <div>
            <Label htmlFor="lineType">Type</Label>
            <Select>
              <SelectTrigger id="lineType">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="currency">Currency</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="textarea">Textarea</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="lineRequired" />
            <Label htmlFor="lineRequired">Required</Label>
          </div>
          <Button>Save Line Item</Button>
        </CardContent>
      </Card>
    </div>
  );
}
