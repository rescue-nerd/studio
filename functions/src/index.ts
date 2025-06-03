
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2/firestore"; // Using v2 Firestore triggers
import {logger} from "firebase-functions"; // Using v2 logger

import type {
  UserData,
  DaybookData,
  BiltiData,
  GoodsDeliveryData,
  PartyData,
  LedgerEntryData,
  LedgerTransactionType,
} from "./types"; // Assuming you'll create a types.ts in functions/src

admin.initializeApp();
const db = admin.firestore();

// Placeholder Account IDs - In a real app, these would come from config/settings
const PLACEHOLDER_FREIGHT_INCOME_ACCOUNT_ID = "ACC_FREIGHT_INCOME";
const PLACEHOLDER_REBATE_EXPENSE_ACCOUNT_ID = "ACC_REBATE_EXPENSE";
const PLACEHOLDER_DISCOUNT_EXPENSE_ACCOUNT_ID = "ACC_DISCOUNT_EXPENSE";
// const PLACEHOLDER_CASH_ACCOUNT_ID = "ACC_CASH_MAIN"; // General cash account


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
      logger.log(`User ${userId} status unchanged (${newStatus || "not set"}), no action needed.`);
      return;
    }

    try {
      if (newStatus === "disabled") {
        await admin.auth().updateUser(userId, {disabled: true});
        logger.log(`User ${userId} successfully disabled in Firebase Auth.`);
      } else if (newStatus === "active") {
        await admin.auth().updateUser(userId, {disabled: false});
        logger.log(`User ${userId} successfully enabled in Firebase Auth.`);
      } else {
        logger.log(`User ${userId} status is '${newStatus || "not set"}', no auth action taken.`);
      }
    } catch (error) {
      logger.error(`Error updating auth status for user ${userId}:`, error);
    }
  });


/**
 * Processes an approved Daybook to create corresponding ledger entries.
 */
export const processApprovedDaybook = functions.onDocumentWritten(
  "daybooks/{daybookId}",
  async (event) => {
    const daybookId = event.params.daybookId;
    const afterData = event.data?.after.data() as DaybookData | undefined;

    if (!afterData) {
      logger.log(`Daybook ${daybookId} deleted.`);
      return;
    }

    const becameApproved =
      afterData.status === "Approved" &&
      event.data?.before.data()?.status !== "Approved";

    if (!becameApproved) {
      logger.log(`Daybook ${daybookId} not newly approved. Status: ${afterData.status}.`);
      return;
    }

    if (afterData.processedByFunction) {
      logger.log(`Daybook ${daybookId} already processed. Skipping.`);
      return;
    }

    logger.log(`Processing approved daybook: ${daybookId}`);

    const daybook: DaybookData = afterData;
    const batch = db.batch();
    const MAIN_CASH_LEDGER_ACCOUNT_ID = `BRANCH_CASH_${daybook.branchId}`;

    for (const tx of daybook.transactions) {
      const ledgerEntryBase = {
        miti: daybook.englishMiti,
        nepaliMiti: tx.nepaliMiti || daybook.nepaliMiti,
        referenceNo: `DB-${daybookId}-${tx.id}`,
        sourceModule: "Daybook",
        branchId: daybook.branchId,
        status: "Approved" as const,
        createdAt: admin.firestore.Timestamp.now(),
        createdBy: daybook.approvedBy || "system-daybook-processor",
      };

      let debitAccountId: string | undefined;
      let creditAccountId: string | undefined;
      let description = tx.description;

      if (tx.transactionType.toLowerCase().includes("cash in")) {
        debitAccountId = MAIN_CASH_LEDGER_ACCOUNT_ID;
        creditAccountId = tx.ledgerAccountId || tx.partyId || "UNKNOWN_INCOME_SOURCE";
        description = `Cash In via Daybook: ${tx.description}`;
      } else if (tx.transactionType.toLowerCase().includes("cash out")) {
        creditAccountId = MAIN_CASH_LEDGER_ACCOUNT_ID;
        debitAccountId = tx.ledgerAccountId || tx.partyId || "UNKNOWN_EXPENSE_TARGET";
        description = `Cash Out via Daybook: ${tx.description}`;
      } else if (tx.transactionType === "Adjustment/Correction") {
        if (tx.amount >= 0) {
            debitAccountId = MAIN_CASH_LEDGER_ACCOUNT_ID;
            creditAccountId = tx.ledgerAccountId || "ADJUSTMENT_ACCOUNT";
            description = `Daybook Adjustment (Credit Cash): ${tx.description}`;
        } else {
            creditAccountId = MAIN_CASH_LEDGER_ACCOUNT_ID;
            debitAccountId = tx.ledgerAccountId || "ADJUSTMENT_ACCOUNT";
            description = `Daybook Adjustment (Debit Cash): ${tx.description}`;
        }
      } else {
        logger.warn(`Daybook ${daybookId}: Unknown transaction type for ledger posting: ${tx.transactionType}`);
        continue;
      }

      if (debitAccountId) {
        const debitEntryRef = db.collection("ledgerEntries").doc();
        batch.set(debitEntryRef, {
          ...ledgerEntryBase,
          accountId: debitAccountId,
          description: description,
          debit: Math.abs(tx.amount),
          credit: 0,
          transactionType: tx.transactionType as LedgerTransactionType,
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
          transactionType: tx.transactionType as LedgerTransactionType,
        });
      }
    }

    const daybookDocRef = db.collection("daybooks").doc(daybookId);
    batch.update(daybookDocRef, {processedByFunction: true, updatedAt: admin.firestore.Timestamp.now()});

    try {
      await batch.commit();
      logger.log(`Daybook ${daybookId} processed successfully, approx ${daybook.transactions.length * 2} ledger entries created.`);
    } catch (error) {
      logger.error(`Error committing ledger entries for daybook ${daybookId}:`, error);
    }
  });

