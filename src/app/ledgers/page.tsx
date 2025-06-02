
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
import { CalendarIcon, Search, Filter, PlusCircle, ChevronsUpDown, Check, FileText, Printer, BadgeAlert, CheckCircle2, XCircle } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isValid, subDays, endOfDay, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";


// Interfaces
interface LedgerAccount {
  id: string; 
  name: string;
  type: "Party" | "Truck" | "Driver";
  currentBalance: number;
  panNo?: string; 
  truckNo?: string; 
  licenseNo?: string; 
}

type LedgerTransactionType = "Bilti" | "Delivery" | "Rebate" | "Discount" | "Manual Credit" | "Manual Debit" | "Opening Balance";
type LedgerEntryStatus = "Pending" | "Approved" | "Rejected";

interface LedgerEntry {
  id: string;
  accountId: string;
  miti: Date;
  description: string; 
  debit: number;
  credit: number;
  balance: number; 
  referenceNo?: string; 
  transactionType: LedgerTransactionType;
  status: LedgerEntryStatus;
  approvalRemarks?: string;
  createdBy?: string; 
  createdAt?: Date;
}


const initialMockAccounts: LedgerAccount[] = [
  { id: "PTY001", name: "Global Traders (KTM)", type: "Party", currentBalance: 0, panNo: "PAN123KTM" },
  { id: "PTY002", name: "National Distributors (PKR)", type: "Party", currentBalance: 0, panNo: "PAN456PKR" },
  { id: "TRK001", name: "BA 1 KA 1234", type: "Truck", currentBalance: 0, truckNo: "BA 1 KA 1234"},
  { id: "DRV001", name: "Suresh Kumar", type: "Driver", currentBalance: 0, licenseNo: "LIC-12345" },
];

const initialMockEntries: LedgerEntry[] = [
  // Party PTY001
  { id: "LE001", accountId: "PTY001", miti: new Date("2024-07-01"), description: "Opening Balance", debit: 0, credit: 10000, balance: 10000, transactionType: "Opening Balance", status: "Approved", createdBy: "System", createdAt: new Date("2024-07-01") },
  { id: "LE002", accountId: "PTY001", miti: new Date("2024-07-05"), description: "Freight charges for Bilti BLT-001 (KTM to PKR)", debit: 5000, credit: 0, balance: 15000, referenceNo: "BLT-001", transactionType: "Bilti", status: "Approved", createdBy: "UserA", createdAt: new Date("2024-07-05") },
  { id: "LE003", accountId: "PTY001", miti: new Date("2024-07-10"), description: "Payment received via Cheque #123", debit: 0, credit: 3000, balance: 12000, transactionType: "Manual Credit", status: "Pending", createdBy: "UserB", createdAt: new Date("2024-07-10") },
  { id: "LE004", accountId: "PTY001", miti: new Date("2024-07-15"), description: "Rebate on Delivery GDN-001 (Bilti BLT-001). Reason: Damaged goods.", debit: 0, credit: 500, balance: 11500, referenceNo: "GDN-001", transactionType: "Rebate", status: "Approved", createdBy: "UserA", createdAt: new Date("2024-07-15") },
  
  // Party PTY002
  { id: "LE005", accountId: "PTY002", miti: new Date("2024-07-02"), description: "Opening Balance", debit: 0, credit: 0, balance: 0, transactionType: "Opening Balance", status: "Approved", createdBy: "System", createdAt: new Date("2024-07-02") },
  { id: "LE006", accountId: "PTY002", miti: new Date("2024-07-06"), description: "Freight charges for Bilti BLT-002 (PKR to BRT, To Pay)", debit: 2500, credit: 0, balance: 2500, referenceNo: "BLT-002", transactionType: "Bilti", status: "Approved", createdBy: "UserA", createdAt: new Date("2024-07-06") },
  { id: "LE007", accountId: "PTY002", miti: new Date("2024-07-12"), description: "Discount on Delivery GDN-002 (Bilti BLT-002). Reason: Early payment discount.", debit: 0, credit: 250, balance: 2250, referenceNo: "GDN-002", transactionType: "Discount", status: "Approved", createdBy: "UserA", createdAt: new Date("2024-07-12") },
  { id: "LE011", accountId: "PTY002", miti: new Date("2024-07-18"), description: "Received full payment for BLT-002", debit: 0, credit: 2250, balance: 0, referenceNo: "BLT-002", transactionType: "Manual Credit", status: "Approved", createdBy: "UserB", createdAt: new Date("2024-07-18") },

  // Truck TRK001
  { id: "LE008", accountId: "TRK001", miti: new Date("2024-07-01"), description: "Opening fuel expense allocation", debit: 5000, credit: 0, balance: -5000, transactionType: "Manual Debit", status: "Pending", createdBy: "System", createdAt: new Date("2024-07-01") },
  { id: "LE009", accountId: "TRK001", miti: new Date("2024-07-05"), description: "Freight income from Bilti BLT-001", debit: 0, credit: 5000, balance: 0, referenceNo: "BLT-001", transactionType: "Bilti", status: "Approved", createdBy: "UserA", createdAt: new Date("2024-07-05") },
  { id: "LE012", accountId: "TRK001", miti: new Date("2024-07-20"), description: "Maintenance Cost: Tyre Replacement", debit: 1500, credit: 0, balance: -1500, transactionType: "Manual Debit", status: "Approved", createdBy: "UserC", createdAt: new Date("2024-07-20") },
  
  // Driver DRV001
  { id: "LE010", accountId: "DRV001", miti: new Date("2024-07-01"), description: "Salary advance for July", debit: 1000, credit: 0, balance: -1000, transactionType: "Manual Debit", status: "Approved", createdBy: "System", createdAt: new Date("2024-07-01") },
  { id: "LE013", accountId: "DRV001", miti: new Date("2024-07-25"), description: "Trip Allowance for BLT-001", debit: 0, credit: 200, balance: -800, referenceNo: "BLT-001", transactionType: "Manual Credit", status: "Approved", createdBy: "UserA", createdAt: new Date("2024-07-25") },
];

