
"use client";

import { useState, useEffect, useMemo, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpenCheck, CalendarIcon, PlusCircle, Edit, Trash2, Filter, Loader2, CheckCircle, XCircle, Eye } from "lucide-react";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
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
  serverTimestamp,
  deleteDoc,
  runTransaction,
  type DocumentSnapshot
} from "firebase/firestore";
import type {
  Daybook as FirestoreDaybook,
  DaybookTransaction as FirestoreDaybookTransaction,
  Branch as FirestoreBranch,
  Bilti as FirestoreBilti,
  Party as FirestoreParty,
  LedgerAccount as FirestoreLedgerAccount
} from "@/types/firestore";

// --- Local Interfaces (extending Firestore for UI, e.g. Date objects) ---
interface Daybook extends Omit<FirestoreDaybook, 'englishMiti' | 'createdAt' | 'updatedAt' | 'submittedAt' | 'approvedAt' | 'transactions'> {
  englishMiti: Date;
  createdAt?: Date;
  updatedAt?: Date;
  submittedAt?: Date;
  approvedAt?: Date;
  transactions: DaybookTransactionUI[];
}
interface DaybookTransactionUI extends Omit<FirestoreDaybookTransaction, 'createdAt'> {
  createdAt?: Date; // For UI display
  // UI specific fields if needed, e.g., biltiNo for display
  biltiNo?: string;
  partyName?: string;
}

const PLACEHOLDER_USER_ID = "system_user_placeholder";
// Simulate current user's branch - this would come from user's profile in a real app
const SIMULATED_USER_BRANCH_ID = "BRN001"; // TODO: Replace with actual user branch logic
const SIMULATED_USER_ROLE = "manager"; // "manager" or "superAdmin"


// --- Default Form States ---
const defaultTransactionFormData: Omit<DaybookTransactionUI, 'id' | 'createdAt' | 'createdBy' | 'autoLinked'> = {
  transactionType: "OtherCashIn",
  amount: 0,
  description: "",
  // referenceId, partyId, ledgerAccountId, expenseHead, supportingDocUrl, reasonForAdjustment will be set based on type
};


