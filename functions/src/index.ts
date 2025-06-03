
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2/firestore"; // Using v2 Firestore triggers
import {logger} from "firebase-functions"; // Using v2 logger
import {onCall, HttpsError} from "firebase-functions/v2/https"; // For HTTPS Callable Functions v2

import type {
  UserData,
  DaybookData,
  BiltiData,
  GoodsDeliveryData,
  PartyData,
  LedgerEntryData,
  LedgerTransactionType,
  BranchData, // Added BranchData
} from "./types";

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
      return;
    }
    const consignor = consignorSnap.data() as PartyData;
    const consignee = consigneeSnap.data() as PartyData;

    const ledgerEntryBase: Omit<LedgerEntryData, "id" | "accountId" | "debit" | "credit"> = {
      miti: biltiData.miti,
      nepaliMiti: biltiData.nepaliMiti || "",
      referenceNo: `BLT-${biltiId}`,
      sourceModule: "Bilti",
      status: "Approved",
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: biltiData.createdBy || "system-bilti-processor",
      transactionType: "Bilti",
      branchId: biltiData.branchId || "UNKNOWN_BRANCH",
    };

    const freightAmount = biltiData.totalAmount;

    if (biltiData.payMode === "Paid") {
      batch.set(db.collection("ledgerEntries").doc(), {
        ...ledgerEntryBase,
        accountId: consignor.assignedLedgerId,
        description: `Freight charges for Bilti ${biltiId} (Paid by Consignor)`,
        debit: freightAmount,
        credit: 0,
      });
      batch.set(db.collection("ledgerEntries").doc(), {
        ...ledgerEntryBase,
        accountId: PLACEHOLDER_FREIGHT_INCOME_ACCOUNT_ID,
        description: `Freight income from Bilti ${biltiId}`,
        debit: 0,
        credit: freightAmount,
      });
    } else if (biltiData.payMode === "To Pay" || biltiData.payMode === "Due") {
      batch.set(db.collection("ledgerEntries").doc(), {
        ...ledgerEntryBase,
        accountId: consignee.assignedLedgerId,
        description: `Freight charges for Bilti ${biltiId} (To be Paid by Consignee)`,
        debit: freightAmount,
        credit: 0,
      });
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
        branchId: bilti.branchId || "UNKNOWN_BRANCH",
      };

      if (item.rebateAmount > 0) {
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

// Helper to get user role and branch assignments
interface UserPermissions {
  role: string | null;
  assignedBranchIds: string[];
}
async function getUserPermissions(uid: string): Promise<UserPermissions> {
  if (!uid) return {role: null, assignedBranchIds: []};
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data() as UserData;
      return {
        role: userData?.role || null,
        assignedBranchIds: userData?.assignedBranchIds || [],
      };
    }
    logger.warn(`User document for UID ${uid} not found.`);
    return {role: null, assignedBranchIds: []};
  } catch (error) {
    logger.error(`Error fetching permissions for user ${uid}:`, error);
    return {role: null, assignedBranchIds: []};
  }
}

// --- HTTPS Callable Functions for Daybook Workflow ---