/**
 * Posts ledger entries when a new Bilti is created.
 */
export const postBiltiLedgerEntries = functions.onDocumentCreated(
  "biltis/{biltiId}",
  async (event) => {
    const biltiId = event.params.biltiId;
    const biltiData = event.data?.data() as BiltiData | undefined;

    if (!biltiData) {
      logger.log(`Bilti ${biltiId} data not found on creation. Skipping ledger posting.`);
      return;
    }

    if (biltiData.ledgerProcessed) {
      logger.log(`Bilti ${biltiId} already ledger processed. Skipping.`);
      return;
    }

    logger.log(`Processing ledger entries for new Bilti: ${biltiId}`);
    const batch = db.batch();

    const consignorSnap = await db.collection("parties").doc(biltiData.consignorId).get();
    const consigneeSnap = await db.collection("parties").doc(biltiData.consigneeId).get();

    if (!consignorSnap.exists || !consigneeSnap.exists) {
      logger.error(`Bilti ${biltiId}: Consignor or Consignee party document not found. Skipping ledger entries.`);
      // Optionally mark as processed with error or leave for retry
      return;
    }
    const consignor = consignorSnap.data() as PartyData;
    const consignee = consigneeSnap.data() as PartyData;

    const ledgerEntryBase: Omit<LedgerEntryData, "id" | "accountId" | "debit" | "credit"> = {
      miti: biltiData.miti,
      nepaliMiti: biltiData.nepaliMiti || "",
      referenceNo: `BLT-${biltiId}`,
      sourceModule: "Bilti",
      status: "Approved", // Bilti entries are auto-approved
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: biltiData.createdBy || "system-bilti-processor",
      transactionType: "Bilti",
      branchId: biltiData.branchId || "UNKNOWN_BRANCH", // Assuming Bilti might have a branchId
    };

    const freightAmount = biltiData.totalAmount;

    if (biltiData.payMode === "Paid") {
      // Consignor Paid: Debit Consignor, Credit Freight Income
      // This means cash was received or is due from consignor immediately.
      // For simplicity, we directly assume freight income recognition.
      // A more complex system might involve unearned revenue if services not fully rendered.

      // Debit Consignor (Party who paid)
      batch.set(db.collection("ledgerEntries").doc(), {
        ...ledgerEntryBase,
        accountId: consignor.assignedLedgerId,
        description: `Freight charges for Bilti ${biltiId} (Paid by Consignor)`,
        debit: freightAmount,
        credit: 0,
      });
      // Credit Freight Income
      batch.set(db.collection("ledgerEntries").doc(), {
        ...ledgerEntryBase,
        accountId: PLACEHOLDER_FREIGHT_INCOME_ACCOUNT_ID,
        description: `Freight income from Bilti ${biltiId}`,
        debit: 0,
        credit: freightAmount,
      });
    } else if (biltiData.payMode === "To Pay" || biltiData.payMode === "Due") {
      // Consignee to Pay/Due: Debit Consignee, Credit Freight Income
      // This means cash is expected from the consignee upon delivery.

      // Debit Consignee (Party who will pay)
      batch.set(db.collection("ledgerEntries").doc(), {
        ...ledgerEntryBase,
        accountId: consignee.assignedLedgerId,
        description: `Freight charges for Bilti ${biltiId} (To be Paid by Consignee)`,
        debit: freightAmount,
        credit: 0,
      });
      // Credit Freight Income
      batch.set(db.collection("ledgerEntries").doc(), {
        ...ledgerEntryBase,
        accountId: PLACEHOLDER_FREIGHT_INCOME_ACCOUNT_ID,
        description: `Freight income from Bilti ${biltiId}`,
        debit: 0,
        credit: freightAmount,
      });
    } else {
      logger.warn(`Bilti ${biltiId}: Unknown payMode "${biltiData.payMode}". No standard ledger entries posted.`);
    }

    const biltiDocRef = db.collection("biltis").doc(biltiId);
    batch.update(biltiDocRef, {ledgerProcessed: true, updatedAt: admin.firestore.Timestamp.now()});

    try {
      await batch.commit();
      logger.log(`Bilti ${biltiId}: Ledger entries processed successfully.`);
    } catch (error) {
      logger.error(`Bilti ${biltiId}: Error committing ledger entries:`, error);
    }
  });

