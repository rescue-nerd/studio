
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
import { BookOpenCheck, CalendarIcon, PlusCircle, Edit, Trash2, Filter, Loader2, FileText, UploadCloud, Search, Paperclip, Info } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs for transactions
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
  deleteDoc, // Not used for transactions directly but for Daybook potentially
  writeBatch
} from "firebase/firestore";
import type {
  Daybook as FirestoreDaybook,
  DaybookTransaction as FirestoreDaybookTransaction,
  DaybookTransactionType,
  Branch as FirestoreBranch,
  Bilti as FirestoreBilti,
  Party as FirestoreParty,
  LedgerAccount as FirestoreLedgerAccount
} from "@/types/firestore";

// Local Interfaces extending Firestore types for UI (e.g., Date objects)
interface Daybook extends Omit<FirestoreDaybook, 'englishMiti' | 'createdAt' | 'updatedAt' | 'submittedAt' | 'approvedAt'> {
  englishMiti: Date;
  transactions: DaybookTransactionUI[];
  createdAt?: Date;
  updatedAt?: Date;
  submittedAt?: Date;
  approvedAt?: Date;
}
interface DaybookTransactionUI extends Omit<FirestoreDaybookTransaction, 'createdAt'> {
  createdAt: Date;
  // Optional: Store fetched Bilti/Party/Ledger data for easier display in transaction rows
  linkedBiltiData?: BiltiUI;
  linkedPartyData?: PartyUI;
  linkedLedgerData?: LedgerAccountUI;
}
interface Branch extends FirestoreBranch {}
interface BiltiUI extends Omit<FirestoreBilti, 'miti' | 'createdAt' | 'updatedAt'> {
  miti: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
interface PartyUI extends FirestoreParty {}
interface LedgerAccountUI extends Omit<FirestoreLedgerAccount, 'createdAt' | 'updatedAt' | 'lastTransactionAt'> {
   createdAt: Date;
   updatedAt?: Date;
   lastTransactionAt?: Date;
}

const PLACEHOLDER_USER_ID = "system_user_placeholder"; // Replace with actual auth logic
const SIMULATED_BRANCH_ID = "BRN001_KTM_MAIN"; // Simulate logged-in user's branch

const transactionTypes: DaybookTransactionType[] = [
  "Cash In (Delivery/Receipt)",
  "Delivery Expense (Cash Out)",
  "Cash Out (Expense/Supplier/Other)",
  "Cash In (Other)",
  "Cash Out (Other)",
  "Cash In (from Party Payment)",
  "Cash Out (to Driver/Staff, Petty Expense)",
  "Adjustment/Correction"
];

const defaultTransactionFormData: Omit<FirestoreDaybookTransaction, 'id' | 'createdBy' | 'createdAt'> = {
  transactionType: "Cash Out (Expense/Supplier/Other)",
  amount: 0,
  description: "",
  autoLinked: false,
};

// Helper to get today's Nepali Miti string (Placeholder - replace with actual library)
const getTodayNepaliMiti = (): string => {
  // Placeholder: In a real app, use a reliable Nepali date conversion library
  const today = new Date();
  // This is NOT an actual Nepali date, just a placeholder format
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}_AD`;
};

export default function DaybookPage() {
  const { toast } = useToast();

  // --- State Variables ---
  const [daybooksList, setDaybooksList] = useState<Daybook[]>([]);
  const [activeDaybook, setActiveDaybook] = useState<Daybook | null>(null);
  
  const [branches, setBranches] = useState<Branch[]>([]);
  const [biltisForSelection, setBiltisForSelection] = useState<BiltiUI[]>([]);
  const [parties, setParties] = useState<PartyUI[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccountUI[]>([]); // For expense heads, etc.

  // Filters for Daybook List
  const [filterNepaliMiti, setFilterNepaliMiti] = useState<string>(getTodayNepaliMiti());
  const [filterBranchId, setFilterBranchId] = useState<string>(SIMULATED_BRANCH_ID); // Admin might change this
  const [filterStatus, setFilterStatus] = useState<FirestoreDaybook["status"] | "All">("All");

  // Transaction Form Dialog
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FirestoreDaybookTransaction | null>(null);
  const [transactionFormData, setTransactionFormData] = useState<Omit<FirestoreDaybookTransaction, 'id' | 'createdBy' | 'createdAt'>>(defaultTransactionFormData);
  const [selectedBiltiForTx, setSelectedBiltiForTx] = useState<BiltiUI | null>(null);

  // Loading States
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingActiveDaybook, setIsLoadingActiveDaybook] = useState(false);
  const [isLoadingMasterData, setIsLoadingMasterData] = useState(true);
  const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);
  const [isSubmittingDaybook, setIsSubmittingDaybook] = useState(false);

  // --- Data Fetching ---
  const fetchMasterData = async () => {
    setIsLoadingMasterData(true);
    try {
      const [branchesSnap, biltisSnap, partiesSnap, ledgersSnap] = await Promise.all([
        getDocs(query(collection(db, "branches"), orderBy("name"))),
        getDocs(query(collection(db, "biltis"), where("status", "in", ["Delivered", "Paid"]))), // Eligible for cash-in or expense linking
        getDocs(query(collection(db, "parties"), orderBy("name"))),
        getDocs(query(collection(db, "ledgerAccounts"), orderBy("accountName")))
      ]);
      setBranches(branchesSnap.docs.map(d => ({ ...d.data(), id: d.id } as Branch)));
      const fetchedBiltis = biltisSnap.docs.map(d => {
        const data = d.data() as FirestoreBilti;
        return { ...data, id: d.id, miti: data.miti.toDate() } as BiltiUI;
      });
      setBiltisForSelection(fetchedBiltis);
      setParties(partiesSnap.docs.map(d => ({ ...d.data(), id: d.id } as PartyUI)));
      setLedgerAccounts(ledgersSnap.docs.map(d => {
        const data = d.data() as FirestoreLedgerAccount;
        return { ...data, id: d.id, createdAt: data.createdAt.toDate() } as LedgerAccountUI;
      }));
    } catch (error) {
      console.error("Error fetching master data: ", error);
      toast({ title: "Error", description: "Failed to load master data.", variant: "destructive" });
    } finally {
      setIsLoadingMasterData(false);
    }
  };

  const fetchDaybooksList = async () => {
    setIsLoadingList(true);
    let q = query(collection(db, "daybooks"));
    if (filterNepaliMiti && filterNepaliMiti !== "All") q = query(q, where("nepaliMiti", "==", filterNepaliMiti));
    if (filterBranchId && filterBranchId !== "All") q = query(q, where("branchId", "==", filterBranchId));
    if (filterStatus && filterStatus !== "All") q = query(q, where("status", "==", filterStatus));
    q = query(q, orderBy("englishMiti", "desc"));

    try {
      const querySnapshot = await getDocs(q);
      const fetchedDaybooks = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data() as FirestoreDaybook;
        return {
          ...data,
          id: docSnap.id,
          englishMiti: data.englishMiti.toDate(),
          transactions: (data.transactions || []).map(t => ({...t, createdAt: t.createdAt.toDate()})),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          submittedAt: data.submittedAt?.toDate(),
          approvedAt: data.approvedAt?.toDate(),
        } as Daybook;
      });
      setDaybooksList(fetchedDaybooks);
    } catch (error) {
      console.error("Error fetching daybooks list: ", error);
      toast({ title: "Error", description: "Failed to fetch daybooks.", variant: "destructive" });
    } finally {
      setIsLoadingList(false);
    }
  };
  
  const loadOrCreateActiveDaybook = async (nepaliMiti: string, branchId: string) => {
    if (!nepaliMiti || !branchId) {
      setActiveDaybook(null);
      return;
    }
    setIsLoadingActiveDaybook(true);
    try {
      const daybookDocId = `${branchId}_${nepaliMiti}`; // Or query if using auto-IDs
      const daybookRef = doc(db, "daybooks", daybookDocId); // Assuming composite ID for direct fetch
      // For simplicity, we'll query if we don't use composite ID.
      // Let's assume we query:
      const q = query(collection(db, "daybooks"), 
                      where("branchId", "==", branchId), 
                      where("nepaliMiti", "==", nepaliMiti));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data() as FirestoreDaybook;
        setActiveDaybook({
          ...data,
          id: docSnap.id,
          englishMiti: data.englishMiti.toDate(),
          transactions: (data.transactions || []).map(t => ({...t, createdAt: t.createdAt.toDate(), linkedBiltiData: biltisForSelection.find(b => b.id === t.referenceId)})),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        });
      } else {
        // No daybook exists for today, create a draft IF a transaction is being added
        // For now, we'll set activeDaybook to null, and create it when the first transaction is added.
        setActiveDaybook(null); 
      }
    } catch (error) {
      console.error("Error loading active daybook: ", error);
      toast({ title: "Error", description: "Could not load or create daybook for today.", variant: "destructive" });
    } finally {
      setIsLoadingActiveDaybook(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchDaybooksList();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterNepaliMiti, filterBranchId, filterStatus]);
  
  useEffect(() => {
    // Automatically load today's daybook for the current branch when component mounts or filter changes
    if(!isLoadingMasterData){ // Ensure master data like biltis is loaded for linking
        loadOrCreateActiveDaybook(filterNepaliMiti, filterBranchId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterNepaliMiti, filterBranchId, isLoadingMasterData]);


  // --- Derived State & Calculations ---
  const daybookSummary = useMemo(() => {
    if (!activeDaybook) return { openingBalance: 0, totalCashIn: 0, totalCashOut: 0, closingBalance: 0, cashInByType: {}, cashOutByType: {} };
    
    let totalCashIn = 0;
    let totalCashOut = 0;
    const cashInByType: Record<string, number> = {};
    const cashOutByType: Record<string, number> = {};

    activeDaybook.transactions.forEach(tx => {
      if (["Cash In (Delivery/Receipt)", "Cash In (Other)", "Cash In (from Party Payment)"].includes(tx.transactionType) || (tx.transactionType === "Adjustment/Correction" && tx.amount > 0)) {
        totalCashIn += tx.amount;
        cashInByType[tx.transactionType] = (cashInByType[tx.transactionType] || 0) + tx.amount;
      } else if (["Delivery Expense (Cash Out)", "Cash Out (Expense/Supplier/Other)", "Cash Out (Other)", "Cash Out (to Driver/Staff, Petty Expense)"].includes(tx.transactionType) || (tx.transactionType === "Adjustment/Correction" && tx.amount < 0) ){
        totalCashOut += Math.abs(tx.amount); // Amount for cash out is stored positive, but logically negative for balance
        cashOutByType[tx.transactionType] = (cashOutByType[tx.transactionType] || 0) + Math.abs(tx.amount);
      }
    });
    const openingBalance = activeDaybook.openingBalance || 0;
    const closingBalance = openingBalance + totalCashIn - totalCashOut;
    return { openingBalance, totalCashIn, totalCashOut, closingBalance, cashInByType, cashOutByType };
  }, [activeDaybook]);


  // --- Event Handlers ---
  const handleTransactionFormChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTransactionFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTransactionTypeChange = (value: DaybookTransactionType) => {
    setTransactionFormData(prev => ({ 
        ...defaultTransactionFormData, // Reset most fields
        transactionType: value, 
        amount: prev.transactionType === "Cash In (Delivery/Receipt)" && value !== "Cash In (Delivery/Receipt)" ? 0 : prev.amount, // Reset amount if switching from auto-filled
        description: prev.transactionType === "Cash In (Delivery/Receipt)" && value !== "Cash In (Delivery/Receipt)" ? "" : prev.description, // Reset description
    }));
    setSelectedBiltiForTx(null);
  };

  const handleBiltiSelectForTx = (biltiId: string) => {
    const bilti = biltisForSelection.find(b => b.id === biltiId);
    if (bilti) {
      setSelectedBiltiForTx(bilti);
      if (transactionFormData.transactionType === "Cash In (Delivery/Receipt)") {
        setTransactionFormData(prev => ({
          ...prev,
          amount: bilti.totalAmount,
          description: `Cash received for Bilti ${bilti.id}`,
          referenceId: bilti.id,
          partyId: bilti.consigneeId, // Or consignor depending on who pays
          autoLinked: true,
        }));
      } else if (transactionFormData.transactionType === "Delivery Expense (Cash Out)") {
         setTransactionFormData(prev => ({
          ...prev,
          referenceId: bilti.id,
          partyId: bilti.consigneeId, // Or relevant party for expense
          autoLinked: true,
          description: `Expense for Bilti ${bilti.id}: `, // Prompt user to complete
        }));
      }
    }
  };
  
  const handleSaveTransaction = async () => {
    if (!activeDaybook && !(filterBranchId && filterNepaliMiti)) {
        toast({ title: "Error", description: "No active daybook context. Select branch and Miti.", variant: "destructive"});
        return;
    }
    // Basic Validations
    if (transactionFormData.transactionType === "Cash In (Delivery/Receipt)" && !selectedBiltiForTx) {
        toast({title: "Validation Error", description: "Please select a Bilti/Delivery for this cash-in.", variant: "destructive"}); return;
    }
    if (transactionFormData.transactionType === "Delivery Expense (Cash Out)" && !selectedBiltiForTx) {
        toast({title: "Validation Error", description: "Please select a Bilti/Delivery to link this expense.", variant: "destructive"}); return;
    }
    if (!transactionFormData.description.trim() && transactionFormData.transactionType !== "Cash In (Delivery/Receipt)") {
        toast({title: "Validation Error", description: "Description is required.", variant: "destructive"}); return;
    }
    if (transactionFormData.amount <= 0 && transactionFormData.transactionType !== "Adjustment/Correction") { // Adjustments can be negative conceptually
        toast({title: "Validation Error", description: "Amount must be greater than zero.", variant: "destructive"}); return;
    }
    // Duplicate Delivery Cash-In check (basic)
    if (transactionFormData.transactionType === "Cash In (Delivery/Receipt)" && activeDaybook?.transactions.some(tx => tx.referenceId === selectedBiltiForTx?.id && tx.transactionType === "Cash In (Delivery/Receipt)" && tx.id !== editingTransaction?.id)) {
        toast({title: "Duplicate Entry", description: `Cash-in for Bilti ${selectedBiltiForTx?.id} already exists in this daybook.`, variant: "warning"}); return;
    }

    setIsSubmittingTransaction(true);
    let currentDaybook = activeDaybook;

    // Create Daybook if it doesn't exist (first transaction for the day)
    if (!currentDaybook) {
        const newDaybookPayload: Omit<FirestoreDaybook, 'id'> = {
            branchId: filterBranchId,
            nepaliMiti: filterNepaliMiti,
            englishMiti: Timestamp.now(), // Or derive from nepaliMiti if possible
            openingBalance: 0, // Placeholder - fetch previous day's closing in real app
            totalCashIn: 0, totalCashOut: 0, closingBalance: 0, // Will be updated
            status: "Draft",
            transactions: [],
            createdBy: PLACEHOLDER_USER_ID,
            createdAt: Timestamp.now(),
        };
        try {
            // Using composite ID for predictability, otherwise query after addDoc
            const daybookDocId = `${filterBranchId}_${filterNepaliMiti}`; 
            const daybookRef = doc(db, "daybooks", daybookDocId);
            // await setDoc(daybookRef, newDaybookPayload); // Use setDoc with specific ID
            // For auto-ID: const docRef = await addDoc(collection(db, "daybooks"), newDaybookPayload);
            // For now, let's assume a predictable ID or that addDoc is used and ID is retrieved.
            // This part needs robust ID generation or query strategy.
            // To simplify, let's use addDoc and then refetch/update local state
            const docRef = await addDoc(collection(db, "daybooks"), newDaybookPayload);
            currentDaybook = { 
                ...newDaybookPayload, 
                id: docRef.id, 
                englishMiti: newDaybookPayload.englishMiti.toDate(),
                transactions: [] 
            };
            setActiveDaybook(currentDaybook);
            setDaybooksList(prev => [currentDaybook!, ...prev]); // Add to list
            toast({title: "Daybook Created", description: `Draft daybook started for ${filterNepaliMiti}.`});
        } catch(error) {
            console.error("Error creating new daybook:", error);
            toast({title: "Error", description: "Failed to create new daybook document.", variant: "destructive"});
            setIsSubmittingTransaction(false);
            return;
        }
    }
    
    if (!currentDaybook) { // Should not happen if creation succeeded
        toast({title: "Error", description: "Daybook context lost.", variant: "destructive"});
        setIsSubmittingTransaction(false);
        return;
    }

    const newTransaction: FirestoreDaybookTransaction = {
      ...transactionFormData,
      id: editingTransaction ? editingTransaction.id : uuidv4(),
      createdBy: PLACEHOLDER_USER_ID,
      createdAt: editingTransaction ? Timestamp.fromDate(editingTransaction.createdAt as Date) : Timestamp.now(),
      amount: Number(transactionFormData.amount) || 0,
      // Ensure referenceId and autoLinked are set if a Bilti was selected
      referenceId: selectedBiltiForTx?.id || transactionFormData.referenceId,
      autoLinked: !!selectedBiltiForTx,
    };

    const updatedTransactions = editingTransaction
      ? currentDaybook.transactions.map(tx => tx.id === editingTransaction.id ? {...newTransaction, createdAt: (newTransaction.createdAt as Timestamp).toDate() } as DaybookTransactionUI : tx)
      : [...currentDaybook.transactions, {...newTransaction, createdAt: (newTransaction.createdAt as Timestamp).toDate() } as DaybookTransactionUI];

    try {
      const daybookRef = doc(db, "daybooks", currentDaybook.id);
      await updateDoc(daybookRef, { 
          transactions: updatedTransactions.map(tx => ({...tx, createdAt: Timestamp.fromDate(tx.createdAt)})), // Convert Dates back to Timestamps for Firestore
          updatedAt: Timestamp.now(),
          updatedBy: PLACEHOLDER_USER_ID 
      });
      
      setActiveDaybook(prev => prev ? { ...prev, transactions: updatedTransactions, updatedAt: new Date() } : null);
      toast({ title: editingTransaction ? "Transaction Updated" : "Transaction Added", description: "Transaction saved to draft daybook." });
      setIsTransactionFormOpen(false);
      setEditingTransaction(null);
      setTransactionFormData(defaultTransactionFormData);
      setSelectedBiltiForTx(null);
    } catch (error) {
      console.error("Error saving transaction: ", error);
      toast({ title: "Error", description: "Failed to save transaction.", variant: "destructive" });
    } finally {
      setIsSubmittingTransaction(false);
    }
  };

  const handleEditTransaction = (tx: FirestoreDaybookTransaction) => {
    setEditingTransaction(tx);
    const bilti = biltisForSelection.find(b => b.id === tx.referenceId);
    setSelectedBiltiForTx(bilti || null);
    setTransactionFormData({
        transactionType: tx.transactionType,
        amount: tx.amount,
        referenceId: tx.referenceId,
        partyId: tx.partyId,
        ledgerAccountId: tx.ledgerAccountId,
        expenseHead: tx.expenseHead,
        description: tx.description,
        supportingDocUrl: tx.supportingDocUrl,
        autoLinked: tx.autoLinked,
        reasonForAdjustment: tx.reasonForAdjustment,
    });
    setIsTransactionFormOpen(true);
  };
  
  const handleDeleteTransaction = async (txId: string) => {
    if (!activeDaybook || activeDaybook.status !== "Draft") {
        toast({title: "Error", description: "Can only delete transactions from a Draft daybook.", variant: "destructive"});
        return;
    }
    const confirmed = window.confirm("Are you sure you want to delete this transaction?");
    if (confirmed && activeDaybook) {
        const updatedTransactions = activeDaybook.transactions.filter(tx => tx.id !== txId);
        try {
            const daybookRef = doc(db, "daybooks", activeDaybook.id);
            await updateDoc(daybookRef, { 
                transactions: updatedTransactions.map(t => ({...t, createdAt: Timestamp.fromDate(t.createdAt)})),
                updatedAt: Timestamp.now(),
                updatedBy: PLACEHOLDER_USER_ID
            });
            setActiveDaybook(prev => prev ? { ...prev, transactions: updatedTransactions, updatedAt: new Date() } : null);
            toast({title: "Transaction Deleted", description: "Transaction removed from draft."});
        } catch (error) {
            console.error("Error deleting transaction:", error);
            toast({title: "Error", description: "Failed to delete transaction.", variant: "destructive"});
        }
    }
  };

  const handleDaybookAction = async (action: "Submit" | "Approve" | "Reject") => {
    if (!activeDaybook) return;
    setIsSubmittingDaybook(true);
    
    let newStatus: FirestoreDaybook["status"] = activeDaybook.status;
    let approvalRemarksVal: string | undefined = undefined;

    if (action === "Submit") newStatus = "Pending Approval";
    else if (action === "Approve") newStatus = "Approved";
    else if (action === "Reject") {
        newStatus = "Rejected";
        approvalRemarksVal = window.prompt("Enter rejection remarks (required for rejection):") || "";
        if (!approvalRemarksVal.trim()) {
            toast({title: "Remarks Required", description: "Please provide a reason for rejection.", variant: "warning"});
            setIsSubmittingDaybook(false);
            return;
        }
    }

    const daybookRef = doc(db, "daybooks", activeDaybook.id);
    const updatePayload: Partial<FirestoreDaybook> = {
      status: newStatus,
      updatedAt: Timestamp.now(),
      updatedBy: PLACEHOLDER_USER_ID,
    };

    if (action === "Submit") updatePayload.submittedAt = Timestamp.now();
    if (action === "Approve" || action === "Reject") {
      updatePayload.approvedAt = Timestamp.now();
      updatePayload.approvedBy = PLACEHOLDER_USER_ID; // Actual admin User ID
      if (approvalRemarksVal) updatePayload.approvalRemarks = approvalRemarksVal;
    }

    // --- Batch write for Bilti updates on Approval ---
    const batch = writeBatch(db);
    batch.update(daybookRef, updatePayload);

    let biltiUpdateSuccess = true;
    if (newStatus === "Approved") {
        // Post to ledgers (simulated - actual posting is complex)
        toast({title: "Ledger Posting (Simulated)", description: "Approved transactions would now be posted to respective ledgers.", variant: "info", duration: 5000});

        activeDaybook.transactions.forEach(tx => {
            if (tx.transactionType === "Cash In (Delivery/Receipt)" && tx.referenceId) {
                const biltiRef = doc(db, "biltis", tx.referenceId);
                batch.update(biltiRef, { 
                    status: "Paid", 
                    cashCollectionStatus: "Collected",
                    daybookCashInRef: tx.id, // Link daybook transaction to bilti
                    updatedAt: Timestamp.now(),
                    updatedBy: PLACEHOLDER_USER_ID
                });
            } else if (tx.transactionType === "Delivery Expense (Cash Out)" && tx.referenceId) {
                const biltiRef = doc(db, "biltis", tx.referenceId);
                const biltiToUpdate = biltisForSelection.find(b => b.id === tx.referenceId);
                if (biltiToUpdate) {
                    const newExpenseEntry = {
                        daybookTransactionId: tx.id,
                        amount: tx.amount,
                        description: tx.description,
                        miti: tx.createdAt // Using transaction creation time as expense time
                    };
                    const updatedExpenses = [...(biltiToUpdate.deliveryExpenses || []), newExpenseEntry];
                    batch.update(biltiRef, { 
                        deliveryExpenses: updatedExpenses,
                        updatedAt: Timestamp.now(),
                        updatedBy: PLACEHOLDER_USER_ID
                    });
                }
            }
        });
    }

    try {
      await batch.commit();
      setActiveDaybook(prev => prev ? { ...prev, ...updatePayload, status: newStatus, updatedAt: new Date() } : null);
      // Refresh biltis if any were updated
      if (newStatus === "Approved") {
          fetchMasterData(); // To get updated bilti statuses/expenses
      }
      fetchDaybooksList(); // Refresh the list view
      toast({ title: `Daybook ${action}ed`, description: `Daybook status changed to ${newStatus}.` });
    } catch (error) {
      console.error(`Error ${action.toLowerCase()}ing daybook: `, error);
      toast({ title: "Error", description: `Failed to ${action.toLowerCase()} daybook.`, variant: "destructive" });
    } finally {
      setIsSubmittingDaybook(false);
    }
  };

  const getBiltiDisplayData = (biltiId?: string): string => {
    if (!biltiId) return "N/A";
    const bilti = biltisForSelection.find(b => b.id === biltiId);
    if (!bilti) return biltiId;
    const consigneeName = parties.find(p => p.id === bilti.consigneeId)?.name || "Unknown";
    return `${bilti.id} (To: ${bilti.destination}, For: ${consigneeName}, Amt: ${bilti.totalAmount.toFixed(2)})`;
  };
  
  const getPartyDisplayData = (partyId?: string): string => {
     if (!partyId) return "N/A";
     const party = parties.find(p => p.id === partyId);
     return party ? `${party.name} (${party.id})` : partyId;
  };

  const getLedgerDisplayData = (ledgerId?: string): string => {
     if (!ledgerId) return "N/A";
     const ledger = ledgerAccounts.find(l => l.id === ledgerId);
     return ledger ? `${ledger.accountName} (${ledger.id})` : ledgerId;
  };
  
  // Simulate user role
  const isSuperAdmin = true; // Set to false to simulate branch manager

  const canEditActiveDaybook = activeDaybook && (activeDaybook.status === "Draft" || (activeDaybook.status === "Rejected" && !isSuperAdmin));
  const canSubmitActiveDaybook = activeDaybook && activeDaybook.status === "Draft" && activeDaybook.transactions.length > 0 && !isSuperAdmin;
  const canApproveRejectActiveDaybook = activeDaybook && activeDaybook.status === "Pending Approval" && isSuperAdmin;


  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <BookOpenCheck className="mr-3 h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-headline font-bold text-foreground">Daybook Management</h1>
            <p className="text-muted-foreground">Record daily cash transactions and manage approvals.</p>
          </div>
        </div>
        {/* Add New Daybook button if needed, or rely on auto-creation */}
      </div>

      {/* Filters and Daybook List */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Daybook Register</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-2 items-end">
            <div>
              <Label htmlFor="filterNepaliMiti">Nepali Miti</Label>
              <Input id="filterNepaliMiti" value={filterNepaliMiti} onChange={(e) => setFilterNepaliMiti(e.target.value)} placeholder="YYYY-MM-DD (BS)" />
            </div>
            {isSuperAdmin && ( // Branch selection only for super admin
              <div>
                <Label htmlFor="filterBranch">Branch</Label>
                <Select value={filterBranchId} onValueChange={setFilterBranchId} disabled={isLoadingMasterData}>
                  <SelectTrigger id="filterBranch">
                    <SelectValue placeholder={isLoadingMasterData ? "Loading branches..." : "Select Branch"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Branches</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="filterStatus">Status</Label>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FirestoreDaybook["status"] | "All")}>
                <SelectTrigger id="filterStatus"><SelectValue placeholder="Select Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  {(["Draft", "Pending Approval", "Approved", "Rejected"] as FirestoreDaybook["status"][]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingList && <div className="flex justify-center items-center h-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Loading daybooks...</div>}
          {!isLoadingList && daybooksList.length === 0 && <p className="text-center text-muted-foreground py-4">No daybooks found for the selected filters.</p>}
          {!isLoadingList && daybooksList.length > 0 && (
            <ScrollArea className="h-[200px]">
              <Table>
                <TableHeader><TableRow><TableHead>Miti (BS)</TableHead><TableHead>Branch</TableHead><TableHead>Status</TableHead><TableHead>Closing Bal.</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {daybooksList.map(dbk => (
                    <TableRow key={dbk.id} className={activeDaybook?.id === dbk.id ? "bg-primary/10" : ""}>
                      <TableCell>{dbk.nepaliMiti}</TableCell>
                      <TableCell>{branches.find(b => b.id === dbk.branchId)?.name || dbk.branchId}</TableCell>
                      <TableCell><Badge variant={dbk.status === "Approved" ? "default" : dbk.status === "Rejected" ? "destructive" : "secondary"} className={dbk.status === "Approved" ? "bg-accent text-accent-foreground" : ""}>{dbk.status}</Badge></TableCell>
                      <TableCell>{(dbk.openingBalance + dbk.totalCashIn - dbk.totalCashOut).toFixed(2)}</TableCell>
                      <TableCell>
                        <Button variant="link" size="sm" onClick={() => {
                            setFilterNepaliMiti(dbk.nepaliMiti);
                            setFilterBranchId(dbk.branchId);
                            // loadOrCreateActiveDaybook will be triggered by useEffect
                        }}>View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Active Daybook Details & Transactions */}
      {isLoadingActiveDaybook && <div className="flex justify-center items-center h-32"><Loader2 className="h-10 w-10 animate-spin text-primary" /> Loading daybook details...</div>}
      
      {!isLoadingActiveDaybook && (filterNepaliMiti && filterBranchId) && (
        <Card className="shadow-lg mt-4">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start">
                <div>
                    <CardTitle className="font-headline text-xl">
                        Daybook for: {branches.find(b => b.id === filterBranchId)?.name || filterBranchId} - Miti: {filterNepaliMiti}
                    </CardTitle>
                    <CardDescription>
                        Status: <Badge variant={activeDaybook?.status === "Approved" ? "default" : activeDaybook?.status === "Rejected" ? "destructive" : "secondary"} className={activeDaybook?.status === "Approved" ? "bg-accent text-accent-foreground" : ""}>{activeDaybook?.status || "Not Started"}</Badge>
                        {activeDaybook?.approvalRemarks && <p className="text-xs text-muted-foreground italic">Remarks: {activeDaybook.approvalRemarks}</p>}
                    </CardDescription>
                </div>
                <div className="flex gap-2 mt-2 sm:mt-0">
                    {canSubmitActiveDaybook && <Button onClick={() => handleDaybookAction("Submit")} disabled={isSubmittingDaybook}>{isSubmittingDaybook ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Submit for Approval</Button>}
                    {canApproveRejectActiveDaybook && <Button variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => handleDaybookAction("Approve")} disabled={isSubmittingDaybook}>{isSubmittingDaybook ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}Approve</Button>}
                    {canApproveRejectActiveDaybook && <Button variant="destructive" onClick={() => handleDaybookAction("Reject")} disabled={isSubmittingDaybook}>{isSubmittingDaybook ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}Reject</Button>}
                </div>
            </div>
             <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm border p-3 rounded-md bg-muted/30">
                <p>Opening: <span className="font-semibold">{daybookSummary.openingBalance.toFixed(2)}</span></p>
                <p>Total Cash In: <span className="font-semibold text-green-600">{daybookSummary.totalCashIn.toFixed(2)}</span></p>
                <p>Total Cash Out: <span className="font-semibold text-red-600">{daybookSummary.totalCashOut.toFixed(2)}</span></p>
                <p>Closing: <span className="font-bold text-lg">{daybookSummary.closingBalance.toFixed(2)}</span></p>
                {Object.entries(daybookSummary.cashInByType).length > 0 && <div className="col-span-full text-xs mt-1">Cash In Breakup: {Object.entries(daybookSummary.cashInByType).map(([type,amt]) => `${type}: ${amt.toFixed(2)}`).join(' | ')}</div>}
                {Object.entries(daybookSummary.cashOutByType).length > 0 && <div className="col-span-full text-xs mt-1">Cash Out Breakup: {Object.entries(daybookSummary.cashOutByType).map(([type,amt]) => `${type}: ${amt.toFixed(2)}`).join(' | ')}</div>}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Transactions</h3>
                {canEditActiveDaybook && (
                <Dialog open={isTransactionFormOpen} onOpenChange={(isOpen) => {
                    setIsTransactionFormOpen(isOpen);
                    if (!isOpen) { setEditingTransaction(null); setTransactionFormData(defaultTransactionFormData); setSelectedBiltiForTx(null); }
                }}>
                    <DialogTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => {setEditingTransaction(null); setTransactionFormData(defaultTransactionFormData); setSelectedBiltiForTx(null); setIsTransactionFormOpen(true);}}>
                            <PlusCircle className="mr-2 h-4 w-4"/> Add Transaction
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{editingTransaction ? "Edit" : "Add"} Daybook Transaction</DialogTitle>
                            <DialogDescription>For Daybook: {filterBranchId} - {filterNepaliMiti}</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={(e) => {e.preventDefault(); handleSaveTransaction();}} className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-2">
                            <div>
                                <Label htmlFor="transactionType">Transaction Type <span className="text-destructive">*</span></Label>
                                <Select value={transactionFormData.transactionType} onValueChange={handleTransactionTypeChange} required>
                                    <SelectTrigger><SelectValue placeholder="Select type"/></SelectTrigger>
                                    <SelectContent>{transactionTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>

                            {(transactionFormData.transactionType === "Cash In (Delivery/Receipt)" || transactionFormData.transactionType === "Delivery Expense (Cash Out)") && (
                                <div>
                                    <Label htmlFor="biltiSelectForTx">Select Bilti/Delivery <span className="text-destructive">*</span></Label>
                                    <Select value={selectedBiltiForTx?.id || ""} onValueChange={handleBiltiSelectForTx} required disabled={isLoadingMasterData}>
                                        <SelectTrigger id="biltiSelectForTx">
                                            <SelectValue placeholder={isLoadingMasterData ? "Loading Biltis..." : "Select Bilti/Delivery"}/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {biltisForSelection
                                                .filter(b => transactionFormData.transactionType === "Cash In (Delivery/Receipt)" ? (b.status === "Delivered" && b.payMode !== "Paid" && b.cashCollectionStatus !== "Collected") : true) // Filter for unpaid if cash-in
                                                .map(b => <SelectItem key={b.id} value={b.id}>{getBiltiDisplayData(b.id)}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    {transactionFormData.transactionType === "Cash In (Delivery/Receipt)" && selectedBiltiForTx?.cashCollectionStatus === "Collected" && 
                                        <p className="text-xs text-orange-500 mt-1 flex items-center"><Info className="h-3 w-3 mr-1"/>Cash for this Bilti seems already collected.</p>}
                                </div>
                            )}
                            
                            <div>
                                <Label htmlFor="amount">Amount <span className="text-destructive">*</span></Label>
                                <Input id="amount" name="amount" type="number" value={transactionFormData.amount} onChange={handleTransactionFormChange} 
                                       readOnly={transactionFormData.transactionType === "Cash In (Delivery/Receipt)" && !!selectedBiltiForTx}
                                       required />
                            </div>

                            {transactionFormData.transactionType !== "Cash In (Delivery/Receipt)" && (
                                <div>
                                    <Label htmlFor="description">Description / Narration <span className="text-destructive">*</span></Label>
                                    <Textarea id="description" name="description" value={transactionFormData.description} onChange={handleTransactionFormChange} rows={2} required/>
                                </div>
                            )}
                             {(transactionFormData.transactionType === "Cash In (Other)" || transactionFormData.transactionType === "Cash In (from Party Payment)") && (
                                <div>
                                    <Label htmlFor="partyIdTx">Party (Received From)</Label>
                                    <Select name="partyId" value={transactionFormData.partyId || ""} onValueChange={(val) => setTransactionFormData(p=>({...p, partyId: val}))} >
                                        <SelectTrigger><SelectValue placeholder="Select party..."/></SelectTrigger>
                                        <SelectContent>{parties.map(pt => <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            )}
                            {(transactionFormData.transactionType === "Cash Out (Expense/Supplier/Other)" || transactionFormData.transactionType === "Delivery Expense (Cash Out)" || transactionFormData.transactionType === "Cash Out (to Driver/Staff, Petty Expense)") && (
                                <>
                                <div>
                                    <Label htmlFor="expenseHead">Expense Head / Category</Label>
                                    <Input id="expenseHead" name="expenseHead" value={transactionFormData.expenseHead || ""} onChange={handleTransactionFormChange} placeholder="e.g., Fuel, Unloading, Office Rent"/>
                                </div>
                                 <div>
                                    <Label htmlFor="partyIdTxExpense">Party (Paid To)</Label>
                                     <Select name="partyId" value={transactionFormData.partyId || ""} onValueChange={(val) => setTransactionFormData(p=>({...p, partyId: val}))} >
                                        <SelectTrigger><SelectValue placeholder="Select party/supplier..."/></SelectTrigger>
                                        <SelectContent>{parties.map(pt => <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                </>
                            )}
                             {(transactionFormData.transactionType === "Cash Out (Other)" || transactionFormData.transactionType === "Cash In (Other)") && (
                                <div>
                                    <Label htmlFor="ledgerAccountIdTx">Ledger Account (Bank/Other)</Label>
                                     <Select name="ledgerAccountId" value={transactionFormData.ledgerAccountId || ""} onValueChange={(val) => setTransactionFormData(p=>({...p, ledgerAccountId: val}))} >
                                        <SelectTrigger><SelectValue placeholder="Select ledger account..."/></SelectTrigger>
                                        <SelectContent>{ledgerAccounts.filter(la => la.accountType === "Bank" || la.accountType === "Cash" || !["Party", "Truck", "Driver", "Branch", "Expense"].includes(la.accountType) ).map(la => <SelectItem key={la.id} value={la.id}>{la.accountName}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            )}
                            {transactionFormData.transactionType === "Adjustment/Correction" && (
                                <div>
                                    <Label htmlFor="reasonForAdjustment">Reason for Adjustment <span className="text-destructive">*</span></Label>
                                    <Textarea id="reasonForAdjustment" name="reasonForAdjustment" value={transactionFormData.reasonForAdjustment || ""} onChange={handleTransactionFormChange} rows={2} required/>
                                </div>
                            )}
                            <div>
                                <Label htmlFor="supportingDocUrl">Supporting Document URL (Optional)</Label>
                                <div className="flex items-center gap-2">
                                <Input id="supportingDocUrl" name="supportingDocUrl" value={transactionFormData.supportingDocUrl || ""} onChange={handleTransactionFormChange} placeholder="https://storage.example.com/doc.pdf"/>
                                <Button type="button" variant="outline" size="icon" onClick={()=>alert("File upload not implemented yet.")} title="Upload File (Not Implemented)">
                                    <UploadCloud className="h-4 w-4"/>
                                </Button>
                                </div>
                            </div>
                            <DialogFooter className="pt-4 border-t">
                                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingTransaction}>Cancel</Button></DialogClose>
                                <Button type="submit" disabled={isSubmittingTransaction}>
                                    {isSubmittingTransaction && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    {editingTransaction ? "Update" : "Add"} Transaction
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
                )}
            </div>
            <ScrollArea className="h-[350px] mt-2">
            <Table>
                <TableHeader><TableRow>
                    <TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Reference</TableHead>
                    <TableHead>Amount</TableHead><TableHead>Doc</TableHead>{canEditActiveDaybook && <TableHead>Actions</TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                    {activeDaybook && activeDaybook.transactions.length === 0 && <TableRow><TableCell colSpan={canEditActiveDaybook ? 6 : 5} className="text-center h-24">No transactions added for this day.</TableCell></TableRow>}
                    {activeDaybook?.transactions.map(tx => (
                        <TableRow key={tx.id}>
                            <TableCell>{tx.transactionType}</TableCell>
                            <TableCell className="max-w-xs truncate" title={tx.description}>{tx.description}</TableCell>
                            <TableCell className="max-w-[150px] truncate" title={tx.referenceId ? getBiltiDisplayData(tx.referenceId) : (tx.partyId ? getPartyDisplayData(tx.partyId) : (tx.ledgerAccountId ? getLedgerDisplayData(tx.ledgerAccountId) : 'N/A'))}>
                                {tx.referenceId ? getBiltiDisplayData(tx.referenceId) : (tx.partyId ? getPartyDisplayData(tx.partyId) : (tx.ledgerAccountId ? getLedgerDisplayData(tx.ledgerAccountId) : 'N/A'))}
                            </TableCell>
                            <TableCell className={cn(tx.transactionType.includes("Cash In") || (tx.transactionType === "Adjustment/Correction" && tx.amount > 0) ? "text-green-600" : (tx.transactionType.includes("Cash Out") || (tx.transactionType === "Adjustment/Correction" && tx.amount < 0) ? "text-red-600" : ""))}>
                                {tx.transactionType === "Adjustment/Correction" ? tx.amount.toFixed(2) : Math.abs(tx.amount).toFixed(2)}
                            </TableCell>
                            <TableCell>
                                {tx.supportingDocUrl ? <a href={tx.supportingDocUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline"><Paperclip className="inline h-4 w-4"/> View</a> : "N/A"}
                            </TableCell>
                            {canEditActiveDaybook && (
                            <TableCell><div className="flex gap-1">
                                <Button variant="outline" size="icon" onClick={() => handleEditTransaction(tx)}><Edit className="h-3 w-3"/></Button>
                                <Button variant="destructive" size="icon" onClick={() => handleDeleteTransaction(tx.id)}><Trash2 className="h-3 w-3"/></Button>
                            </div></TableCell>
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            </ScrollArea>
            {!activeDaybook && <p className="text-center text-muted-foreground py-10">Select a date and branch to view or start a daybook. If no daybook exists for today, adding a transaction will create one.</p>}
          </CardContent>
           <CardFooter>
            <p className="text-xs text-muted-foreground">
                Note: Opening balance calculation from previous day and actual ledger posting upon approval are complex features ideally handled by backend logic. This prototype simulates these aspects. File uploads are not implemented.
            </p>
        </CardFooter>
        </Card>
      )}
    </div>
  );
}
