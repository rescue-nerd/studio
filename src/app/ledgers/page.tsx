
"use client";

import { useState, useEffect, useMemo, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, Filter, PlusCircle, ChevronsUpDown, Check, FileText, Printer } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isValid, subDays, endOfDay, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk";
import { Textarea } from "@/components/ui/textarea";

// Interfaces
interface LedgerAccount {
  id: string; // e.g., PTY001, TRK001, DRV001
  name: string;
  type: "Party" | "Truck" | "Driver";
  currentBalance: number;
  panNo?: string; // For parties
  truckNo?: string; // For trucks
  licenseNo?: string; // For drivers
}

interface LedgerEntry {
  id: string;
  accountId: string;
  miti: Date;
  description: string;
  debit: number;
  credit: number;
  balance: number; // Running balance after this entry
  referenceNo?: string; // e.g., Bilti No, Delivery No
  transactionType: "Bilti" | "Delivery" | "Rebate" | "Discount" | "Manual Credit" | "Manual Debit" | "Opening Balance";
}

// Mock Data
const initialMockAccounts: LedgerAccount[] = [
  { id: "PTY001", name: "Global Traders (KTM)", type: "Party", currentBalance: 15000, panNo: "PAN123KTM" },
  { id: "PTY002", name: "National Distributors (PKR)", type: "Party", currentBalance: -5250, panNo: "PAN456PKR" },
  { id: "TRK001", name: "BA 1 KA 1234", type: "Truck", currentBalance: 25000, truckNo: "BA 1 KA 1234"},
  { id: "DRV001", name: "Suresh Kumar", type: "Driver", currentBalance: 1200, licenseNo: "LIC-12345" },
];

const initialMockEntries: LedgerEntry[] = [
  // Party PTY001
  { id: "LE001", accountId: "PTY001", miti: new Date("2024-07-01"), description: "Opening Balance", debit: 0, credit: 10000, balance: 10000, transactionType: "Opening Balance" },
  { id: "LE002", accountId: "PTY001", miti: new Date("2024-07-05"), description: "Freight charges for Bilti BLT-001", debit: 5000, credit: 0, balance: 15000, referenceNo: "BLT-001", transactionType: "Bilti" },
  { id: "LE003", accountId: "PTY001", miti: new Date("2024-07-10"), description: "Payment received against BLT-001", debit: 0, credit: 3000, balance: 12000, referenceNo: "BLT-001", transactionType: "Manual Credit" },
  { id: "LE004", accountId: "PTY001", miti: new Date("2024-07-15"), description: "Rebate on Delivery GDN-001 (Bilti BLT-001) - Damaged goods", debit: 0, credit: 500, balance: 11500, referenceNo: "GDN-001", transactionType: "Rebate" },
  // Party PTY002
  { id: "LE005", accountId: "PTY002", miti: new Date("2024-07-02"), description: "Opening Balance", debit: 0, credit: 0, balance: 0, transactionType: "Opening Balance" },
  { id: "LE006", accountId: "PTY002", miti: new Date("2024-07-06"), description: "Freight charges for Bilti BLT-002 (To Pay)", debit: 2500, credit: 0, balance: 2500, referenceNo: "BLT-002", transactionType: "Bilti" },
  { id: "LE007", accountId: "PTY002", miti: new Date("2024-07-12"), description: "Discount on Delivery GDN-002 (Bilti BLT-002) - Early payment", debit: 0, credit: 250, balance: 2250, referenceNo: "GDN-002", transactionType: "Discount" },
  // Truck TRK001
  { id: "LE008", accountId: "TRK001", miti: new Date("2024-07-01"), description: "Opening fuel expense", debit: 5000, credit: 0, balance: -5000, transactionType: "Manual Debit" },
  { id: "LE009", accountId: "TRK001", miti: new Date("2024-07-05"), description: "Freight income from Bilti BLT-001", debit: 0, credit: 5000, balance: 0, referenceNo: "BLT-001", transactionType: "Bilti" },
  // Driver DRV001
  { id: "LE010", accountId: "DRV001", miti: new Date("2024-07-01"), description: "Salary advance", debit: 1000, credit: 0, balance: -1000, transactionType: "Manual Debit" },
];
// Adjust initial balances based on mock entries
initialMockAccounts.forEach(acc => {
    const relevantEntries = initialMockEntries.filter(e => e.accountId === acc.id).sort((a,b) => a.miti.getTime() - b.miti.getTime());
    if (relevantEntries.length > 0) {
        acc.currentBalance = relevantEntries[relevantEntries.length - 1].balance;
    } else {
        acc.currentBalance = 0; // Or set to an opening balance if defined differently
    }
});


