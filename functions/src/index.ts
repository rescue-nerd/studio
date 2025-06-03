import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2/firestore"; // Using v2 Firestore triggers
import {logger} from "firebase-functions"; // Using v2 logger

admin.initializeApp();
const db = admin.firestore();

interface UserData {
  status?: "active" | "disabled";
  role?: string;
  email?: string;
  displayName?: string;
}

interface DaybookTransaction {
  id: string;
  transactionType: string;
  amount: number;
  description: string;
  ledgerAccountId?: string;
  partyId?: string;
  referenceId?: string;
  nepaliMiti?: string;
  createdAt: admin.firestore.Timestamp;
}

interface DaybookData {
  status?: "Draft" | "Pending Approval" | "Approved" | "Rejected";
  nepaliMiti: string;
  englishMiti: admin.firestore.Timestamp;
  branchId: string;
  transactions: DaybookTransaction[];
  openingBalance: number;
  totalCashIn: number;
  totalCashOut: number;
  closingBalance: number;
  processedByFunction?: boolean;
  approvedBy?: string;
}


/**
 * Syncs user status from Firestore 'users' collection to Firebase Authentication.
 * If a user's 'status' field in Firestore is set to "disabled", they are disabled in Auth.
 * If set to "active", they are enabled in Auth.
 */
export const syncUserStatusToAuth = functions.onDocumentWritten(
  "users/{userId}",
  async (event) => {
    const userId = event.params.userId;
    const beforeData = event.data?.before.data() as UserData | undefined;
    const afterData = event.data?.after.data() as UserData | undefined;

    if (!afterData) {
      logger.log(`User ${userId} deleted, no status to sync.`);
      return;
    }

    const oldStatus = beforeData?.status;
    const newStatus = afterData.status;

    if (oldStatus === newStatus) {
      logger.log(`User ${userId} status unchanged (${newStatus}), no action needed.`);
      return;
    }

    try {
      if (newStatus === "disabled") {
        await admin.auth().updateUser(userId, {disabled: true});
        logger.log(`User ${userId} successfully disabled in Firebase Auth.`);
      } else if (newStatus === "active") {
        await admin.auth().updateUser(userId, {disabled: false});
        logger.log(`User ${userId} successfully enabled in Firebase Auth.`);
      }
    } catch (error) {
      logger.error(`Error updating auth status for user ${userId}:`, error);
      // Optionally, you could try to revert the Firestore status change here
      // or add more sophisticated error handling/retry mechanisms.
    }
  });


/**
 * Processes an approved Daybook to create corresponding ledger entries.
 */
