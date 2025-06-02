
"use client";

import { useState, useEffect, useMemo, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

import { BookOpenCheck, CalendarIcon, PlusCircle, Edit, Trash2, Filter, AlertTriangle, CheckCircle2, XCircle, Loader2, ChevronsUpDown, Check as CheckIcon } from "lucide-react";
import { format, parse, isValid, addDays, subDays } from "date-fns"; // Added addDays, subDays
import { enUS } from "date-fns/locale"; // For consistent date parsing if needed

import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  Timestamp,
  deleteDoc,
  writeBatch,
  serverTimestamp, // Re-added for potential future use if directly setting timestamps
  type DocumentSnapshot
} from "firebase/firestore";

import {
  type Daybook as FirestoreDaybook,
  type DaybookTransaction as FirestoreDaybookTransaction,
  type DaybookTransactionType,
  type Branch as FirestoreBranch,
  type Bilti as FirestoreBilti,
  type Party as FirestoreParty,
  type LedgerAccount as FirestoreLedgerAccount,
} from "@/types/firestore";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Interfaces matching Firestore structure but with Date objects for UI
interface Daybook extends Omit<FirestoreDaybook, 'englishMiti' | 'createdAt' | 'updatedAt' | 'submittedAt' | 'approvedAt' | 'transactions'> {
  englishMiti: Date;
  transactions: DaybookTransaction[]; // UI version of transactions
  createdAt?: Date;
  updatedAt?: Date;
  submittedAt?: Date;
  approvedAt?: Date;
}

interface DaybookTransaction extends Omit<FirestoreDaybookTransaction, 'createdAt'> {
  createdAt?: Date; // For UI display
}

interface Branch extends FirestoreBranch {}
interface Bilti extends Omit<FirestoreBilti, 'miti' | 'createdAt' | 'updatedAt'> {
  id: string;
  miti: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
interface Party extends FirestoreParty {}
interface LedgerAccount extends Omit<FirestoreLedgerAccount, 'createdAt' | 'updatedAt' | 'lastTransactionAt'> {
   createdAt?: Date; // Making these optional to align if not always present
   updatedAt?: Date;
   lastTransactionAt?: Date;
}


const PLACEHOLDER_USER_ID = "system_user_placeholder"; // Replace with actual auth
const SIMULATED_SUPER_ADMIN_ID = "super_admin_placeholder"; // For UI simulation

// Default Nepali Miti for today (simplified for client-side)
const getTodayNepaliMiti = () => {
  // This is a placeholder. In a real app, use a library or server-side logic.
  const today = new Date();
  return format(today, "yyyy-MM-dd"); // Using Gregorian for simulation
};


export default function DaybookPage() {
  const { toast } = useToast();

  // --- Component State ---
  const [activeDaybook, setActiveDaybook] = useState<Daybook | null>(null);
  const [daybooksList, setDaybooksList] = useState<Daybook[]>([]); // For admin view of multiple daybooks

  // Master Data
  const [branches, setBranches] = useState<Branch[]>([]);
  const [biltisForSelection, setBiltisForSelection] = useState<Bilti[]>([]);
  const [allBiltisMaster, setAllBiltisMaster] = useState<Bilti[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);

  // Filters
  const [filterNepaliMiti, setFilterNepaliMiti] = useState<string>(getTodayNepaliMiti());
  const [filterBranchId, setFilterBranchId] = useState<string>("");

  // UI Control States
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingDaybook, setIsSubmittingDaybook] = useState(false);
  const [isApprovingDaybook, setIsApprovingDaybook] = useState(false);
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [isViewSupportingDocOpen, setIsViewSupportingDocOpen] = useState(false);
  const [docToViewUrl, setDocToViewUrl] = useState<string | null>(null);
  
  const [editingTransaction, setEditingTransaction] = useState<DaybookTransaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<DaybookTransaction | null>(null);
  const [isDeleteTransactionAlertOpen, setIsDeleteTransactionAlertOpen] = useState(false);