initialMockAccounts.forEach(acc => {
    const relevantEntries = initialMockEntries
        .filter(e => e.accountId === acc.id && e.status === "Approved") // Only consider approved for initial balance
        .sort((a, b) => {
            const dateComparison = a.miti.getTime() - b.miti.getTime();
            if (dateComparison !== 0) return dateComparison;
            return (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0) || a.id.localeCompare(b.id);
        });
    
    let runningBalance = 0;
    relevantEntries.forEach(entry => {
      if (entry.transactionType === "Opening Balance") {
            runningBalance = entry.credit - entry.debit;
        } else {
            runningBalance += entry.credit - entry.debit;
        }
        // The mock `entry.balance` might be for all entries, not just approved. We care about the actual current balance.
    });
    acc.currentBalance = runningBalance;
});


const transactionTypes: LedgerTransactionType[] = ["Bilti", "Delivery", "Rebate", "Discount", "Manual Credit", "Manual Debit", "Opening Balance"];
const entryStatuses: LedgerEntryStatus[] = ["Pending", "Approved", "Rejected"];

const defaultManualEntryFormData: Omit<LedgerEntry, 'id' | 'balance' | 'accountId' | 'status' | 'approvalRemarks'> & { accountId?: string } = {
  miti: new Date(),
  description: "", 
  debit: 0,
  credit: 0,
  referenceNo: "",
  transactionType: "Manual Credit", 
  createdBy: "CurrentUser", 
  createdAt: new Date(),
};