export default function DaybookPage() {
  const { toast } = useToast();

  // --- Master Data States ---
  const [branches, setBranches] = useState<FirestoreBranch[]>([]);
  const [availableBiltis, setAvailableBiltis] = useState<FirestoreBilti[]>([]); // For DeliveryCashIn selection
  const [parties, setParties] = useState<FirestoreParty[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<FirestoreLedgerAccount[]>([]);

  // --- Daybook List States ---
  const [daybooks, setDaybooks] = useState<Daybook[]>([]);
  const [filterBranchId, setFilterBranchId] = useState<string>(SIMULATED_USER_ROLE === "manager" ? SIMULATED_USER_BRANCH_ID : "all");
  const [filterNepaliMiti, setFilterNepaliMiti] = useState<string>(""); // User input for BS date
  const [filterStatus, setFilterStatus] = useState<FirestoreDaybook["status"] | "all">("all");
  const [isLoadingDaybooks, setIsLoadingDaybooks] = useState(false);

  // --- Selected Daybook & Transaction States ---
  const [selectedDaybook, setSelectedDaybook] = useState<Daybook | null>(null);
  const [currentOpeningBalance, setCurrentOpeningBalance] = useState(0); // Will be 0 for now
  const [transactionFormData, setTransactionFormData] = useState(defaultTransactionFormData);
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [isSubmittingDaybook, setIsSubmittingDaybook] = useState(false);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);


  // --- Nepali Date Handling (Simplified for UI) ---
  // In a real app, use a robust Nepali date library. For now, it's a string input.
  const getTodayNepaliMiti = () => {
    // Placeholder: In a real app, this would convert new Date() to today's BS date string.
    // For now, let's assume a format like "YYYY-MM-DD" for BS.
    // This needs to be manually set by the user for now, or use a library.
    // Defaulting to empty, user must input.
    return "";
  };

  // --- Data Fetching ---
  const fetchMasterData = async () => {
    try {
      const [branchesSnap, biltisSnap, partiesSnap, ledgersSnap] = await Promise.all([
        getDocs(query(collection(db, "branches"), orderBy("name"))),
        getDocs(query(collection(db, "biltis"), where("status", "in", ["Delivered", "To Pay"]))), // Biltis eligible for cash-in
        getDocs(query(collection(db, "parties"), orderBy("name"))),
        getDocs(query(collection(db, "ledgerAccounts"), orderBy("accountName"))),
      ]);
      setBranches(branchesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as FirestoreBranch)));
      setAvailableBiltis(biltisSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as FirestoreBilti)));
      setParties(partiesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as FirestoreParty)));
      setLedgerAccounts(ledgersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as FirestoreLedgerAccount)));
    } catch (error) {
      console.error("Error fetching master data for Daybook:", error);
      toast({ title: "Error", description: "Failed to load master data.", variant: "destructive" });
    }
  };

  const fetchDaybooks = async () => {
    setIsLoadingDaybooks(true);
    try {
      let q = query(collection(db, "daybooks"));
      if (filterBranchId !== "all") {
        q = query(q, where("branchId", "==", filterBranchId));
      }
      if (filterNepaliMiti) {
        // Exact match for Nepali Miti as it's a string.
        // For date range on englishMiti, you'd convert BS start/end to AD timestamps.
        q = query(q, where("nepaliMiti", "==", filterNepaliMiti));
      }
      if (filterStatus !== "all") {
        q = query(q, where("status", "==", filterStatus));
      }
      q = query(q, orderBy("englishMiti", "desc")); // Show most recent first

      const querySnapshot = await getDocs(q);
      const fetchedDaybooks = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data() as FirestoreDaybook;
        return {
          ...data,
          id: docSnap.id,
          englishMiti: data.englishMiti.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          submittedAt: data.submittedAt?.toDate(),
          approvedAt: data.approvedAt?.toDate(),
          transactions: data.transactions.map(t => ({...t, createdAt: t.createdAt.toDate()})),
        } as Daybook;
      });
      setDaybooks(fetchedDaybooks);
    } catch (error) {
      console.error("Error fetching daybooks:", error);
      toast({ title: "Error", description: "Failed to fetch daybooks.", variant: "destructive" });
    } finally {
      setIsLoadingDaybooks(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (SIMULATED_USER_ROLE === "manager" || filterBranchId !== "all") {
        fetchDaybooks();
    } else if (SIMULATED_USER_ROLE === "superAdmin" && filterBranchId === "all" && (filterNepaliMiti || filterStatus !== "all")) {
        // Allow admin to search without branch if other filters are present
        fetchDaybooks();
    } else if (SIMULATED_USER_ROLE === "superAdmin" && filterBranchId === "all" && !filterNepaliMiti && filterStatus === "all") {
        setDaybooks([]); // Avoid loading all daybooks by default for admin
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId, filterNepaliMiti, filterStatus]);


  // --- Derived State & Calculations ---
  const daybookSummary = useMemo(() => {
    if (!selectedDaybook) return { totalCashIn: 0, totalCashOut: 0, closingBalance: 0 };
    const totalCashIn = selectedDaybook.transactions
      .filter(t => t.transactionType.includes("CashIn") || (t.transactionType === "Adjustment" && t.amount > 0))
      .reduce((sum, t) => sum + t.amount, 0);
    const totalCashOut = selectedDaybook.transactions
      .filter(t => t.transactionType.includes("CashOut") || (t.transactionType === "Adjustment" && t.amount < 0))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0); // Use Math.abs for adjustments
    const closingBalance = currentOpeningBalance + totalCashIn - totalCashOut;
    return { totalCashIn, totalCashOut, closingBalance };
  }, [selectedDaybook, currentOpeningBalance]);

  // --- Event Handlers & Actions ---

  const handleSelectDaybook = (daybook: Daybook | null) => {
    setSelectedDaybook(daybook);
    if (daybook) {
      // TODO: Implement robust opening balance calculation. For now, it's fixed.
      // This would involve fetching the previous day's *approved* closing balance.
      setCurrentOpeningBalance(daybook.openingBalance || 0);
    } else {
      setCurrentOpeningBalance(0);
    }
    setIsTransactionFormOpen(false); // Close form if open
    setEditingTransactionId(null);
  };

  const handleCreateOrFocusTodayDaybook = async () => {
    const todayBS = filterNepaliMiti || getTodayNepaliMiti(); // Prioritize filter input
    if (!todayBS) {
        toast({title: "Input Nepali Date", description: "Please enter today's Nepali Miti to create or view its daybook.", variant: "destructive"});
        return;
    }
    if (SIMULATED_USER_ROLE === "superAdmin" && filterBranchId === "all") {
        toast({title: "Select Branch", description: "Super Admin must select a branch to view/create a daybook.", variant: "destructive"});
        return;
    }

    const currentBranchId = SIMULATED_USER_ROLE === "manager" ? SIMULATED_USER_BRANCH_ID : filterBranchId;

    const existing = daybooks.find(db => db.nepaliMiti === todayBS && db.branchId === currentBranchId);
    if (existing) {
      handleSelectDaybook(existing);
      return;
    }

    // Create new draft Daybook if none exists for today & selected branch
    const newDaybookData: Omit<FirestoreDaybook, 'id'> = {
      branchId: currentBranchId,
      nepaliMiti: todayBS,
      englishMiti: Timestamp.now(), // Represents creation time, actual BS>AD conversion needed for accuracy
      openingBalance: 0, // Placeholder
      totalCashIn: 0,
      totalCashOut: 0,
      closingBalance: 0,
      status: "Draft",
      transactions: [],
      createdBy: PLACEHOLDER_USER_ID,
      createdAt: Timestamp.now(),
    };

    try {
      const docRef = await addDoc(collection(db, "daybooks"), newDaybookData);
      const newDaybookForState: Daybook = {
        ...newDaybookData,
        id: docRef.id,
        englishMiti: newDaybookData.englishMiti.toDate(),
        transactions: [],
      };
      setDaybooks(prev => [newDaybookForState, ...prev]);
      handleSelectDaybook(newDaybookForState);
      toast({ title: "Daybook Created", description: `Draft daybook for ${todayBS} created.` });
    } catch (error) {
      console.error("Error creating new daybook:", error);
      toast({ title: "Error", description: "Failed to create new daybook.", variant: "destructive" });
    }
  };


  const handleTransactionFormChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let parsedValue: string | number = value;
    if (name === "amount") {
      parsedValue = value === "" ? 0 : parseFloat(value);
      if (isNaN(parsedValue as number)) parsedValue = 0;
    }
    setTransactionFormData(prev => ({ ...prev, [name]: parsedValue }));
  };

  const handleTransactionSelectChange = (name: keyof typeof defaultTransactionFormData, value: string) => {
    setTransactionFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'transactionType') {
      // Reset conditional fields when type changes
      setTransactionFormData(current => ({
        ...defaultTransactionFormData, // Start from default
        transactionType: value as FirestoreDaybookTransaction['transactionType'], // Keep the new type
        amount: current.amount, // Preserve amount if user entered it
        description: current.description, // Preserve description
      }));
    }
    if (name === 'referenceId' && transactionFormData.transactionType === 'DeliveryCashIn') {
        const selectedBilti = availableBiltis.find(b => b.id === value);
        if (selectedBilti) {
            setTransactionFormData(prev => ({...prev, amount: selectedBilti.totalAmount, description: `Cash for Bilti ${selectedBilti.id}`}));
        }
    }
  };

  const handleSaveTransaction = async () => {
    if (!selectedDaybook || selectedDaybook.status !== "Draft") {
      toast({ title: "Error", description: "Can only add transactions to a draft daybook.", variant: "destructive" });
      return;
    }
    if (transactionFormData.amount === 0 && transactionFormData.transactionType !== "Adjustment") { // Adjustments can be 0 if only for remarks
        toast({ title: "Validation Error", description: "Amount cannot be zero.", variant: "destructive" });
        return;
    }
    if (!transactionFormData.description.trim()){
        toast({ title: "Validation Error", description: "Description is required.", variant: "destructive"});
        return;
    }
    if (transactionFormData.transactionType === "DeliveryCashIn" && !transactionFormData.referenceId) {
        toast({ title: "Validation Error", description: "Please select a Bilti/Delivery for Cash In.", variant: "destructive"});
        return;
    }
     // Basic duplicate check for DeliveryCashIn within the current daybook
    if (transactionFormData.transactionType === "DeliveryCashIn" && transactionFormData.referenceId) {
        const isDuplicate = selectedDaybook.transactions.some(
            tx => tx.transactionType === "DeliveryCashIn" &&
                  tx.referenceId === transactionFormData.referenceId &&
                  tx.id !== editingTransactionId // Don't compare against itself when editing
        );
        if (isDuplicate) {
            toast({ title: "Duplicate Entry", description: "This Bilti/Delivery has already been recorded for cash-in today.", variant: "destructive" });
            return;
        }
    }


    const newTransaction: FirestoreDaybookTransaction = {
      id: editingTransactionId || `txn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, // Generate local unique ID
      ...transactionFormData,
      amount: Number(transactionFormData.amount),
      autoLinked: transactionFormData.transactionType === "DeliveryCashIn",
      createdBy: PLACEHOLDER_USER_ID,
      createdAt: Timestamp.now(),
    };

    let updatedTransactions: DaybookTransactionUI[];
    if (editingTransactionId) {
      updatedTransactions = selectedDaybook.transactions.map(t => t.id === editingTransactionId ? (newTransaction as DaybookTransactionUI) : t);
    } else {
      updatedTransactions = [...selectedDaybook.transactions, newTransaction as DaybookTransactionUI];
    }

    // Recalculate totals for Firestore update
    const newTotalCashIn = updatedTransactions
      .filter(t => t.transactionType.includes("CashIn") || (t.transactionType === "Adjustment" && t.amount > 0))
      .reduce((sum, t) => sum + t.amount, 0);
    const newTotalCashOut = updatedTransactions
      .filter(t => t.transactionType.includes("CashOut") || (t.transactionType === "Adjustment" && t.amount < 0))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const newClosingBalance = (selectedDaybook.openingBalance || 0) + newTotalCashIn - newTotalCashOut;

    try {
      const daybookDocRef = doc(db, "daybooks", selectedDaybook.id);
      await updateDoc(daybookDocRef, {
        transactions: updatedTransactions.map(uiTxn => ({...uiTxn, createdAt: Timestamp.fromDate(uiTxn.createdAt || new Date())})), // Convert UI Date back to Timestamp for saving
        totalCashIn: newTotalCashIn,
        totalCashOut: newTotalCashOut,
        closingBalance: newClosingBalance,
        updatedAt: Timestamp.now(),
        updatedBy: PLACEHOLDER_USER_ID,
      });

      setSelectedDaybook(prev => prev ? { ...prev, transactions: updatedTransactions, totalCashIn: newTotalCashIn, totalCashOut: newTotalCashOut, closingBalance: newClosingBalance } : null);
      toast({ title: "Transaction Saved", description: `Transaction ${editingTransactionId ? 'updated' : 'added'} to draft.` });
      setIsTransactionFormOpen(false);
      setTransactionFormData(defaultTransactionFormData);
      setEditingTransactionId(null);
      fetchDaybooks(); // Refresh list to show updated totals
    } catch (error) {
      console.error("Error saving transaction:", error);
      toast({ title: "Error", description: "Failed to save transaction.", variant: "destructive" });
    }
  };

  const handleEditTransaction = (transaction: DaybookTransactionUI) => {
    setTransactionFormData({
        transactionType: transaction.transactionType,
        amount: transaction.amount,
        referenceId: transaction.referenceId,
        partyId: transaction.partyId,
        ledgerAccountId: transaction.ledgerAccountId,
        expenseHead: transaction.expenseHead,
        description: transaction.description,
        supportingDocUrl: transaction.supportingDocUrl,
        reasonForAdjustment: transaction.reasonForAdjustment,
    });
    setEditingTransactionId(transaction.id);
    setIsTransactionFormOpen(true);
  };

  const handleDeleteTransaction = async (transactionId: string) => {
     if (!selectedDaybook || selectedDaybook.status !== "Draft") return;

     const updatedTransactions = selectedDaybook.transactions.filter(t => t.id !== transactionId);
     const newTotalCashIn = updatedTransactions
      .filter(t => t.transactionType.includes("CashIn") || (t.transactionType === "Adjustment" && t.amount > 0))
      .reduce((sum, t) => sum + t.amount, 0);
    const newTotalCashOut = updatedTransactions
      .filter(t => t.transactionType.includes("CashOut") || (t.transactionType === "Adjustment" && t.amount < 0))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const newClosingBalance = (selectedDaybook.openingBalance || 0) + newTotalCashIn - newTotalCashOut;

    try {
        const daybookDocRef = doc(db, "daybooks", selectedDaybook.id);
        await updateDoc(daybookDocRef, {
            transactions: updatedTransactions.map(uiTxn => ({...uiTxn, createdAt: Timestamp.fromDate(uiTxn.createdAt || new Date())})),
            totalCashIn: newTotalCashIn,
            totalCashOut: newTotalCashOut,
            closingBalance: newClosingBalance,
            updatedAt: Timestamp.now(),
            updatedBy: PLACEHOLDER_USER_ID
        });
        setSelectedDaybook(prev => prev ? { ...prev, transactions: updatedTransactions, totalCashIn: newTotalCashIn, totalCashOut: newTotalCashOut, closingBalance: newClosingBalance } : null);
        toast({ title: "Transaction Deleted" });
        fetchDaybooks();
    } catch (error) {
        console.error("Error deleting transaction:", error);
        toast({ title: "Error", description: "Failed to delete transaction.", variant: "destructive" });
    }
  };

  const handleSubmitDaybookForApproval = async () => {
    if (!selectedDaybook || selectedDaybook.status !== "Draft") return;
    if (selectedDaybook.transactions.length === 0) {
        toast({title: "Empty Daybook", description: "Cannot submit an empty daybook.", variant: "destructive"});
        return;
    }
    setIsSubmittingDaybook(true);
    try {
      const daybookDocRef = doc(db, "daybooks", selectedDaybook.id);
      await updateDoc(daybookDocRef, {
        status: "Pending Approval",
        submittedBy: PLACEHOLDER_USER_ID,
        submittedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        updatedBy: PLACEHOLDER_USER_ID,
      });
      toast({ title: "Daybook Submitted", description: "Daybook sent for approval." });
      fetchDaybooks(); // Refresh list
      setSelectedDaybook(null); // Deselect
    } catch (error) {
      console.error("Error submitting daybook:", error);
      toast({ title: "Error", description: "Failed to submit daybook.", variant: "destructive" });
    } finally {
      setIsSubmittingDaybook(false);
    }
  };

  const handleDaybookApproval = async (daybookId: string, newStatus: "Approved" | "Rejected") => {
    const daybookToUpdate = daybooks.find(db => db.id === daybookId);
    if (!daybookToUpdate || daybookToUpdate.status !== "Pending Approval") return;

    let approvalRemarks = "";
    if (newStatus === "Rejected") {
        approvalRemarks = prompt("Please provide remarks for rejection:") || "";
        if (!approvalRemarks.trim()) {
            toast({title: "Remarks Required", description: "Rejection requires remarks.", variant: "destructive"});
            return;
        }
    }
    setIsProcessingApproval(true);
    try {
        const daybookDocRef = doc(db, "daybooks", daybookId);
        await updateDoc(daybookDocRef, {
            status: newStatus,
            approvedBy: PLACEHOLDER_USER_ID,
            approvedAt: Timestamp.now(),
            approvalRemarks: approvalRemarks,
            updatedAt: Timestamp.now(),
            updatedBy: PLACEHOLDER_USER_ID,
        });

        // Placeholder for Ledger Posting Logic (ideally a Cloud Function)
        if (newStatus === "Approved") {
            toast({ title: "Ledger Posting (Simulated)", description: "Approved entries would now be posted to ledgers by a backend process."});
            // Here you would trigger a cloud function or iterate through daybookToUpdate.transactions
            // and create corresponding entries in the 'ledgerEntries' collection.
            // This would also update Bilti statuses to 'Paid' etc.
        }
        toast({ title: `Daybook ${newStatus}`, description: `Daybook ${daybookId} has been ${newStatus.toLowerCase()}.` });
        fetchDaybooks();
        if(selectedDaybook?.id === daybookId) setSelectedDaybook(null);

    } catch (error) {
        console.error(`Error ${newStatus.toLowerCase()} daybook:`, error);
        toast({ title: "Error", description: `Failed to ${newStatus.toLowerCase()} daybook.`, variant: "destructive" });
    } finally {
        setIsProcessingApproval(false);
    }
  };

  const getBranchName = (branchId: string) => branches.find(b => b.id === branchId)?.name || "N/A";
  const getBiltiInfo = (biltiId: string) => availableBiltis.find(b => b.id === biltiId);
  const getPartyName = (partyId: string) => parties.find(p => p.id === partyId)?.name || ledgerAccounts.find(l => l.id === partyId)?.accountName || "N/A";

  const isSuperAdmin = SIMULATED_USER_ROLE === "superAdmin";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <BookOpenCheck className="mr-3 h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-foreground">Branch Daybook</h1>
            <p className="text-muted-foreground">Record daily cash transactions and manage approvals.</p>
          </div>
        </div>
         <Button onClick={handleCreateOrFocusTodayDaybook} disabled={isLoadingDaybooks}>
            <PlusCircle className="mr-2 h-4 w-4" /> Today&apos;s Daybook / Add Transaction
        </Button>
      </div>

      {/* Daybook List & Filters */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Daybook Overview</CardTitle>
          <CardDescription>Filter and select daybooks to view or manage.</CardDescription>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="filterNepaliMiti">Nepali Miti (YYYY-MM-DD)</Label>
              <Input id="filterNepaliMiti" value={filterNepaliMiti} onChange={(e) => setFilterNepaliMiti(e.target.value)} placeholder="e.g., 2081-04-15" />
            </div>
            {isSuperAdmin && (
              <div>
                <Label htmlFor="filterBranch">Branch</Label>
                <Select value={filterBranchId} onValueChange={setFilterBranchId}>
                  <SelectTrigger id="filterBranch"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="filterStatus">Status</Label>
              <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val as any)}>
                <SelectTrigger id="filterStatus"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader><TableRow><TableHead>Nepali Miti</TableHead><TableHead>Branch</TableHead><TableHead>Status</TableHead><TableHead>Closing Balance</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoadingDaybooks && <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>}
                {!isLoadingDaybooks && daybooks.length === 0 && <TableRow><TableCell colSpan={5} className="text-center h-24">No daybooks found for current filters.</TableCell></TableRow>}
                {!isLoadingDaybooks && daybooks.map(db => (
                  <TableRow key={db.id} className={selectedDaybook?.id === db.id ? "bg-muted" : ""}>
                    <TableCell>{db.nepaliMiti}</TableCell>
                    <TableCell>{getBranchName(db.branchId)}</TableCell>
                    <TableCell><Badge variant={db.status === "Approved" ? "default" : db.status === "Rejected" ? "destructive" : "secondary"}>{db.status}</Badge></TableCell>
                    <TableCell className="text-right">{db.closingBalance.toFixed(2)}</TableCell>
                    <TableCell>
                        <Button variant="outline" size="sm" onClick={() => handleSelectDaybook(db)}><Eye className="mr-1 h-4 w-4"/>View</Button>
                        {isSuperAdmin && db.status === "Pending Approval" && (
                            <>
                                <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 ml-1" onClick={() => handleDaybookApproval(db.id, "Approved")} disabled={isProcessingApproval}><CheckCircle className="mr-1 h-4 w-4"/>Approve</Button>
                                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 ml-1" onClick={() => handleDaybookApproval(db.id, "Rejected")} disabled={isProcessingApproval}><XCircle className="mr-1 h-4 w-4"/>Reject</Button>
                            </>
                        )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Selected Daybook Details & Transaction Management */}
      {selectedDaybook && (
        <Card className="shadow-lg mt-6">
          <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="font-headline text-xl">Daybook for: {selectedDaybook.nepaliMiti} (Branch: {getBranchName(selectedDaybook.branchId)})</CardTitle>
                    <CardDescription>Status: <Badge variant={selectedDaybook.status === "Approved" ? "default" : selectedDaybook.status === "Rejected" ? "destructive" : "secondary"}>{selectedDaybook.status}</Badge>
                     {selectedDaybook.approvalRemarks && <span className="text-xs italic"> - {selectedDaybook.approvalRemarks}</span>}
                    </CardDescription>
                </div>
                 {selectedDaybook.status === "Draft" && (
                    <Dialog open={isTransactionFormOpen} onOpenChange={(open) => { setIsTransactionFormOpen(open); if(!open) {setEditingTransactionId(null); setTransactionFormData(defaultTransactionFormData);}}}>
                        <DialogTrigger asChild>
                            <Button size="sm"><PlusCircle className="mr-2 h-4 w-4"/> Add Transaction</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-lg">
                            <DialogHeader><DialogTitle>{editingTransactionId ? "Edit" : "Add New"} Transaction</DialogTitle></DialogHeader>
                            <form onSubmit={(e) => {e.preventDefault(); handleSaveTransaction();}} className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-2">
                                <div><Label>Transaction Type</Label>
                                    <Select name="transactionType" value={transactionFormData.transactionType} onValueChange={(val) => handleTransactionSelectChange('transactionType', val)} required>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DeliveryCashIn">Cash In (Delivery/Bilti Receipt)</SelectItem>
                                        <SelectItem value="OtherCashIn">Cash In (Other)</SelectItem>
                                        <SelectItem value="ExpenseCashOut">Cash Out (Expense/Supplier)</SelectItem>
                                        <SelectItem value="Adjustment">Adjustment/Correction</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </div>
                                {transactionFormData.transactionType === "DeliveryCashIn" && (
                                    <div><Label>Select Bilti/Delivery</Label>
                                        <Select name="referenceId" value={transactionFormData.referenceId || ""} onValueChange={(val) => handleTransactionSelectChange('referenceId', val)} required>
                                        <SelectTrigger><SelectValue placeholder="Select Bilti/Delivery"/></SelectTrigger>
                                        <SelectContent>
                                            {availableBiltis.filter(b => b.status === "Delivered" || b.status === "To Pay").map(b => <SelectItem key={b.id} value={b.id}>{b.id} ({getPartyName(b.consigneeId)}) - Amt: {b.totalAmount}</SelectItem>)}
                                        </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div><Label>Amount</Label><Input name="amount" type="number" value={transactionFormData.amount} onChange={handleTransactionFormChange} required readOnly={transactionFormData.transactionType === "DeliveryCashIn"}/></div>
                                <div><Label>Description</Label><Textarea name="description" value={transactionFormData.description} onChange={handleTransactionFormChange} required/></div>

                                {(transactionFormData.transactionType === "OtherCashIn" || transactionFormData.transactionType === "ExpenseCashOut") && (
                                    <>
                                    <div><Label>Party / Ledger Account</Label>
                                        <Select name="partyId" value={transactionFormData.partyId || ""} onValueChange={(val) => handleTransactionSelectChange('partyId', val)}>
                                        <SelectTrigger><SelectValue placeholder="Select Party or Ledger"/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">None</SelectItem>
                                            <optgroup label="Parties">
                                                {parties.map(p => <SelectItem key={p.id} value={p.id}>{p.name} (Party)</SelectItem>)}
                                            </optgroup>
                                            <optgroup label="Ledger Accounts">
                                                {ledgerAccounts.filter(l => l.accountType === "Cash" || l.accountType === "Bank" || l.accountType === "Expense" || l.accountType.toLowerCase().includes("income")).map(l => <SelectItem key={l.id} value={l.id}>{l.accountName} ({l.accountType})</SelectItem>)}
                                            </optgroup>
                                        </SelectContent>
                                        </Select>
                                    </div>
                                    {transactionFormData.transactionType === "ExpenseCashOut" && (
                                        <div><Label>Expense Head (Optional)</Label><Input name="expenseHead" value={transactionFormData.expenseHead || ""} onChange={handleTransactionFormChange} placeholder="e.g., Fuel, Office Supplies"/></div>
                                    )}
                                    </>
                                )}
                                {transactionFormData.transactionType === "Adjustment" && (
                                     <div><Label>Reason for Adjustment</Label><Textarea name="reasonForAdjustment" value={transactionFormData.reasonForAdjustment || ""} onChange={handleTransactionFormChange} required/></div>
                                )}
                                {transactionFormData.transactionType === "ExpenseCashOut" && (
                                    <div><Label>Supporting Document URL (Optional)</Label><Input name="supportingDocUrl" value={transactionFormData.supportingDocUrl || ""} onChange={handleTransactionFormChange} placeholder="Link to document"/></div>
                                )}
                                <DialogFooter className="pt-4 border-t">
                                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                                    <Button type="submit">{editingTransactionId ? "Update" : "Add"} Transaction</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                 )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 border rounded-md bg-secondary/50">
              <div><Label className="text-xs">Opening Balance:</Label><p className="font-semibold">{currentOpeningBalance.toFixed(2)}</p></div>
              <div><Label className="text-xs">Total Cash In:</Label><p className="font-semibold text-green-600">{daybookSummary.totalCashIn.toFixed(2)}</p></div>
              <div><Label className="text-xs">Total Cash Out:</Label><p className="font-semibold text-red-600">{daybookSummary.totalCashOut.toFixed(2)}</p></div>
              <div><Label className="text-xs">Calculated Closing Balance:</Label><p className="font-bold text-lg">{daybookSummary.closingBalance.toFixed(2)}</p></div>
            </div>
            <h4 className="font-semibold mb-2">Transactions:</h4>
            <ScrollArea className="h-[350px]">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Ref/Party</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {selectedDaybook.transactions.length === 0 && <TableRow><TableCell colSpan={6} className="text-center h-20">No transactions added yet.</TableCell></TableRow>}
                  {selectedDaybook.transactions.map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell>{format(tx.createdAt || new Date(), "PP p")}</TableCell>
                      <TableCell>{tx.transactionType}</TableCell>
                      <TableCell className="max-w-xs truncate" title={tx.description}>{tx.description}</TableCell>
                      <TableCell className="max-w-xs truncate" title={tx.referenceId || tx.partyId}>
                        {tx.transactionType === "DeliveryCashIn" ? `Bilti: ${getBiltiInfo(tx.referenceId || "")?.id || tx.referenceId}` : getPartyName(tx.partyId || tx.ledgerAccountId || "")}
                        {tx.expenseHead && ` (${tx.expenseHead})`}
                      </TableCell>
                      <TableCell className={cn("text-right", tx.transactionType.includes("CashIn") || (tx.transactionType === "Adjustment" && tx.amount > 0) ? "text-green-600" : "text-red-600")}>
                        {tx.transactionType === "Adjustment" && tx.amount > 0 ? "+" : ""}{tx.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {selectedDaybook.status === "Draft" && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditTransaction(tx)}><Edit className="h-4 w-4"/></Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4"/></AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Delete Transaction?</AlertDialogTitle><AlertDialogDescription>This will remove the transaction: "{tx.description.substring(0,30)}...".</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteTransaction(tx.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
          <CardFooter className="border-t pt-4">
            {selectedDaybook.status === "Draft" && (
              <Button onClick={handleSubmitDaybookForApproval} disabled={isSubmittingDaybook || selectedDaybook.transactions.length === 0}>
                {isSubmittingDaybook && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Submit for Approval
              </Button>
            )}
            {selectedDaybook.status === "Pending Approval" && isSuperAdmin && (
              <div className="flex gap-2">
                 <Button onClick={() => handleDaybookApproval(selectedDaybook.id, "Approved")} className="bg-green-600 hover:bg-green-700" disabled={isProcessingApproval}>
                    {isProcessingApproval && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Approve Daybook
                 </Button>
                 <Button variant="destructive" onClick={() => handleDaybookApproval(selectedDaybook.id, "Rejected")} disabled={isProcessingApproval}>
                    {isProcessingApproval && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Reject Daybook
                 </Button>
              </div>
            )}
            {selectedDaybook.status === "Rejected" && ( // Allow manager to resubmit if rejected
                 <Button onClick={handleSubmitDaybookForApproval} disabled={isSubmittingDaybook || selectedDaybook.transactions.length === 0}>
                    {isSubmittingDaybook && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Re-Submit for Approval
                </Button>
            )}
            <p className="text-xs text-muted-foreground ml-auto">Last updated: {selectedDaybook.updatedAt ? format(selectedDaybook.updatedAt, "PPp") : "N/A"}</p>
          </CardFooter>
        </Card>
      )}
       <CardFooter className="mt-4">
            <p className="text-xs text-muted-foreground">
                Note: Opening balance calculation is simplified (defaults to 0 for new daybooks). Ledger posting upon approval is simulated; requires backend Cloud Functions for robust implementation.
                User roles and branch access are currently simulated.
            </p>
        </CardFooter>
    </div>
  );
}

    

