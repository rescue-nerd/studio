import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Search, Edit, Trash2 } from "lucide-react";

// Mock data for branches
const branches = [
  { id: "BRN001", name: "Kathmandu Main", location: "Kathmandu, Nepal", manager: "Hari Bahadur", status: "Active" },
  { id: "BRN002", name: "Pokhara Hub", location: "Pokhara, Nepal", manager: "Sita Sharma", status: "Active" },
  { id: "BRN003", name: "Biratnagar Depot", location: "Biratnagar, Nepal", manager: "Gopal Karki", status: "Inactive" },
  { id: "BRN004", name: "Butwal Office", location: "Butwal, Nepal", manager: "Rita Adhikari", status: "Active" },
];

export default function BranchManagementPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground">Branch Management</h1>
          <p className="text-muted-foreground">Manage your company's branches and their details.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Branch
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Branch List</CardTitle>
          <CardDescription>View, edit, or add new branches.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search branches..." className="pl-8" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">{branch.id}</TableCell>
                  <TableCell>{branch.name}</TableCell>
                  <TableCell>{branch.location}</TableCell>
                  <TableCell>{branch.manager}</TableCell>
                  <TableCell>
                    <Badge variant={branch.status === "Active" ? "default" : "destructive"} className={branch.status === "Active" ? "bg-accent text-accent-foreground" : ""}>
                      {branch.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" aria-label="Edit Branch">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" aria-label="Delete Branch">
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
    </div>
  );
}
