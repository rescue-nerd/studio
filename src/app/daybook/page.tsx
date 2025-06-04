
"use client";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "cmdk";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import { format, isValid, parse } from "date-fns";
import { enUS } from "date-fns/locale";
import { AlertTriangle, BookOpenCheck, Check as CheckIcon, ChevronsUpDown, Edit, Loader2, PlusCircle, Trash2, UploadCloud } from "lucide-react";

import { db, functions } from "@/lib/firebase";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    where
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type {
    DaybookTransactionCreateRequest,
    DaybookTransactionDeleteRequest,
    DaybookTransactionType,
    Bilti as FirestoreBilti,
    Branch as FirestoreBranch,
    FirestoreDaybook,
    DaybookTransaction as FirestoreDaybookTransaction,
    LedgerAccount as FirestoreLedgerAccount,
    Party as FirestoreParty,
    User as FirestoreUser,
} from "@/types/firestore";
import { useRouter } from "next/navigation";


interface Daybook extends Omit<FirestoreDaybook, 'englishMiti' | 'createdAt' | 'updatedAt' | 'submittedAt' | 'approvedAt' | 'transactions' | 'processingTimestamp' | 'createdBy'> {
  id: string;
  englishMiti: Date;
  transactions: DaybookTransaction[];
  createdAt?: Date;
  updatedAt?: Date;
  submittedAt?: Date;
  approvedAt?: Date;
  processingTimestamp?: Date;
  createdBy?: string;
}

interface DaybookTransaction extends Omit<FirestoreDaybookTransaction, 'createdAt' | 'createdBy'> {
  createdAt?: Date;
  createdBy?: string;
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

const getTodayNepaliMiti = () => {
  const today = new Date();
  return format(today, "yyyy-MM-dd", { locale: enUS });
};

const transactionTypes: DaybookTransactionType[] = [
  "Cash In (from Delivery/Receipt)",
  "Delivery Expense (Cash Out)",
  "Cash Out (to Expense/Supplier/Other)",
  "Cash In (Other)",
  "Cash In (from Party Payment)",
  "Cash Out (to Driver/Staff, Petty Expense)",
  "Adjustment/Correction",
];

// Create callable function references
const submitDaybookFn = httpsCallable<{daybookId: string}, {success: boolean, message: string}>(functions, 'submitDaybook');
const approveDaybookFn = httpsCallable<{daybookId: string}, {success: boolean, message: string}>(functions, 'approveDaybook');
const rejectDaybookFn = httpsCallable<{daybookId: string, remarks: string}, {success: boolean, message: string}>(functions, 'rejectDaybook');
const createDaybookTransactionFn = httpsCallable<DaybookTransactionCreateRequest, {success: boolean, id: string, message: string}>(functions, 'createDaybookTransaction');
const deleteDaybookTransactionFn = httpsCallable<DaybookTransactionDeleteRequest, {success: boolean, id: string, message: string}>(functions, 'deleteDaybookTransaction');
const createDaybookFn = httpsCallable<{branchId: string, nepaliMiti: string, englishMiti: string, openingBalance?: number}, {success: boolean, id: string, message: string}>(functions, 'createDaybook');


export default function DaybookPage() {
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();

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
  
  const [editingTransaction, setEditingTransaction] = useState<DaybookTransaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<DaybookTransaction | null>(null);
  const [isDeleteTransactionAlertOpen, setIsDeleteTransactionAlertOpen] = useState(false);

  const [isSuperAdmin, setIsSuperAdmin] = useState(false); 

  const initialTransactionFormData: Omit<DaybookTransaction, 'id' | 'createdAt' | 'createdBy' | 'autoLinked'> = {
    transactionType: "Cash In (Other)",
    amount: 0,
    description: "",
    ledgerAccountId: "", 
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

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authUser, authLoading, router]);

  useEffect(() => {
    const checkUserRole = async () => {
        if (authUser?.uid) {
            try {
                const userDocRef = doc(db, "users", authUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data() as FirestoreUser;
                    setIsSuperAdmin(userData.role === 'superAdmin');
                } else {
                    setIsSuperAdmin(false);
                }
            } catch (error) {
                console.error("Error fetching user role:", error);
                setIsSuperAdmin(false);
            }
        } else {
            setIsSuperAdmin(false);
        }
    };
    checkUserRole();
  }, [authUser]);


