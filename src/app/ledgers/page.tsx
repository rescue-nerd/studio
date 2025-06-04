
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
import { CalendarIcon, Search, Filter, PlusCircle, ChevronsUpDown, Check, FileText, Printer, BadgeAlert, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { db, functions } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  getDocs,
  where,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { handleFirebaseError, logError } from "@/lib/firebase-error-handler";
import type { 
  LedgerAccount as FirestoreLedgerAccount, 
  LedgerEntry as FirestoreLedgerEntry, 
  LedgerTransactionType,
  CloudFunctionResponse,
  LedgerEntryCreateRequest,
  LedgerEntryUpdateStatusRequest
} from "@/types/firestore";
import { useAuth } from "@/contexts/auth-context"; // Import useAuth
import { useRouter } from "next/navigation"; // Import useRouter

const createManualLedgerEntryFn = httpsCallable<LedgerEntryCreateRequest, CloudFunctionResponse>(functions, 'createManualLedgerEntry');
const updateLedgerEntryStatusFn = httpsCallable<LedgerEntryUpdateStatusRequest, CloudFunctionResponse>(functions, 'updateLedgerEntryStatus');

type FirestoreLedgerEntryStatus = FirestoreLedgerEntry["status"];

interface LedgerAccount extends Omit<FirestoreLedgerAccount, 'createdAt' | 'updatedAt' | 'lastTransactionAt'> {
  createdAt: Date;
  updatedAt?: Date;
  lastTransactionAt?: Date;
}
interface LedgerEntry extends Omit<FirestoreLedgerEntry, 'miti' | 'createdAt' | 'approvedAt' | 'createdBy' | 'approvedBy'> {
  miti: Date;
  createdAt: Date;
  approvedAt?: Date;
  createdBy?: string;
  approvedBy?: string;
}

const transactionTypesForFilter: LedgerTransactionType[] = ["Bilti", "Delivery", "Rebate", "Discount", "Manual Credit", "Manual Debit", "Opening Balance", "Payment", "Receipt", "Expense", "Fuel", "Maintenance"];
const entryStatusesForFilter: FirestoreLedgerEntryStatus[] = ["Pending", "Approved", "Rejected"];

const defaultManualEntryFormData: Omit<LedgerEntry, 'id' | 'balanceAfterTransaction' | 'accountId' | 'status' | 'approvalRemarks' | 'approvedBy' | 'approvedAt' | 'sourceModule' | 'branchId' | 'createdBy' | 'createdAt'> = {
  miti: new Date(),
  description: "",
  debit: 0,
  credit: 0,
  referenceNo: "",
  transactionType: "Manual Credit" as LedgerTransactionType,
};


export default function LedgersPage() {
  const [allLedgerAccounts, setAllLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [allLedgerEntries, setAllLedgerEntries] = useState<LedgerEntry[]>([]);
  
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accountSearchTerm, setAccountSearchTerm] = useState("");
  const [isAccountSelectOpen, setIsAccountSelectOpen] = useState(false);

  const [filterType, setFilterType] = useState<LedgerTransactionType | "All">("All");
  const [filterStatus, setFilterStatus] = useState<FirestoreLedgerEntryStatus | "All">("All");
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);

  const [isManualEntryDialogOpen, setIsManualEntryDialogOpen] = useState(false);
  const [manualEntryFormData, setManualEntryFormData] = useState(defaultManualEntryFormData);

  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isSubmittingManualEntry, setIsSubmittingManualEntry] = useState(false);
  const [isUpdatingEntryStatus, setIsUpdatingEntryStatus] = useState<string | null>(null); 

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authUser, authLoading, router]);

  const fetchLedgerAccounts = async () => {
    if(!authUser) return;
    setIsLoadingAccounts(true);
    try {
      const q = query(collection(db, "ledgerAccounts"), orderBy("accountName"));
      const querySnapshot = await getDocs(q);
      const fetchedAccounts = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data() as FirestoreLedgerAccount;
        return {
          ...data,
          id: docSnap.id,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          lastTransactionAt: data.lastTransactionAt?.toDate(),
        } as LedgerAccount;
      });
      setAllLedgerAccounts(fetchedAccounts);
    } catch (error) {
      console.error("Error fetching ledger accounts:", error);
      toast({ title: "Error", description: "Failed to fetch ledger accounts.", variant: "destructive"});
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const fetchLedgerEntries = async (accountId: string) => {
    if (!accountId || !authUser) return;
    setIsLoadingEntries(true);
    try {
      const q = query(collection(db, "ledgerEntries"), where("accountId", "==", accountId), orderBy("miti", "asc"), orderBy("createdAt", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedEntries = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data() as FirestoreLedgerEntry;
        return {
          ...data,
          id: docSnap.id,
          miti: data.miti.toDate(),
          createdAt: data.createdAt.toDate(),
          approvedAt: data.approvedAt?.toDate(),
        } as LedgerEntry;
      });
      setAllLedgerEntries(prev => {
        const otherAccountEntries = prev.filter(e => e.accountId !== accountId);
        return [...otherAccountEntries, ...fetchedEntries];
      });
    } catch (error) {
      console.error(`Error fetching entries for account ${accountId}:`, error);
      toast({ title: "Error", description: `Failed to fetch entries for account ${accountId}.`, variant: "destructive"});
    } finally {
      setIsLoadingEntries(false);
    }
  };
  
  useEffect(() => {
    if (authUser) {
      fetchLedgerAccounts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  useEffect(() => {
    if (selectedAccountId && authUser) {
      fetchLedgerEntries(selectedAccountId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, authUser]);


  const selectedAccountDetails = useMemo(() => {
    return allLedgerAccounts.find(acc => acc.id === selectedAccountId);
  }, [selectedAccountId, allLedgerAccounts]);


  const processedAndFilteredEntries = useMemo(() => {
    if (!selectedAccountId) return [];

    const accountEntries = allLedgerEntries.filter(entry => entry.accountId === selectedAccountId);
    
    const filtered = accountEntries
      .filter(entry => filterType === "All" || entry.transactionType === filterType)
      .filter(entry => filterStatus === "All" || entry.status === filterStatus)
      .filter(entry => !filterStartDate || entry.miti >= startOfDay(filterStartDate))
      .filter(entry => !filterEndDate || entry.miti <= endOfDay(filterEndDate));

    const sortedForBalance = [...filtered].sort((a, b) => {
        const dateComparison = a.miti.getTime() - b.miti.getTime();
        if (dateComparison !== 0) return dateComparison;
        if (a.transactionType === "Opening Balance") return -1;
        if (b.transactionType === "Opening Balance") return 1;
        const createdAtComparison = (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
        if (createdAtComparison !== 0) return createdAtComparison;
        if (a.status === "Approved" && b.status !== "Approved") return -1;
        if (a.status !== "Approved" && b.status === "Approved") return 1;
        return a.id.localeCompare(b.id);
    });

    let runningBalance = 0;
    const entriesWithBalance = sortedForBalance.map(entry => {
      let balanceAfterThisEntry = runningBalance; 
      if (entry.status === "Approved" || entry.transactionType === "Opening Balance") {
         if (entry.transactionType === "Opening Balance") {
            runningBalance = entry.credit - entry.debit;
         } else {
            runningBalance += entry.credit - entry.debit;
         }
         balanceAfterThisEntry = runningBalance;
      }
      return { ...entry, balanceAfterTransaction: balanceAfterThisEntry };
    });

    return entriesWithBalance.sort((a, b) => {
        const dateComparison = b.miti.getTime() - a.miti.getTime();
        if (dateComparison !== 0) return dateComparison;
        return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0) || b.id.localeCompare(a.id);
    });

  }, [selectedAccountId, allLedgerEntries, filterType, filterStatus, filterStartDate, filterEndDate]);


  const currentAccountBalance = useMemo(() => {
    if (!selectedAccountId) return 0;
    const approvedEntries = allLedgerEntries
        .filter(e => e.accountId === selectedAccountId && (e.status === "Approved" || e.transactionType === "Opening Balance"))
        .sort((a, b) => {
            const dateComparison = a.miti.getTime() - b.miti.getTime();
            if (dateComparison !== 0) return dateComparison;
            if (a.transactionType === "Opening Balance") return -1;
            if (b.transactionType === "Opening Balance") return 1;
            const createdAtComparison = (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
            if (createdAtComparison !== 0) return createdAtComparison;
            return a.id.localeCompare(b.id);
        });

    let runningBalance = 0;
    approvedEntries.forEach(entry => {
        if (entry.transactionType === "Opening Balance") {
            runningBalance = entry.credit - entry.debit;
        } else {
            runningBalance += entry.credit - entry.debit;
        }
    });
    return runningBalance;
  }, [selectedAccountId, allLedgerEntries]);


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
    if (date) setManualEntryFormData(prev => ({ ...prev, miti: date }));
  };
  
  const handleManualEntryTypeChange = (value: LedgerTransactionType) => {
    setManualEntryFormData(prev => ({...prev, transactionType: value}));
  };

  const handleManualEntrySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive"});
      return;
    }
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
    setIsSubmittingManualEntry(true);
    
    const entryPayload: LedgerEntryCreateRequest = {
      accountId: selectedAccountId,
      miti: manualEntryFormData.miti.toISOString(),
      nepaliMiti: manualEntryFormData.nepaliMiti || "", 
      description: manualEntryFormData.description,
      debit: manualEntryFormData.debit,
      credit: manualEntryFormData.credit,
      referenceNo: manualEntryFormData.referenceNo || "",
      transactionType: manualEntryFormData.transactionType,
    };

    try {
        const result = await createManualLedgerEntryFn(entryPayload);
        if (result.data.success) {
            // Refresh entries for the selected account
            await fetchLedgerEntries(selectedAccountId);
            toast({ title: "Manual Entry Submitted", description: result.data.message });
            setIsManualEntryDialogOpen(false);
            setManualEntryFormData({...defaultManualEntryFormData, miti: new Date()}); 
        } else {
            toast({ title: "Submission Failed", description: result.data.message || "Failed to submit manual entry.", variant: "destructive"});
        }
    } catch (error: any) {
        console.error("Error submitting manual entry:", error);
        toast({ title: "Error", description: error.message || "Failed to submit manual entry.", variant: "destructive"});
    } finally {
        setIsSubmittingManualEntry(false);
    }
  };
  
  const filteredAccountsForSelect = allLedgerAccounts.filter(acc => 
    acc.accountName.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
    acc.id.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
    (acc.panNo && acc.panNo.toLowerCase().includes(accountSearchTerm.toLowerCase())) ||
    (acc.truckNo && acc.truckNo.toLowerCase().includes(accountSearchTerm.toLowerCase()))
  );

  const handleViewDetails = (entry: LedgerEntry) => {
    alert(`Entry ID: ${entry.id}\nAccount: ${selectedAccountDetails?.accountName}\nMiti: ${format(entry.miti, "PP")}\nDescription: ${entry.description}\nRef: ${entry.referenceNo || 'N/A'}\nType: ${entry.transactionType}\nStatus: ${entry.status}\n${entry.approvalRemarks ? `Remarks: ${entry.approvalRemarks}\n` : ""}Created: ${entry.createdAt ? format(entry.createdAt, 'Pp') : 'N/A'} by ${entry.createdBy || 'N/A'}`);
  };

  const handleUpdateEntryStatus = async (entryId: string, newStatus: "Approved" | "Rejected", remarks?: string) => {
    if (!selectedAccountId || !authUser) return;
    setIsUpdatingEntryStatus(entryId);
    
    const updatePayload: LedgerEntryUpdateStatusRequest = {
      entryId,
      status: newStatus,
      approvalRemarks: remarks,
    };

    try {
        const result = await updateLedgerEntryStatusFn(updatePayload);
        if (result.data.success) {
            // Refresh entries for the selected account to get the updated data
            await fetchLedgerEntries(selectedAccountId);
            toast({ title: `Entry ${newStatus}`, description: result.data.message });
        } else {
            toast({ title: "Update Failed", description: result.data.message || "Failed to update entry status.", variant: "destructive"});
        }
    } catch (error: any) {
        console.error(`Error updating entry ${entryId} to ${newStatus}:`, error);
        toast({ title: "Error", description: error.message || "Failed to update entry status.", variant: "destructive"});
    } finally {
        setIsUpdatingEntryStatus(null);
    }
  };

  const handleApproveEntry = (entryId: string) => {
    handleUpdateEntryStatus(entryId, "Approved");
  };

  const handleRejectEntry = (entryId: string) => {
    const remarks = window.prompt("Enter rejection remarks (optional):");
    handleUpdateEntryStatus(entryId, "Rejected", remarks || undefined);
  };

  const getStatusBadgeVariant = (status: FirestoreLedgerEntryStatus) => {
    switch (status) {
      case "Approved": return "default"; 
      case "Pending": return "secondary"; 
      case "Rejected": return "destructive";
      default: return "outline";
    }
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground">Ledger / Accounting</h1>
          <p className="text-muted-foreground">Track income, expenses, and balances for trucks, drivers, and parties.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => alert("Export to PDF (not implemented)")} disabled={!selectedAccountId || processedAndFilteredEntries.length === 0}><FileText className="mr-2 h-4 w-4"/> Export PDF</Button>
            <Button variant="outline" onClick={() => alert("Print Ledger (not implemented)")} disabled={!selectedAccountId || processedAndFilteredEntries.length === 0}><Printer className="mr-2 h-4 w-4"/> Print Ledger</Button>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <CardTitle className="font-headline text-xl">Ledger Statement</CardTitle>
                <CardDescription>
                    View statements and add manual entries.
                </CardDescription>
            </div>
            <Dialog open={isManualEntryDialogOpen} onOpenChange={setIsManualEntryDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!selectedAccountId || isSubmittingManualEntry}><PlusCircle className="mr-2 h-4 w-4"/> Add Manual Entry</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Manual Ledger Entry</DialogTitle>
                  <DialogDescription>For account: <span className="font-semibold">{selectedAccountDetails?.accountName || "N/A"}</span>. Submitted entries will be 'Pending' approval.</DialogDescription>
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
                        <Label htmlFor="manualNepaliMiti">Nepali Miti (Optional)</Label>
                        <Input id="manualNepaliMiti" name="nepaliMiti" value={manualEntryFormData.nepaliMiti || ""} onChange={handleManualEntryChange} placeholder="e.g., 2081-04-15"/>
                    </div>
                    <div>
                        <Label htmlFor="manualDescription">Description / Memo <span className="text-destructive">*</span></Label>
                        <Textarea id="manualDescription" name="description" value={manualEntryFormData.description} onChange={handleManualEntryChange} required rows={3} placeholder="Reason for entry, e.g., Cash deposit"/>
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
                                <SelectItem value="Opening Balance">Opening Balance</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter className="pt-4 border-t">
                        <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingManualEntry}>Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isSubmittingManualEntry}>
                            {isSubmittingManualEntry && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit for Approval
                        </Button>
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
                  <Button variant="outline" role="combobox" aria-expanded={isAccountSelectOpen} className="w-full justify-between" disabled={isLoadingAccounts}>
                    {isLoadingAccounts ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading Accounts...</> : selectedAccountDetails ? `${selectedAccountDetails.accountName} (${selectedAccountDetails.accountType})` : "Select account..."}
                    {!isLoadingAccounts && <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search account (Name, ID, PAN, Truck No)..." onValueChange={setAccountSearchTerm} value={accountSearchTerm}/>
                    <CommandEmpty>No account found.</CommandEmpty>
                    <CommandList>
                      <ScrollArea className="h-48">
                        {filteredAccountsForSelect.map((account) => (
                          <CommandItem
                            key={account.id}
                            value={`${account.accountName} ${account.id} ${account.accountType} ${account.panNo || ''} ${account.truckNo || ''}`}
                            onSelect={() => handleAccountSelect(account.id)}
                            className="cursor-pointer"
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedAccountId === account.id ? "opacity-100" : "opacity-0")}/>
                            {account.accountName} ({account.accountType}) - {account.id}
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
                <Input value={selectedAccountDetails ? currentAccountBalance.toFixed(2) : "N/A"} readOnly className="font-bold text-lg bg-muted" />
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
                    {transactionTypesForFilter.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filterStatus">Status</Label>
                <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as FirestoreLedgerEntryStatus | "All")}>
                  <SelectTrigger id="filterStatus"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Statuses</SelectItem>
                    {entryStatusesForFilter.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
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

          {isLoadingEntries && <div className="flex justify-center items-center h-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading entries...</p></div>}
          
          {!isLoadingEntries && selectedAccountId ? (
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
                  {processedAndFilteredEntries.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center h-24">No ledger entries found for the selected account and filters.</TableCell></TableRow>
                  )}
                  {processedAndFilteredEntries.map((entry) => (
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
                      <TableCell className="text-right font-medium">
                        {(entry.status === "Approved" || entry.transactionType === "Opening Balance") ? entry.balanceAfterTransaction?.toFixed(2) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 items-center">
                            <Button variant="link" size="sm" onClick={() => handleViewDetails(entry)} className="px-1 h-auto py-0">Details</Button>
                            {entry.status === "Pending" && (
                                <>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handleApproveEntry(entry.id)} 
                                    className="px-1 text-green-600 border-green-600 hover:bg-green-100 hover:text-green-700 h-auto py-0.5"
                                    disabled={isUpdatingEntryStatus === entry.id}
                                >
                                    {isUpdatingEntryStatus === entry.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <CheckCircle2 className="mr-1 h-3 w-3"/>}Approve
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handleRejectEntry(entry.id)} 
                                    className="px-1 text-red-600 border-red-600 hover:bg-red-100 hover:text-red-700 h-auto py-0.5"
                                    disabled={isUpdatingEntryStatus === entry.id}
                                >
                                     {isUpdatingEntryStatus === entry.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <XCircle className="mr-1 h-3 w-3"/>}Reject
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
            !isLoadingEntries && <div className="text-center py-10 text-muted-foreground">
              <p>Please select a ledger account to view its statement.</p>
            </div>
          )}
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground flex items-start gap-1">
                <BadgeAlert className="h-4 w-4 mt-0.5 text-orange-500 shrink-0"/>
                <span>
                    Balances are calculated client-side based on fetched and filtered entries. 
                    The 'Current Balance' at the top reflects the sum of all approved entries and opening balances for the selected account.
                    Persistent, authoritative balance updates ideally require backend processing.
                </span>
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