export const processApprovedDaybook = functions.onDocumentWritten(
  "daybooks/{daybookId}",
  async (event) => {
    const daybookId = event.params.daybookId;
    const beforeData = event.data?.before.data() as DaybookData | undefined;
    const afterData = event.data?.after.data() as DaybookData | undefined;

    if (!afterData) {
      logger.log(`Daybook ${daybookId} deleted.`);
      return;
    }

    // Check if status changed to "Approved" and not already processed
    const becameApproved =
      afterData.status === "Approved" &&
      beforeData?.status !== "Approved";

    if (!becameApproved) {
      logger.log(`Daybook ${daybookId} not newly approved. Status: ${afterData.status}. Processed: ${afterData.processedByFunction}`);
      return;
    }

    if (afterData.processedByFunction) {
      logger.log(`Daybook ${daybookId} already processed. Skipping.`);
      return;
    }

    logger.log(`Processing approved daybook: ${daybookId}`);

    const daybook: DaybookData = afterData;
    const batch = db.batch();

    // Placeholder for main cash ledger account ID
    // In a real app, this might come from config or branch settings
    const MAIN_CASH_LEDGER_ACCOUNT_ID = `BRANCH_CASH_${daybook.branchId}`;

    for (const tx of daybook.transactions) {
      const ledgerEntryBase = {
        miti: daybook.englishMiti, // Assuming daybook's date for all entries
        nepaliMiti: tx.nepaliMiti || daybook.nepaliMiti,
        referenceNo: `DB-${daybookId}-${tx.id}`,
        sourceModule: "Daybook",
        branchId: daybook.branchId,
        status: "Approved" as const, // Entries from approved daybook are auto-approved
        createdAt: admin.firestore.Timestamp.now(),
        createdBy: daybook.approvedBy || "system-daybook-processor", // User who approved daybook or system
      };

      let debitAccountId: string | undefined;
      let creditAccountId: string | undefined;
      let description = tx.description;

      // Determine debit and credit accounts based on transaction type
      // This logic is simplified and needs careful expansion based on actual accounting rules.
      if (tx.transactionType.toLowerCase().includes("cash in")) {
        debitAccountId = MAIN_CASH_LEDGER_ACCOUNT_ID; // Cash is debited (increases)
        creditAccountId = tx.ledgerAccountId || tx.partyId || "UNKNOWN_INCOME_SOURCE";
        description = `Cash In: ${tx.description}`;
      } else if (tx.transactionType.toLowerCase().includes("cash out")) {
        creditAccountId = MAIN_CASH_LEDGER_ACCOUNT_ID; // Cash is credited (decreases)
        debitAccountId = tx.ledgerAccountId || tx.partyId || "UNKNOWN_EXPENSE_TARGET";
        description = `Cash Out: ${tx.description}`;
      } else if (tx.transactionType === "Adjustment/Correction") {
        if (tx.amount >= 0) { // Positive adjustment = Cash In
            debitAccountId = MAIN_CASH_LEDGER_ACCOUNT_ID;
            creditAccountId = tx.ledgerAccountId || "ADJUSTMENT_ACCOUNT";
            description = `Adjustment (Credit): ${tx.description}`;
        } else { // Negative adjustment = Cash Out
            creditAccountId = MAIN_CASH_LEDGER_ACCOUNT_ID;
            debitAccountId = tx.ledgerAccountId || "ADJUSTMENT_ACCOUNT";
            description = `Adjustment (Debit): ${tx.description}`;
        }
      } else {
        logger.warn(`Unknown transaction type for ledger posting: ${tx.transactionType}`);
        continue; // Skip this transaction
      }
      
      // Ensure account IDs are valid; create/lookup ledger accounts if needed
      // For simplicity, we assume ledgerAccountId or partyId (if available) can be directly used or mapped.
      // In a real system, you might need to find or create ledger accounts based on partyId, truckId, etc.
      // if specific ledgerAccountId is not provided in the daybook transaction.

      if (debitAccountId) {
        const debitEntryRef = db.collection("ledgerEntries").doc();
        batch.set(debitEntryRef, {
          ...ledgerEntryBase,
          accountId: debitAccountId,
          description: description,
          debit: Math.abs(tx.amount),
          credit: 0,
          transactionType: tx.transactionType,
        });
      }

      if (creditAccountId) {
        const creditEntryRef = db.collection("ledgerEntries").doc();
        batch.set(creditEntryRef, {
          ...ledgerEntryBase,
          accountId: creditAccountId,
          description: description,
          debit: 0,
          credit: Math.abs(tx.amount),
          transactionType: tx.transactionType,
        });
      }
    }

    // Mark daybook as processed
    const daybookDocRef = db.collection("daybooks").doc(daybookId);
    batch.update(daybookDocRef, {processedByFunction: true, updatedAt: admin.firestore.Timestamp.now()});

    try {
      await batch.commit();
      logger.log(`Daybook ${daybookId} processed successfully, ${daybook.transactions.length * 2} ledger entries created (approx).`);
    } catch (error) {
      logger.error(`Error committing ledger entries for daybook ${daybookId}:`, error);
      // Consider how to handle partial failures or retry.
    }
  });