  const fetchMasterData = async () => {
    if (!authUser) return;
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
        return { ...data, id: d.id, miti: data.miti.toDate(), createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate() } as Bilti;
      });
      setAllBiltisMaster(allFetchedBiltis);
      setBiltisForSelection(allFetchedBiltis);

      setParties(partiesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Party)));
      setLedgerAccounts(ledgersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as LedgerAccount)));

    } catch (error) {
      console.error("Error fetching master data:", error);
      toast({ title: "Error", description: "Failed to load master data.", variant: "destructive" });
    }
  };


  const loadOrCreateActiveDaybook = async () => {
    if (!authUser || !filterBranchId || !filterNepaliMiti) {
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
      );
      const querySnapshot = await getDocs(daybookQuery);

      if (!querySnapshot.empty) {
        const daybookDoc = querySnapshot.docs[0];
        const data = daybookDoc.data() as FirestoreDaybook;
        const loadedDaybook: Daybook = {
          ...(data as Omit<FirestoreDaybook, 'englishMiti' | 'createdAt' | 'updatedAt' | 'submittedAt' | 'approvedAt' | 'transactions' | 'processingTimestamp'>),
          id: daybookDoc.id,
          englishMiti: data.englishMiti.toDate(),
          transactions: (data.transactions || []).map(tx => ({
            ...tx,
            createdAt: tx.createdAt?.toDate(), 
          })),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          submittedAt: data.submittedAt?.toDate(),
          approvedBy: data.approvedBy,
          processingTimestamp: data.processingTimestamp?.toDate(),
        };
        setActiveDaybook(loadedDaybook);
        setActiveDaybookFromState(loadedDaybook);
      } else {
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
    if (authUser) {
      fetchMasterData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  useEffect(() => {
    if (authUser && filterBranchId && filterNepaliMiti) {
      loadOrCreateActiveDaybook();
    } else {
      setActiveDaybook(null); 
      setActiveDaybookFromState(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, filterBranchId, filterNepaliMiti]);


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
    if (branches.length > 0 && (!filterBranchId || !branches.find(b => b.id === filterBranchId))) {
      setFilterBranchId(branches[0].id);
    }
  };

  const handleOpenTransactionForm = (transaction?: DaybookTransaction) => {
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
        ledgerAccountId: transaction.ledgerAccountId || "",
        supportingDocUrl: transaction.supportingDocUrl,
        reasonForAdjustment: transaction.reasonForAdjustment,
        nepaliMiti: transaction.nepaliMiti,
      });
      if (transaction.referenceId && (transaction.transactionType === "Cash In (from Delivery/Receipt)" || transaction.transactionType === "Delivery Expense (Cash Out)")) {
        setSelectedBiltiForTx(getBiltiDetailsById(transaction.referenceId) || null);
      }
      if (transaction.partyId) setSelectedPartyForTx(parties.find(p => p.id === transaction.partyId) || null);
      if (transaction.ledgerAccountId) setSelectedLedgerForTx(ledgerAccounts.find(l => l.id === transaction.ledgerAccountId) || null);

    } else {
      setEditingTransaction(null);
      setTransactionFormData({...initialTransactionFormData, ledgerAccountId: ""});
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
      setTransactionFormData(prev => ({...prev, nepaliMiti: format(date, "yyyy-MM-dd") })); 
    }
  };

  const handleTransactionFormTypeChange = (value: DaybookTransactionType) => {
    setTransactionFormData(prev => ({ ...prev, transactionType: value, amount: 0, description: "", ledgerAccountId: prev.ledgerAccountId || "" })); 
    setSelectedBiltiForTx(null);
    setSelectedPartyForTx(null);
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
    if (!authUser) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
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
     if (transactionFormData.amount <= 0 && transactionFormData.transactionType !== "Adjustment/Correction") { 
        toast({ title: "Validation Error", description: "Amount must be greater than zero (except for Adjustments).", variant: "destructive" });
        return;
    }
    if (transactionFormData.transactionType === "Cash In (from Delivery/Receipt)" || transactionFormData.transactionType === "Delivery Expense (Cash Out)") {
        if(!transactionFormData.referenceId || !selectedBiltiForTx) {
            toast({ title: "Validation Error", description: "Please select a Bilti for this transaction type.", variant: "destructive" });
            return;
        }
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
    let currentActiveDaybookToUpdate = activeDaybookFromState || activeDaybook;

    try {
      if (!currentActiveDaybookToUpdate) {
        // If no daybook exists, create one first using the Cloud Function
        const parsedEnglishDate = parse(filterNepaliMiti, "yyyy-MM-dd", new Date());
        if (!isValid(parsedEnglishDate)) {
          toast({ title: "Error", description: "Invalid Nepali Miti format. Please use YYYY-MM-DD.", variant: "destructive" });
          return;
        }

        // Create daybook using Cloud Function
        const createDaybookResult = await createDaybookFn({
          branchId: filterBranchId,
          nepaliMiti: filterNepaliMiti,
          englishMiti: parsedEnglishDate.toISOString(),
          openingBalance: 0
        });
        
        if (!createDaybookResult.data.success) {
          toast({ 
            title: "Error", 
            description: createDaybookResult.data.message || "Failed to create daybook.", 
            variant: "destructive" 
          });
          return;
        }

        // Reload the daybook to get the created state
        await loadOrCreateActiveDaybook();
        currentActiveDaybookToUpdate = activeDaybookFromState || activeDaybook;
        
        if (!currentActiveDaybookToUpdate) {
          toast({ title: "Error", description: "Failed to load created daybook.", variant: "destructive" });
          return;
        }
      }

      // Now create the transaction using Cloud Function
      const transactionRequest: DaybookTransactionCreateRequest = {
        daybookId: currentActiveDaybookToUpdate.id,
        transactionId: editingTransaction?.id, // For updates
        transactionType: transactionFormData.transactionType,
        amount: transactionFormData.amount,
        description: transactionFormData.description,
        ledgerAccountId: transactionFormData.ledgerAccountId,
        partyId: transactionFormData.partyId,
        referenceId: transactionFormData.referenceId,
        nepaliMiti: transactionFormData.nepaliMiti || filterNepaliMiti,
      };

      const result = await createDaybookTransactionFn(transactionRequest);
      
      if (result.data.success) {
        // Reload the daybook to get the updated state
        await loadOrCreateActiveDaybook();
        
        toast({ 
          title: editingTransaction ? "Transaction Updated" : "Transaction Added", 
          description: result.data.message 
        });

        setIsTransactionFormOpen(false);
        setEditingTransaction(null);
        setTransactionFormData({...initialTransactionFormData, ledgerAccountId: ""}); 
        setSelectedBiltiForTx(null);
        setSelectedPartyForTx(null);
        setSelectedLedgerForTx(null);
      } else {
        toast({ 
          title: "Transaction Failed", 
          description: result.data.message || "An unknown error occurred.", 
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error("Error saving transaction:", error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to save transaction.", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmittingTransaction(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!activeDaybookFromState || !transactionToDelete || !authUser) return;
    setIsSubmittingTransaction(true); 
    try {
        const deleteRequest: DaybookTransactionDeleteRequest = {
            daybookId: activeDaybookFromState.id,
            transactionId: transactionToDelete.id
        };

        const result = await deleteDaybookTransactionFn(deleteRequest);
        
        if (result.data.success) {
            // Reload the daybook to get the updated state
            await loadOrCreateActiveDaybook();
            
            toast({ 
                title: "Transaction Deleted", 
                description: result.data.message 
            });
            
            setIsDeleteTransactionAlertOpen(false);
            setTransactionToDelete(null);
        } else {
            toast({ 
                title: "Delete Failed", 
                description: result.data.message || "An unknown error occurred.", 
                variant: "destructive"
            });
        }
    } catch (error: any) {
        console.error("Error deleting transaction:", error);
        toast({ 
            title: "Error", 
            description: error.message || "Failed to delete transaction.", 
            variant: "destructive" 
        });
    } finally {
        setIsSubmittingTransaction(false);
    }
  };

  const handleSubmitDaybook = async () => {
    if (!activeDaybookFromState || activeDaybookFromState.transactions.length === 0 || !authUser) {
        toast({ title: "Cannot Submit", description: "Please add at least one transaction and be logged in.", variant: "destructive"});
        return;
    }
    setIsSubmittingDaybook(true);
    try {
        const result = await submitDaybookFn({ daybookId: activeDaybookFromState.id });
        if (result.data.success) {
            const updatedDaybookState = { ...activeDaybookFromState, status: "Pending Approval" as const, submittedAt: new Date(), submittedBy: authUser.uid };
            setActiveDaybook(updatedDaybookState);
            setActiveDaybookFromState(updatedDaybookState);
            toast({ title: "Daybook Submitted", description: result.data.message });
        } else {
             toast({ title: "Submission Failed", description: result.data.message || "An unknown error occurred.", variant: "destructive"});
        }
    } catch (error: any) {
        console.error("Error submitting daybook via function:", error);
        toast({ title: "Error Submitting Daybook", description: error.message || "Failed to submit daybook.", variant: "destructive"});
    } finally {
        setIsSubmittingDaybook(false);
    }
  };

  const handleApproveDaybook = async () => {
    if (!activeDaybookFromState || !authUser) return;
    setIsApprovingDaybook(true);
    try {
        const result = await approveDaybookFn({ daybookId: activeDaybookFromState.id });
        if (result.data.success) {
            const updatedDaybookState = {
                ...activeDaybookFromState,
                status: "Approved" as const,
                approvedAt: new Date(),
                approvedBy: authUser.uid
            };
            setActiveDaybook(updatedDaybookState);
            setActiveDaybookFromState(updatedDaybookState);
            toast({ title: "Daybook Approved", description: result.data.message });
        } else {
            toast({ title: "Approval Failed", description: result.data.message || "An unknown error occurred.", variant: "destructive"});
        }
    } catch (error: any) {
      console.error("Error approving daybook via function:", error);
      toast({ title: "Error Approving Daybook", description: error.message || "Failed to approve daybook.", variant: "destructive" });
    } finally {
      setIsApprovingDaybook(false);
    }
  };

  const handleRejectDaybook = async () => {
    if (!activeDaybookFromState || !authUser) return;
    const remarks = prompt("Enter rejection remarks (optional):");
    if (remarks === null) return; // User cancelled prompt

    setIsApprovingDaybook(true); 
    try {
        const result = await rejectDaybookFn({ daybookId: activeDaybookFromState.id, remarks: remarks || "" });
        if (result.data.success) {
            const updatedDaybookState = {
                ...activeDaybookFromState,
                status: "Rejected" as const,
                approvedAt: new Date(), // rejection timestamp
                approvedBy: authUser.uid,
                approvalRemarks: remarks || "Rejected"
            };
            setActiveDaybook(updatedDaybookState);
            setActiveDaybookFromState(updatedDaybookState);
            toast({ title: "Daybook Rejected", description: result.data.message });
        } else {
            toast({ title: "Rejection Failed", description: result.data.message || "An unknown error occurred.", variant: "destructive"});
        }
    } catch (error: any) {
        console.error("Error rejecting daybook via function:", error);
        toast({ title: "Error Rejecting Daybook", description: error.message || "Failed to reject daybook.", variant: "destructive"});
    } finally {
        setIsApprovingDaybook(false);
    }
  };

  const currentDaybookState = activeDaybookFromState || activeDaybook;
  const canEditDaybook = currentDaybookState?.status === "Draft" || (currentDaybookState?.status === "Rejected" && !isSuperAdmin); 


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

      {isLoading && !currentDaybookState && (
        <div className="flex justify-center items-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Loading daybook data...</p>
        </div>
      )}

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
                        <TableCell>{tx.referenceId || tx.partyId || getLedgerAccountNameById(tx.ledgerAccountId) || 'N/A'}</TableCell>
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
            <ScrollArea className="flex-grow pr-1"> 
            <form onSubmit={(e) => { e.preventDefault(); handleSaveTransaction(); }} className="space-y-3 py-2"> 
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
                            <PopoverContent className="w-[450px] p-0" align="start"> 
                                <Command>
                                    <CommandInput placeholder="Search Bilti No. or Destination..." onValueChange={setBiltiSearchTerm} value={biltiSearchTerm}/>
                                    <CommandList className="max-h-[250px] overflow-y-auto">
                                    <CommandEmpty>No Bilti found.</CommandEmpty>
                                    {allBiltisMaster
                                        .filter(b => {
                                            if (transactionFormData.transactionType === "Cash In (from Delivery/Receipt)") {
                                                return (b.status === "Delivered" || b.status === "Received") && b.payMode !== "Paid" && b.cashCollectionStatus !== "Collected" &&
                                                       (b.id.toLowerCase().includes(biltiSearchTerm.toLowerCase()) || b.destination.toLowerCase().includes(biltiSearchTerm.toLowerCase()));
                                            }
                                            return (b.id.toLowerCase().includes(biltiSearchTerm.toLowerCase()) || b.destination.toLowerCase().includes(biltiSearchTerm.toLowerCase()));
                                        })
                                        .map(bilti => (
                                        <CommandItem
                                            key={bilti.id}
                                            value={`${bilti.id} ${bilti.destination} ${getPartyNameById(bilti.consigneeId)}`} 
                                            onSelect={() => handleBiltiSelectForTx(bilti.id)}
                                            className="cursor-pointer flex flex-col items-start !text-left p-2 hover:bg-accent" 
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
                <DialogFooter className="pt-4 border-t !mt-6"> 
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

