
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk";

import { BookOpenCheck, CalendarIcon, PlusCircle, Edit, Trash2, Filter, AlertTriangle, CheckCircle2, XCircle, Loader2, ChevronsUpDown, Check as CheckIcon, UploadCloud } from "lucide-react";
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
  FirestoreDaybook,
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
interface Daybook extends Omit<FirestoreDaybook, 'englishMiti' | 'createdAt' | 'updatedAt' | 'submittedAt' | 'approvedAt' | 'transactions' | 'processingTimestamp'> {
  id: string;
  englishMiti: Date;
  transactions: DaybookTransaction[];
  createdAt?: Date;
  updatedAt?: Date;
  submittedAt?: Date;
  approvedAt?: Date;
  processingTimestamp?: Date;
}

interface DaybookTransaction extends Omit<FirestoreDaybookTransaction, 'createdAt'> {
  createdAt?: Date;
}

interface Branch extends FirestoreBranch {
    id: string;
}
interface Bilti extends Omit<FirestoreBilti, 'miti' | 'createdAt' | 'updatedAt'> {
  id: string;
  miti: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
interface Party extends FirestoreParty {
    id: string;
}
interface LedgerAccount extends Omit<FirestoreLedgerAccount, 'createdAt' | 'updatedAt' | 'lastTransactionAt'> {
   id: string;
   createdAt?: Date;
   updatedAt?: Date;
   lastTransactionAt?: Date;
}


const PLACEHOLDER_USER_ID = "system_user_placeholder"; // Replace with actual authenticated user ID
const SIMULATED_SUPER_ADMIN_ID = "super_admin_placeholder"; // Replace with actual super admin check logic

const getTodayNepaliMiti = () => {
  // This is a placeholder. In a real app, use a reliable Nepali date conversion library.
  // For demo, this will just use the Gregorian date formatted.
  const today = new Date();
  return format(today, "yyyy-MM-dd", { locale: enUS });
};

const transactionTypes: DaybookTransactionType[] = [
  "Cash In (from Delivery/Receipt)",
  "Delivery Expense (Cash Out)",
  "Cash Out (to Expense/Supplier/Other)",
  "Cash In (Other)",
  "Cash Out (Other)",
  "Cash In (from Party Payment)",
  "Cash Out (to Driver/Staff, Petty Expense)",
  "Adjustment/Correction",
];


export default function DaybookPage() {
  const { toast } = useToast();

  const [activeDaybook, setActiveDaybook] = useState<Daybook | null>(null);
  const [activeDaybookFromState, setActiveDaybookFromState] = useState<Daybook | null>(null);

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

  const [isSuperAdmin, setIsSuperAdmin] = useState(false); // Simulate super admin role

  const initialTransactionFormData: Omit<DaybookTransaction, 'id' | 'createdAt' | 'createdBy' | 'autoLinked'> = {
    transactionType: "Cash In (Other)",
    amount: 0,
    description: "",
    ledgerAccountId: "", // Initialize as empty, will be mandatory
  };
  const [transactionFormData, setTransactionFormData] = useState(initialTransactionFormData);

  const [selectedBiltiForTx, setSelectedBiltiForTx] = useState<Bilti | null>(null);
  const [isBiltiSelectOpen, setIsBiltiSelectOpen] = useState(false);
  const [biltiSearchTerm, setBiltiSearchTerm] = useState("");

  const [selectedPartyForTx, setSelectedPartyForTx] = useState<Party | null>(null);
  const [isPartySelectOpen, setIsPartySelectOpen] = useState(false);
  const [partySearchTerm, setPartySearchTerm] = useState("");

  const [selectedLedgerForTx, setSelectedLedgerForTx] = useState<LedgerAccount | null>(null);
  const [isLedgerSelectOpen, setIsLedgerSelectOpen] = useState(false);
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState("");

  const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);