  // Simulated user role
  const [isSuperAdmin, setIsSuperAdmin] = useState(false); // Simulate role for UI controls

  const initialTransactionFormData: Omit<DaybookTransaction, 'id' | 'createdAt' | 'createdBy' | 'autoLinked'> = {
    transactionType: "Cash In (Other)",
    amount: 0,
    description: "",
  };
  const [transactionFormData, setTransactionFormData] = useState(initialTransactionFormData);
  const [selectedBiltiForTx, setSelectedBiltiForTx] = useState<Bilti | null>(null);
  const [isBiltiSelectOpen, setIsBiltiSelectOpen] = useState(false);


  // --- Data Fetching ---
  const fetchMasterData = async () => {
    // setIsLoading(true) // Combined loading state
    try {
      const [branchesSnap, biltisSnap, partiesSnap, ledgersSnap] = await Promise.all([
        getDocs(query(collection(db, "branches"), orderBy("name"))),
        getDocs(collection(db, "biltis")), // Fetch all, filter client-side for now
        getDocs(query(collection(db, "parties"), orderBy("name"))),
        getDocs(query(collection(db, "ledgerAccounts"), orderBy("accountName"))),
      ]);

      const fetchedBranches = branchesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Branch));
      setBranches(fetchedBranches);
      if (fetchedBranches.length > 0 && !filterBranchId) {
        setFilterBranchId(fetchedBranches[0].id); // Default to first branch
      }
      
      const allFetchedBiltis = biltisSnap.docs.map(d => {
        const data = d.data() as FirestoreBilti;
        return { ...data, id: d.id, miti: data.miti.toDate() } as Bilti;
      });
      setAllBiltisMaster(allFetchedBiltis);

