import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Edit, Trash2, Search } from "lucide-react";

// Mock data for numbering configurations
const numberingConfigs = [
  { id: "CFG001", documentType: "Invoice", prefix: "INV-", suffix: "/24", startingNumber: 1001, perBranch: true, branch: "KTM" },
  { id: "CFG002", documentType: "Waybill", prefix: "WB-", suffix: "", startingNumber: 500, perBranch: false, branch: "Global" },
  { id: "CFG003", documentType: "Receipt", prefix: "RCPT-", suffix: "/FY24", startingNumber: 1, perBranch: true, branch: "PKR" },
];

const documentTypes = ["Invoice", "Waybill", "Receipt", "Credit Note", "Purchase Order"];
const branches = ["KTM", "PKR", "BTN", "BRT", "Global"]; // Mock branches

export default function AutomaticNumberingPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground">Automatic Numbering</h1>
          <p className="text-muted-foreground">Configure auto-numbering schemes for various document types.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Configuration
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Numbering Configurations</CardTitle>
          <CardDescription>Manage document numbering series.</CardDescription>
           <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search configurations..." className="pl-8" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document Type</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Suffix</TableHead>
                <TableHead>Start No.</TableHead>
                <TableHead>Per Branch</TableHead>
                <TableHead>Branch/Scope</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {numberingConfigs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">{config.documentType}</TableCell>
                  <TableCell>{config.prefix}</TableCell>
                  <TableCell>{config.suffix}</TableCell>
                  <TableCell>{config.startingNumber}</TableCell>
                  <TableCell>
                    <Checkbox checked={config.perBranch} aria-label={config.perBranch ? "Yes" : "No"} />
                  </TableCell>
                  <TableCell>{config.branch}</TableCell>
                  <TableCell>
                     <div className="flex gap-2">
                      <Button variant="outline" size="icon" aria-label="Edit Config">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" aria-label="Delete Config">
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
          <CardTitle className="font-headline text-xl">Add/Edit Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="docType">Document Type</Label>
            <Select>
              <SelectTrigger id="docType">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map(type => <SelectItem key={type} value={type.toLowerCase().replace(' ', '-')}>{type}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="prefix">Prefix</Label>
              <Input id="prefix" placeholder="e.g., INV-" />
            </div>
            <div>
              <Label htmlFor="suffix">Suffix</Label>
              <Input id="suffix" placeholder="e.g., /2024" />
            </div>
            <div>
              <Label htmlFor="startNum">Starting Number</Label>
              <Input id="startNum" type="number" placeholder="e.g., 1001" />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="perBranch" />
            <Label htmlFor="perBranch">Branch Specific</Label>
          </div>
          <div>
            <Label htmlFor="branchSelect">Branch (if specific)</Label>
            <Select>
              <SelectTrigger id="branchSelect">
                <SelectValue placeholder="Select branch or Global" />
              </SelectTrigger>
              <SelectContent>
                {branches.map(branch => <SelectItem key={branch} value={branch}>{branch}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button>Save Configuration</Button>
        </CardContent>
      </Card>
    </div>
  );
}