const transactionTypes: LedgerEntry["transactionType"][] = ["Bilti", "Delivery", "Rebate", "Discount", "Manual Credit", "Manual Debit", "Opening Balance"];

const defaultManualEntryFormData: Omit<LedgerEntry, 'id' | 'balance' | 'accountId'> & { accountId?: string } = {
  miti: new Date(),
  description: "",
  debit: 0,
  credit: 0,
  referenceNo: "",
  transactionType: "Manual Credit",
};


export default function LedgersPage() {
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>(initialMockAccounts);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>(initialMockEntries);
  
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accountSearchTerm, setAccountSearchTerm] = useState("");
  const [isAccountSelectOpen, setIsAccountSelectOpen] = useState(false);

  const [filterType, setFilterType] = useState<LedgerEntry["transactionType"] | "All">("All");
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);

  const [isManualEntryDialogOpen, setIsManualEntryDialogOpen] = useState(false);
  const [manualEntryFormData, setManualEntryFormData] = useState(defaultManualEntryFormData);

  const { toast } = useToast();

  const selectedAccount = useMemo(() => {
    return ledgerAccounts.find(acc => acc.id === selectedAccountId);
  }, [selectedAccountId, ledgerAccounts]);

  const displayedEntries = useMemo(() => {
    if (!selectedAccountId) return [];
    return ledgerEntries
      .filter(entry => entry.accountId === selectedAccountId)
      .filter(entry => filterType === "All" || entry.transactionType === filterType)
      .filter(entry => !filterStartDate || entry.miti >= startOfDay(filterStartDate))
      .filter(entry => !filterEndDate || entry.miti <= endOfDay(filterEndDate))
      .sort((a, b) => b.miti.getTime() - a.miti.getTime()); // Show newest first
  }, [selectedAccountId, ledgerEntries, filterType, filterStartDate, filterEndDate]);

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    setIsAccountSelectOpen(false);
  };

  const handleManualEntryChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let parsedValue: string | number = value;
    if (name === "debit" || name === "credit") {
        parsedValue = value === "" ? 0 : parseFloat(value);
        if (isNaN(parsedValue as number) || parsedValue < 0) parsedValue = 0;
    }
    setManualEntryFormData(prev => ({ ...prev, [name]: parsedValue }));
  };

  const handleManualEntryDateChange = (date?: Date) => {
    if (date) setManualEntryFormData(prev => ({ ...prev, miti: date }));
  };
  
  const handleManualEntryTypeChange = (value: LedgerEntry["transactionType"]) => {
    setManualEntryFormData(prev => ({...prev, transactionType: value}));
  };


  const handleManualEntrySubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) {
        toast({ title: "Error", description: "Please select an account first.", variant: "destructive"});
        return;
    }
    if (!manualEntryFormData.description.trim()) {
        toast({ title: "Error", description: "Description/Memo is required for manual entry.", variant: "destructive"});
        return;
    }
    if (manualEntryFormData.debit === 0 && manualEntryFormData.credit === 0) {
        toast({ title: "Error", description: "Either Debit or Credit amount must be provided.", variant: "destructive"});
        return;
    }
    if (manualEntryFormData.debit > 0 && manualEntryFormData.credit > 0) {
        toast({ title: "Error", description: "Cannot have both Debit and Credit amounts.", variant: "destructive"});
        return;
    }

    const newEntryId = `LE${Date.now()}`;
    let newBalance = selectedAccount?.currentBalance || 0;
    if (manualEntryFormData.transactionType.includes("Credit") || manualEntryFormData.credit > 0) {
        newBalance += manualEntryFormData.credit;
    } else { // Debit or Opening Balance treated as debit if no credit
        newBalance -= manualEntryFormData.debit;
    }
    
    const newEntry: LedgerEntry = {
      id: newEntryId,
      accountId: selectedAccountId,
      miti: manualEntryFormData.miti,
      description: manualEntryFormData.description,
      debit: manualEntryFormData.debit,
      credit: manualEntryFormData.credit,
      balance: newBalance, // This would be more complex with full history recalculation
      referenceNo: manualEntryFormData.referenceNo,
      transactionType: manualEntryFormData.transactionType,
    };

    // Simulate recalculating subsequent balances and updating account balance
    // In a real system, this would be DB-driven and more robust.
    const updatedEntries = [...ledgerEntries, newEntry]
        .filter(entry => entry.accountId === selectedAccountId)
        .sort((a, b) => a.miti.getTime() - b.miti.getTime() || a.id.localeCompare(b.id));
    
    let currentRunningBalance = 0;
    const recalculatedEntriesForAccount = updatedEntries.map(entry => {
        if (entry.transactionType === "Opening Balance") {
            currentRunningBalance = entry.credit - entry.debit;
        } else {
            currentRunningBalance += entry.credit - entry.debit;
        }
        return {...entry, balance: currentRunningBalance};
    });
    
    const otherAccountEntries = ledgerEntries.filter(entry => entry.accountId !== selectedAccountId);
    setLedgerEntries([...otherAccountEntries, ...recalculatedEntriesForAccount]);

    setLedgerAccounts(prevAccounts => 
        prevAccounts.map(acc => 
            acc.id === selectedAccountId ? { ...acc, currentBalance: currentRunningBalance } : acc
        )
    );

    toast({ title: "Manual Entry Added", description: `Entry for ${selectedAccount?.name} saved.` });
    setIsManualEntryDialogOpen(false);
    setManualEntryFormData(defaultManualEntryFormData);
  };
  
  const filteredAccounts = ledgerAccounts.filter(acc => 
    acc.name.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
    acc.id.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
    (acc.panNo && acc.panNo.toLowerCase().includes(accountSearchTerm.toLowerCase())) ||
    (acc.truckNo && acc.truckNo.toLowerCase().includes(accountSearchTerm.toLowerCase())) ||
    (acc.licenseNo && acc.licenseNo.toLowerCase().includes(accountSearchTerm.toLowerCase()))
  );


  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground">Ledger / Accounting</h1>
          <p className="text-muted-foreground">Track income, expenses, and balances for trucks, drivers, and parties.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => alert("Export to PDF (not implemented)")}><FileText className="mr-2 h-4 w-4"/> Export PDF</Button>
            <Button variant="outline" onClick={() => alert("Print Ledger (not implemented)")}><Printer className="mr-2 h-4 w-4"/> Print Ledger</Button>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <CardTitle className="font-headline text-xl">Ledger Management</CardTitle>
                <CardDescription>
                    View statements and add manual entries. Bilti/Delivery related entries are (simulated as) auto-posted.
                </CardDescription>
            </div>
            <Dialog open={isManualEntryDialogOpen} onOpenChange={setIsManualEntryDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!selectedAccountId}><PlusCircle className="mr-2 h-4 w-4"/> Add Manual Entry</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Manual Ledger Entry</DialogTitle>
                  <DialogDescription>For account: <span className="font-semibold">{selectedAccount?.name || "N/A"}</span></DialogDescription>
                </DialogHeader>
                <form onSubmit={handleManualEntrySubmit} className="space-y-3 py-2">
                    <div>
                        <Label htmlFor="manualMiti">Miti (Date)</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !manualEntryFormData.miti && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {manualEntryFormData.miti ? format(manualEntryFormData.miti, "PPP") : <span>Pick a date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={manualEntryFormData.miti} onSelect={handleManualEntryDateChange} initialFocus /></PopoverContent>
                        </Popover>
                    </div>
                    <div>
                        <Label htmlFor="manualDescription">Description / Memo <span className="text-destructive">*</span></Label>
                        <Textarea id="manualDescription" name="description" value={manualEntryFormData.description} onChange={handleManualEntryChange} required rows={3}/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                           <Label htmlFor="manualDebit">Debit Amount</Label>
                           <Input id="manualDebit" name="debit" type="number" value={manualEntryFormData.debit} onChange={handleManualEntryChange} placeholder="0.00"/>
                        </div>
                        <div>
                           <Label htmlFor="manualCredit">Credit Amount</Label>
                           <Input id="manualCredit" name="credit" type="number" value={manualEntryFormData.credit} onChange={handleManualEntryChange} placeholder="0.00"/>
                        </div>
                    </div>
                     <div>
                        <Label htmlFor="manualRefNo">Reference No. (Optional)</Label>
                        <Input id="manualRefNo" name="referenceNo" value={manualEntryFormData.referenceNo || ""} onChange={handleManualEntryChange}/>
                    </div>
                    <div>
                        <Label htmlFor="manualTransactionType">Transaction Type</Label>
                        <Select value={manualEntryFormData.transactionType} onValueChange={handleManualEntryTypeChange} required>
                            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Manual Credit">Manual Credit</SelectItem>
                                <SelectItem value="Manual Debit">Manual Debit</SelectItem>
                                <SelectItem value="Opening Balance">Opening Balance</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter className="pt-4 border-t">
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">Save Entry</Button>
                    </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2">
              <Label htmlFor="ledgerAccountSelect">Select Ledger Account</Label>
              <Popover open={isAccountSelectOpen} onOpenChange={setIsAccountSelectOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={isAccountSelectOpen} className="w-full justify-between">
                    {selectedAccount ? `${selectedAccount.name} (${selectedAccount.type})` : "Select account..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search account (Name, ID, PAN, Truck No)..." onValueChange={setAccountSearchTerm} />
                    <CommandEmpty>No account found.</CommandEmpty>
                    <CommandList>
                      <ScrollArea className="h-48">
                        {filteredAccounts.map((account) => (
                          <CommandItem
                            key={account.id}
                            value={account.name}
                            onSelect={() => handleAccountSelect(account.id)}
                            className="cursor-pointer"
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedAccountId === account.id ? "opacity-100" : "opacity-0")}/>
                            {account.name} ({account.type}) - {account.id}
                          </CommandItem>
                        ))}
                      </ScrollArea>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
                <Label>Current Balance</Label>
                <Input value={selectedAccount ? selectedAccount.currentBalance.toFixed(2) : "N/A"} readOnly className="font-bold text-lg bg-muted" />
            </div>
          </div>

        </CardHeader>
        <CardContent>
          <div className="mb-4 p-4 border rounded-md bg-secondary/30">
            <h3 className="text-md font-semibold mb-2 flex items-center"><Filter className="mr-2 h-4 w-4"/>Filter Entries</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="filterType">Transaction Type</Label>
                <Select value={filterType} onValueChange={(value) => setFilterType(value as LedgerEntry["transactionType"] | "All")}>
                  <SelectTrigger id="filterType"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Types</SelectItem>
                    {transactionTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filterStartDate">Start Date</Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button id="filterStartDate" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !filterStartDate && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {filterStartDate ? format(filterStartDate, "PPP") : <span>Pick start date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={filterStartDate} onSelect={setFilterStartDate} /></PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="filterEndDate">End Date</Label>
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button id="filterEndDate" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !filterEndDate && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {filterEndDate ? format(filterEndDate, "PPP") : <span>Pick end date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={filterEndDate} onSelect={setFilterEndDate} /></PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {selectedAccountId ? (
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description/Reason</TableHead>
                    <TableHead>Ref. No.</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedEntries.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center h-24">No ledger entries found for the selected criteria.</TableCell></TableRow>
                  )}
                  {displayedEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{format(entry.miti, "PP")}</TableCell>
                      <TableCell className="max-w-xs truncate" title={entry.description}>{entry.description}</TableCell>
                      <TableCell>{entry.referenceNo || "N/A"}</TableCell>
                      <TableCell className="text-right">{entry.debit > 0 ? entry.debit.toFixed(2) : "-"}</TableCell>
                      <TableCell className="text-right">{entry.credit > 0 ? entry.credit.toFixed(2) : "-"}</TableCell>
                      <TableCell className="text-right font-medium">{entry.balance.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button variant="link" size="sm" onClick={() => alert(`View details for entry ${entry.id} (not implemented)`)}>Details</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <p>Please select a ledger account to view its statement.</p>
            </div>
          )}
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">
                This ledger is a frontend simulation. Automatic entries from Bilti/Delivery and balance calculations are representative.
                Full transactional integrity and real-time data require backend integration.
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}

    