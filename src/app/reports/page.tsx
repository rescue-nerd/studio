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
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase'; // Import Supabase client
import { cn } from "@/lib/utils";
import { Bilti, Daybook as LedgerEntry, Party, Truck } from "@/types/database"; // Import types
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "cmdk";
import { endOfDay, format, startOfDay } from "date-fns";
import { CalendarIcon, Check, ChevronsUpDown, Download, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface LedgerEntryWithBalance extends LedgerEntry {
  runningBalance: number;
}

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
  const [allParties, setAllParties] = useState<Party[]>([]); // State to hold parties fetched from Supabase
  const [selectedPartyForLedger, setSelectedPartyForLedger] = useState<Party | null>(null);
  const [partyLedgerData, setPartyLedgerData] = useState<LedgerEntryWithBalance[]>([]); // Using Daybook as LedgerEntry with balance
  const [partyLedgerBalance, setPartyLedgerBalance] = useState(0);
  const [isPartyLedgerLoading, setIsPartyLedgerLoading] = useState(false);
  const [isPartySelectOpen, setIsPartySelectOpen] = useState(false);

  // Truck Performance Report State
  const [allTrucks, setAllTrucks] = useState<Truck[]>([]); // State to hold trucks fetched from Supabase
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
    fetchParties();
    fetchTrucks();
  }, [authUser, authLoading, router]);

  const fetchParties = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('parties').select('*');
      if (error) {
        toast({ title: "Error fetching parties", description: error.message, variant: "destructive" });
        setAllParties([]);
      } else {
        setAllParties(data || []);
      }
    } catch (e: any) {
      toast({ title: "Network error fetching parties", description: e.message, variant: "destructive" });
      setAllParties([]);
    }
  };

  const fetchTrucks = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('trucks').select('*');
      if (error) {
        toast({ title: "Error fetching trucks", description: error.message, variant: "destructive" });
        setAllTrucks([]);
      } else {
        setAllTrucks(data || []);
      }
    } catch (e: any) {
      toast({ title: "Network error fetching trucks", description: e.message, variant: "destructive" });
      setAllTrucks([]);
    }
  };
  
  // getPartyName should now work as allParties will be populated
  const getPartyName = (partyId: string) => allParties.find(p => p.id === partyId)?.name || "N/A";

  const handleGenerateDailyReport = async () => {
    if (!dailyReportDate) {
      toast({ title: "Error", description: "Please select a date.", variant: "destructive" });
      return;
    }
    if (!supabase) {
      toast({ title: "Error", description: "Supabase client not available.", variant: "destructive" });
      return;
    }
    setIsDailyLoading(true);
    try {
      const { data, error } = await supabase
        .from('biltis')
        .select('*')
        .gte('date', format(startOfDay(dailyReportDate), "yyyy-MM-dd'T'HH:mm:ssXXX"))
        .lte('date', format(endOfDay(dailyReportDate), "yyyy-MM-dd'T'HH:mm:ssXXX"));
      if (error) {
        toast({ title: "Error fetching daily report", description: error.message, variant: "destructive" });
        setDailyReportData([]);
        setDailyReportSummary({ count: 0, totalAmount: 0 });
      } else {
        const biltis = data || [];
        setDailyReportData(biltis);
        setDailyReportSummary({
          count: biltis.length,
          totalAmount: biltis.reduce((sum, b) => sum + b.amount, 0),
        });
        if (biltis.length === 0) {
          toast({ title: "No Biltis Found", description: "No biltis were found for the selected date.", variant: "default" });
        }
      }
    } catch (e: any) {
      toast({ title: "Network error fetching daily report", description: e.message, variant: "destructive" });
      setDailyReportData([]);
      setDailyReportSummary({ count: 0, totalAmount: 0 });
    }
    setIsDailyLoading(false);
  };
  
  const handleExportDailyToCSV = () => {
    if (dailyReportData.length === 0) {
        toast({ title: "No Data", description: "Generate a report first to export.", variant: "destructive"});
        return;
    }
    const headers = ["Bilti No", "Consignor", "Consignee", "Destination", "Packages", "Total Amount", "Pay Mode"];
    const rows = dailyReportData.map(bilti => [
        bilti.documentNumber, // Assuming documentNumber is the Bilti No.
        getPartyName(bilti.consignorId),
        getPartyName(bilti.consigneeId),
        bilti.toLocationId, // This is an ID, might need to fetch location name
        bilti.quantity,
        bilti.amount,
        bilti.status, // This is Bilti status, not payMode. Need to adjust if payMode is required.
    ].join(","));
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `daily_bilti_activity_${format(dailyReportDate || new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({title: "Exported", description: "Daily Bilti Activity report exported to CSV."});
  };

  const handleGenerateRegisterReport = async () => {
    if (!registerStartDate || !registerEndDate) {
      toast({ title: "Error", description: "Please select a valid date range.", variant: "destructive" });
      return;
    }
    if (!supabase) {
      toast({ title: "Error", description: "Supabase client not available.", variant: "destructive" });
      return;
    }
    setIsRegisterLoading(true);
    try {
      let query = supabase.from('biltis').select('*')
        .gte('date', format(startOfDay(registerStartDate), "yyyy-MM-dd'T'HH:mm:ssXXX"))
        .lte('date', format(endOfDay(registerEndDate), "yyyy-MM-dd'T'HH:mm:ssXXX"));

      // Party name filtering is complex and might require a database function or view for optimal performance.
      // For now, we'll fetch all biltis in the date range and then filter client-side if a party name is provided.
      // This is not ideal for large datasets.
      const { data, error } = await query;

      if (error) {
        toast({ title: "Error fetching bilti register", description: error.message, variant: "destructive" });
        setRegisterReportData([]);
      } else {
        let filteredData = data || [];
        if (registerPartyName.trim()) {
          const searchTerm = registerPartyName.trim().toLowerCase();
          filteredData = filteredData.filter(bilti => {
            const consignor = allParties.find(p => p.id === bilti.consignorId);
            const consignee = allParties.find(p => p.id === bilti.consigneeId);
            return (consignor && consignor.name.toLowerCase().includes(searchTerm)) || 
                   (consignee && consignee.name.toLowerCase().includes(searchTerm));
          });
          if (filteredData.length === 0 && (data || []).length > 0) {
             toast({ title: "Party Filter Applied", description: `No biltis found for party '${registerPartyName}' in the selected date range.`, variant: "default" });
          } else if (filteredData.length === 0) {
             toast({ title: "No Biltis Found", description: `No biltis found for the selected criteria.`, variant: "default" });
          }
        }
        setRegisterReportData(filteredData);
        if (filteredData.length === 0 && !registerPartyName.trim()) {
          toast({ title: "No Biltis Found", description: "No biltis were found for the selected date range.", variant: "default" });
        }
      }
    } catch (e: any) {
      toast({ title: "Network error fetching bilti register", description: e.message, variant: "destructive" });
      setRegisterReportData([]);
    }
    setIsRegisterLoading(false);
  };

  const handlePartySelectForLedger = async (party: Party) => {
    setSelectedPartyForLedger(party);
    setIsPartySelectOpen(false);
    if (party && supabase) {
        setIsPartyLedgerLoading(true);
        try {
          // Assuming 'daybook' table stores ledger entries and 'related_party_id' links to Party.id
          const { data, error } = await supabase
            .from('daybook') 
            .select('*')
            .eq('related_party_id', party.id) 
            .order('date', { ascending: true }) // Fetch oldest first for running balance
            .order('created_at', { ascending: true }); // Secondary sort for same-day entries

          if (error) {
            toast({ title: "Error fetching party ledger", description: error.message, variant: "destructive" });
            setPartyLedgerData([]);
            setPartyLedgerBalance(0);
          } else {
            const entries = (data || []) as LedgerEntry[];
            let currentBalance = 0;
            const entriesWithRunningBalance: LedgerEntryWithBalance[] = entries.map(entry => {
              // Standard accounting: For a party ledger (our receivable):
              // Debit: Increases amount party owes us.
              // Credit: Decreases amount party owes us (e.g., payment received, goods returned).
              if (entry.type === 'debit') {
                currentBalance += entry.amount;
              } else if (entry.type === 'credit') {
                currentBalance -= entry.amount;
              }
              return { ...entry, runningBalance: currentBalance };
            });
            setPartyLedgerData(entriesWithRunningBalance);
            setPartyLedgerBalance(currentBalance); // Final balance
            if (entries.length === 0) {
              toast({ title: "No Ledger Entries", description: `No ledger entries found for ${party.name}.`, variant: "default" });
            }
          }
        } catch (e: any) {
          toast({ title: "Network error fetching party ledger", description: e.message, variant: "destructive" });
          setPartyLedgerData([]);
          setPartyLedgerBalance(0);
        }
        setIsPartyLedgerLoading(false);
    } else {
        setPartyLedgerData([]);
        setPartyLedgerBalance(0);
        if (!supabase) toast({ title: "Error", description: "Supabase client not available.", variant: "destructive" });
    }
  };

  const handlePartyAddForLedger = (newParty: Party) => {
    // This function was for mock data. With Supabase, adding a party would be a separate form/process.
    // For now, just select it if it were added.
    setSelectedPartyForLedger(newParty); 
    toast({ title: "Party Selected (Simulated Add)", description: `${newParty.name} selected. Actual add needs implementation.`});
  }
  
  const handleTruckSelect = (truck: Truck | null) => {
    setSelectedTruck(truck);
    setIsTruckSelectOpen(false);
  };
  
  const filteredTrucksForSelect = allTrucks.filter(truck => // Use allTrucks state
    truck.truckNo.toLowerCase().includes(truckSearchTerm.toLowerCase()) ||
    (truck.ownerName && truck.ownerName.toLowerCase().includes(truckSearchTerm.toLowerCase())) // Assuming Truck type has ownerName
  );

  const handleGenerateTruckReport = async () => {
    if (!truckReportStartDate || !truckReportEndDate) {
        toast({ title: "Error", description: "Please select a valid date range for truck report.", variant: "destructive" });
        return;
    }
    if (!supabase) {
      toast({ title: "Error", description: "Supabase client not available.", variant: "destructive" });
      return;
    }
    setIsTruckReportLoading(true);
    try {
      const targetTrucks = selectedTruck ? [selectedTruck] : allTrucks;
      if (targetTrucks.length === 0 && !selectedTruck) {
        toast({ title: "No Trucks", description: "No trucks available to generate report. Fetching trucks or select one.", variant: "default" });
        setIsTruckReportLoading(false);
        return;
      }

      const reportPromises = targetTrucks.map(async (truck) => {
        const { data: biltisForTruck, error } = await supabase
          .from('biltis')
          .select('amount, truckId') // Ensure truckId is selected if needed for join or verification, though not directly used in calculation here
          .eq('truckId', truck.id)
          .gte('date', format(startOfDay(truckReportStartDate), "yyyy-MM-dd'T'HH:mm:ssXXX"))
          .lte('date', format(endOfDay(truckReportEndDate), "yyyy-MM-dd'T'HH:mm:ssXXX"));
        
        if (error) {
          toast({ title: `Error fetching biltis for ${truck.truckNo}`, description: error.message, variant: "destructive" });
          return { truck, biltiCount: 0, totalFreight: 0, simulatedExpenses: 0, netRevenue: 0 };
        }
        
        const biltis = biltisForTruck || [];
        const totalFreight = biltis.reduce((sum, b) => sum + b.amount, 0);
        // Simulation logic - can be adjusted or made more complex
        const simulatedExpenses = totalFreight * 0.6 + biltis.length * 100; 
        const netRevenue = totalFreight - simulatedExpenses;
        return { truck, biltiCount: biltis.length, totalFreight, simulatedExpenses, netRevenue };
      });
      
      const reportResults = await Promise.all(reportPromises);
      setTruckReportData(reportResults);
      if (reportResults.every(r => r.biltiCount === 0)){
         toast({ title: "No Data for Trucks", description: "No bilti data found for the selected truck(s) in this period.", variant: "default" });
      }

    } catch (e: any) {
      toast({ title: "Network error generating truck report", description: e.message, variant: "destructive" });
      setTruckReportData([]);
    }
    setIsTruckReportLoading(false);
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
        parties={allParties} // Use allParties state
        onPartySelect={handlePartySelectForLedger}
        onPartyAdd={handlePartyAddForLedger} 
        dialogTitle="Select Party for Ledger"
      />

      <div>
        <h1 className="text-3xl font-headline font-bold text-foreground">Reports Dashboard</h1>
        <p className="text-muted-foreground">Generate and view various reports for insights and data exports.</p>
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
                    {/* Ensure dailyReportDate is not undefined before formatting */}
                    <CardTitle className="text-md">Summary for {dailyReportDate ? format(dailyReportDate, "PP") : ""}</CardTitle>
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
                    <TableBody>{dailyReportData.map(b => (<TableRow key={b.id}><TableCell>{b.documentNumber}</TableCell><TableCell>{getPartyName(b.consignorId)}</TableCell><TableCell>{getPartyName(b.consigneeId)}</TableCell><TableCell>Rs. {b.amount.toFixed(2)}</TableCell></TableRow>))}</TableBody>
                  </Table>
                </ScrollArea>
              ) : !isDailyLoading && dailyReportSummary.count === 0 && <p className="text-center text-muted-foreground py-4">No Biltis found for the selected date. (Or Supabase call not implemented)</p>}\
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
              <Button onClick={handleGenerateRegisterReport} disabled={isRegisterLoading}>{isRegisterLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin\"/>} Generate Register</Button>
              {registerReportData.length > 0 ? (
                 <ScrollArea className="h-[400px] mt-2">
                  <Table>
                    <TableHeader><TableRow><TableHead>Miti</TableHead><TableHead>Bilti No.</TableHead><TableHead>Consignor</TableHead><TableHead>Consignee</TableHead><TableHead>Destination</TableHead><TableHead className="text-right">Amount</TableHead>{/*<TableHead>Pay Mode</TableHead>*/}<TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>{registerReportData.map(b => (<TableRow key={b.id}><TableCell>{format(new Date(b.date), "PP")}</TableCell><TableCell>{b.documentNumber}</TableCell><TableCell>{getPartyName(b.consignorId)}</TableCell><TableCell>{getPartyName(b.consigneeId)}</TableCell><TableCell>{b.toLocationId}</TableCell><TableCell className="text-right">{b.amount.toFixed(2)}</TableCell>{/*<TableCell>{b.payMode}</TableCell>*/}<TableCell>{b.status}</TableCell></TableRow>))}</TableBody>
                  </Table>
                </ScrollArea>
              ) : !isRegisterLoading && <p className="text-center text-muted-foreground py-4">No Biltis found for the selected criteria. (Or Supabase call not implemented)</p>}\
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
                    {selectedPartyForLedger ? `${selectedPartyForLedger.name} (ID: ${selectedPartyForLedger.id})` : "Select Party..."}
                 </Button>
              </div>
              {isPartyLedgerLoading && <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary\"/></div>}
              {selectedPartyForLedger && !isPartyLedgerLoading && (
                <>
                  <Card className="bg-secondary/30">
                    <CardHeader><CardTitle className="text-md">Ledger for: {selectedPartyForLedger.name}</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p>ID: {selectedPartyForLedger.id}</p>
                      <p>Contact: {selectedPartyForLedger.contactNo || "N/A"}</p>
                      <p className="font-bold text-lg">Current Balance: Rs. {partyLedgerBalance.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <h4 className="font-semibold mt-4">Recent Transactions:</h4>
                   {partyLedgerData.length > 0 ? (
                    <ScrollArea className="h-[300px] mt-1">
                      <Table>
                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                        <TableBody>{partyLedgerData.map((e, idx) => (<TableRow key={e.id}><TableCell>{format(new Date(e.date),"PP")}</TableCell><TableCell>{e.description}</TableCell><TableCell className="text-right">{e.type === 'debit' ? e.amount.toFixed(2):"-"}</TableCell><TableCell className="text-right">{e.type === 'credit' ? e.amount.toFixed(2):"-"}</TableCell><TableCell className="text-right">{e.runningBalance.toFixed(2)}</TableCell></TableRow>))}</TableBody>
                      </Table>
                    </ScrollArea>
                  ) : <p className="text-center text-muted-foreground py-4">No ledger entries found for this party. (Or Supabase call not implemented)</p>}\
                  {/* <Button variant="link" className="p-0 h-auto" onClick={() => alert("Navigate to full ledger page for " + selectedPartyForLedger.name + " (manual selection needed there for now)")}>View Full Statement in Ledgers Module</Button> */}
                </>
              )}
               {!selectedPartyForLedger && !isPartyLedgerLoading && <p className="text-center text-muted-foreground py-4">Please select a party to view their ledger summary.</p>}\
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
                        {selectedTruck ? `${selectedTruck.truckNo} (${selectedTruck.ownerName})` : "All Trucks / Select Truck..."}
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
                            <CommandItem key={truck.id} value={`${truck.truckNo} ${truck.ownerName}`} onSelect={() => handleTruckSelect(truck)} className="cursor-pointer">
                              <Check className={cn("mr-2 h-4 w-4", selectedTruck?.id === truck.id ? "opacity-100" : "opacity-0")}/>
                              {truck.truckNo} ({truck.ownerName})
                            </CommandItem>
                          ))}\
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <Button onClick={handleGenerateTruckReport} disabled={isTruckReportLoading}>{isTruckReportLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin\"/>}Generate Truck Report</Button>
              
              {truckReportData.length > 0 ? (
                 <ScrollArea className="h-[400px] mt-2">
                  <Table>
                    <TableHeader><TableRow><TableHead>Truck No.</TableHead><TableHead>Owner</TableHead><TableHead className="text-right">Biltis</TableHead><TableHead className="text-right">Freight Amt.</TableHead><TableHead className="text-right">Expenses (Sim.)</TableHead><TableHead className="text-right">Net Rev. (Sim.)</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {truckReportData.map(item => (
                        <TableRow key={item.truck.id}>
                          <TableCell>{item.truck.truckNo}</TableCell>
                          <TableCell>{item.truck.ownerName}</TableCell>
                          <TableCell className="text-right">{item.biltiCount}</TableCell>
                          <TableCell className="text-right">{item.totalFreight.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{item.simulatedExpenses.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">{item.netRevenue.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}\
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : !isTruckReportLoading && <p className="text-center text-muted-foreground py-4">No truck performance data found for the selected criteria. (Or Supabase call not implemented)</p>}\
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
