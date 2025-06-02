
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
import { format, parse, isValid, addDays, subDays } from "date-fns";
import { enUS } from "date-fns/locale";

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
} from "firebase/firestore";

import type {
  Daybook as FirestoreDaybook,
  DaybookTransaction as FirestoreDaybookTransaction,
  DaybookTransactionType,
  Branch as FirestoreBranch,
  Bilti as FirestoreBilti,
  Party as FirestoreParty,
  LedgerAccount as FirestoreLedgerAccount,
} from "@/types/firestore";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Interfaces matching Firestore structure but with Date objects for UI
interface Daybook extends Omit<FirestoreDaybook, 'englishMiti' | 'createdAt' | 'updatedAt' | 'submittedAt' | 'approvedAt' | 'transactions'> {
  id: string; // Explicitly add id for UI Daybook object
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

interface Branch extends FirestoreBranch {
    id: string; // Ensure Branch has an id for selection
}
interface Bilti extends Omit<FirestoreBilti, 'miti' | 'createdAt' | 'updatedAt'> {
  id: string;
  miti: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
interface Party extends FirestoreParty {
    id: string; // Ensure Party has an id for selection
}
interface LedgerAccount extends Omit<FirestoreLedgerAccount, 'createdAt' | 'updatedAt' | 'lastTransactionAt'> {
   id: string; // Ensure LedgerAccount has an id for selection
   createdAt?: Date;
   updatedAt?: Date;
   lastTransactionAt?: Date;
}


const PLACEHOLDER_USER_ID = "system_user_placeholder";
const SIMULATED_SUPER_ADMIN_ID = "super_admin_placeholder";

const getTodayNepaliMiti = () => {
  const today = new Date();
  return format(today, "yyyy-MM-dd");
};


export default function DaybookPage() {
  const { toast } = useToast();

  const [activeDaybook, setActiveDaybook] = useState<Daybook | null>(null);
  const [daybooksList, setDaybooksList] = useState<Daybook[]>([]);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [biltisForSelection, setBiltisForSelection] = useState<Bilti[]>([]);
  const [allBiltisMaster, setAllBiltisMaster] = useState<Bilti[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);

  const [filterNepaliMiti, setFilterNepaliMiti] = useState<string>(getTodayNepaliMiti());
  const [filterBranchId, setFilterBranchId] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingDaybook, setIsSubmittingDaybook] = useState(false);
  const [isApprovingDaybook, setIsApprovingDaybook] = useState(false);
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [isViewSupportingDocOpen, setIsViewSupportingDocOpen] = useState(false);
  const [docToViewUrl, setDocToViewUrl] = useState<string | null>(null);
  
  const [editingTransaction, setEditingTransaction] = useState<DaybookTransaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<DaybookTransaction | null>(null);
  const [isDeleteTransactionAlertOpen, setIsDeleteTransactionAlertOpen] = useState(false);

  const [isSuperAdmin, setIsSuperAdmin] = useState(false); // Simulate role for UI controls

  const initialTransactionFormData: Omit<DaybookTransaction, 'id' | 'createdAt' | 'createdBy' | 'autoLinked'> = {
    transactionType: "Cash In (Other)",
    amount: 0,
    description: "",
  };
  const [transactionFormData, setTransactionFormData] = useState(initialTransactionFormData);
  const [selectedBiltiForTx, setSelectedBiltiForTx] = useState<Bilti | null>(null);
  const [isBiltiSelectOpen, setIsBiltiSelectOpen] = useState(false);


  const fetchMasterData = async () => {
    try {
      const [branchesSnap, biltisSnap, partiesSnap, ledgersSnap] = await Promise.all([
        getDocs(query(collection(db, "branches"), orderBy("name"))),
        getDocs(collection(db, "biltis")),
        getDocs(query(collection(db, "parties"), orderBy("name"))),
        getDocs(query(collection(db, "ledgerAccounts"), orderBy("accountName"))),
      ]);

      const fetchedBranches = branchesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Branch));
      setBranches(fetchedBranches);
      if (fetchedBranches.length > 0 && !filterBranchId) {
        setFilterBranchId(fetchedBranches[0].id);
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
      toast({ title: "Error", description: "Failed to load master data.", variant: "destructive" });
    }
  };