export default function LedgersPage() {
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>(initialMockAccounts);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>(initialMockEntries);
  
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accountSearchTerm, setAccountSearchTerm] = useState("");
  const [isAccountSelectOpen, setIsAccountSelectOpen] = useState(false);

  const [filterType, setFilterType] = useState<LedgerTransactionType | "All">("All");
  const [filterStatus, setFilterStatus] = useState<LedgerEntryStatus | "All">("All");
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
      .filter(entry => filterStatus === "All" || entry.status === filterStatus)
      .filter(entry => !filterStartDate || entry.miti >= startOfDay(filterStartDate))
      .filter(entry => !filterEndDate || entry.miti <= endOfDay(filterEndDate))
      .sort((a, b) => { 
          const dateComparison = b.miti.getTime() - a.miti.getTime();
          if (dateComparison !== 0) return dateComparison;
          return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0) || b.id.localeCompare(a.id);
      });
  }, [selectedAccountId, ledgerEntries, filterType, filterStatus, filterStartDate, filterEndDate]);

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    setIsAccountSelectOpen(false);
    setAccountSearchTerm(""); 
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
    if (date) setManualEntryFormData(prev => ({ ...prev, miti: date, createdAt: new Date() }));
  };
  
  const handleManualEntryTypeChange = (value: LedgerTransactionType) => {
    setManualEntryFormData(prev => ({...prev, transactionType: value}));
  };


  const recalculateBalances = (accountId: string, entries: LedgerEntry[]): LedgerEntry[] => {
    const accountEntriesSorted = entries
      .filter(e => e.accountId === accountId)
      .sort((a, b) => {
        const dateComparison = a.miti.getTime() - b.miti.getTime();
        if (dateComparison !== 0) return dateComparison;
        if (a.transactionType === "Opening Balance") return -1;
        if (b.transactionType === "Opening Balance") return 1;
        return (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0) || a.id.localeCompare(b.id);
      });

    let currentRunningBalance = 0;
    const recalculated = accountEntriesSorted.map(entry => {
      if (entry.status === "Approved" || entry.transactionType === "Opening Balance") { // Opening balance is always 'approved' in effect for balance calculation
        if (entry.transactionType === "Opening Balance") {
          currentRunningBalance = entry.credit - entry.debit;
        } else {
          currentRunningBalance += entry.credit - entry.debit;
        }
      }
      return { ...entry, balance: currentRunningBalance };
    });
    
    // Update the main account's currentBalance
    setLedgerAccounts(prevAccounts => 
        prevAccounts.map(acc => 
            acc.id === accountId ? { ...acc, currentBalance: currentRunningBalance } : acc
        )
    );
    
    return entries.map(origEntry => recalculated.find(r => r.id === origEntry.id) || origEntry);
  };


  const handleManualEntrySubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) {
        toast({ title: "Error", description: "Please select an account first.", variant: "destructive"});
        return;
    }
    if (!manualEntryFormData.description.trim()) {
        toast({ title: "Validation Error", description: "Description / Memo is required for manual entry.", variant: "destructive"});
        return;
    }
    if (manualEntryFormData.debit === 0 && manualEntryFormData.credit === 0) {
        toast({ title: "Validation Error", description: "Either Debit or Credit amount must be non-zero.", variant: "destructive"});
        return;
    }
    if (manualEntryFormData.debit > 0 && manualEntryFormData.credit > 0) {
        toast({ title: "Validation Error", description: "Cannot have both Debit and Credit amounts for a single entry.", variant: "destructive"});
        return;
    }

    const newEntryId = `LE-MAN-${Date.now()}`;
    
    const newEntry: LedgerEntry = {
      id: newEntryId,
      accountId: selectedAccountId,
      miti: manualEntryFormData.miti,
      description: manualEntryFormData.description,
      debit: manualEntryFormData.debit,
      credit: manualEntryFormData.credit,
      balance: 0, // Will be recalculated
      referenceNo: manualEntryFormData.referenceNo,
      transactionType: manualEntryFormData.transactionType,
      status: "Pending", // New manual entries are pending
      createdBy: "CurrentUser", 
      createdAt: new Date(),
    };

    setLedgerEntries(prevEntries => recalculateBalances(selectedAccountId, [...prevEntries, newEntry]));
    toast({ title: "Manual Entry Submitted", description: `Entry for ${selectedAccount?.name} submitted for approval.` });
    setIsManualEntryDialogOpen(false);
    setManualEntryFormData({...defaultManualEntryFormData, miti: new Date(), createdAt: new Date()}); 
  };
  
  const filteredAccounts = ledgerAccounts.filter(acc => 
    acc.name.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
    acc.id.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
    (acc.panNo && acc.panNo.toLowerCase().includes(accountSearchTerm.toLowerCase())) ||
    (acc.truckNo && acc.truckNo.toLowerCase().includes(accountSearchTerm.toLowerCase())) ||
    (acc.licenseNo && acc.licenseNo.toLowerCase().includes(accountSearchTerm.toLowerCase()))
  );

  const handleViewDetails = (entry: LedgerEntry) => {
    alert(`Entry ID: ${entry.id}\nAccount: ${selectedAccount?.name}\nMiti: ${format(entry.miti, "PP")}\nDescription: ${entry.description}\nRef: ${entry.referenceNo || 'N/A'}\nType: ${entry.transactionType}\nStatus: ${entry.status}\n${entry.approvalRemarks ? `Remarks: ${entry.approvalRemarks}\n` : ""}Created: ${entry.createdAt ? format(entry.createdAt, 'Pp') : 'N/A'} by ${entry.createdBy || 'N/A'}`);
  };

  const handleApproveEntry = (entryId: string) => {
    let updatedEntries = ledgerEntries.map(entry => 
        entry.id === entryId ? { ...entry, status: "Approved" as LedgerEntryStatus, approvalRemarks: "Approved by SuperAdmin" } : entry
    );
    setLedgerEntries(recalculateBalances(selectedAccountId!, updatedEntries));
    toast({ title: "Entry Approved", description: `Entry ${entryId} has been approved.` });
  };

  const handleRejectEntry = (entryId: string) => {
    const remarks = window.prompt("Enter rejection remarks (optional):");
    let updatedEntries = ledgerEntries.map(entry => 
        entry.id === entryId ? { ...entry, status: "Rejected" as LedgerEntryStatus, approvalRemarks: remarks || "Rejected by SuperAdmin" } : entry
    );
    // Balances might need recalculation if a rejection impacts future calculations, but for this simulation, we'll keep it simple.
    // If rejection means the transaction is void, it shouldn't affect the running balance if it was pending.
    // If it was approved and then rejected (not typical), then balance recalc is crucial.
    // For now, if it was Pending, its financial impact wasn't yet "live".
    setLedgerEntries(recalculateBalances(selectedAccountId!, updatedEntries));
    toast({ title: "Entry Rejected", description: `Entry ${entryId} has been rejected.` });
  };

  const getStatusBadgeVariant = (status: LedgerEntryStatus) => {
    switch (status) {
      case "Approved": return "default"; // Default is often green-ish in themes or primary
      case "Pending": return "secondary"; // Yellow or Gray
      case "Rejected": return "destructive"; // Red
      default: return "outline";
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground">Ledger / Accounting</h1>
          <p className="text-muted-foreground">Track income, expenses, and balances for trucks, drivers, and parties.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => alert("Export to PDF (not implemented)")} disabled={!selectedAccountId || displayedEntries.length === 0}><FileText className="mr-2 h-4 w-4"/> Export PDF</Button>
            <Button variant="outline" onClick={() => alert("Print Ledger (not implemented)")} disabled={!selectedAccountId || displayedEntries.length === 0}><Printer className="mr-2 h-4 w-4"/> Print Ledger</Button>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <CardTitle className="font-headline text-xl">Ledger Statement</CardTitle>
                <CardDescription>
                    View statements and add manual entries. Transactions from Bilti/Delivery modules are (simulated as) auto-posted.
                </CardDescription>
            </div>
            <Dialog open={isManualEntryDialogOpen} onOpenChange={setIsManualEntryDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!selectedAccountId}><PlusCircle className="mr-2 h-4 w-4"/> Add Manual Entry</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Manual Ledger Entry</DialogTitle>
                  <DialogDescription>For account: <span className="font-semibold">{selectedAccount?.name || "N/A"}</span>. Submitted entries will be 'Pending' approval.</DialogDescription>
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
                        <Textarea id="manualDescription" name="description" value={manualEntryFormData.description} onChange={handleManualEntryChange} required rows={3} placeholder="Reason for entry, e.g., Cash deposit, Opening fuel expenses"/>
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
                        <Input id="manualRefNo" name="referenceNo" value={manualEntryFormData.referenceNo || ""} onChange={handleManualEntryChange} placeholder="e.g., Cheque No., Bilti No."/>
                    </div>
                    <div>
                        <Label htmlFor="manualTransactionType">Transaction Type</Label>
                        <Select value={manualEntryFormData.transactionType} onValueChange={handleManualEntryTypeChange as (value: string)=>void} required>
                            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Manual Credit">Manual Credit</SelectItem>
                                <SelectItem value="Manual Debit">Manual Debit</SelectItem>
                                <SelectItem value="Opening Balance">Opening Balance</SelectItem> {/* Note: Opening Balance might need special handling for approval if it sets base balance */}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter className="pt-4 border-t">
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">Submit for Approval</Button>
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
                    <CommandInput placeholder="Search account (Name, ID, PAN, Truck No)..." onValueChange={setAccountSearchTerm} value={accountSearchTerm}/>
                    <CommandEmpty>No account found.</CommandEmpty>
                    <CommandList>
                      <ScrollArea className="h-48">
                        {filteredAccounts.map((account) => (
                          <CommandItem
                            key={account.id}
                            value={`${account.name} ${account.id} ${account.type} ${account.panNo || ''} ${account.truckNo || ''}`}
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
                <Label>Current Balance (Approved)</Label>
                <Input value={selectedAccount ? selectedAccount.currentBalance.toFixed(2) : "N/A"} readOnly className="font-bold text-lg bg-muted" />
            </div>
          </div>

        </CardHeader>
        <CardContent>
          <div className="mb-4 p-4 border rounded-md bg-secondary/30">
            <h3 className="text-md font-semibold mb-2 flex items-center"><Filter className="mr-2 h-4 w-4"/>Filter Entries</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="filterType">Transaction Type</Label>
                <Select value={filterType} onValueChange={(value) => setFilterType(value as LedgerTransactionType | "All")}>
                  <SelectTrigger id="filterType"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Types</SelectItem>
                    {transactionTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filterStatus">Status</Label>
                <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as LedgerEntryStatus | "All")}>
                  <SelectTrigger id="filterStatus"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Statuses</SelectItem>
                    {entryStatuses.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
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
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedEntries.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center h-24">No ledger entries found for the selected account and filters.</TableCell></TableRow>
                  )}
                  {displayedEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{format(entry.miti, "PP")}</TableCell>
                      <TableCell className="max-w-xs truncate" title={entry.description}>
                        {entry.description}
                        {entry.approvalRemarks && <p className="text-xs text-muted-foreground italic">({entry.status} Remarks: {entry.approvalRemarks})</p>}
                      </TableCell>
                      <TableCell>{entry.referenceNo || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(entry.status)} 
                               className={cn(
                                   entry.status === "Approved" ? "bg-accent text-accent-foreground" : "",
                                   entry.status === "Pending" ? "bg-yellow-400 text-yellow-900" : ""
                               )}>
                          {entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{entry.debit > 0 ? entry.debit.toFixed(2) : "-"}</TableCell>
                      <TableCell className="text-right">{entry.credit > 0 ? entry.credit.toFixed(2) : "-"}</TableCell>
                      <TableCell className="text-right font-medium">{entry.status === "Approved" || entry.transactionType === "Opening Balance" ? entry.balance.toFixed(2) : "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                            <Button variant="link" size="sm" onClick={() => handleViewDetails(entry)} className="px-1">Details</Button>
                            {/* Conceptually, these buttons would only be visible/enabled for users with approval rights */}
                            {entry.status === "Pending" && (
                                <>
                                <Button variant="outline" size="sm" onClick={() => handleApproveEntry(entry.id)} className="px-1 text-green-600 border-green-600 hover:bg-green-100 hover:text-green-700">
                                    <CheckCircle2 className="mr-1 h-3 w-3"/>Approve
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleRejectEntry(entry.id)} className="px-1 text-red-600 border-red-600 hover:bg-red-100 hover:text-red-700">
                                    <XCircle className="mr-1 h-3 w-3"/>Reject
                                </Button>
                                </>
                            )}
                        </div>
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
            <p className="text-xs text-muted-foreground flex items-start gap-1">
                <BadgeAlert className="h-4 w-4 mt-0.5 text-orange-500 shrink-0"/>
                <span>This ledger is a frontend simulation. Automatic entries from Bilti/Delivery and balance calculations are representative. Full transactional integrity, audit trails, approval workflows, and real-time data require robust backend integration.</span>
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