export const submitDaybook = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => {
  const {daybookId} = request.data as {daybookId: string};
  const uid = request.auth?.uid;

  if (!uid) {
    logger.error("submitDaybook: Unauthenticated access attempt.");
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  if (!daybookId) {
    logger.error("submitDaybook: Missing daybookId.");
    throw new HttpsError("invalid-argument", "The function must be called with a 'daybookId'.");
  }

  const daybookRef = db.collection("daybooks").doc(daybookId);
  try {
    const daybookDoc = await daybookRef.get();
    if (!daybookDoc.exists) {
      logger.error(`submitDaybook: Daybook ${daybookId} not found for user ${uid}.`);
      throw new HttpsError("not-found", `Daybook with ID ${daybookId} not found.`);
    }
    const daybookData = daybookDoc.data() as DaybookData;

    if (daybookData.status !== "Draft" && daybookData.status !== "Rejected") {
      logger.warn(`submitDaybook: Attempt to submit daybook ${daybookId} with invalid status ${daybookData.status} by user ${uid}.`);
      throw new HttpsError("failed-precondition", `Daybook cannot be submitted. Current status: ${daybookData.status}.`);
    }

    const userPermissions = await getUserPermissions(uid);
    if (userPermissions.role !== "superAdmin" && !userPermissions.assignedBranchIds.includes(daybookData.branchId)) {
      logger.warn(`submitDaybook: Permission denied for user ${uid} (Role: ${userPermissions.role}) to submit daybook ${daybookId} for branch ${daybookData.branchId}.`);
      throw new HttpsError("permission-denied", "You do not have permission to submit daybooks for this branch.");
    }

    await daybookRef.update({
      status: "Pending Approval",
      submittedAt: admin.firestore.Timestamp.now(),
      submittedBy: uid,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: uid,
    });
    logger.info(`Daybook ${daybookId} submitted by ${uid} (Role: ${userPermissions.role}) for branch ${daybookData.branchId}`);
    return {success: true, message: "Daybook submitted successfully."};
  } catch (error: any) {
    logger.error(`Error submitting daybook ${daybookId} by user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to submit daybook.");
  }
});

export const approveDaybook = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => {
  const {daybookId} = request.data as {daybookId: string};
  const uid = request.auth?.uid;

  if (!uid) {
    logger.error("approveDaybook: Unauthenticated access attempt.");
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  if (!daybookId) {
    logger.error("approveDaybook: Missing daybookId.");
    throw new HttpsError("invalid-argument", "The function must be called with a 'daybookId'.");
  }

  const daybookRef = db.collection("daybooks").doc(daybookId);
  try {
    const daybookDoc = await daybookRef.get();
    if (!daybookDoc.exists) {
      logger.error(`approveDaybook: Daybook ${daybookId} not found for approval by ${uid}.`);
      throw new HttpsError("not-found", `Daybook with ID ${daybookId} not found.`);
    }
    const daybookData = daybookDoc.data() as DaybookData;

    if (daybookData.status !== "Pending Approval") {
      logger.warn(`approveDaybook: Attempt to approve daybook ${daybookId} with invalid status ${daybookData.status} by user ${uid}.`);
      throw new HttpsError("failed-precondition", `Daybook cannot be approved. Current status: ${daybookData.status}.`);
    }

    const userPermissions = await getUserPermissions(uid);
    const canApprove = userPermissions.role === "superAdmin" ||
                       (userPermissions.role === "manager" && userPermissions.assignedBranchIds.includes(daybookData.branchId));

    if (!canApprove) {
      logger.warn(`approveDaybook: Permission denied for user ${uid} (Role: ${userPermissions.role}) to approve ${daybookId} for branch ${daybookData.branchId}.`);
      throw new HttpsError("permission-denied", "You do not have permission to approve daybooks for this branch.");
    }

    await daybookRef.update({
      status: "Approved",
      approvedAt: admin.firestore.Timestamp.now(),
      approvedBy: uid,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: uid,
    });
    logger.info(`Daybook ${daybookId} approved by ${uid} (Role: ${userPermissions.role}) for branch ${daybookData.branchId}`);
    return {success: true, message: "Daybook approved successfully."};
  } catch (error: any) {
    logger.error(`Error approving daybook ${daybookId} by user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to approve daybook.");
  }
});

export const rejectDaybook = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => {
  const {daybookId, remarks} = request.data as {daybookId: string, remarks?: string};
  const uid = request.auth?.uid;

  if (!uid) {
    logger.error("rejectDaybook: Unauthenticated access attempt.");
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  if (!daybookId) {
    logger.error("rejectDaybook: Missing daybookId.");
    throw new HttpsError("invalid-argument", "The function must be called with a 'daybookId'.");
  }

  const daybookRef = db.collection("daybooks").doc(daybookId);
  try {
    const daybookDoc = await daybookRef.get();
    if (!daybookDoc.exists) {
      logger.error(`rejectDaybook: Daybook ${daybookId} not found for rejection by ${uid}.`);
      throw new HttpsError("not-found", `Daybook with ID ${daybookId} not found.`);
    }
    const daybookData = daybookDoc.data() as DaybookData;

    if (daybookData.status !== "Pending Approval") {
      logger.warn(`rejectDaybook: Attempt to reject daybook ${daybookId} with invalid status ${daybookData.status} by user ${uid}.`);
      throw new HttpsError("failed-precondition", `Daybook cannot be rejected. Current status: ${daybookData.status}.`);
    }

    const userPermissions = await getUserPermissions(uid);
     const canReject = userPermissions.role === "superAdmin" ||
                       (userPermissions.role === "manager" && userPermissions.assignedBranchIds.includes(daybookData.branchId));

    if (!canReject) {
      logger.warn(`rejectDaybook: Permission denied for user ${uid} (Role: ${userPermissions.role}) to reject ${daybookId} for branch ${daybookData.branchId}.`);
      throw new HttpsError("permission-denied", "You do not have permission to reject daybooks for this branch.");
    }

    await daybookRef.update({
      status: "Rejected",
      approvedAt: admin.firestore.Timestamp.now(), // Using approvedAt for rejection timestamp too
      approvedBy: uid, // User who rejected
      approvalRemarks: remarks || "Rejected without specific remarks.",
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: uid,
    });
    logger.info(`Daybook ${daybookId} rejected by ${uid} (Role: ${userPermissions.role}) for branch ${daybookData.branchId} with remarks: "${remarks || "N/A"}"`);
    return {success: true, message: "Daybook rejected successfully."};
  } catch (error: any) {
    logger.error(`Error rejecting daybook ${daybookId} by user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to reject daybook.");
  }
});

// --- Branch Management CRUD Functions ---
export const createBranch = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const userPermissions = await getUserPermissions(uid);
  if (userPermissions.role !== "superAdmin") {
    throw new HttpsError("permission-denied", "You do not have permission to create branches.");
  }

  const data = request.data as Omit<BranchData, "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy">;

  if (!data.name || !data.location) {
    throw new HttpsError("invalid-argument", "Branch Name and Location are required.");
  }

  try {
    const newBranchRef = await db.collection("branches").add({
      ...data,
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: uid,
    });
    logger.info(`Branch ${newBranchRef.id} created by ${uid}`);
    return {success: true, id: newBranchRef.id, message: "Branch created successfully."};
  } catch (error: any) {
    logger.error("Error creating branch:", error);
    throw new HttpsError("internal", error.message || "Failed to create branch.");
  }
});

export const updateBranch = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const userPermissions = await getUserPermissions(uid);
  if (userPermissions.role !== "superAdmin") {
    throw new HttpsError("permission-denied", "You do not have permission to update branches.");
  }

  const {branchId, ...dataToUpdate} = request.data as {branchId: string} & Partial<Omit<BranchData, "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy">>;

  if (!branchId) {
    throw new HttpsError("invalid-argument", "Branch ID is required for updates.");
  }
  if (!dataToUpdate.name || !dataToUpdate.location) {
    throw new HttpsError("invalid-argument", "Branch Name and Location are required.");
  }

  try {
    const branchRef = db.collection("branches").doc(branchId);
    const branchDoc = await branchRef.get();
    if (!branchDoc.exists) {
      throw new HttpsError("not-found", `Branch with ID ${branchId} not found.`);
    }

    await branchRef.update({
      ...dataToUpdate,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: uid,
    });
    logger.info(`Branch ${branchId} updated by ${uid}`);
    return {success: true, id: branchId, message: "Branch updated successfully."};
  } catch (error: any) {
    logger.error(`Error updating branch ${branchId}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to update branch.");
  }
});

export const deleteBranch = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const userPermissions = await getUserPermissions(uid);
  if (userPermissions.role !== "superAdmin") {
    throw new HttpsError("permission-denied", "You do not have permission to delete branches.");
  }

  const {branchId} = request.data as {branchId: string};
  if (!branchId) {
    throw new HttpsError("invalid-argument", "Branch ID is required for deletion.");
  }

  try {
    const branchRef = db.collection("branches").doc(branchId);
    const branchDoc = await branchRef.get();
    if (!branchDoc.exists) {
      throw new HttpsError("not-found", `Branch with ID ${branchId} not found.`);
    }
    // Add dependency checks here if needed before deletion
    // For example, check if any users, daybooks, biltis, etc., are linked to this branch.
    // If dependencies exist, you might want to prevent deletion or handle it accordingly.
    // For now, direct deletion is implemented.

    await branchRef.delete();
    logger.info(`Branch ${branchId} deleted by ${uid}`);
    return {success: true, id: branchId, message: "Branch deleted successfully."};
  } catch (error: any) {
    logger.error(`Error deleting branch ${branchId}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to delete branch.");
  }
});