  const fetchMasterData = async () => {
    try {
      const [branchesSnap, biltisSnap, partiesSnap, ledgersSnap] = await Promise.all([
        getDocs(query(collection(db, "branches"), orderBy("name"))),
        getDocs(collection(db, "biltis")), // Consider adding orderBy or where clauses for performance
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
      // Biltis for "Cash In (from Delivery/Receipt)" selection dynamically filtered in form
      setBiltisForSelection(allFetchedBiltis); // General list for other expense linking

      setParties(partiesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Party)));
      setLedgerAccounts(ledgersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as LedgerAccount)));

    } catch (error) {
      console.error("Error fetching master data:", error);
      toast({ title: "Error", description: "Failed to load master data.", variant: "destructive" });
    }
  };

  const fetchDaybooksList = async () => { /* Placeholder, not primary use for this page */ };

  const loadOrCreateActiveDaybook = async () => {
    if (!filterBranchId || !filterNepaliMiti) {
      setActiveDaybook(null);
      setActiveDaybookFromState(null);
      return;
    }
    setIsLoading(true);
    try {
      const daybookQuery = query(
        collection(db, "daybooks"),
        where("branchId", "==", filterBranchId),
        where("nepaliMiti", "==", filterNepaliMiti)
        // Consider adding orderBy englishMiti or createdAt if multiple daybooks per day are possible (should not be)
      );
      const querySnapshot = await getDocs(daybookQuery);

      if (!querySnapshot.empty) {
        const daybookDoc = querySnapshot.docs[0];
        const data = daybookDoc.data() as FirestoreDaybook;
        const loadedDaybook = {
          ...data,
          id: daybookDoc.id,
          englishMiti: data.englishMiti.toDate(),
          transactions: (data.transactions || []).map(tx => ({
            ...tx,
            createdAt: tx.createdAt?.toDate(), // Convert Firestore Timestamp to Date
          })),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          submittedAt: data.submittedAt?.toDate(),
          approvedAt: data.approvedAt?.toDate(),
          processingTimestamp: data.processingTimestamp?.toDate(),
        };
        setActiveDaybook(loadedDaybook);
        setActiveDaybookFromState(loadedDaybook); // Keep a stable copy for checks
      } else {
        // No existing daybook, set to null. It will be auto-created on first transaction.
        setActiveDaybook(null);
        setActiveDaybookFromState(null);
      }
    } catch (error) {
      console.error("Error loading daybook:", error);
      toast({ title: "Error", description: "Failed to load daybook data.", variant: "destructive" });
      setActiveDaybook(null);
      setActiveDaybookFromState(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
    // setIsSuperAdmin(checkIfUserIsSuperAdmin()); // Replace with actual role check
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (filterBranchId && filterNepaliMiti) {
      loadOrCreateActiveDaybook();
    } else {
      setActiveDaybook(null); // Clear daybook if filters are incomplete
      setActiveDaybookFromState(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId, filterNepaliMiti]);


  const getBranchNameById = (id: string) => branches.find(b => b.id === id)?.name || "N/A";
  const getPartyNameById = (id?: string) => parties.find(p => p.id === id)?.name || "N/A";
  const getLedgerAccountNameById = (id?: string) => ledgerAccounts.find(la => la.id === id)?.accountName || "N/A";
  const getBiltiDetailsById = (id?: string) => allBiltisMaster.find(b => b.id === id);


  const daybookSummary = useMemo(() => {
    const currentDaybook = activeDaybookFromState || activeDaybook;
    if (!currentDaybook) return {
        cashInByType: {}, cashOutByType: {}, netCashIn: 0, netCashOut: 0,
        closingBalance: 0, openingBalance: 0, transactionsCount: 0
    };

    const cashInByType: Record<string, number> = {};
    const cashOutByType: Record<string, number> = {};
    let netCashIn = 0;
    let netCashOut = 0;

    (currentDaybook.transactions || []).forEach(tx => {
      if (tx.transactionType.toLowerCase().includes("cash in")) {
        netCashIn += tx.amount;
        cashInByType[tx.transactionType] = (cashInByType[tx.transactionType] || 0) + tx.amount;
      } else if (tx.transactionType.toLowerCase().includes("cash out")) {
        netCashOut += tx.amount;
        cashOutByType[tx.transactionType] = (cashOutByType[tx.transactionType] || 0) + tx.amount;
      } else if (tx.transactionType === "Adjustment/Correction") {
        // Adjustments can be positive (cash in) or negative (cash out)
        if (tx.amount >= 0) {
            netCashIn += tx.amount;
            cashInByType[tx.transactionType] = (cashInByType[tx.transactionType] || 0) + tx.amount;
        } else {
            netCashOut += Math.abs(tx.amount);
            cashOutByType[tx.transactionType] = (cashOutByType[tx.transactionType] || 0) + Math.abs(tx.amount);
        }
      }
    });
    const openingBalance = currentDaybook.openingBalance || 0;
    const closingBalance = openingBalance + netCashIn - netCashOut;
    return {
        cashInByType, cashOutByType, netCashIn, netCashOut, closingBalance, openingBalance,
        transactionsCount: currentDaybook.transactions?.length || 0
    };
  }, [activeDaybook, activeDaybookFromState]);

  const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFilterNepaliMiti(e.target.value);
  };

  const handleBranchChange = (value: string) => {
    setFilterBranchId(value);
  };

  const handleLoadToday = () => {
    setFilterNepaliMiti(getTodayNepaliMiti());
    // If filterBranchId is not set, or current filterBranchId is not in branches, set to first branch
    if (branches.length > 0 && (!filterBranchId || !branches.find(b => b.id === filterBranchId))) {
      setFilterBranchId(branches[0].id);
    }
  };

  const handleOpenTransactionForm = (transaction?: DaybookTransaction) => {
    // Reset selections
    setSelectedBiltiForTx(null);
    setSelectedPartyForTx(null);
    setSelectedLedgerForTx(null);

    if (transaction) {
      setEditingTransaction(transaction);
      setTransactionFormData({
        transactionType: transaction.transactionType,
        amount: transaction.amount,
        description: transaction.description,
        referenceId: transaction.referenceId,
        partyId: transaction.partyId,
        ledgerAccountId: transaction.ledgerAccountId,
        // expenseHead: transaction.expenseHead, // expenseHead is part of ledger now or description
        supportingDocUrl: transaction.supportingDocUrl,
        reasonForAdjustment: transaction.reasonForAdjustment,
        nepaliMiti: transaction.nepaliMiti,
      });
      // Pre-fill selected entities for edit form
      if (transaction.referenceId && (transaction.transactionType === "Cash In (from Delivery/Receipt)" || transaction.transactionType === "Delivery Expense (Cash Out)")) {
        setSelectedBiltiForTx(getBiltiDetailsById(transaction.referenceId) || null);
      }
      if (transaction.partyId) setSelectedPartyForTx(parties.find(p => p.id === transaction.partyId) || null);
      if (transaction.ledgerAccountId) setSelectedLedgerForTx(ledgerAccounts.find(l => l.id === transaction.ledgerAccountId) || null);

    } else {
      setEditingTransaction(null);
      setTransactionFormData({...initialTransactionFormData, transactionType: "Cash In (Other)", ledgerAccountId: ""}); // Ensure ledgerAccountId is reset for new
    }
    setIsTransactionFormOpen(true);
  };

  const handleTransactionFormInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let parsedValue: string | number = value;
    if (name === "amount") {
      parsedValue = value === "" ? 0 : parseFloat(value);
      if (isNaN(parsedValue as number) || parsedValue < 0) parsedValue = 0;
    }
    setTransactionFormData(prev => ({ ...prev, [name]: parsedValue }));
  };

  const handleTransactionFormDateChange = (date?: Date) => {
    if (date) {
      setTransactionFormData(prev => ({...prev, nepaliMiti: format(date, "yyyy-MM-dd") })); // Assuming nepaliMiti is string here for form
    }
  };

  const handleTransactionFormTypeChange = (value: DaybookTransactionType) => {
    setTransactionFormData(prev => ({ ...prev, transactionType: value, amount: 0, description: "", ledgerAccountId: prev.ledgerAccountId || "" })); // Reset amount and desc, keep ledger if set
    // Reset linked entities
    setSelectedBiltiForTx(null);
    setSelectedPartyForTx(null);
    // Do not reset selectedLedgerForTx here, as ledger is now always required
  };

  const handleBiltiSelectForTx = (biltiId: string) => {
    const bilti = allBiltisMaster.find(b => b.id === biltiId);
    setSelectedBiltiForTx(bilti || null);
    setTransactionFormData(prev => ({
      ...prev,
      referenceId: bilti ? bilti.id : undefined,
      amount: prev.transactionType === "Cash In (from Delivery/Receipt)" ? (bilti?.totalAmount || 0) : prev.amount,
      description: prev.transactionType === "Cash In (from Delivery/Receipt)" ? `Cash received for Bilti ${bilti?.id}` : prev.description,
      autoLinked: true,
    }));
    setIsBiltiSelectOpen(false);
  };

  const handlePartySelectForTx = (partyId: string) => {
    const party = parties.find(p => p.id === partyId);
    setSelectedPartyForTx(party || null);
    setTransactionFormData(prev => ({ ...prev, partyId: party?.id }));
    setIsPartySelectOpen(false);
  };

  const handleLedgerSelectForTx = (ledgerId: string) => {
    const ledger = ledgerAccounts.find(l => l.id === ledgerId);
    setSelectedLedgerForTx(ledger || null);
    setTransactionFormData(prev => ({ ...prev, ledgerAccountId: ledger?.id }));
    setIsLedgerSelectOpen(false);
  };


  const handleSaveTransaction = async () => {
    if (!filterBranchId || !filterNepaliMiti) {
      toast({ title: "Error", description: "Branch and Miti must be selected for the Daybook.", variant: "destructive" });
      return;
    }

    if (!transactionFormData.ledgerAccountId) {
        toast({ title: "Validation Error", description: "Ledger Account / Expense Head is required for all transactions.", variant: "destructive" });
        return;
    }

    if (!transactionFormData.description && transactionFormData.transactionType !== "Cash In (from Delivery/Receipt)") {
        toast({ title: "Validation Error", description: "Description / Narration is required.", variant: "destructive" });
        return;
    }
     if (transactionFormData.amount <= 0 && transactionFormData.transactionType !== "Adjustment/Correction") { // Allow zero/negative for adjustment
        toast({ title: "Validation Error", description: "Amount must be greater than zero (except for Adjustments).", variant: "destructive" });
        return;
    }
    if (transactionFormData.transactionType === "Cash In (from Delivery/Receipt)" || transactionFormData.transactionType === "Delivery Expense (Cash Out)") {
        if(!transactionFormData.referenceId || !selectedBiltiForTx) {
            toast({ title: "Validation Error", description: "Please select a Bilti for this transaction type.", variant: "destructive" });
            return;
        }
         // Check for duplicate Cash In for the same Bilti in the current Daybook's transactions
         if(transactionFormData.transactionType === "Cash In (from Delivery/Receipt)") {
            const existingCashInForBilti = (activeDaybookFromState?.transactions || activeDaybook?.transactions || [])
                .find(tx => tx.referenceId === selectedBiltiForTx?.id && tx.transactionType === "Cash In (from Delivery/Receipt)" && tx.id !== editingTransaction?.id);
            if (existingCashInForBilti) {
                toast({ title: "Duplicate Entry", description: `Cash in for Bilti ${selectedBiltiForTx?.id} already exists in this daybook. Please edit the existing entry or choose a different Bilti.`, variant: "destructive"});
                return;
            }
        }
    }


    setIsSubmittingTransaction(true);
    let currentActiveDaybook = activeDaybookFromState || activeDaybook;
    let daybookDocRef;

    try {
      // Prepare transaction entry for Firestore
      const transactionEntry: FirestoreDaybookTransaction = {
        id: editingTransaction ? editingTransaction.id : `txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, // More unique local ID
        ...transactionFormData, // This includes ledgerAccountId
        nepaliMiti: transactionFormData.nepaliMiti || filterNepaliMiti, // Ensure Nepali Miti is set
        createdBy: PLACEHOLDER_USER_ID, // Replace with actual authenticated user ID
        createdAt: Timestamp.now(),
        autoLinked: (transactionFormData.transactionType === "Cash In (from Delivery/Receipt)" || transactionFormData.transactionType === "Delivery Expense (Cash Out)") && !!transactionFormData.referenceId,
      };

      if (!currentActiveDaybook) { // Daybook doesn't exist, create it first
        const parsedEnglishDate = parse(filterNepaliMiti, "yyyy-MM-dd", new Date());
        if (!isValid(parsedEnglishDate)) {
          toast({ title: "Error", description: "Invalid Nepali Miti format. Please use YYYY-MM-DD.", variant: "destructive" });
          setIsSubmittingTransaction(false);
          return;
        }

        const newDaybookPayload: FirestoreDaybook = {
          branchId: filterBranchId,
          nepaliMiti: filterNepaliMiti,
          englishMiti: Timestamp.fromDate(parsedEnglishDate),
          openingBalance: 0, // TODO: Implement fetching previous day's closing balance
          totalCashIn: 0, totalCashOut: 0, closingBalance: 0, // Will be recalculated on display or server-side
          status: "Draft",
          transactions: [transactionEntry],
          createdBy: PLACEHOLDER_USER_ID, // Replace with actual user
          createdAt: Timestamp.now(),
          processingTimestamp: Timestamp.now(), // Set processing timestamp on creation
        };
        daybookDocRef = await addDoc(collection(db, "daybooks"), newDaybookPayload);
        // Set the newly created daybook as active
        currentActiveDaybook = {
            ...newDaybookPayload,
            id: daybookDocRef.id,
            englishMiti: newDaybookPayload.englishMiti.toDate(),
            processingTimestamp: newDaybookPayload.processingTimestamp?.toDate(),
            transactions: newDaybookPayload.transactions.map(tx => ({...tx, createdAt: tx.createdAt.toDate()})), // Convert Timestamps
            createdAt: newDaybookPayload.createdAt.toDate()
        };
        toast({ title: "Daybook Created & Transaction Added", description: "New daybook initiated with the first transaction." });
      } else {
        // Daybook exists, add/update transaction
        daybookDocRef = doc(db, "daybooks", currentActiveDaybook.id);
        const updatedTransactions = editingTransaction
          ? currentActiveDaybook.transactions.map(tx => tx.id === editingTransaction.id ? transactionEntry : tx)
          : [...currentActiveDaybook.transactions, transactionEntry];

        await updateDoc(daybookDocRef, {
            transactions: updatedTransactions.map(tx => ({...tx, createdAt: Timestamp.fromDate(tx.createdAt || new Date())})), // Ensure Timestamps
            updatedAt: Timestamp.now(),
            updatedBy: PLACEHOLDER_USER_ID // Replace with actual user
        });
        // Update local state
        currentActiveDaybook = { ...currentActiveDaybook, transactions: updatedTransactions.map(tx => ({...tx, createdAt: tx.createdAt})) as DaybookTransaction[] };
        toast({ title: editingTransaction ? "Transaction Updated" : "Transaction Added", description: "Daybook successfully updated." });
      }

      setActiveDaybook(currentActiveDaybook); // Update local state immediately
      setActiveDaybookFromState(currentActiveDaybook); // Reflect changes for subsequent operations


      setIsTransactionFormOpen(false);
      setEditingTransaction(null);
      setTransactionFormData({...initialTransactionFormData, ledgerAccountId: ""}); // Reset form, clear ledger
      setSelectedBiltiForTx(null);
      setSelectedPartyForTx(null);
      setSelectedLedgerForTx(null);

    } catch (error) {
      console.error("Error saving transaction:", error);
      toast({ title: "Error", description: "Failed to save transaction.", variant: "destructive" });
    } finally {
      setIsSubmittingTransaction(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!activeDaybookFromState || !transactionToDelete) return;
    setIsSubmittingTransaction(true); // Use same loading state or a specific one
    try {
        const updatedTransactions = activeDaybookFromState.transactions.filter(tx => tx.id !== transactionToDelete.id);
        const daybookDocRef = doc(db, "daybooks", activeDaybookFromState.id);
        await updateDoc(daybookDocRef, {
            transactions: updatedTransactions.map(tx => ({...tx, createdAt: Timestamp.fromDate(tx.createdAt || new Date())})), // Ensure Timestamps
            updatedAt: Timestamp.now(),
            updatedBy: PLACEHOLDER_USER_ID
        });

        // Update local state
        const updatedDaybook = { ...activeDaybookFromState, transactions: updatedTransactions };
        setActiveDaybook(updatedDaybook);
        setActiveDaybookFromState(updatedDaybook);

        toast({ title: "Transaction Deleted", description: `Transaction "${transactionToDelete.description}" removed from the daybook.` });
        setIsDeleteTransactionAlertOpen(false);
        setTransactionToDelete(null);
    } catch (error) {
        console.error("Error deleting transaction:", error);
        toast({ title: "Error", description: "Failed to delete transaction.", variant: "destructive" });
    } finally {
        setIsSubmittingTransaction(false);
    }
  };

  const handleSubmitDaybook = async () => {
    if (!activeDaybookFromState || activeDaybookFromState.transactions.length === 0) {
        toast({ title: "Cannot Submit", description: "Please add at least one transaction before submitting the daybook.", variant: "destructive"});
        return;
    }
    setIsSubmittingDaybook(true);
    try {
        const daybookDocRef = doc(db, "daybooks", activeDaybookFromState.id);
        await updateDoc(daybookDocRef, {
            status: "Pending Approval",
            submittedAt: Timestamp.now(),
            submittedBy: PLACEHOLDER_USER_ID, // Replace with actual user
        });
        const updatedDaybook = { ...activeDaybookFromState, status: "Pending Approval" as const, submittedAt: new Date(), submittedBy: PLACEHOLDER_USER_ID };
        setActiveDaybook(updatedDaybook);
        setActiveDaybookFromState(updatedDaybook);
        toast({ title: "Daybook Submitted", description: "Daybook has been submitted for approval."});
    } catch (error) {
        console.error("Error submitting daybook:", error);
        toast({ title: "Error", description: "Failed to submit daybook.", variant: "destructive"});
    } finally {
        setIsSubmittingDaybook(false);
    }
  };

  const handleApproveDaybook = async () => {
    if (!activeDaybookFromState) return;
    setIsApprovingDaybook(true);
    try {
      const daybookDocRef = doc(db, "daybooks", activeDaybookFromState.id);
      // The client only updates the status and who approved it.
      // The Cloud Function `onDaybookApproval` will handle linked Bilti updates and LedgerEntry creation.
      await updateDoc(daybookDocRef, {
        status: "Approved",
        approvedAt: Timestamp.now(), // Client can set its perceived approval time
        approvedBy: SIMULATED_SUPER_ADMIN_ID, // Replace with actual admin user ID
      });

      // UI will update based on the Firestore listener or by re-fetching.
      // For immediate UI feedback (optimistic update):
      const updatedDaybook = {
        ...activeDaybookFromState,
        status: "Approved" as const,
        approvedAt: new Date(),
        approvedBy: SIMULATED_SUPER_ADMIN_ID
      };
      setActiveDaybook(updatedDaybook);
      setActiveDaybookFromState(updatedDaybook);

      toast({
        title: "Daybook Approved",
        description: "Approval submitted. Backend function will process linked records and ledger entries.",
      });
    } catch (error) {
      console.error("Error approving daybook:", error);
      toast({ title: "Error", description: "Failed to submit daybook approval.", variant: "destructive" });
    } finally {
      setIsApprovingDaybook(false);
    }
  };

  const handleRejectDaybook = async () => {
    if (!activeDaybookFromState) return;
    const remarks = prompt("Enter rejection remarks (optional):");
    // If user cancels prompt, remarks will be null. We proceed even if null.
    setIsApprovingDaybook(true); // Use same loading state for simplicity
    try {
        const daybookDocRef = doc(db, "daybooks", activeDaybookFromState.id);
        await updateDoc(daybookDocRef, {
            status: "Rejected",
            approvedAt: Timestamp.now(), // Or rejectionAt
            approvedBy: SIMULATED_SUPER_ADMIN_ID,
            approvalRemarks: remarks || "Rejected without specific remarks.",
        });
         const updatedDaybook = { ...activeDaybookFromState, status: "Rejected" as const, approvedAt: new Date(), approvedBy: SIMULATED_SUPER_ADMIN_ID, approvalRemarks: remarks || "Rejected" };
        setActiveDaybook(updatedDaybook);
        setActiveDaybookFromState(updatedDaybook);
        toast({ title: "Daybook Rejected", description: remarks ? `Reason: ${remarks}` : "Daybook has been rejected."});
    } catch (error) {
        console.error("Error rejecting daybook:", error);
        toast({ title: "Error", description: "Failed to reject daybook.", variant: "destructive"});
    } finally {
        setIsApprovingDaybook(false);
    }
  };

  const currentDaybookState = activeDaybookFromState || activeDaybook;
  const canEditDaybook = currentDaybookState?.status === "Draft" || (currentDaybookState?.status === "Rejected" && !isSuperAdmin); // Branch manager can edit if rejected by admin


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
              disabled={isLoading || (!currentDaybookState && (!filterBranchId || !filterNepaliMiti)) || (currentDaybookState && !canEditDaybook) || isSubmittingDaybook || isApprovingDaybook}
            >
              <PlusCircle className="mr-2 h-4 w-4"/> Add Transaction
            </Button>
            <Button variant="outline" onClick={() => alert("Print Daybook (Not Implemented)")} disabled={!currentDaybookState}>Print</Button>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Select Daybook</CardTitle>
          {/* <CardDescription>Select a branch and date to view or manage its daybook.</CardDescription> */}
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

      {/* Loading state for entire daybook */}
      {isLoading && !currentDaybookState && (
        <div className="flex justify-center items-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Loading daybook data...</p>
        </div>
      )}

      {/* Daybook not yet created message */}
      {!isLoading && filterBranchId && filterNepaliMiti && !currentDaybookState && (
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
             <Button onClick={() => handleOpenTransactionForm()} disabled={isLoading || !filterBranchId || !filterNepaliMiti}>
                <PlusCircle className="mr-2 h-4 w-4"/> Add First Transaction
             </Button>
          </CardFooter>
        </Card>
      )}

      {/* Active Daybook Display */}
      {currentDaybookState && (
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start">
                <div>
                    <CardTitle className="font-headline text-xl">
                        Daybook for: {getBranchNameById(currentDaybookState.branchId)} - {currentDaybookState.nepaliMiti}
                    </CardTitle>
                    <CardDescription>
                        English Date: {format(currentDaybookState.englishMiti, "PPP")} | Transactions: {daybookSummary.transactionsCount}
                        {currentDaybookState.processingTimestamp && ` | Processed: ${format(currentDaybookState.processingTimestamp, "PPp")}`}
                    </CardDescription>
                </div>
                <Badge
                    variant={
                        currentDaybookState.status === "Approved" ? "default" :
                        currentDaybookState.status === "Rejected" ? "destructive" :
                        currentDaybookState.status === "Pending Approval" ? "secondary" : "outline"
                    }
                    className={cn("text-sm mt-2 sm:mt-0",
                        currentDaybookState.status === "Approved" ? "bg-accent text-accent-foreground" :
                        currentDaybookState.status === "Pending Approval" ? "bg-yellow-400 text-yellow-900" : ""
                    )}
                >
                    Status: {currentDaybookState.status}
                </Badge>
            </div>
            {currentDaybookState.status === "Rejected" && currentDaybookState.approvalRemarks && (
                <p className="text-sm text-destructive mt-2">Rejection Remarks: {currentDaybookState.approvalRemarks}</p>
            )}
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
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentDaybookState.transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        No transactions added yet for this daybook.
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentDaybookState.transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                            <Badge variant={tx.transactionType.toLowerCase().includes("cash in") ? "secondary" : tx.transactionType.toLowerCase().includes("cash out") ? "outline" : "default"}
                                   className={cn(tx.transactionType.toLowerCase().includes("cash in") ? "bg-green-100 text-green-700" : tx.transactionType.toLowerCase().includes("cash out") ? "bg-red-100 text-red-700" : "")}
                            >
                                {tx.transactionType}
                            </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={tx.description}>{tx.description}</TableCell>
                        <TableCell>{tx.referenceId || tx.partyId || tx.ledgerAccountId || 'N/A'}</TableCell>
                        <TableCell className={cn("text-right font-medium", tx.transactionType.toLowerCase().includes("cash in") ? "text-green-600" : tx.transactionType === "Adjustment/Correction" && tx.amount < 0 ? "text-red-600" : tx.transactionType.toLowerCase().includes("cash out") ? "text-red-600" : "text-foreground" )}>
                            {tx.transactionType.toLowerCase().includes("cash out") || (tx.transactionType === "Adjustment/Correction" && tx.amount < 0) ? "-" : ""}{Math.abs(tx.amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {canEditDaybook && (
                            <div className="flex gap-1">
                                <Button variant="outline" size="icon" onClick={() => handleOpenTransactionForm(tx)} disabled={isSubmittingDaybook || isApprovingDaybook || isSubmittingTransaction} aria-label="Edit Transaction"><Edit className="h-4 w-4"/></Button>
                                <Button variant="destructive" size="icon" onClick={() => {setTransactionToDelete(tx); setIsDeleteTransactionAlertOpen(true);}} disabled={isSubmittingDaybook || isApprovingDaybook || isSubmittingTransaction} aria-label="Delete Transaction"><Trash2 className="h-4 w-4"/></Button>
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
             {canEditDaybook && currentDaybookState.transactions.length > 0 && (
                <Button onClick={handleSubmitDaybook} disabled={isSubmittingDaybook || isApprovingDaybook || isSubmittingTransaction}>
                    {isSubmittingDaybook && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Submit for Approval
                </Button>
             )}
             {isSuperAdmin && currentDaybookState.status === "Pending Approval" && (
                <>
                <Button onClick={handleApproveDaybook} className="bg-green-600 hover:bg-green-700 text-white" disabled={isApprovingDaybook || isSubmittingDaybook || isSubmittingTransaction}>
                    {isApprovingDaybook && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Approve Daybook
                </Button>
                <Button onClick={handleRejectDaybook} variant="destructive" disabled={isApprovingDaybook || isSubmittingDaybook || isSubmittingTransaction}>
                    Reject Daybook
                </Button>
                </>
             )}
             {currentDaybookState.status === "Approved" && <p className="text-sm text-green-600 font-semibold">Daybook Approved by {currentDaybookState.approvedBy || "N/A"} on {currentDaybookState.approvedAt ? format(currentDaybookState.approvedAt, "PPp") : "N/A"}</p>}
             {currentDaybookState.status === "Rejected" && !canEditDaybook && <p className="text-sm text-red-600 font-semibold">Daybook Rejected. Branch manager to review.</p>}
             {currentDaybookState.status === "Rejected" && canEditDaybook && <p className="text-sm text-red-600 font-semibold">Daybook Rejected. Please review and resubmit.</p>}

          </CardFooter>
        </Card>
      )}

      {/* Transaction Add/Edit Dialog */}
      <Dialog open={isTransactionFormOpen} onOpenChange={(isOpen) => {
          setIsTransactionFormOpen(isOpen);
          if (!isOpen) {
            setEditingTransaction(null);
            setTransactionFormData({...initialTransactionFormData, ledgerAccountId: ""});
            setSelectedBiltiForTx(null);
            setSelectedPartyForTx(null);
            setSelectedLedgerForTx(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>{editingTransaction ? "Edit Transaction" : "Add New Transaction"}</DialogTitle>
                <DialogDescription>
                    Enter details for the cash book transaction. Fields marked <span className="text-destructive">*</span> are required.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow pr-1"> {/* Added pr-1 for scrollbar visibility if needed */}
            <form onSubmit={(e) => { e.preventDefault(); handleSaveTransaction(); }} className="space-y-3 py-2"> {/* Removed grid and items-center for more natural flow */}
                 <div>
                    <Label htmlFor="txType">Transaction Type <span className="text-destructive">*</span></Label>
                    <Select value={transactionFormData.transactionType} onValueChange={handleTransactionFormTypeChange} required>
                        <SelectTrigger id="txType"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {transactionTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div>
                    <Label htmlFor="txNepaliMiti">Nepali Miti (Transaction Specific, Optional)</Label>
                    <Input id="txNepaliMiti" name="nepaliMiti" value={transactionFormData.nepaliMiti || ""} onChange={handleTransactionFormInputChange} placeholder="Defaults to Daybook Miti"/>
                </div>


                {/* Bilti Selection - Conditional */}
                {(transactionFormData.transactionType === "Cash In (from Delivery/Receipt)" || transactionFormData.transactionType === "Delivery Expense (Cash Out)") && (
                    <div>
                        <Label htmlFor="biltiSelect">Select Bilti <span className="text-destructive">*</span></Label>
                        <Popover open={isBiltiSelectOpen} onOpenChange={setIsBiltiSelectOpen}>
                            <PopoverTrigger asChild>
                                <Button id="biltiSelect" variant="outline" className="w-full justify-start text-left">
                                    {selectedBiltiForTx ? `${selectedBiltiForTx.id} (To: ${selectedBiltiForTx.destination})` : "Select Bilti..."}
                                    <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[450px] p-0" align="start"> {/* Increased width */}
                                <Command>
                                    <CommandInput placeholder="Search Bilti No. or Destination..." onValueChange={setBiltiSearchTerm} value={biltiSearchTerm}/>
                                    <CommandList className="max-h-[250px] overflow-y-auto">
                                    <CommandEmpty>No Bilti found.</CommandEmpty>
                                    {allBiltisMaster
                                        .filter(b => {
                                            // Filter for "Cash In (from Delivery/Receipt)"
                                            if (transactionFormData.transactionType === "Cash In (from Delivery/Receipt)") {
                                                return (b.status === "Delivered" || b.status === "Received") && b.payMode !== "Paid" && b.cashCollectionStatus !== "Collected" &&
                                                       (b.id.toLowerCase().includes(biltiSearchTerm.toLowerCase()) || b.destination.toLowerCase().includes(biltiSearchTerm.toLowerCase()));
                                            }
                                            // General filter for "Delivery Expense (Cash Out)"
                                            return (b.id.toLowerCase().includes(biltiSearchTerm.toLowerCase()) || b.destination.toLowerCase().includes(biltiSearchTerm.toLowerCase()));
                                        })
                                        .map(bilti => (
                                        <CommandItem
                                            key={bilti.id}
                                            value={`${bilti.id} ${bilti.destination} ${getPartyNameById(bilti.consigneeId)}`} // Make value more unique for Command
                                            onSelect={() => handleBiltiSelectForTx(bilti.id)}
                                            className="cursor-pointer flex flex-col items-start !text-left p-2 hover:bg-accent" // Custom styling
                                        >
                                            <div className="flex w-full justify-between items-center">
                                                <p className="font-semibold text-primary">{bilti.id}</p>
                                                <CheckIcon className={cn("h-4 w-4", selectedBiltiForTx?.id === bilti.id ? "opacity-100" : "opacity-0")}/>
                                            </div>
                                            <p className="text-sm">Consignee: <span className="font-medium">{getPartyNameById(bilti.consigneeId)}</span></p>
                                            <p className="text-xs text-muted-foreground">To: {bilti.destination} | Miti: {format(bilti.miti, "PP")}</p>
                                            <p className="text-xs text-muted-foreground">Pkgs: {bilti.packages} | Amount: Rs. {bilti.totalAmount.toFixed(2)}</p>
                                        </CommandItem>
                                    ))}
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                )}

                <div>
                    <Label htmlFor="txAmount">Amount <span className="text-destructive">*</span></Label>
                    <Input id="txAmount" name="amount" type="number" value={transactionFormData.amount} onChange={handleTransactionFormInputChange}
                           readOnly={transactionFormData.transactionType === "Cash In (from Delivery/Receipt)" && !!selectedBiltiForTx} required/>
                </div>

                <div>
                    <Label htmlFor="txDescription">Description / Narration <span className="text-destructive">*</span></Label>
                    <Textarea id="txDescription" name="description" value={transactionFormData.description} onChange={handleTransactionFormInputChange}
                              readOnly={transactionFormData.transactionType === "Cash In (from Delivery/Receipt)" && !!selectedBiltiForTx} required rows={3}/>
                </div>

                {/* Party Selection - Conditional (but ledger is always shown now) */}
                {(transactionFormData.transactionType === "Cash Out (to Expense/Supplier/Other)" || transactionFormData.transactionType === "Cash In (Other)" || transactionFormData.transactionType === "Cash In (from Party Payment)") && (
                    <div>
                        <Label htmlFor="partySelect">Party (Optional)</Label>
                         <Popover open={isPartySelectOpen} onOpenChange={setIsPartySelectOpen}>
                            <PopoverTrigger asChild>
                                <Button id="partySelect" variant="outline" className="w-full justify-start text-left">
                                    {selectedPartyForTx ? selectedPartyForTx.name : "Select Party..."}
                                    <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Search Party..." onValueChange={setPartySearchTerm} value={partySearchTerm}/>
                                    <CommandList>
                                    <CommandEmpty>No Party found.</CommandEmpty>
                                    {parties.filter(p => p.name.toLowerCase().includes(partySearchTerm.toLowerCase())).map(party => (
                                        <CommandItem key={party.id} value={party.name} onSelect={() => handlePartySelectForTx(party.id)} className="cursor-pointer">
                                            <CheckIcon className={cn("mr-2 h-4 w-4", selectedPartyForTx?.id === party.id ? "opacity-100" : "opacity-0")}/>
                                            {party.name}
                                        </CommandItem>
                                    ))}
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                )}
                
                {/* Ledger Account Selection - Always Visible */}
                <div>
                    <Label htmlFor="ledgerAccountSelect">Ledger Account / Expense Head <span className="text-destructive">*</span></Label>
                     <Popover open={isLedgerSelectOpen} onOpenChange={setIsLedgerSelectOpen}>
                        <PopoverTrigger asChild>
                            <Button id="ledgerAccountSelect" variant="outline" className="w-full justify-start text-left">
                                {selectedLedgerForTx ? selectedLedgerForTx.accountName : "Select Ledger/Expense Head..."}
                                <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Search Ledger/Expense..." onValueChange={setLedgerSearchTerm} value={ledgerSearchTerm}/>
                                <CommandList>
                                <CommandEmpty>No Ledger/Expense Head found.</CommandEmpty>
                                {ledgerAccounts.filter(la => la.accountName.toLowerCase().includes(ledgerSearchTerm.toLowerCase())).map(la => (
                                    <CommandItem key={la.id} value={la.accountName} onSelect={() => handleLedgerSelectForTx(la.id)} className="cursor-pointer">
                                        <CheckIcon className={cn("mr-2 h-4 w-4", selectedLedgerForTx?.id === la.id ? "opacity-100" : "opacity-0")}/>
                                        {la.accountName} ({la.accountType})
                                    </CommandItem>
                                ))}
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Removed Manual Expense Head Input as Ledger Account selection is now mandatory */}

                {transactionFormData.transactionType === "Adjustment/Correction" && (
                    <div>
                        <Label htmlFor="txReasonForAdjustment">Reason for Adjustment <span className="text-destructive">*</span></Label>
                        <Textarea id="txReasonForAdjustment" name="reasonForAdjustment" value={transactionFormData.reasonForAdjustment || ""} onChange={handleTransactionFormInputChange} required />
                    </div>
                )}

                <div>
                    <Label htmlFor="txSupportingDocUrl">Supporting Document URL (Optional)</Label>
                    <div className="flex items-center gap-2">
                        <Input id="txSupportingDocUrl" name="supportingDocUrl" value={transactionFormData.supportingDocUrl || ""} onChange={handleTransactionFormInputChange} placeholder="https://example.com/doc.pdf"/>
                        <Button type="button" variant="outline" size="icon" onClick={() => alert("File upload not implemented")} aria-label="Upload document"><UploadCloud className="h-4 w-4"/></Button>
                    </div>
                </div>
                <DialogFooter className="pt-4 border-t !mt-6"> {/* Use !mt-6 to ensure spacing */}
                    <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingTransaction}>Cancel</Button></DialogClose>
                    <Button type="submit" disabled={isSubmittingTransaction}>
                        {isSubmittingTransaction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editingTransaction ? "Update Transaction" : "Save Transaction"}
                    </Button>
                </DialogFooter>
            </form>
            </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Transaction Confirmation Dialog */}
      <AlertDialog open={isDeleteTransactionAlertOpen} onOpenChange={setIsDeleteTransactionAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the transaction: <span className="font-medium">{transactionToDelete?.description}</span>.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setTransactionToDelete(null)} disabled={isSubmittingTransaction}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteTransaction} disabled={isSubmittingTransaction}>
                    {isSubmittingTransaction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete Transaction
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

