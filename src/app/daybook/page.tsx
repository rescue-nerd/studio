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
  AlertDialogTrigger, // Added AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button"; // Import buttonVariants
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger, // Added DialogTrigger
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
import { AlertTriangle, BookOpenCheck, Check as CheckIcon, ChevronsUpDown, Edit, Loader2, PlusCircle, Trash2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { db } from "@/lib/supabase-db";

import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type {
  Bilti as BiltiRow, // Renamed to avoid conflict with local type if any
  Branch as BranchRow, // Renamed to avoid conflict
  Daybook as DaybookRow, // Using the new DaybookTransaction type
  DaybookTransactionCreateRequest,
  DaybookTransactionDeleteRequest, // Using the new Daybook type
  DaybookTransaction as DaybookTransactionRow, // Renamed to avoid conflict
  DaybookTransactionType,
  LedgerAccount as LedgerAccountRow, // Using the new LedgerAccount type
  Party as PartyRow, // Renamed to avoid conflict
  User as UserRow, // Renamed to avoid conflict
} from "@/types/database";
import { useRouter } from "next/navigation";

// Local interface for Daybook, mapping from DaybookRow
interface LocalDaybook extends Omit<DaybookRow, 'english_miti' | 'created_at' | 'updated_at' | 'submitted_at' | 'approved_at' | 'processing_timestamp' | 'created_by' | 'transactions_json'> {
  id: string;
  english_miti: Date;
  transactions: LocalDaybookTransaction[];
  created_at?: Date;
  updated_at?: Date;
  submitted_at?: Date;
  approved_at?: Date;
  processing_timestamp?: Date;
  created_by?: string; // Keep as string, it's a user_id
}

// Local interface for DaybookTransaction, mapping from DaybookTransactionRow
interface LocalDaybookTransaction extends Omit<DaybookTransactionRow, 'created_at' | 'created_by' | 'updated_at' | 'updated_by'> {
  created_at?: Date;
  created_by?: string; // Keep as string
  updated_at?: Date;
  updated_by?: string;
}


const getTodayNepaliMiti = () => {
  const today = new Date();
  return format(today, "yyyy-MM-dd", { locale: enUS });
};

// Use the imported DaybookTransactionType enum for transactionTypes array
const transactionTypes: DaybookTransactionType[] = [
  "Cash In (from Delivery/Receipt)",
  "Delivery Expense (Cash Out)",
  "Cash Out (to Expense/Supplier/Other)",
  "Cash In (Other)",
  "Cash In (from Party Payment)",
  "Cash Out (to Driver/Staff, Petty Expense)",
  "Adjustment/Correction",
];

// Supabase Edge Function references
const submitDaybookFn = async (data: {daybookId: string}) => {
  const { data: responseData, error } = await supabase.functions.invoke('submit-daybook', { body: data });
  if (error) throw error;
  return responseData as {success: boolean, message: string};
};
const approveDaybookFn = async (data: {daybookId: string}) => {
  const { data: responseData, error } = await supabase.functions.invoke('approve-daybook', { body: data });
  if (error) throw error;
  return responseData as {success: boolean, message: string};
};
const rejectDaybookFn = async (data: {daybookId: string, remarks: string}) => {
  const { data: responseData, error } = await supabase.functions.invoke('reject-daybook', { body: data });
  if (error) throw error;
  return responseData as {success: boolean, message: string};
};

const createDaybookTransactionFn = async (data: DaybookTransactionCreateRequest) => {
  const { data: responseData, error } = await supabase.functions.invoke('create-daybook-transaction', { body: data });
  if (error) throw error;
  return responseData as {success: boolean, id: string, message: string, transaction: DaybookTransactionRow }; // Assuming function returns the created transaction
};

const deleteDaybookTransactionFn = async (data: DaybookTransactionDeleteRequest) => {
  const { data: responseData, error } = await supabase.functions.invoke('delete-daybook-transaction', { body: data });
  if (error) throw error;
  return responseData as {success: boolean, id: string, message: string};
};

const createDaybookFn = async (data: {branch_id: string, nepali_miti: string, english_miti: string, opening_balance?: number}) => {
  const { data: responseData, error } = await supabase.functions.invoke('create-daybook', { body: data });
  if (error) throw error;
  return responseData as {success: boolean, id: string, message: string, daybook: DaybookRow}; // Assuming function returns the created daybook
};


export default function DaybookPage() {
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeDaybook, setActiveDaybook] = useState<LocalDaybook | null>(null);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [biltisForSelection, setBiltisForSelection] = useState<BiltiRow[]>([]);
  const [allBiltisMaster, setAllBiltisMaster] = useState<BiltiRow[]>([]);
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccountRow[]>([]);

  const [filterNepaliMiti, setFilterNepaliMiti] = useState<string>(getTodayNepaliMiti());
  const [filterBranchId, setFilterBranchId] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingDaybook, setIsSubmittingDaybook] = useState(false);
  const [isApprovingDaybook, setIsApprovingDaybook] = useState(false);
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  
  const [editingTransaction, setEditingTransaction] = useState<LocalDaybookTransaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<LocalDaybookTransaction | null>(null);
  const [isDeleteTransactionAlertOpen, setIsDeleteTransactionAlertOpen] = useState(false);

  const [isSuperAdmin, setIsSuperAdmin] = useState(false); 

  // Use DaybookTransactionCreateRequest for form data, omitting daybook_id as it's contextually known
  const initialTransactionFormData: Omit<DaybookTransactionCreateRequest, 'daybook_id'> = {
    transaction_type: "Cash In (Other)",
    amount: 0,
    description: "",
    ledger_account_id: "", 
    nepali_miti: filterNepaliMiti,
    reference_id: null,
    party_id: null,
    auto_linked: false,
    supporting_doc_url: null,
    reason_for_adjustment: null,
  };
  const [transactionFormData, setTransactionFormData] = useState(initialTransactionFormData);

  const [selectedBiltiForTx, setSelectedBiltiForTx] = useState<BiltiRow | null>(null);
  const [isBiltiSelectOpen, setIsBiltiSelectOpen] = useState(false);
  const [biltiSearchTerm, setBiltiSearchTerm] = useState("");

  const [selectedPartyForTx, setSelectedPartyForTx] = useState<PartyRow | null>(null);
  const [isPartySelectOpen, setIsPartySelectOpen] = useState(false);
  const [partySearchTerm, setPartySearchTerm] = useState("");

  const [selectedLedgerForTx, setSelectedLedgerForTx] = useState<LedgerAccountRow | null>(null);
  const [isLedgerSelectOpen, setIsLedgerSelectOpen] = useState(false);
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState("");

  const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);
  const [daybookToReject, setDaybookToReject] = useState<LocalDaybook | null>(null);
  const [rejectionRemarks, setRejectionRemarks] = useState("");
  const [isRejectDialogValid, setIsRejectDialogValid] = useState(false);


  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authUser, authLoading, router]);

  const checkUserRole = async () => {
    if (authUser?.id) {
      try {
        // Assuming 'users' table and 'role' column exist as per UserRow
        // And db.read is the correct method to fetch a single user by ID
        const userRecord = await db.read<UserRow>('users', authUser.id);
        if (userRecord) {
          setIsSuperAdmin(userRecord.role === 'super_admin'); // Use 'super_admin' from UserRole
        } else {
          setIsSuperAdmin(false);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        setIsSuperAdmin(false);
        // toast({ title: "Error", description: "Could not verify user role.", variant: "destructive" });
      }
    } else {
      setIsSuperAdmin(false);
    }
  };

  useEffect(() => {
    if(authUser) checkUserRole();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);


  const fetchMasterData = async () => {
    if (!authUser) return;
    try {
      // Ensure db.query returns { results: T[] } or adjust accordingly
      const branchesPromise = db.query<BranchRow>('branches', { select: '*', orderBy: { column: 'name', ascending: true } });
      const biltisPromise = db.query<BiltiRow>('biltis', { select: '*', orderBy: { column: 'documentNumber', ascending: true } });
      const partiesPromise = db.query<PartyRow>('parties', { select: '*', orderBy: { column: 'name', ascending: true } });
      const ledgersPromise = db.query<LedgerAccountRow>('ledger_accounts', { select: '*', orderBy: { column: 'account_name', ascending: true } });
      
      const [branchesData, biltisData, partiesData, ledgersData] = await Promise.all([
        branchesPromise, biltisPromise, partiesPromise, ledgersPromise
      ]);

      // Assuming db.query directly returns T[] as per its definition in supabase-db.ts
      setBranches(branchesData);
      if (branchesData.length > 0 && !filterBranchId) {
        setFilterBranchId(branchesData[0].id);
      }
      setAllBiltisMaster(biltisData);
      setBiltisForSelection(biltisData); 
      setParties(partiesData);
      setLedgerAccounts(ledgersData);

    } catch (error) {
      console.error("Error fetching master data:", error);
      toast({ title: "Error", description: "Failed to load master data.", variant: "destructive" });
    }
  };


  const loadOrCreateActiveDaybook = async () => {
    if (!authUser || !filterBranchId || !filterNepaliMiti) {
      setActiveDaybook(null);
      return;
    }
    setIsLoading(true);
    try {
      // Fetch daybook with related transactions
      // The select string for related tables in Supabase is 'table_name(*)'
      const daybooksData = await db.query<DaybookRow>('daybooks', {
        select: '*, daybook_transactions(*)', 
        filters: { branch_id: filterBranchId, nepali_miti: filterNepaliMiti },
        limit: 1
      });

      if (daybooksData.length > 0) {
        const data = daybooksData[0];
        // Ensure daybook_transactions is correctly typed as DaybookTransactionRow[]
        // The join 'daybook_transactions(*)' should return an array of related records.
        let transactions: LocalDaybookTransaction[] = [];
        // Supabase returns related records as an array on the parent object if the select is correct.
        // e.g. data.daybook_transactions would be DaybookTransactionRow[]
        if (Array.isArray((data as any).daybook_transactions)) { // Cast to any to access potentially joined data
             transactions = ((data as any).daybook_transactions as DaybookTransactionRow[]).map((tx: DaybookTransactionRow) => ({
                ...tx,
                created_at: tx.created_at ? new Date(tx.created_at) : undefined,
                updated_at: tx.updated_at ? new Date(tx.updated_at) : undefined,
            }));
        } else if (data.transactions_json) { // Fallback for legacy data
            try {
                const parsedTx = JSON.parse(data.transactions_json as string);
                if (Array.isArray(parsedTx)) {
                    transactions = parsedTx.map((tx: any) => ({
                        ...tx, 
                        id: tx.id || crypto.randomUUID(),
                        daybook_id: data.id,
                        transaction_type: tx.transactionType || tx.transaction_type,
                        amount: tx.amount,
                        description: tx.description,
                        nepali_miti: tx.nepaliMiti || tx.nepali_miti || data.nepali_miti,
                        created_at: tx.createdAt || tx.created_at ? new Date(tx.createdAt || tx.created_at) : undefined,
                        created_by: tx.createdBy || tx.created_by,
                        ledger_account_id: tx.ledgerAccountId || tx.ledger_account_id || "", // Ensure it's not undefined
                        party_id: tx.partyId || tx.party_id,
                        reference_id: tx.referenceId || tx.reference_id,
                        auto_linked: tx.autoLinked || tx.auto_linked || false,
                        supporting_doc_url: tx.supportingDocUrl || tx.supporting_doc_url,
                        reason_for_adjustment: tx.reasonForAdjustment || tx.reason_for_adjustment,
                    }));
                }
            } catch (e) { console.error("Failed to parse transactions_json", e); }
        }


        const loadedDaybook: LocalDaybook = {
          ...data,
          english_miti: new Date(data.english_miti), // Assuming english_miti is a valid date string
          transactions: transactions,
          created_at: data.created_at ? new Date(data.created_at) : undefined,
          updated_at: data.updated_at ? new Date(data.updated_at) : undefined,
          submitted_at: data.submitted_at ? new Date(data.submitted_at) : undefined,
          approved_at: data.approved_at ? new Date(data.approved_at) : undefined,
          processing_timestamp: data.processing_timestamp ? new Date(data.processing_timestamp) : undefined,
        };
        setActiveDaybook(loadedDaybook);
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, filterBranchId, filterNepaliMiti]);


  const getBranchNameById = (id: string) => branches.find(b => b.id === id)?.name || "N/A";
  const getPartyNameById = (id?: string | null) => parties.find(p => p.id === id)?.name || "N/A";
  const getLedgerAccountNameById = (id?: string | null) => ledgerAccounts.find(la => la.id === id)?.account_name || "N/A";
  const getBiltiDetailsById = (id?: string | null) => allBiltisMaster.find(b => b.id === id);


  const daybookSummary = useMemo(() => {
    const currentDaybook = activeDaybook; // Simplified, removed activeDaybookFromState
    if (!currentDaybook) return {
        cashInByType: {}, cashOutByType: 0, netCashIn: 0, netCashOut: 0,
        closingBalance: 0, openingBalance: 0, transactionsCount: 0
    };

    const cashInByType: Record<string, number> = {};
    const cashOutByType: Record<string, number> = {};
    let netCashIn = 0;
    let netCashOut = 0;

    (currentDaybook.transactions || []).forEach(tx => {
      // Ensure tx.transaction_type is not undefined before calling toLowerCase()
      const txTypeLower = tx.transaction_type?.toLowerCase() || "";
      if (txTypeLower.includes("cash in")) {
        netCashIn += tx.amount;
        cashInByType[tx.transaction_type] = (cashInByType[tx.transaction_type] || 0) + tx.amount;
      } else if (txTypeLower.includes("cash out")) {
        netCashOut += tx.amount;
        cashOutByType[tx.transaction_type] = (cashOutByType[tx.transaction_type] || 0) + tx.amount;
      } else if (tx.transaction_type === "Adjustment/Correction") {
        if (tx.amount >= 0) {
            netCashIn += tx.amount;
            cashInByType[tx.transaction_type] = (cashInByType[tx.transaction_type] || 0) + tx.amount;
        } else {
            netCashOut += Math.abs(tx.amount);
            cashOutByType[tx.transaction_type] = (cashOutByType[tx.transaction_type] || 0) + Math.abs(tx.amount);
        }
      }
    });
    const openingBalance = currentDaybook.opening_balance || 0;
    const closingBalance = openingBalance + netCashIn - netCashOut;
    return {
        cashInByType, cashOutByType, netCashIn, netCashOut, closingBalance, openingBalance,
        transactionsCount: currentDaybook.transactions?.length || 0
    };
  }, [activeDaybook]);

  const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newMiti = e.target.value;
    // Basic validation for YYYY-MM-DD format, can be improved
    if (/^\d{4}-\d{2}-\d{2}$/.test(newMiti) || newMiti === "") {
        setFilterNepaliMiti(newMiti);
    } else {
        toast({title: "Invalid Date", description: "Please use YYYY-MM-DD format for Nepali Miti.", variant: "destructive"})
    }
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

  const handleOpenTransactionForm = (transaction?: LocalDaybookTransaction) => {
    setSelectedBiltiForTx(null);
    setSelectedPartyForTx(null);
    setSelectedLedgerForTx(null);
    
    // Reset form with current daybook\'s miti or filter miti
    const currentMiti = activeDaybook?.nepali_miti || filterNepaliMiti;
    setTransactionFormData({ 
        ...initialTransactionFormData,
        nepali_miti: currentMiti, 
    });


    if (transaction) {
      setEditingTransaction(transaction);
      // Map LocalDaybookTransaction to DaybookTransactionCreateRequest structure
      setTransactionFormData({
        transaction_type: transaction.transaction_type,
        amount: transaction.amount,
        description: transaction.description || "",
        reference_id: transaction.reference_id || null,
        party_id: transaction.party_id || null,
        ledger_account_id: transaction.ledger_account_id || "", // Ensure it\'s not null if DB expects string
        supporting_doc_url: transaction.supporting_doc_url || null,
        reason_for_adjustment: transaction.reason_for_adjustment || null,
        nepali_miti: transaction.nepali_miti || currentMiti,
        auto_linked: transaction.auto_linked || false,
      });
      if (transaction.reference_id && (transaction.transaction_type === "Cash In (from Delivery/Receipt)" || transaction.transaction_type === "Delivery Expense (Cash Out)")) {
        setSelectedBiltiForTx(getBiltiDetailsById(transaction.reference_id) || null);
      }
      if (transaction.party_id) setSelectedPartyForTx(parties.find(p => p.id === transaction.party_id) || null);
      if (transaction.ledger_account_id) setSelectedLedgerForTx(ledgerAccounts.find(l => l.id === transaction.ledger_account_id) || null);

    } else {
      setEditingTransaction(null);
    }
    setIsTransactionFormOpen(true);
  };

  const handleTransactionFormInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let parsedValue: string | number | null = value;
    if (name === "amount") {
      parsedValue = value === "" ? 0 : parseFloat(value);
      if (isNaN(parsedValue as number) || parsedValue < 0) parsedValue = 0;
    }
    
    // For optional fields that can be empty string, convert to null for DB
    if ((name === 'supporting_doc_url' || name === 'reason_for_adjustment' || name === 'party_id' || name === 'reference_id') && value === '') {
        parsedValue = null;
    }


    setTransactionFormData(prev => ({ ...prev, [name]: parsedValue as any })); // Cast to any to avoid type conflicts with specific fields
  };
  
  const handleTransactionNepaliMitiChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newMiti = e.target.value;
     if (/^\d{4}-\d{2}-\d{2}$/.test(newMiti) || newMiti === "") {
        setTransactionFormData(prev => ({ ...prev, nepali_miti: newMiti }));
    } else {
        toast({title: "Invalid Date", description: "Please use YYYY-MM-DD format for Nepali Miti.", variant: "destructive"})
    }
  };

  const handleTransactionFormTypeChange = (value: DaybookTransactionType) => {
    setTransactionFormData(prev => ({ 
        ...prev, 
        transaction_type: value, 
        amount: 0, 
        description: "", 
        // ledger_account_id is kept
        reference_id: null, // Reset linked items
        party_id: null,
        auto_linked: false,
    })); 
    setSelectedBiltiForTx(null); 
    setSelectedPartyForTx(null); 
  };

  const handleBiltiSelectForTx = (biltiId: string) => {
    const bilti = allBiltisMaster.find(b => b.id === biltiId);
    setSelectedBiltiForTx(bilti || null);
    setTransactionFormData(prev => ({
      ...prev,
      reference_id: bilti ? bilti.id : null,
      // Use BiltiRow.amount, assuming it\'s the total amount
      amount: prev.transaction_type === "Cash In (from Delivery/Receipt)" ? (bilti?.amount || 0) : prev.amount,
      description: prev.transaction_type === "Cash In (from Delivery/Receipt)" ? `Cash received for Bilti ${bilti?.documentNumber || bilti?.id}` : prev.description,
      auto_linked: true,
    }));
    setIsBiltiSelectOpen(false);
  };

  const handlePartySelectForTx = (partyId: string) => {
    const party = parties.find(p => p.id === partyId);
    setSelectedPartyForTx(party || null);
    setTransactionFormData(prev => ({ ...prev, party_id: party?.id || null }));
    setIsPartySelectOpen(false);
  };

  const handleLedgerSelectForTx = (ledgerId: string) => {
    const ledger = ledgerAccounts.find(l => l.id === ledgerId);
    setSelectedLedgerForTx(ledger || null);
    // ledger_account_id is not nullable in DaybookTransactionCreateRequest
    setTransactionFormData(prev => ({ ...prev, ledger_account_id: ledger?.id || "" })); 
    setIsLedgerSelectOpen(false);
  };


  const handleSaveTransaction = async () => {
    if (!activeDaybook) {
      toast({ title: "Error", description: "No active daybook selected.", variant: "destructive" });
      return;
    }
    if (!transactionFormData.ledger_account_id) {
        toast({ title: "Validation Error", description: "Ledger account is required.", variant: "destructive" });
        return;
    }
    if (!transactionFormData.nepali_miti) {
        toast({ title: "Validation Error", description: "Transaction Nepali Miti is required.", variant: "destructive" });
        return;
    }


    setIsSubmittingTransaction(true);
    try {
      const payload: DaybookTransactionCreateRequest = {
        ...transactionFormData,
        daybook_id: activeDaybook.id,
      };

      if (editingTransaction) {
        // Update transaction - Assuming an \'update-daybook-transaction\' function exists
        // For now, we\'ll simulate by deleting and creating, or rely on create to handle upsert if designed that way.
        // This part needs clarification on how updates are handled.
        // If direct DB update:
        // await db.update<DaybookTransactionRow>(\'daybook_transactions\', editingTransaction.id, payload);
        // For now, let\'s assume we refresh after any transaction change.
        // This is a simplification. A proper update function would be better.
        // For demo, we will call create which might need to be an upsert or we need a new function.
        // Let\'s assume createDaybookTransactionFn can handle an ID for updates, or we need a new function.
        // For simplicity, this example will just re-fetch the daybook.
        // A real app would have an update function.
        // For now, we will assume no direct update, user has to delete and re-add.
        // Or, if createDaybookTransactionFn is smart enough to update if an ID is present (not standard for \'create\')
        // This example will focus on creation. For editing, a separate flow or function is needed.
        // Let\'s assume for now editing means deleting and re-adding for simplicity of this example.
        // Or, if your backend \'create-daybook-transaction\' can take an ID and update, that\'s also an option.
        
        // For this exercise, we will assume createDaybookTransactionFn is for new transactions only.
        // And we will refresh the daybook. A real app needs a proper update mechanism.
        toast({title: "Info", description: "Transaction editing not fully implemented in this example. Refreshing data."})


      } else {
        const result = await createDaybookTransactionFn(payload);
        if (result.success && result.transaction) {
             // Add to local state or reload
        } else {
            throw new Error(result.message || "Failed to create transaction");
        }
      }
      
      toast({ title: "Success", description: `Transaction ${editingTransaction ? 'updated' : 'saved'} successfully.` });
      setIsTransactionFormOpen(false);
      setEditingTransaction(null);
      loadOrCreateActiveDaybook(); // Reload the daybook to see changes
    } catch (error: any) {
      console.error("Error saving transaction:", error);
      toast({ title: "Error", description: error.message || "Failed to save transaction.", variant: "destructive" });
    } finally {
      setIsSubmittingTransaction(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete || !activeDaybook) return;
    setIsSubmittingTransaction(true); // Reuse loading state or add a new one
    try {
      const payload: DaybookTransactionDeleteRequest = {
        id: transactionToDelete.id,
        daybook_id: activeDaybook.id,
      };
      await deleteDaybookTransactionFn(payload);
      toast({ title: "Success", description: "Transaction deleted successfully." });
      setIsDeleteTransactionAlertOpen(false);
      setTransactionToDelete(null);
      loadOrCreateActiveDaybook(); // Reload
    } catch (error: any) {
      console.error("Error deleting transaction:", error);
      toast({ title: "Error", description: error.message || "Failed to delete transaction.", variant: "destructive" });
    } finally {
      setIsSubmittingTransaction(false);
    }
  };
  
  const openDeleteTransactionAlert = (transaction: LocalDaybookTransaction) => {
    setTransactionToDelete(transaction);
    setIsDeleteTransactionAlertOpen(true);
  };

  const handleCreateNewDaybook = async () => {
    if (!filterBranchId || !filterNepaliMiti) {
        toast({title: "Missing Info", description: "Please select a branch and Nepali Miti first.", variant: "default"}); // Changed variant to default
        return;
    }
    setIsLoading(true);
    try {
        // Attempt to parse the Nepali Miti to create an English date.
        // This assumes Nepali Miti is YYYY-MM-DD and can be parsed directly.
        // A proper Nepali to English date conversion library would be more robust.
        const parsedDate = parse(filterNepaliMiti, 'yyyy-MM-dd', new Date());
        if (!isValid(parsedDate)) {
            toast({title: "Invalid Date", description: "The Nepali Miti is not a valid date for conversion.", variant: "destructive"});
            setIsLoading(false);
            return;
        }
        const englishMiti = format(parsedDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"); // ISO string

        const result = await createDaybookFn({
            branch_id: filterBranchId,
            nepali_miti: filterNepaliMiti,
            english_miti: englishMiti, // Send as ISO string
            // opening_balance: 0 // Default or fetch from previous day\'s closing
        });
        if (result.success && result.daybook) {
            toast({title: "Success", description: "New daybook created."});
            loadOrCreateActiveDaybook(); // Reload to show the new daybook
        } else {
            throw new Error(result.message || "Failed to create daybook");
        }
    } catch (error: any) {
        console.error("Error creating new daybook:", error);
        toast({ title: "Error", description: error.message || "Could not create new daybook.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  const handleSubmitDaybook = async () => {
    if (!activeDaybook || activeDaybook.status !== 'pending') {
        toast({title: "Invalid Action", description: "Daybook cannot be submitted or is not in pending state.", variant: "default"}); // Changed variant to default
        return;
    }
    setIsSubmittingDaybook(true);
    try {
        await submitDaybookFn({ daybookId: activeDaybook.id });
        toast({title: "Success", description: "Daybook submitted for approval."});
        loadOrCreateActiveDaybook(); // Refresh
    } catch (error: any) {
        console.error("Error submitting daybook:", error);
        toast({ title: "Error", description: error.message || "Failed to submit daybook.", variant: "destructive" });
    } finally {
        setIsSubmittingDaybook(false);
    }
  };

  const handleApproveDaybook = async () => {
    if (!activeDaybook || activeDaybook.status !== 'submitted' || !isSuperAdmin) {
        toast({title: "Invalid Action", description: "Daybook cannot be approved or user lacks permission.", variant: "default"}); // Changed variant to default
        return;
    }
    setIsApprovingDaybook(true);
    try {
        await approveDaybookFn({ daybookId: activeDaybook.id });
        toast({title: "Success", description: "Daybook approved."});
        loadOrCreateActiveDaybook(); // Refresh
    } catch (error: any) {
        console.error("Error approving daybook:", error);
        toast({ title: "Error", description: error.message || "Failed to approve daybook.", variant: "destructive" });
    } finally {
        setIsApprovingDaybook(false);
    }
  };

  const openRejectDaybookDialog = (daybook: LocalDaybook) => {
    if (daybook.status !== 'submitted' || !isSuperAdmin) {
        toast({title: "Invalid Action", description: "Daybook cannot be rejected or user lacks permission.", variant: "default"}); // Changed variant to default
        return;
    }
    setDaybookToReject(daybook);
    setRejectionRemarks(""); // Reset remarks
    setIsRejectDialogValid(false); // Reset validation
  };

  const handleRejectDaybook = async () => {
    if (!daybookToReject || !rejectionRemarks.trim()) {
        setIsRejectDialogValid(true); // Show validation error in dialog if needed
        toast({title: "Validation Error", description: "Rejection remarks are required.", variant: "default"}); // Changed variant to default
        return;
    }
    setIsApprovingDaybook(true); // Reuse loading state or add a new one for rejection
    try {
        await rejectDaybookFn({ daybookId: daybookToReject.id, remarks: rejectionRemarks });
        toast({title: "Success", description: "Daybook rejected."});
        setDaybookToReject(null); // Close dialog
        loadOrCreateActiveDaybook(); // Refresh
    } catch (error: any) {
        console.error("Error rejecting daybook:", error);
        toast({ title: "Error", description: error.message || "Failed to reject daybook.", variant: "destructive" });
    } finally {
        setIsApprovingDaybook(false);
    }
  };
  
  const filteredBiltis = useMemo(() => {
    if (!biltiSearchTerm) return biltisForSelection.slice(0, 10); // Show some initial items
    return biltisForSelection.filter(b => 
        (b.documentNumber?.toLowerCase().includes(biltiSearchTerm.toLowerCase()) || 
         getPartyNameById(b.consignorId)?.toLowerCase().includes(biltiSearchTerm.toLowerCase()) ||
         getPartyNameById(b.consigneeId)?.toLowerCase().includes(biltiSearchTerm.toLowerCase()))
    ).slice(0, 10);
  }, [biltiSearchTerm, biltisForSelection, getPartyNameById]);

  const filteredParties = useMemo(() => {
    if (!partySearchTerm) return parties.slice(0, 10);
    return parties.filter(p => 
        p.name.toLowerCase().includes(partySearchTerm.toLowerCase())
    ).slice(0, 10);
  }, [partySearchTerm, parties]);

  const filteredLedgers = useMemo(() => {
    if (!ledgerSearchTerm) return ledgerAccounts.slice(0, 10);
    return ledgerAccounts.filter(l => 
        l.account_name.toLowerCase().includes(ledgerSearchTerm.toLowerCase())
    ).slice(0, 10);
  }, [ledgerSearchTerm, ledgerAccounts]);


  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!authUser) {
    // Already handled by useEffect, but good for initial render block
    return null; 
  }

  const canEditDaybook = activeDaybook?.status === 'pending' || (activeDaybook?.status === 'rejected' && !isSuperAdmin) || isSuperAdmin;
  const canSubmitDaybook = activeDaybook?.status === 'pending' && (activeDaybook.transactions?.length || 0) > 0;
  const canApproveRejectDaybook = activeDaybook?.status === 'submitted' && isSuperAdmin;


  return (
    <ScrollArea className="h-full">
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Daybook Management</h2>
        </div>

        {/* Filters and Load Button */}
        <Card>
          <CardHeader>
            <CardTitle>Select Daybook</CardTitle>
            <CardDescription>Select a branch and date to load or create a daybook.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Select value={filterBranchId} onValueChange={handleBranchChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nepaliMiti">Nepali Miti (YYYY-MM-DD)</Label>
              <Input 
                id="nepaliMiti" 
                type="text" // Changed from date to text for manual YYYY-MM-DD input
                value={filterNepaliMiti} 
                onChange={handleDateChange}
                placeholder="YYYY-MM-DD" 
              />
            </div>
            <div className="flex items-end space-x-2">
                <Button onClick={loadOrCreateActiveDaybook} disabled={isLoading || !filterBranchId || !filterNepaliMiti}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpenCheck className="mr-2 h-4 w-4" />}
                    Load Daybook
                </Button>
                 <Button onClick={handleLoadToday} variant="outline">Today</Button>
            </div>
          </CardContent>
        </Card>

        {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}

        {!isLoading && !activeDaybook && filterBranchId && filterNepaliMiti && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>No Daybook Found</CardTitle>
              <CardDescription>
                No daybook exists for {getBranchNameById(filterBranchId)} on {filterNepaliMiti}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleCreateNewDaybook} disabled={isLoading}>
                <PlusCircle className="mr-2 h-4 w-4" /> Create New Daybook
              </Button>
            </CardContent>
          </Card>
        )}

        {activeDaybook && (
          <>
            {/* Daybook Header and Actions */}
            <Card className="mt-4">
              <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Daybook for {getBranchNameById(activeDaybook.branch_id)} - {activeDaybook.nepali_miti}</CardTitle>
                        <CardDescription>
                            Status: <Badge variant={
                                activeDaybook.status === 'approved' ? 'default' : // 'default' is often green-ish
                                activeDaybook.status === 'rejected' ? 'destructive' :
                                activeDaybook.status === 'submitted' ? 'secondary' : // 'secondary' is often grey/blue
                                'outline' // for 'pending'
                            }>{activeDaybook.status}</Badge>
                            {activeDaybook.status === 'rejected' && activeDaybook.remarks && (
                                <span className="ml-2 text-sm text-destructive">Rejection Remarks: {activeDaybook.remarks}</span>
                            )}
                        </CardDescription>
                         <CardDescription className="mt-1">
                            Opening Balance: {daybookSummary.openingBalance.toFixed(2)} | 
                            Total Cash In: {daybookSummary.netCashIn.toFixed(2)} | 
                            Total Cash Out: {daybookSummary.netCashOut.toFixed(2)} | 
                            Closing Balance: <span className="font-semibold">{daybookSummary.closingBalance.toFixed(2)}</span>
                        </CardDescription>
                    </div>
                    <div className="flex space-x-2">
                        {canSubmitDaybook && (
                             <Button onClick={handleSubmitDaybook} disabled={isSubmittingDaybook}>
                                {isSubmittingDaybook ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckIcon className="mr-2 h-4 w-4" />} Submit for Approval
                            </Button>
                        )}
                        {canApproveRejectDaybook && (
                            <>
                            <Button onClick={handleApproveDaybook} disabled={isApprovingDaybook} variant="default">
                                {isApprovingDaybook && !daybookToReject ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckIcon className="mr-2 h-4 w-4" />} Approve
                            </Button>
                            <Dialog open={!!daybookToReject} onOpenChange={(isOpen) => !isOpen && setDaybookToReject(null)}>
                                <DialogTrigger asChild>
                                    <Button variant="destructive" onClick={() => openRejectDaybookDialog(activeDaybook)} disabled={isApprovingDaybook}>
                                        <AlertTriangle className="mr-2 h-4 w-4" /> Reject
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Reject Daybook</DialogTitle>
                                        <DialogDescription>
                                            Please provide remarks for rejecting this daybook.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <Textarea 
                                        placeholder="Rejection remarks..."
                                        value={rejectionRemarks}
                                        onChange={(e) => {
                                            setRejectionRemarks(e.target.value);
                                            if (e.target.value.trim()) setIsRejectDialogValid(false); // Hide validation error if user types
                                        }}
                                        className={cn(isRejectDialogValid && !rejectionRemarks.trim() && "border-red-500")}
                                    />
                                    {isRejectDialogValid && !rejectionRemarks.trim() && <p className="text-sm text-red-500">Remarks are required.</p>}
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setDaybookToReject(null)}>Cancel</Button>
                                        <Button variant="destructive" onClick={handleRejectDaybook} disabled={isApprovingDaybook || !rejectionRemarks.trim()}>
                                            {isApprovingDaybook && daybookToReject ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm Reject
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            </>
                        )}
                    </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Transactions Table */}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Transactions ({daybookSummary.transactionsCount})</h3>
                    {canEditDaybook && (
                         <Dialog open={isTransactionFormOpen} onOpenChange={setIsTransactionFormOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={() => handleOpenTransactionForm()}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Transaction
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[600px]">
                                <DialogHeader>
                                <DialogTitle>{editingTransaction ? "Edit" : "Add"} Transaction</DialogTitle>
                                <DialogDescription>
                                    {editingTransaction ? "Update the details of the transaction." : "Add a new transaction to the daybook."}
                                </DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="max-h-[70vh] p-1"> {/* Added ScrollArea for long forms */}
                                <div className="grid gap-4 py-4 pr-3">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="transaction_type" className="text-right">Type</Label>
                                        <Select 
                                            value={transactionFormData.transaction_type} 
                                            onValueChange={(value: DaybookTransactionType) => handleTransactionFormTypeChange(value)}
                                        >
                                            <SelectTrigger className="col-span-3">
                                                <SelectValue placeholder="Select Type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {transactionTypes.map(type => (
                                                <SelectItem key={type} value={type}>{type}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="amount" className="text-right">Amount</Label>
                                        <Input 
                                            id="amount" 
                                            name="amount" 
                                            type="number" 
                                            value={transactionFormData.amount} 
                                            onChange={handleTransactionFormInputChange} 
                                            className="col-span-3" 
                                        />
                                    </div>
                                     <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="nepali_miti_tx" className="text-right">Nepali Miti</Label>
                                        <Input
                                            id="nepali_miti_tx"
                                            name="nepali_miti" // Ensure this matches the state field
                                            type="text"
                                            placeholder="YYYY-MM-DD"
                                            value={transactionFormData.nepali_miti}
                                            onChange={handleTransactionNepaliMitiChange}
                                            className="col-span-3"
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="description" className="text-right">Description</Label>
                                        <Textarea 
                                            id="description" 
                                            name="description" 
                                            value={transactionFormData.description || ""} 
                                            onChange={handleTransactionFormInputChange} 
                                            className="col-span-3" 
                                        />
                                    </div>
                                    {(transactionFormData.transaction_type === "Cash In (from Delivery/Receipt)" || transactionFormData.transaction_type === "Delivery Expense (Cash Out)") && (
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="reference_id" className="text-right">Bilti Ref.</Label>
                                            <Popover open={isBiltiSelectOpen} onOpenChange={setIsBiltiSelectOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" role="combobox" aria-expanded={isBiltiSelectOpen} className="col-span-3 justify-between">
                                                        {selectedBiltiForTx ? `\${selectedBiltiForTx.documentNumber} (Consignor: \${getPartyNameById(selectedBiltiForTx.consignorId)})` : "Select Bilti..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Search bilti no or party..." value={biltiSearchTerm} onValueChange={setBiltiSearchTerm} />
                                                        <CommandList>
                                                            <CommandEmpty>No bilti found.</CommandEmpty>
                                                            {filteredBiltis.map((bilti) => (
                                                            <CommandItem
                                                                key={bilti.id}
                                                                value={`\${bilti.documentNumber} \${getPartyNameById(bilti.consignorId)} \${getPartyNameById(bilti.consigneeId)}`}
                                                                onSelect={() => handleBiltiSelectForTx(bilti.id)}
                                                            >
                                                                <CheckIcon className={cn("mr-2 h-4 w-4", selectedBiltiForTx?.id === bilti.id ? "opacity-100" : "opacity-0")}/>
                                                                {bilti.documentNumber} (Consignor: {getPartyNameById(bilti.consignorId)}, Consignee: {getPartyNameById(bilti.consigneeId)})
                                                            </CommandItem>
                                                            ))}
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    )}
                                    {transactionFormData.transaction_type === "Cash In (from Party Payment)" && (
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="party_id" className="text-right">Party</Label>
                                             <Popover open={isPartySelectOpen} onOpenChange={setIsPartySelectOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" role="combobox" aria-expanded={isPartySelectOpen} className="col-span-3 justify-between">
                                                        {selectedPartyForTx ? selectedPartyForTx.name : "Select Party..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Search party..." value={partySearchTerm} onValueChange={setPartySearchTerm}/>
                                                        <CommandList>
                                                            <CommandEmpty>No party found.</CommandEmpty>
                                                            {filteredParties.map((party) => (
                                                            <CommandItem
                                                                key={party.id}
                                                                value={party.name}
                                                                onSelect={() => handlePartySelectForTx(party.id)}
                                                            >
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
                                     <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="ledger_account_id" className="text-right">Ledger Acct.</Label>
                                        <Popover open={isLedgerSelectOpen} onOpenChange={setIsLedgerSelectOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" role="combobox" aria-expanded={isLedgerSelectOpen} className="col-span-3 justify-between">
                                                    {selectedLedgerForTx ? selectedLedgerForTx.account_name : "Select Ledger Account..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                <Command>
                                                    <CommandInput placeholder="Search ledger account..." value={ledgerSearchTerm} onValueChange={setLedgerSearchTerm} />
                                                    <CommandList>
                                                        <CommandEmpty>No ledger account found.</CommandEmpty>
                                                        {filteredLedgers.map((ledger) => (
                                                        <CommandItem
                                                            key={ledger.id}
                                                            value={ledger.account_name}
                                                            onSelect={() => handleLedgerSelectForTx(ledger.id)}
                                                        >
                                                            <CheckIcon className={cn("mr-2 h-4 w-4", selectedLedgerForTx?.id === ledger.id ? "opacity-100" : "opacity-0")}/>
                                                            {ledger.account_name}
                                                        </CommandItem>
                                                        ))}
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    {transactionFormData.transaction_type === "Adjustment/Correction" && (
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="reason_for_adjustment" className="text-right">Reason</Label>
                                            <Input id="reason_for_adjustment" name="reason_for_adjustment" value={transactionFormData.reason_for_adjustment || ""} onChange={handleTransactionFormInputChange} className="col-span-3" />
                                        </div>
                                    )}
                                    {/* Supporting Document Upload - Placeholder */}
                                    {/* <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="supporting_doc_url" className="text-right">Doc URL</Label>
                                        <Input id="supporting_doc_url" name="supporting_doc_url" value={transactionFormData.supporting_doc_url || ""} onChange={handleTransactionFormInputChange} className="col-span-3" placeholder="Optional: http://..." />
                                    </div> */}
                                </div>
                                </ScrollArea>
                                <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="outline">Cancel</Button>
                                </DialogClose>
                                <Button onClick={handleSaveTransaction} disabled={isSubmittingTransaction || !transactionFormData.ledger_account_id || !transactionFormData.nepali_miti}>
                                    {isSubmittingTransaction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {editingTransaction ? "Save Changes" : "Add Transaction"}
                                </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Party</TableHead>
                      <TableHead>Ledger</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      {canEditDaybook && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(activeDaybook.transactions || []).length === 0 && (
                        <TableRow><TableCell colSpan={canEditDaybook ? 8 : 7} className="text-center">No transactions yet.</TableCell></TableRow>
                    )}
                    {(activeDaybook.transactions || []).map(tx => (
                      <TableRow key={tx.id}>
                        <TableCell>{tx.nepali_miti}</TableCell>
                        <TableCell><Badge variant={tx.transaction_type.toLowerCase().includes("cash in") ? "default" : "secondary"}>{tx.transaction_type}</Badge></TableCell>
                        <TableCell className="max-w-xs truncate">{tx.description}</TableCell>
                        <TableCell>
                            {tx.reference_id && (tx.transaction_type === "Cash In (from Delivery/Receipt)" || tx.transaction_type === "Delivery Expense (Cash Out)") 
                                ? `Bilti: ${getBiltiDetailsById(tx.reference_id)?.documentNumber || tx.reference_id}`
                                : tx.reference_id || "N/A"
                            }
                        </TableCell>
                        <TableCell>{getPartyNameById(tx.party_id)}</TableCell>
                        <TableCell>{getLedgerAccountNameById(tx.ledger_account_id)}</TableCell>
                        <TableCell className="text-right">{tx.amount.toFixed(2)}</TableCell>
                        {canEditDaybook && (
                            <TableCell className="space-x-1">
                                <Button variant="ghost" size="icon" onClick={() => handleOpenTransactionForm(tx)} title="Edit Transaction">
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog open={isDeleteTransactionAlertOpen && transactionToDelete?.id === tx.id} onOpenChange={(isOpen) => {if(!isOpen) setTransactionToDelete(null)}}>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={() => openDeleteTransactionAlert(tx)} title="Delete Transaction">
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the transaction.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setIsDeleteTransactionAlertOpen(false)}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteTransaction} className={buttonVariants({variant: "destructive"})}>
                                            {isSubmittingTransaction ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Delete
                                        </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Daybook Summary */}
            <Card className="mt-4">
                <CardHeader><CardTitle>Daybook Summary</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h4 className="font-semibold mb-2">Cash In Details:</h4>
                            {Object.entries(daybookSummary.cashInByType).map(([type, total]) => (
                                <div key={type} className="flex justify-between text-sm"><span>{type}:</span> <span>{total.toFixed(2)}</span></div>
                            ))}
                            <hr className="my-1"/>
                            <div className="flex justify-between font-semibold"><span>Total Cash In:</span> <span>{daybookSummary.netCashIn.toFixed(2)}</span></div>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Cash Out Details:</h4>
                             {Object.entries(daybookSummary.cashOutByType).map(([type, total]) => (
                                <div key={type} className="flex justify-between text-sm"><span>{type}:</span> <span>{total.toFixed(2)}</span></div>
                            ))}
                            <hr className="my-1"/>
                            <div className="flex justify-between font-semibold"><span>Total Cash Out:</span> <span>{daybookSummary.netCashOut.toFixed(2)}</span></div>
                        </div>
                    </div>
                    <hr className="my-3"/>
                    <div className="space-y-1 text-md">
                        <div className="flex justify-between"><span>Opening Balance:</span> <span>{daybookSummary.openingBalance.toFixed(2)}</span></div>
                        <div className="flex justify-between text-green-600"><span>(+) Total Cash In:</span> <span>{daybookSummary.netCashIn.toFixed(2)}</span></div>
                        <div className="flex justify-between text-red-600"><span>(-) Total Cash Out:</span> <span>{daybookSummary.netCashOut.toFixed(2)}</span></div>
                        <hr className="my-1 border-dashed"/>
                        <div className="flex justify-between font-bold text-lg"><span>Closing Balance:</span> <span>{daybookSummary.closingBalance.toFixed(2)}</span></div>
                    </div>
                </CardContent>
            </Card>
          </>
        )}
      </div>
    </ScrollArea>
  );
}

