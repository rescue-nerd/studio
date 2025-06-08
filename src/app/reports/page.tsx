"use client";

import SmartPartySelectDialog from "@/components/shared/smart-party-select-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context"; // Import useAuth
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "cmdk";
import { endOfDay, format, startOfDay } from "date-fns";
import { CalendarIcon, Check, ChevronsUpDown, Download, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation"; // Import useRouter
import { useEffect, useState } from "react";


// Simplified Interfaces for mock data within this component
interface Party {
  id: string;
  name: string;
  panNo?: string;
  contactNo?: string;
  assignedLedger: string;
}
interface Truck {
  id: string;
  truckNo: string;
  type: string;
  assignedLedger: string;
}
interface Bilti {
  id: string;
  miti: Date;
  consignorId: string;
  consigneeId: string;
  origin: string;
  destination: string;
  packages: number;
  totalAmount: number;
  payMode: "Paid" | "To Pay" | "Due";
  status?: "Pending" | "Manifested" | "Received" | "Delivered";
  truckId: string;
}
interface LedgerEntry {
  accountId: string;
  miti: Date;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

// Mock Data (Self-contained for this component prototype)
const mockParties: Party[] = [
  { id: "PTY001", name: "Global Traders (KTM)", panNo: "PAN123KTM", contactNo: "9800000001", assignedLedger: "L-PTY001" },
  { id: "PTY002", name: "National Distributors (PKR)", panNo: "PAN456PKR", contactNo: "9800000002", assignedLedger: "L-PTY002" },
  { id: "PTY003", name: "Himalayan Goods Co.", panNo: "PAN789BRT", contactNo: "9800000003", assignedLedger: "L-PTY003" },
];
const mockTrucks: Truck[] = [
  { id: "TRK001", truckNo: "BA 1 KA 1234", type: "6-Wheeler", assignedLedger: "L-TRK001" },
  { id: "TRK002", truckNo: "NA 5 KHA 5678", type: "10-Wheeler", assignedLedger: "L-TRK002" },
  { id: "TRK003", truckNo: "GA 2 PA 9101", type: "Trailer", assignedLedger: "L-TRK003" },
];

const mockBiltis: Bilti[] = [
  { id: "BLT-001", miti: new Date("2024-07-15"), consignorId: "PTY001", consigneeId: "PTY002", origin: "KTM", destination: "PKR", packages: 10, totalAmount: 5000, payMode: "To Pay", status: "Delivered", truckId: "TRK001" },
  { id: "BLT-002", miti: new Date("2024-07-15"), consignorId: "PTY002", consigneeId: "PTY001", origin: "PKR", destination: "KTM", packages: 5, totalAmount: 2500, payMode: "Paid", status: "Delivered", truckId: "TRK002" },
  { id: "BLT-003", miti: new Date("2024-07-16"), consignorId: "PTY001", consigneeId: "PTY003", origin: "KTM", destination: "BRT", packages: 20, totalAmount: 10000, payMode: "To Pay", status: "Manifested", truckId: "TRK001" },
  { id: "BLT-004", miti: new Date("2024-07-17"), consignorId: "PTY003", consigneeId: "PTY002", origin: "BRT", destination: "PKR", packages: 15, totalAmount: 7500, payMode: "Paid", status: "Received", truckId: "TRK003" },
  { id: "BLT-005", miti: new Date("2024-07-17"), consignorId: "PTY001", consigneeId: "PTY002", origin: "KTM", destination: "PKR", packages: 8, totalAmount: 4000, payMode: "Due", status: "Delivered", truckId: "TRK002" },
];

const mockLedgerEntries: LedgerEntry[] = [
  { accountId: "L-PTY001", miti: new Date("2024-07-15"), description: "Freight for BLT-001", debit: 5000, credit: 0, balance: 5000 },
  { accountId: "L-PTY001", miti: new Date("2024-07-15"), description: "Payment against BLT-002", debit: 0, credit: 2500, balance: 2500 },
  { accountId: "L-PTY002", miti: new Date("2024-07-15"), description: "Freight for BLT-001", debit: 0, credit: 5000, balance: -5000 },
];


export default function ReportsPage() {
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();

  // Daily Bilti Activity State
  const [dailyReportDate, setDailyReportDate] = useState<Date | undefined>(new Date());
  const [dailyReportData, setDailyReportData] = useState<Bilti[]>([]);
  const [dailyReportSummary, setDailyReportSummary] = useState({ count: 0, totalAmount: 0 });
  const [isDailyLoading, setIsDailyLoading] = useState(false);

  // Bilti Register State
  const [registerStartDate, setRegisterStartDate] = useState<Date | undefined>(() => {const d = new Date(); d.setDate(d.getDate() - 7); return d;});
  const [registerEndDate, setRegisterEndDate] = useState<Date | undefined>(new Date());
  const [registerPartyName, setRegisterPartyName] = useState("");
  const [registerReportData, setRegisterReportData] = useState<Bilti[]>([]);
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);

  // Party Ledger Summary State
  const [selectedPartyForLedger, setSelectedPartyForLedger] = useState<Party | null>(null);
  const [partyLedgerData, setPartyLedgerData] = useState<LedgerEntry[]>([]);
  const [partyLedgerBalance, setPartyLedgerBalance] = useState(0);
  const [isPartyLedgerLoading, setIsPartyLedgerLoading] = useState(false);
  const [isPartySelectOpen, setIsPartySelectOpen] = useState(false);

  // Truck Performance Report State
  const [truckReportStartDate, setTruckReportStartDate] = useState<Date | undefined>(() => {const d = new Date(); d.setDate(d.getDate() - 30); return d;});
  const [truckReportEndDate, setTruckReportEndDate] = useState<Date | undefined>(new Date());
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [truckReportData, setTruckReportData] = useState<Array<{truck: Truck, biltiCount: number, totalFreight: number, simulatedExpenses: number, netRevenue: number}>>([]);
  const [isTruckReportLoading, setIsTruckReportLoading] = useState(false);
  const [isTruckSelectOpen, setIsTruckSelectOpen] = useState(false);
  const [truckSearchTerm, setTruckSearchTerm] = useState("");

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
    // Here you would fetch actual data from Firebase if this page were fully connected.
    // For now, it uses mock data.
  }, [authUser, authLoading, router]);


  const getPartyName = (partyId: string) => mockParties.find(p => p.id === partyId)?.name || "N/A";

  const handleGenerateDailyReport = () => {
    if (!dailyReportDate) {
      toast({ title: "Error", description: "Please select a date.", variant: "destructive" });
      return;
    }
    setIsDailyLoading(true);
    setTimeout(() => { 
      const filtered = mockBiltis.filter(b => format(b.miti, "yyyy-MM-dd") === format(dailyReportDate, "yyyy-MM-dd"));
      setDailyReportData(filtered);
      setDailyReportSummary({
        count: filtered.length,
        totalAmount: filtered.reduce((sum, b) => sum + b.totalAmount, 0),
      });
      setIsDailyLoading(false);
    }, 500);
  };
  
  const handleExportDailyToCSV = () => {
    if (dailyReportData.length === 0) {
        toast({ title: "No Data", description: "Generate a report first to export.", variant: "destructive"});
        return;
    }
    const headers = ["Bilti No", "Consignor", "Consignee", "Destination", "Packages", "Total Amount", "Pay Mode"];
    const rows = dailyReportData.map(bilti => [
        bilti.id,
        getPartyName(bilti.consignorId),
        getPartyName(bilti.consigneeId),
        bilti.destination,
        bilti.packages,
        bilti.totalAmount,
        bilti.payMode,
    ].join(","));
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `daily_bilti_activity_${format(dailyReportDate || new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({title: "Exported", description: "Daily Bilti Activity report exported to CSV."});
  };

  const handleGenerateRegisterReport = () => {
    if (!registerStartDate || !registerEndDate) {
      toast({ title: "Error", description: "Please select a valid date range.", variant: "destructive" });
      return;
    }
    setIsRegisterLoading(true);
    setTimeout(() => {
      let filtered = mockBiltis.filter(b => b.miti >= startOfDay(registerStartDate) && b.miti <= endOfDay(registerEndDate));
      if (registerPartyName.trim()) {
        const partyLower = registerPartyName.toLowerCase();
        filtered = filtered.filter(b => getPartyName(b.consignorId).toLowerCase().includes(partyLower) || getPartyName(b.consigneeId).toLowerCase().includes(partyLower));
      }
      setRegisterReportData(filtered);
      setIsRegisterLoading(false);
    }, 500);
  };

  const handlePartySelectForLedger = (party: Party) => {
    setSelectedPartyForLedger(party);
    setIsPartySelectOpen(false);
    if (party) {
        setIsPartyLedgerLoading(true);
        setTimeout(() => {
            const entries = mockLedgerEntries.filter(e => e.accountId === party.assignedLedger).sort((a,b) => b.miti.getTime() - a.miti.getTime());
            setPartyLedgerData(entries);
            const balance = entries.length > 0 ? entries[0].balance : 0; 
            setPartyLedgerBalance(balance);
            setIsPartyLedgerLoading(false);
        }, 300);
    } else {
        setPartyLedgerData([]);
        setPartyLedgerBalance(0);
    }
  };

  const handlePartyAddForLedger = (newParty: Party) => {
    setSelectedPartyForLedger(newParty);
    toast({ title: "Party Added (Simulated)", description: `${newParty.name} would be added to master list.`});
  }
  
  const handleTruckSelect = (truck: Truck | null) => {
    setSelectedTruck(truck);
    setIsTruckSelectOpen(false);
  };
  
  const filteredTrucksForSelect = mockTrucks.filter(truck =>
    truck.truckNo.toLowerCase().includes(truckSearchTerm.toLowerCase()) ||
    truck.type.toLowerCase().includes(truckSearchTerm.toLowerCase())
  );

  const handleGenerateTruckReport = () => {
    if (!truckReportStartDate || !truckReportEndDate) {
        toast({ title: "Error", description: "Please select a valid date range for truck report.", variant: "destructive" });
        return;
    }
    setIsTruckReportLoading(true);
    setTimeout(() => {
        const targetTrucks = selectedTruck ? [selectedTruck] : mockTrucks;
        const report: typeof truckReportData = targetTrucks.map(truck => {
            const biltisForTruck = mockBiltis.filter(b => 
                b.truckId === truck.id &&
                b.miti >= startOfDay(truckReportStartDate) &&
                b.miti <= endOfDay(truckReportEndDate)
            );
            const totalFreight = biltisForTruck.reduce((sum, b) => sum + b.totalAmount, 0);
            const simulatedExpenses = totalFreight * 0.6 + biltisForTruck.length * 100; 
            const netRevenue = totalFreight - simulatedExpenses;
            return {
                truck,
                biltiCount: biltisForTruck.length,
                totalFreight,
                simulatedExpenses,
                netRevenue
            };
        });
        setTruckReportData(report);
        setIsTruckReportLoading(false);
    }, 500);
  };

  if (authLoading || (!authUser && !authLoading)) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">{authLoading ? "Loading authentication..." : "Redirecting to login..."}</p>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <SmartPartySelectDialog
        isOpen={isPartySelectOpen}
        onOpenChange={setIsPartySelectOpen}
        parties={mockParties} // Replace with actual parties from Firestore
        onPartySelect={handlePartySelectForLedger}
        onPartyAdd={handlePartyAddForLedger} 
        dialogTitle="Select Party for Ledger"
      />

      <div>
        <h1 className="text-3xl font-headline font-bold text-foreground">Reports Dashboard</h1>
        <p className="text-muted-foreground">Generate and view various reports for insights and data exports. (Currently using Mock Data)</p>
      </div>

      <Tabs defaultValue="dailyBilti" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="dailyBilti">Daily Bilti</TabsTrigger>
          <TabsTrigger value="biltiRegister">Bilti Register</TabsTrigger>
          <TabsTrigger value="partyLedger">Party Ledger</TabsTrigger>
          <TabsTrigger value="truckPerformance">Truck Performance</TabsTrigger>
        </TabsList>

        {/* Daily Bilti Activity Tab */}
        <TabsContent value="dailyBilti">
          <Card className="shadow-md mt-4">
            <CardHeader>
              <CardTitle className="font-headline text-lg">Daily Bilti Activity</CardTitle>
              <CardDescription>View all Biltis created on a specific day.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div>
                  <Label htmlFor="dailyReportDate">Select Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button id="dailyReportDate" variant={"outline"} className={cn("w-[280px] justify-start text-left font-normal", !dailyReportDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dailyReportDate ? format(dailyReportDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dailyReportDate} onSelect={setDailyReportDate} initialFocus /></PopoverContent>
                  </Popover>
                </div>
                <Button onClick={handleGenerateDailyReport} disabled={isDailyLoading}>
                  {isDailyLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Generate Report
                </Button>
                 <Button onClick={handleExportDailyToCSV} variant="outline" disabled={dailyReportData.length === 0}>
                  <Download className="mr-2 h-4 w-4" /> Export to CSV
                </Button>
              </div>
              {dailyReportData.length > 0 && (
                <Card className="mt-4 bg-secondary/30">
                  <CardHeader>
                    <CardTitle className="text-md">Summary for {format(dailyReportDate!, "PP")}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 text-sm">
                    <p>Total Biltis: <span className="font-semibold">{dailyReportSummary.count}</span></p>
                    <p>Total Amount: <span className="font-semibold">Rs. {dailyReportSummary.totalAmount.toFixed(2)}</span></p>
                  </CardContent>
                </Card>
              )}
              {dailyReportData.length > 0 ? (
                <ScrollArea className="h-[300px] mt-2">
                  <Table>
                    <TableHeader><TableRow><TableHead>Bilti No.</TableHead><TableHead>Consignor</TableHead><TableHead>Consignee</TableHead><TableHead>Total Amount</TableHead></TableRow></TableHeader>
                    <TableBody>{dailyReportData.map(b => (<TableRow key={b.id}><TableCell>{b.id}</TableCell><TableCell>{getPartyName(b.consignorId)}</TableCell><TableCell>{getPartyName(b.consigneeId)}</TableCell><TableCell>Rs. {b.totalAmount.toFixed(2)}</TableCell></TableRow>))}</TableBody>
                  </Table>
                </ScrollArea>
              ) : !isDailyLoading && dailyReportSummary.count === 0 && <p className="text-center text-muted-foreground py-4">No Biltis found for the selected date.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bilti Register Tab */}
        <TabsContent value="biltiRegister">
          <Card className="shadow-md mt-4">
            <CardHeader>
              <CardTitle className="font-headline text-lg">Bilti Register</CardTitle>
              <CardDescription>View a list of Biltis within a date range, optionally filtered by party.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <Label htmlFor="registerStartDate">Start Date</Label>
                  <Popover><PopoverTrigger asChild><Button id="registerStartDate" variant={"outline"} className={cn("w-full justify-start text-left font-normal",!registerStartDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{registerStartDate ? format(registerStartDate,"PPP") : <span>Pick start date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={registerStartDate} onSelect={setRegisterStartDate}/></PopoverContent></Popover>
                </div>
                <div>
                  <Label htmlFor="registerEndDate">End Date</Label>
                  <Popover><PopoverTrigger asChild><Button id="registerEndDate" variant={"outline"} className={cn("w-full justify-start text-left font-normal",!registerEndDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{registerEndDate ? format(registerEndDate,"PPP") : <span>Pick end date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={registerEndDate} onSelect={setRegisterEndDate}/></PopoverContent></Popover>
                </div>
                <div>
                  <Label htmlFor="registerPartyName">Party Name (Consignor/Consignee)</Label>
                  <Input id="registerPartyName" placeholder="Enter party name to filter" value={registerPartyName} onChange={(e) => setRegisterPartyName(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleGenerateRegisterReport} disabled={isRegisterLoading}>{isRegisterLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Generate Register</Button>
              {registerReportData.length > 0 ? (
                 <ScrollArea className="h-[400px] mt-2">
                  <Table>
                    <TableHeader><TableRow><TableHead>Miti</TableHead><TableHead>Bilti No.</TableHead><TableHead>Consignor</TableHead><TableHead>Consignee</TableHead><TableHead>Destination</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Pay Mode</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>{registerReportData.map(b => (<TableRow key={b.id}><TableCell>{format(b.miti, "PP")}</TableCell><TableCell>{b.id}</TableCell><TableCell>{getPartyName(b.consignorId)}</TableCell><TableCell>{getPartyName(b.consigneeId)}</TableCell><TableCell>{b.destination}</TableCell><TableCell className="text-right">{b.totalAmount.toFixed(2)}</TableCell><TableCell>{b.payMode}</TableCell><TableCell>{b.status}</TableCell></TableRow>))}</TableBody>
                  </Table>
                </ScrollArea>
              ) : !isRegisterLoading && <p className="text-center text-muted-foreground py-4">No Biltis found for the selected criteria.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Party Ledger Summary Tab */}
        <TabsContent value="partyLedger">
          <Card className="shadow-md mt-4">
            <CardHeader>
              <CardTitle className="font-headline text-lg">Party Ledger Summary</CardTitle>
              <CardDescription>View a summary of a party's ledger.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="partyLedgerSelect">Select Party</Label>
                 <Button id="partyLedgerSelect" variant="outline" className="w-full justify-start" onClick={() => setIsPartySelectOpen(true)}>
                    {selectedPartyForLedger ? `${selectedPartyForLedger.name} (PAN: ${selectedPartyForLedger.panNo || 'N/A'})` : "Select Party..."}
                 </Button>
              </div>
              {isPartyLedgerLoading && <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>}
              {selectedPartyForLedger && !isPartyLedgerLoading && (
                <>
                  <Card className="bg-secondary/30">
                    <CardHeader><CardTitle className="text-md">Ledger for: {selectedPartyForLedger.name}</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p>PAN: {selectedPartyForLedger.panNo || "N/A"}</p>
                      <p>Contact: {selectedPartyForLedger.contactNo || "N/A"}</p>
                      <p className="font-bold text-lg">Current Balance: Rs. {partyLedgerBalance.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <h4 className="font-semibold mt-4">Recent Transactions:</h4>
                   {partyLedgerData.length > 0 ? (
                    <ScrollArea className="h-[300px] mt-1">
                      <Table>
                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                        <TableBody>{partyLedgerData.map((e, idx) => (<TableRow key={idx}><TableCell>{format(e.miti,"PP")}</TableCell><TableCell>{e.description}</TableCell><TableCell className="text-right">{e.debit > 0 ? e.debit.toFixed(2):"-"}</TableCell><TableCell className="text-right">{e.credit > 0 ? e.credit.toFixed(2):"-"}</TableCell><TableCell className="text-right">{e.balance.toFixed(2)}</TableCell></TableRow>))}</TableBody>
                      </Table>
                    </ScrollArea>
                  ) : <p className="text-center text-muted-foreground py-4">No ledger entries found for this party.</p>}
                  <Button variant="link" className="p-0 h-auto" onClick={() => alert("Navigate to full ledger page for " + selectedPartyForLedger.name + " (manual selection needed there for now)")}>View Full Statement in Ledgers Module</Button>
                </>
              )}
               {!selectedPartyForLedger && !isPartyLedgerLoading && <p className="text-center text-muted-foreground py-4">Please select a party to view their ledger summary.</p>}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Truck Performance Report Tab */}
        <TabsContent value="truckPerformance">
          <Card className="shadow-md mt-4">
            <CardHeader>
              <CardTitle className="font-headline text-lg">Truck Performance Report</CardTitle>
              <CardDescription>Analyze truck performance over a selected period.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <Label htmlFor="truckReportStartDate">Start Date</Label>
                  <Popover><PopoverTrigger asChild><Button id="truckReportStartDate" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !truckReportStartDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{truckReportStartDate ? format(truckReportStartDate, "PPP") : <span>Pick start date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={truckReportStartDate} onSelect={setTruckReportStartDate}/></PopoverContent></Popover>
                </div>
                <div>
                  <Label htmlFor="truckReportEndDate">End Date</Label>
                  <Popover><PopoverTrigger asChild><Button id="truckReportEndDate" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !truckReportEndDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{truckReportEndDate ? format(truckReportEndDate, "PPP") : <span>Pick end date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={truckReportEndDate} onSelect={setTruckReportEndDate}/></PopoverContent></Popover>
                </div>
                 <div>
                  <Label htmlFor="truckSelectReport">Select Truck (Optional)</Label>
                  <Popover open={isTruckSelectOpen} onOpenChange={setIsTruckSelectOpen}>
                    <PopoverTrigger asChild>
                      <Button id="truckSelectReport" variant="outline" role="combobox" aria-expanded={isTruckSelectOpen} className="w-full justify-between">
                        {selectedTruck ? `${selectedTruck.truckNo} (${selectedTruck.type})` : "All Trucks / Select Truck..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Search truck..." onValueChange={setTruckSearchTerm} value={truckSearchTerm}/>
                        <CommandEmpty>No truck found.</CommandEmpty>
                        <CommandList>
                            <CommandItem onSelect={() => handleTruckSelect(null)} className="cursor-pointer">
                                <Check className={cn("mr-2 h-4 w-4", !selectedTruck ? "opacity-100" : "opacity-0")}/>
                                All Trucks
                            </CommandItem>
                          {filteredTrucksForSelect.map((truck) => (
                            <CommandItem key={truck.id} value={`${truck.truckNo} ${truck.type}`} onSelect={() => handleTruckSelect(truck)} className="cursor-pointer">
                              <Check className={cn("mr-2 h-4 w-4", selectedTruck?.id === truck.id ? "opacity-100" : "opacity-0")}/>
                              {truck.truckNo} ({truck.type})
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <Button onClick={handleGenerateTruckReport} disabled={isTruckReportLoading}>{isTruckReportLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Generate Truck Report</Button>
              
              {truckReportData.length > 0 ? (
                 <ScrollArea className="h-[400px] mt-2">
                  <Table>
                    <TableHeader><TableRow><TableHead>Truck No.</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Biltis</TableHead><TableHead className="text-right">Freight Amt.</TableHead><TableHead className="text-right">Expenses (Sim.)</TableHead><TableHead className="text-right">Net Rev. (Sim.)</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {truckReportData.map(item => (
                        <TableRow key={item.truck.id}>
                          <TableCell>{item.truck.truckNo}</TableCell>
                          <TableCell>{item.truck.type}</TableCell>
                          <TableCell className="text-right">{item.biltiCount}</TableCell>
                          <TableCell className="text-right">{item.totalFreight.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{item.simulatedExpenses.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">{item.netRevenue.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : !isTruckReportLoading && <p className="text-center text-muted-foreground py-4">No truck performance data found for the selected criteria.</p>}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