/**
 * Posts ledger entries for rebates and discounts when a GoodsDelivery note is created.
 */
export const postGoodsDeliveryLedgerEntries = functions.onDocumentCreated(
  "goodsDeliveries/{deliveryId}",
  async (event) => {
    const deliveryId = event.params.deliveryId;
    const deliveryData = event.data?.data() as GoodsDeliveryData | undefined;

    if (!deliveryData) {
      logger.log(`GoodsDelivery ${deliveryId} data not found on creation. Skipping ledger posting.`);
      return;
    }

    if (deliveryData.ledgerProcessed) {
      logger.log(`GoodsDelivery ${deliveryId} already ledger processed. Skipping.`);
      return;
    }

    if (!deliveryData.deliveredBiltis || deliveryData.deliveredBiltis.length === 0) {
      logger.log(`GoodsDelivery ${deliveryId} has no biltis. Skipping ledger entries.`);
      const deliveryDocRef = db.collection("goodsDeliveries").doc(deliveryId);
      await deliveryDocRef.update({ledgerProcessed: true, updatedAt: admin.firestore.Timestamp.now()});
      return;
    }

    logger.log(`Processing ledger entries for new GoodsDelivery: ${deliveryId}`);
    const batch = db.batch();

    for (const item of deliveryData.deliveredBiltis) {
      const biltiSnap = await db.collection("biltis").doc(item.biltiId).get();
      if (!biltiSnap.exists) {
        logger.error(`GoodsDelivery ${deliveryId}: Bilti ${item.biltiId} not found. Skipping rebates/discounts for this item.`);
        continue;
      }
      const bilti = biltiSnap.data() as BiltiData;

      // Rebates and discounts are typically credited to the party who was supposed to pay,
      // which is usually the consignee if "To Pay" or "Due".
      // If "Paid" by consignor, then credit consignor.
      // For simplicity, let's assume the consignee's ledger is affected for now.
      // A more robust system would check bilti.payMode and determine the debtor.
      const partyToCreditSnap = await db.collection("parties").doc(bilti.consigneeId).get();
      if (!partyToCreditSnap.exists) {
        logger.error(`GoodsDelivery ${deliveryId}: Consignee ${bilti.consigneeId} for Bilti ${item.biltiId} not found. Skipping ledger for this item.`);
        continue;
      }
      const partyToCredit = partyToCreditSnap.data() as PartyData;

      const ledgerEntryBase: Omit<LedgerEntryData, "id" | "accountId" | "debit" | "credit" | "description" | "transactionType"> = {
        miti: deliveryData.miti,
        nepaliMiti: deliveryData.nepaliMiti || "",
        referenceNo: `GD-${deliveryId}-BLT-${item.biltiId}`,
        sourceModule: "GoodsDelivery",
        status: "Approved",
        createdAt: admin.firestore.Timestamp.now(),
        createdBy: deliveryData.createdBy || "system-gd-processor",
        branchId: bilti.branchId || "UNKNOWN_BRANCH", // Assuming Bilti might have a branchId or GoodsDelivery has one
      };

      if (item.rebateAmount > 0) {
        // Debit Rebate Expense, Credit Party
        batch.set(db.collection("ledgerEntries").doc(), {
          ...ledgerEntryBase,
          accountId: PLACEHOLDER_REBATE_EXPENSE_ACCOUNT_ID,
          description: `Rebate for Bilti ${item.biltiId}: ${item.rebateReason || "Rebate Given"}`,
          debit: item.rebateAmount,
          credit: 0,
          transactionType: "Rebate" as LedgerTransactionType,
        });
        batch.set(db.collection("ledgerEntries").doc(), {
          ...ledgerEntryBase,
          accountId: partyToCredit.assignedLedgerId,
          description: `Rebate received for Bilti ${item.biltiId}: ${item.rebateReason || "Rebate Given"}`,
          debit: 0,
          credit: item.rebateAmount,
          transactionType: "Rebate" as LedgerTransactionType,
        });
      }

      if (item.discountAmount > 0) {
        // Debit Discount Expense, Credit Party
        batch.set(db.collection("ledgerEntries").doc(), {
          ...ledgerEntryBase,
          accountId: PLACEHOLDER_DISCOUNT_EXPENSE_ACCOUNT_ID,
          description: `Discount for Bilti ${item.biltiId}: ${item.discountReason || "Discount Given"}`,
          debit: item.discountAmount,
          credit: 0,
          transactionType: "Discount" as LedgerTransactionType,
        });
        batch.set(db.collection("ledgerEntries").doc(), {
          ...ledgerEntryBase,
          accountId: partyToCredit.assignedLedgerId,
          description: `Discount received for Bilti ${item.biltiId}: ${item.discountReason || "Discount Given"}`,
          debit: 0,
          credit: item.discountAmount,
          transactionType: "Discount" as LedgerTransactionType,
        });
      }
    }

    const deliveryDocRef = db.collection("goodsDeliveries").doc(deliveryId);
    batch.update(deliveryDocRef, {ledgerProcessed: true, updatedAt: admin.firestore.Timestamp.now()});

    try {
      await batch.commit();
      logger.log(`GoodsDelivery ${deliveryId}: Ledger entries for rebates/discounts processed successfully.`);
    } catch (error) {
      logger.error(`GoodsDelivery ${deliveryId}: Error committing ledger entries for rebates/discounts:`, error);
    }
  });