  const fetchDaybooksList = async () => {
    // This is more for an admin view, not primarily used by the main DaybookPage logic directly
    // For now, it's a placeholder.
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
        setActiveDaybook(null); 
      }
    } catch (error) {
      console.error("Error loading daybook:", error);
      toast({ title: "Error", description: "Failed to load daybook data.", variant: "destructive" });
      setActiveDaybook(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchMasterData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (filterBranchId && filterNepaliMiti) {
      loadOrCreateActiveDaybook();
    } else {
      setActiveDaybook(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId, filterNepaliMiti]);


  const getBranchNameById = (id: string) => branches.find(b => b.id === id)?.name || "N/A";
  const getPartyNameById = (id?: string) => parties.find(p => p.id === id)?.name || "N/A";
  const getLedgerAccountNameById = (id?: string) => ledgerAccounts.find(la => la.id === id)?.accountName || "N/A";
  const getBiltiDetailsById = (id?: string) => allBiltisMaster.find(b => b.id === id);


  const daybookSummary = useMemo(() => {
    if (!activeDaybook) return { 
        cashInByType: {}, 
        cashOutByType: {}, 
        netCashIn: 0, 
        netCashOut: 0, 
        closingBalance: 0, 
        openingBalance: 0,
        transactionsCount: 0
    };

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
        if (tx.amount >= 0) { // Positive adjustment is cash in
            netCashIn += tx.amount;
            cashInByType[tx.transactionType] = (cashInByType[tx.transactionType] || 0) + tx.amount;
        } else { // Negative adjustment is cash out
            netCashOut += Math.abs(tx.amount);
            cashOutByType[tx.transactionType] = (cashOutByType[tx.transactionType] || 0) + Math.abs(tx.amount);
        }
      }
    });
    const openingBalance = activeDaybook.openingBalance || 0;
    const closingBalance = openingBalance + netCashIn - netCashOut;
    return { 
        cashInByType, 
        cashOutByType, 
        netCashIn, 
        netCashOut, 
        closingBalance, 
        openingBalance,
        transactionsCount: activeDaybook.transactions?.length || 0
    };
  }, [activeDaybook]);

  const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFilterNepaliMiti(e.target.value);
  };

  const handleBranchChange = (value: string) => {
    setFilterBranchId(value);
  };

  const handleLoadToday = () => {
    setFilterNepaliMiti(getTodayNepaliMiti());
    if (branches.length > 0 && !branches.find(b => b.id === filterBranchId)) {
      setFilterBranchId(branches[0].id);
    }
  };
  
  const handleOpenTransactionForm = (transaction?: DaybookTransaction) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setTransactionFormData({
        transactionType: transaction.transactionType,
        amount: transaction.amount,
        description: transaction.description,
        referenceId: transaction.referenceId,
        partyId: transaction.partyId,
        ledgerAccountId: transaction.ledgerAccountId,
        expenseHead: transaction.expenseHead,
        supportingDocUrl: transaction.supportingDocUrl,
        reasonForAdjustment: transaction.reasonForAdjustment,
        // Exclude id, createdBy, createdAt, autoLinked as they are not part of initial form data
      });
      // If it's a delivery-linked transaction, pre-select the Bilti for context
      if (transaction.referenceId && (transaction.transactionType === "Cash In (from Delivery/Receipt)" || transaction.transactionType === "Delivery Expense (Cash Out)")) {
        setSelectedBiltiForTx(getBiltiDetailsById(transaction.referenceId) || null);
      } else {
        setSelectedBiltiForTx(null);
      }
    } else {
      setEditingTransaction(null);
      setTransactionFormData(initialTransactionFormData);
      setSelectedBiltiForTx(null);
    }
    setIsTransactionFormOpen(true);
  };

  const handleSaveTransaction = async () => {
    // Actual save logic will be in a subsequent step
    // For now, just close the dialog and log
    console.log("Save Transaction Data:", transactionFormData);
    setIsTransactionFormOpen(false);
  };
  
  const handleSubmitDaybook = async () => {
    // Placeholder for submission logic
    alert("Daybook submitted for approval (Simulated).");
  };

  const handleApproveDaybook = async () => {
    // Placeholder for approval logic
    alert("Daybook approved (Simulated).");
  };

  const handleRejectDaybook = async () => {
    // Placeholder for rejection logic
    const remarks = prompt("Enter rejection remarks:");
    if (remarks !== null) { // User didn't cancel prompt
      alert(`Daybook rejected with remarks: ${remarks} (Simulated).`);
    }
  };


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
            <Button 
              onClick={() => handleOpenTransactionForm()} 
              disabled={isLoading || !activeDaybook || (activeDaybook && activeDaybook.status !== "Draft" && activeDaybook.status !== "Rejected")}
            >
              <PlusCircle className="mr-2 h-4 w-4"/> Add Transaction
            </Button>
            <Button variant="outline" onClick={() => alert("Print Daybook (Not Implemented)")} disabled={!activeDaybook}>Print</Button>
        </div>
      </div>

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
             <Button onClick={() => handleOpenTransactionForm()} disabled={isLoading}>
                <PlusCircle className="mr-2 h-4 w-4"/> Add First Transaction
             </Button>
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
                        English Date: {format(activeDaybook.englishMiti, "PPP")} | Transactions: {daybookSummary.transactionsCount}
                    </CardDescription>
                </div>
                <Badge 
                    variant={
                        activeDaybook.status === "Approved" ? "default" : 
                        activeDaybook.status === "Rejected" ? "destructive" : 
                        activeDaybook.status === "Pending Approval" ? "secondary" : "outline"
                    } 
                    className={cn("text-sm mt-2 sm:mt-0", 
                        activeDaybook.status === "Approved" ? "bg-accent text-accent-foreground" : 
                        activeDaybook.status === "Pending Approval" ? "bg-yellow-400 text-yellow-900" : ""
                    )}
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
              {Object.entries(daybookSummary.cashInByType).map(([type, amount]) => (
                <p key={type} className="text-xs text-muted-foreground">{type}: {amount.toFixed(2)}</p>
              ))}
            </div>
            <div className="p-3 rounded-md bg-red-100 dark:bg-red-900/30">
              <p className="text-sm text-red-700 dark:text-red-300">Total Cash Out</p>
              <p className="text-lg font-semibold text-red-800 dark:text-red-200">Rs. {daybookSummary.netCashOut.toFixed(2)}</p>
               {Object.entries(daybookSummary.cashOutByType).map(([type, amount]) => (
                <p key={type} className="text-xs text-muted-foreground">{type}: {Math.abs(amount).toFixed(2)}</p>
              ))}
            </div>
            <div className="p-3 rounded-md bg-primary/10">
              <p className="text-sm text-primary">Calculated Closing Balance</p>
              <p className="text-lg font-bold text-primary">Rs. {daybookSummary.closingBalance.toFixed(2)}</p>
            </div>
          </CardContent>

          <CardContent>
            <h3 className="text-lg font-semibold mb-2">Transactions</h3>
            <ScrollArea className="max-h-[400px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeDaybook.transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        No transactions added yet for this daybook.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeDaybook.transactions.map((tx, index) => (
                      <TableRow key={tx.id || index}>
                        <TableCell>
                            <Badge variant={tx.transactionType.toLowerCase().includes("cash in") ? "secondary" : tx.transactionType.toLowerCase().includes("cash out") ? "outline" : "default"}
                                   className={cn(tx.transactionType.toLowerCase().includes("cash in") ? "bg-green-100 text-green-700" : tx.transactionType.toLowerCase().includes("cash out") ? "bg-red-100 text-red-700" : "")}
                            >
                                {tx.transactionType}
                            </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={tx.description}>{tx.description}</TableCell>
                        <TableCell>{tx.referenceId || 'N/A'}</TableCell>
                        <TableCell className={cn("text-right font-medium", tx.transactionType.toLowerCase().includes("cash in") ? "text-green-600" : "text-red-600")}>
                            {tx.transactionType.toLowerCase().includes("cash out") ? "-" : ""}{tx.amount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {/* Placeholder for Edit/Delete buttons */}
                          {(activeDaybook.status === "Draft" || activeDaybook.status === "Rejected") && (
                            <div className="flex gap-1">
                                <Button variant="outline" size="icon" onClick={() => handleOpenTransactionForm(tx)} disabled={isSubmittingDaybook || isApprovingDaybook} aria-label="Edit Transaction"><Edit className="h-4 w-4"/></Button>
                                <Button variant="destructive" size="icon" onClick={() => alert("Delete (not implemented)")} disabled={isSubmittingDaybook || isApprovingDaybook} aria-label="Delete Transaction"><Trash2 className="h-4 w-4"/></Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
          
          <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
             {activeDaybook.status === "Draft" && daybookSummary.transactionsCount > 0 && (
                <Button onClick={handleSubmitDaybook} disabled={isSubmittingDaybook}>
                    {isSubmittingDaybook && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Submit for Approval
                </Button>
             )}
             {isSuperAdmin && activeDaybook.status === "Pending Approval" && (
                <>
                <Button onClick={handleApproveDaybook} className="bg-green-600 hover:bg-green-700 text-white" disabled={isApprovingDaybook}>
                    {isApprovingDaybook && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Approve Daybook
                </Button>
                <Button onClick={handleRejectDaybook} variant="destructive" disabled={isApprovingDaybook}>
                    Reject Daybook
                </Button>
                </>
             )}
             {activeDaybook.status === "Approved" && <p className="text-sm text-green-600 font-semibold">Daybook Approved by {activeDaybook.approvedBy || "N/A"} on {activeDaybook.approvedAt ? format(activeDaybook.approvedAt, "PPp") : "N/A"}</p>}
             {activeDaybook.status === "Rejected" && <p className="text-sm text-red-600 font-semibold">Daybook Rejected. Please review and resubmit.</p>}
          </CardFooter>
        </Card>
      )}

      {/* Transaction Form Dialog Placeholder */}
      <Dialog open={isTransactionFormOpen} onOpenChange={setIsTransactionFormOpen}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>{editingTransaction ? "Edit Transaction" : "Add New Transaction"}</DialogTitle>
                <DialogDescription>
                    Enter details for the cash book transaction. All fields marked * are required.
                </DialogDescription>
            </DialogHeader>
            {/* Form will be added in the next step */}
            <div className="py-4">
                <p className="text-muted-foreground text-center">[Transaction Form Fields Will Go Here]</p>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="button" onClick={handleSaveTransaction}>
                    {/* Add loader here later */}
                    {editingTransaction ? "Update Transaction" : "Save Transaction"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog Placeholder */}
      <AlertDialog open={isDeleteTransactionAlertOpen} onOpenChange={setIsDeleteTransactionAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the transaction: {transactionToDelete?.description}.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => alert("Confirm Delete (Not Implemented)")}>
                    {/* Add loader here later */}
                    Delete Transaction
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
