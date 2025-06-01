import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Search, Edit, Trash2 } from "lucide-react";

// Mock data
const countries = [
  { id: "C001", name: "Nepal", code: "NP" },
  { id: "C002", name: "India", code: "IN" },
];
const states = [
  { id: "S001", name: "Bagmati", country: "Nepal" },
  { id: "S002", name: "Gandaki", country: "Nepal" },
  { id: "S003", name: "Uttar Pradesh", country: "India" },
];
const cities = [
  { id: "CT001", name: "Kathmandu", state: "Bagmati" },
  { id: "CT002", name: "Pokhara", state: "Gandaki" },
  { id: "CT003", name: "Lucknow", state: "Uttar Pradesh" },
];
const units = [
  { id: "U001", name: "Kilogram", symbol: "kg", type: "Weight" },
  { id: "U002", name: "Kilometer", symbol: "km", type: "Distance" },
  { id: "U003", name: "Liter", symbol: "L", type: "Volume" },
];

const LocationTable = ({ data, headers, title }: { data: any[]; headers: string[]; title: string }) => (
  <Card className="shadow-md mt-4">
    <CardHeader>
      <div className="flex justify-between items-center">
        <CardTitle className="font-headline text-lg">{title}</CardTitle>
        <Button variant="outline" size="sm">
          <PlusCircle className="mr-2 h-4 w-4" /> Add New
        </Button>
      </div>
      <div className="relative mt-2">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder={`Search ${title.toLowerCase()}...`} className="pl-8" />
      </div>
    </CardHeader>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map(header => <TableHead key={header}>{header}</TableHead>)}
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id}>
              {Object.values(item).map((value: any, index) => <TableCell key={index}>{value}</TableCell>)}
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" aria-label={`Edit ${title}`}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon" aria-label={`Delete ${title}`}>
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
);

export default function LocationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold text-foreground">Locations &amp; Unit Management</h1>
        <p className="text-muted-foreground">Manage countries, states, cities, and measurement units.</p>
      </div>

      <Tabs defaultValue="countries" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="countries">Countries</TabsTrigger>
          <TabsTrigger value="states">States</TabsTrigger>
          <TabsTrigger value="cities">Cities</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
        </TabsList>
        <TabsContent value="countries">
          <LocationTable data={countries} headers={["ID", "Name", "Code"]} title="Countries" />
        </TabsContent>
        <TabsContent value="states">
          <LocationTable data={states} headers={["ID", "Name", "Country"]} title="States" />
        </TabsContent>
        <TabsContent value="cities">
          <LocationTable data={cities} headers={["ID", "Name", "State"]} title="Cities" />
        </TabsContent>
        <TabsContent value="units">
          <LocationTable data={units} headers={["ID", "Name", "Symbol", "Type"]} title="Units" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