// It's good practice to define types for function data to ensure consistency
// Create a types.ts file in functions/src
// e.g., functions/src/types.ts
/*
import type { Timestamp } from "firebase-admin/firestore";

export interface UserData {
  status?: "active" | "disabled";
  role?: string;
  email?: string;
  displayName?: string;
}

export interface DaybookTransaction {
  id: string;
  transactionType: string;
  amount: number;
  description: string;
  ledgerAccountId?: string;
  partyId?: string;
  referenceId?: string;
  nepaliMiti?: string;
  createdAt: Timestamp;
}

export interface DaybookData {
  status?: "Draft" | "Pending Approval" | "Approved" | "Rejected";
  nepaliMiti: string;
  englishMiti: Timestamp;
  branchId: string;
  transactions: DaybookTransaction[];
  openingBalance: number;
  totalCashIn: number;
  totalCashOut: number;
  closingBalance: number;
  processedByFunction?: boolean;
  approvedBy?: string;
  // Auditable fields
  createdBy?: string;
  createdAt?: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

export interface BiltiData {
  id: string;
  miti: Timestamp;
  nepaliMiti?: string;
  consignorId: string;
  consigneeId: string;
  totalAmount: number;
  payMode: "Paid" | "To Pay" | "Due";
  ledgerProcessed?: boolean;
  createdBy?: string;
  branchId?: string; // Assuming bilti can be associated with a branch
}

export interface DeliveredBiltiItemData {
  biltiId: string;
  rebateAmount: number;
  rebateReason?: string;
  discountAmount: number;
  discountReason?: string;
}

export interface GoodsDeliveryData {
  id: string;
  miti: Timestamp;
  nepaliMiti?: string;
  deliveredBiltis: DeliveredBiltiItemData[];
  ledgerProcessed?: boolean;
  createdBy?: string;
}

export interface PartyData {
  id: string;
  name: string;
  assignedLedgerId: string;
}

export type LedgerTransactionType =
  | "Bilti"
  | "Delivery"
  | "Rebate"
  | "Discount"
  | "Manual Credit"
  | "Manual Debit"
  | "Opening Balance"
  | "Payment"
  | "Receipt"
  | "Expense"
  | "Fuel"
  | "Maintenance"
  | "DaybookCashIn"
  | "DaybookCashOut"
  | string;

export interface LedgerEntryData {
  id: string;
  accountId: string;
  miti: Timestamp;
  nepaliMiti?: string;
  description: string;
  debit: number;
  credit: number;
  referenceNo?: string;
  transactionType: LedgerTransactionType;
  status: "Pending" | "Approved" | "Rejected";
  sourceModule?: string;
  branchId?: string;
  createdAt: Timestamp;
  createdBy?: string;
}

*/