      setParties(partiesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Party)));
      setLedgerAccounts(ledgersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as LedgerAccount)));

    } catch (error) {
      console.error("Error fetching master data:", error);
      toast({ title: "Error", description: "Failed to load master data. Some selections may be unavailable.", variant: "destructive" });
    }
    // setIsLoading(false);
  };

  const fetchDaybooksList = async (branchId?: string, nepaliMiti?: string) => {
    // This function would be for an admin view, not typically needed for daily branch operation.
    // For now, it's a placeholder if we want to list multiple daybooks.
    // The primary function is loadOrCreateActiveDaybook.
  };

  const loadOrCreateActiveDaybook = async () => {
    if (!filterBranchId || !filterNepaliMiti) {
      setActiveDaybook(null);
      return;
    }
    setIsLoading(true);
    try {
      const daybookQuery = query(
        collection(db, "daybooks"),
        where("branchId", "==", filterBranchId),
        where("nepaliMiti", "==", filterNepaliMiti)
      );
      const querySnapshot = await getDocs(daybookQuery);

      if (!querySnapshot.empty) {
        const daybookDoc = querySnapshot.docs[0];
        const data = daybookDoc.data() as FirestoreDaybook;
        setActiveDaybook({
          ...data,
          id: daybookDoc.id,
          englishMiti: data.englishMiti.toDate(),
          transactions: (data.transactions || []).map(tx => ({
            ...tx,
            createdAt: tx.createdAt?.toDate(),
          })),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          submittedAt: data.submittedAt?.toDate(),
          approvedAt: data.approvedAt?.toDate(),
        });
      } else {
        // No daybook exists, user will create one by adding the first transaction
        setActiveDaybook(null); 
      }
    } catch (error) {
      console.error("Error loading daybook:", error);
      toast({ title: "Error", description: "Failed to load daybook data for the selected date/branch.", variant: "destructive" });
      setActiveDaybook(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchMasterData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Initial master data fetch

  useEffect(() => {
    if (filterBranchId && filterNepaliMiti) {
      loadOrCreateActiveDaybook();
    } else {
      setActiveDaybook(null); // Clear active daybook if filters are incomplete
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId, filterNepaliMiti]);


  // --- Helper Functions ---
  const getBranchNameById = (id: string) => branches.find(b => b.id === id)?.name || "N/A";
  const getPartyNameById = (id?: string) => parties.find(p => p.id === id)?.name || "N/A";
  const getLedgerAccountNameById = (id?: string) => ledgerAccounts.find(la => la.id === id)?.accountName || "N/A";
  const getBiltiDetailsById = (id?: string) => allBiltisMaster.find(b => b.id === id);

  // --- Memos for Calculations ---
  const daybookSummary = useMemo(() => {
    if (!activeDaybook) return { cashIn: {}, cashOut: {}, netCashIn: 0, netCashOut: 0, closingBalance: 0, openingBalance: 0 };

    const cashInByType: Record<string, number> = {};
    const cashOutByType: Record<string, number> = {};
    let netCashIn = 0;
    let netCashOut = 0;

    (activeDaybook.transactions || []).forEach(tx => {
      if (tx.transactionType.toLowerCase().includes("cash in")) {
        netCashIn += tx.amount;
        cashInByType[tx.transactionType] = (cashInByType[tx.transactionType] || 0) + tx.amount;
      } else if (tx.transactionType.toLowerCase().includes("cash out")) {
        netCashOut += tx.amount;
        cashOutByType[tx.transactionType] = (cashOutByType[tx.transactionType] || 0) + tx.amount;
      } else if (tx.transactionType === "Adjustment/Correction") {
        // Handle adjustments: assume positive amount is cash in, negative is cash out
        if (tx.amount >= 0) {
            netCashIn += tx.amount;
            cashInByType[tx.transactionType] = (cashInByType[tx.transactionType] || 0) + tx.amount;
        } else {
            netCashOut += Math.abs(tx.amount);
            cashOutByType[tx.transactionType] = (cashOutByType[tx.transactionType] || 0) + Math.abs(tx.amount);
        }
      }
    });
    const openingBalance = activeDaybook.openingBalance || 0;
    const closingBalance = openingBalance + netCashIn - netCashOut;
    return { cashIn: cashInByType, cashOut: cashOutByType, netCashIn, netCashOut, closingBalance, openingBalance };
  }, [activeDaybook]);


  // --- Event Handlers (Placeholders, to be filled in next steps) ---
  const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFilterNepaliMiti(e.target.value);
  };

  const handleBranchChange = (value: string) => {
    setFilterBranchId(value);
  };

  const handleLoadToday = () => {
    setFilterNepaliMiti(getTodayNepaliMiti());
    if (branches.length > 0 && !branches.find(b => b.id === filterBranchId)) {
      setFilterBranchId(branches[0].id); // Default to first branch if current is invalid or not set
    }
    // loadOrCreateActiveDaybook will be triggered by useEffect
  };
  
  // More handlers will be added in subsequent steps

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center">
          <BookOpenCheck className="mr-3 h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-foreground">Daily Cash Book (Daybook)</h1>
            <p className="text-muted-foreground">Manage daily cash transactions, submissions, and approvals.</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
            {/* Add New Transaction Button will go here */}
            <Button variant="outline" onClick={() => alert("Print Daybook (Not Implemented)")} disabled={!activeDaybook}>Print</Button>
        </div>
      </div>

      {/* Filters Section */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Select Daybook</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label htmlFor="filterBranch">Branch</Label>
            <Select value={filterBranchId} onValueChange={handleBranchChange} disabled={isLoading || branches.length === 0}>
              <SelectTrigger id="filterBranch">
                <SelectValue placeholder={isLoading ? "Loading branches..." : (branches.length === 0 ? "No branches found" : "Select Branch")} />
              </SelectTrigger>
              <SelectContent>
                {branches.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="filterNepaliMiti">Nepali Miti (YYYY-MM-DD)</Label>
            <Input 
              id="filterNepaliMiti" 
              value={filterNepaliMiti} 
              onChange={handleDateChange} 
              placeholder="Enter Nepali date"
              disabled={isLoading}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={loadOrCreateActiveDaybook} disabled={isLoading || !filterBranchId || !filterNepaliMiti}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Load Daybook
            </Button>
            <Button onClick={handleLoadToday} variant="outline" disabled={isLoading}>Load Today&apos;s</Button>
          </div>
        </CardContent>
      </Card>

      {/* Daybook Summary and Status */}
      {isLoading && !activeDaybook && (
        <div className="flex justify-center items-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Loading daybook...</p>
        </div>
      )}

      {!isLoading && filterBranchId && filterNepaliMiti && !activeDaybook && (
         <Card className="shadow-lg border-dashed border-primary/50">
          <CardHeader>
            <CardTitle className="font-headline text-xl flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500"/>
                Daybook Not Created Yet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              No Daybook entry exists for branch <span className="font-semibold">{getBranchNameById(filterBranchId)}</span> on Miti <span className="font-semibold">{filterNepaliMiti}</span>.
            </p>
            <p className="text-muted-foreground mt-1">
              The Daybook will be automatically created when you add the first transaction.
            </p>
          </CardContent>
          <CardFooter>
             {/* Add New Transaction Button will also be prominent here */}
          </CardFooter>
        </Card>
      )}

      {activeDaybook && (
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start">
                <div>
                    <CardTitle className="font-headline text-xl">
                        Daybook for: {getBranchNameById(activeDaybook.branchId)} - {activeDaybook.nepaliMiti}
                    </CardTitle>
                    <CardDescription>
                        English Date: {format(activeDaybook.englishMiti, "PPP")}
                    </CardDescription>
                </div>
                <Badge 
                    variant={
                        activeDaybook.status === "Approved" ? "default" : 
                        activeDaybook.status === "Rejected" ? "destructive" : 
                        activeDaybook.status === "Pending Approval" ? "secondary" : "outline"
                    } 
                    className={cn("text-sm mt-2 sm:mt-0", activeDaybook.status === "Approved" ? "bg-accent text-accent-foreground" : "")}
                >
                    Status: {activeDaybook.status}
                </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="p-3 rounded-md bg-secondary/50">
              <p className="text-sm text-muted-foreground">Opening Balance</p>
              <p className="text-lg font-semibold">Rs. {daybookSummary.openingBalance.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-md bg-green-100 dark:bg-green-900/30">
              <p className="text-sm text-green-700 dark:text-green-300">Total Cash In</p>
              <p className="text-lg font-semibold text-green-800 dark:text-green-200">Rs. {daybookSummary.netCashIn.toFixed(2)}</p>
              {Object.entries(daybookSummary.cashIn).map(([type, amount]) => (
                <p key={type} className="text-xs text-muted-foreground">{type}: {amount.toFixed(2)}</p>
              ))}
            </div>
            <div className="p-3 rounded-md bg-red-100 dark:bg-red-900/30">
              <p className="text-sm text-red-700 dark:text-red-300">Total Cash Out</p>
              <p className="text-lg font-semibold text-red-800 dark:text-red-200">Rs. {daybookSummary.netCashOut.toFixed(2)}</p>
               {Object.entries(daybookSummary.cashOut).map(([type, amount]) => (
                <p key={type} className="text-xs text-muted-foreground">{type}: {Math.abs(amount).toFixed(2)}</p>
              ))}
            </div>
            <div className="p-3 rounded-md bg-primary/10">
              <p className="text-sm text-primary">Calculated Closing Balance</p>
              <p className="text-lg font-bold text-primary">Rs. {daybookSummary.closingBalance.toFixed(2)}</p>
            </div>
          </CardContent>

          {/* Transaction Table Placeholder */}
          <CardContent>
            <h3 className="text-lg font-semibold mb-2">Transactions</h3>
            <div className="border rounded-md p-6 min-h-[100px] flex items-center justify-center bg-muted/30">
                <p className="text-muted-foreground">Transaction table and forms will be added next.</p>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
             {/* Action Buttons Placeholder */}
             <p className="text-xs text-muted-foreground">Submission and approval buttons will appear here.</p>
          </CardFooter>
        </Card>
      )}

      {/* Transaction Form Dialog Placeholder */}
      {/* Delete Confirmation Dialog Placeholder */}

    </div>
  );
}

    