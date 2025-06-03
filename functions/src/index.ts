import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2/firestore"; // Using v2 Firestore triggers
import {logger} from "firebase-functions"; // Using v2 logger
import {onCall, HttpsError} from "firebase-functions/v2/https"; // For HTTPS Callable Functions v2

import type {
  UserData,
  DaybookData,
  DaybookTransaction,
  FunctionsBiltiData,
  GoodsDeliveryData,
  GoodsReceiptData,
  PartyData,
  LedgerEntryData,
  LedgerTransactionType,
  ManifestData,
  LedgerEntryCallableData,
  UpdateLedgerEntryStatusPayload,
  DaybookTransactionCallableData,
  DeleteDaybookTransactionPayload,
  // Adding new types for the 4 function groups
  UpdateUserProfilePayload,
  UpdateUserBranchAssignmentsPayload,
  InvoiceLineCustomizationData,
  CreateInvoiceLineCustomizationPayload,
  UpdateInvoiceLineCustomizationPayload,
  DeleteInvoiceLineCustomizationPayload,
  NarrationTemplateData,
  CreateNarrationTemplatePayload,
  UpdateNarrationTemplatePayload,
  DeleteNarrationTemplatePayload,
  DocumentNumberingConfigData,
  CreateDocumentNumberingConfigPayload,
  UpdateDocumentNumberingConfigPayload,
  DeleteDocumentNumberingConfigPayload,
  GenerateNextDocumentNumberPayload,
  GenerateNextDocumentNumberResult,
  CreateDaybookPayload,
  DaybookCreateResponse,
} from "./types";

admin.initializeApp();
const db = admin.firestore();

// Placeholder Account IDs
const PLACEHOLDER_FREIGHT_INCOME_ACCOUNT_ID = "ACC_FREIGHT_INCOME";
const PLACEHOLDER_REBATE_EXPENSE_ACCOUNT_ID = "ACC_REBATE_EXPENSE";
const PLACEHOLDER_DISCOUNT_EXPENSE_ACCOUNT_ID = "ACC_DISCOUNT_EXPENSE";


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
    }
  });


export const processApprovedDaybook = functions.onDocumentWritten(
  "daybooks/{daybookId}",
  async (event) => {
    const daybookId = event.params.daybookId;
    const afterData = event.data?.after.data() as DaybookData | undefined;

    if (!afterData) return;

    const becameApproved =
      afterData.status === "Approved" &&
      event.data?.before.data()?.status !== "Approved";

    if (!becameApproved || afterData.processedByFunction) return;

    logger.log(`Processing approved daybook: ${daybookId}`);
    const daybook: DaybookData = afterData;
    const batch = db.batch();
    const MAIN_CASH_LEDGER_ACCOUNT_ID = `BRANCH_CASH_${daybook.branchId}`;

    for (const tx of daybook.transactions) {
      const ledgerEntryBase: Omit<LedgerEntryData, "id" | "accountId" | "debit" | "credit" | "description" | "transactionType"> = {
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
        continue;
      }
      if (debitAccountId) {
        batch.set(db.collection("ledgerEntries").doc(), {
          ...ledgerEntryBase, accountId: debitAccountId, description, debit: Math.abs(tx.amount), credit: 0, transactionType: tx.transactionType as LedgerTransactionType,
        });
      }
      if (creditAccountId) {
        batch.set(db.collection("ledgerEntries").doc(), {
          ...ledgerEntryBase, accountId: creditAccountId, description, debit: 0, credit: Math.abs(tx.amount), transactionType: tx.transactionType as LedgerTransactionType,
        });
      }
    }
    batch.update(db.collection("daybooks").doc(daybookId), {processedByFunction: true, updatedAt: admin.firestore.Timestamp.now()});
    try {
      await batch.commit();
      logger.log(`Daybook ${daybookId} processed successfully.`);
    } catch (error) {
      logger.error(`Error committing ledger entries for daybook ${daybookId}:`, error);
    }
  });


export const postBiltiLedgerEntries = functions.onDocumentCreated(
  "biltis/{biltiId}",
  async (event) => {
    const biltiId = event.params.biltiId;
    const biltiData = event.data?.data() as FunctionsBiltiData | undefined;

    if (!biltiData || biltiData.ledgerProcessed) return;

    logger.log(`Processing ledger entries for new Bilti: ${biltiId}`);
    const batch = db.batch();
    const consignorSnap = await db.collection("parties").doc(biltiData.consignorId).get();
    const consigneeSnap = await db.collection("parties").doc(biltiData.consigneeId).get();

    if (!consignorSnap.exists || !consigneeSnap.exists) {
      logger.error(`Bilti ${biltiId}: Consignor or Consignee party document not found.`);
      return;
    }
    const consignor = consignorSnap.data() as PartyData;
    const consignee = consigneeSnap.data() as PartyData;
    const ledgerEntryBase: Omit<LedgerEntryData, "id" | "accountId" | "debit" | "credit"> = {
      miti: biltiData.miti,
      nepaliMiti: biltiData.nepaliMiti || "",
      description: "", // Will be set per entry
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
      batch.set(db.collection("ledgerEntries").doc(), {...ledgerEntryBase, accountId: consignor.assignedLedgerId, description: `Freight charges for Bilti ${biltiId} (Paid by Consignor)`, debit: freightAmount, credit: 0});
      batch.set(db.collection("ledgerEntries").doc(), {...ledgerEntryBase, accountId: PLACEHOLDER_FREIGHT_INCOME_ACCOUNT_ID, description: `Freight income from Bilti ${biltiId}`, debit: 0, credit: freightAmount});
    } else if (biltiData.payMode === "To Pay" || biltiData.payMode === "Due") {
      batch.set(db.collection("ledgerEntries").doc(), {...ledgerEntryBase, accountId: consignee.assignedLedgerId, description: `Freight charges for Bilti ${biltiId} (To be Paid by Consignee)`, debit: freightAmount, credit: 0});
      batch.set(db.collection("ledgerEntries").doc(), {...ledgerEntryBase, accountId: PLACEHOLDER_FREIGHT_INCOME_ACCOUNT_ID, description: `Freight income from Bilti ${biltiId}`, debit: 0, credit: freightAmount});
    }
    batch.update(db.collection("biltis").doc(biltiId), {ledgerProcessed: true, updatedAt: admin.firestore.Timestamp.now()});
    try {
      await batch.commit();
      logger.log(`Bilti ${biltiId}: Ledger entries processed.`);
    } catch (error) {
      logger.error(`Bilti ${biltiId}: Error committing ledger entries:`, error);
    }
  });


export const postGoodsDeliveryLedgerEntries = functions.onDocumentCreated(
  "goodsDeliveries/{deliveryId}",
  async (event) => {
    const deliveryId = event.params.deliveryId;
    const deliveryData = event.data?.data() as GoodsDeliveryData | undefined;

    if (!deliveryData || deliveryData.ledgerProcessed || !deliveryData.deliveredBiltis || deliveryData.deliveredBiltis.length === 0) {
      if (deliveryData && (!deliveryData.deliveredBiltis || deliveryData.deliveredBiltis.length === 0)) {
        await db.collection("goodsDeliveries").doc(deliveryId).update({ledgerProcessed: true, updatedAt: admin.firestore.Timestamp.now()});
      }
      return;
    }
    logger.log(`Processing ledger entries for new GoodsDelivery: ${deliveryId}`);
    const batch = db.batch();

    for (const item of deliveryData.deliveredBiltis) {
      const biltiSnap = await db.collection("biltis").doc(item.biltiId).get();
      if (!biltiSnap.exists) continue;
      const bilti = biltiSnap.data() as FunctionsBiltiData;
      const partyToCreditSnap = await db.collection("parties").doc(bilti.consigneeId).get();
      if (!partyToCreditSnap.exists) continue;
      const partyToCredit = partyToCreditSnap.data() as PartyData;
      const ledgerEntryBase: Omit<LedgerEntryData, "id" | "accountId" | "debit" | "credit" | "description" | "transactionType"> = {
        miti: deliveryData.miti, nepaliMiti: deliveryData.nepaliMiti || "", referenceNo: `GD-${deliveryId}-BLT-${item.biltiId}`, sourceModule: "GoodsDelivery", status: "Approved", createdAt: admin.firestore.Timestamp.now(), createdBy: deliveryData.createdBy || "system-gd-processor", branchId: bilti.branchId || "UNKNOWN_BRANCH",
      };
      if (item.rebateAmount > 0) {
        batch.set(db.collection("ledgerEntries").doc(), {...ledgerEntryBase, accountId: PLACEHOLDER_REBATE_EXPENSE_ACCOUNT_ID, description: `Rebate for Bilti ${item.biltiId}: ${item.rebateReason || "Rebate Given"}`, debit: item.rebateAmount, credit: 0, transactionType: "Rebate" as LedgerTransactionType});
        batch.set(db.collection("ledgerEntries").doc(), {...ledgerEntryBase, accountId: partyToCredit.assignedLedgerId, description: `Rebate received for Bilti ${item.biltiId}: ${item.rebateReason || "Rebate Given"}`, debit: 0, credit: item.rebateAmount, transactionType: "Rebate" as LedgerTransactionType});
      }
      if (item.discountAmount > 0) {
        batch.set(db.collection("ledgerEntries").doc(), {...ledgerEntryBase, accountId: PLACEHOLDER_DISCOUNT_EXPENSE_ACCOUNT_ID, description: `Discount for Bilti ${item.biltiId}: ${item.discountReason || "Discount Given"}`, debit: item.discountAmount, credit: 0, transactionType: "Discount" as LedgerTransactionType});
        batch.set(db.collection("ledgerEntries").doc(), {...ledgerEntryBase, accountId: partyToCredit.assignedLedgerId, description: `Discount received for Bilti ${item.biltiId}: ${item.discountReason || "Discount Given"}`, debit: 0, credit: item.discountAmount, transactionType: "Discount" as LedgerTransactionType});
      }
    }
    batch.update(db.collection("goodsDeliveries").doc(deliveryId), {ledgerProcessed: true, updatedAt: admin.firestore.Timestamp.now()});
    try {
      await batch.commit();
      logger.log(`GoodsDelivery ${deliveryId}: Ledger entries for rebates/discounts processed.`);
    } catch (error) {
      logger.error(`GoodsDelivery ${deliveryId}: Error committing ledger entries for rebates/discounts:`, error);
    }
  });


interface UserPermissions {role: string | null; assignedBranchIds: string[];}
async function getUserPermissions(uid: string): Promise<UserPermissions> {
  if (!uid) return {role: null, assignedBranchIds: []};
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data() as UserData;
      return {role: userData?.role || null, assignedBranchIds: userData?.assignedBranchIds || []};
    }
    return {role: null, assignedBranchIds: []};
  } catch (error) {
    logger.error(`Error fetching permissions for user ${uid}:`, error);
    return {role: null, assignedBranchIds: []};
  }
}

// Daybook Workflow Functions (submitDaybook, approveDaybook, rejectDaybook) ...
export const submitDaybook = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const approveDaybook = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const rejectDaybook = onCall({enforceAppCheck: false}, async () => {/* ... */});

// Branch Management CRUD Functions ...
export const createBranch = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const updateBranch = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const deleteBranch = onCall({enforceAppCheck: false}, async () => {/* ... */});

// Locations & Units CRUD Functions ...
export const createCountry = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const updateCountry = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const deleteCountry = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const createState = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const updateState = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const deleteState = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const createCity = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const updateCity = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const deleteCity = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const createUnit = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const updateUnit = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const deleteUnit = onCall({enforceAppCheck: false}, async () => {/* ... */});

// Truck Management CRUD Functions ...
export const createTruck = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const updateTruck = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const deleteTruck = onCall({enforceAppCheck: false}, async () => {/* ... */});

// Driver Management CRUD Functions ...
export const createDriver = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const updateDriver = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const deleteDriver = onCall({enforceAppCheck: false}, async () => {/* ... */});

// Party Management CRUD Functions ...
export const createParty = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const updateParty = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const deleteParty = onCall({enforceAppCheck: false}, async () => {/* ... */});

// Godown Management CRUD Functions ...
export const createGodown = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const updateGodown = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const deleteGodown = onCall({enforceAppCheck: false}, async () => {/* ... */});

// Bilti / Invoicing CRUD Functions ...
export const createBilti = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const updateBilti = onCall({enforceAppCheck: false}, async () => {/* ... */});
export const deleteBilti = onCall({enforceAppCheck: false}, async () => {/* ... */});


// --- Manifest CRUD Functions ---
interface ManifestCallableData extends Omit<ManifestData, "id" | "miti" | "status" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy"> { miti: string; }

export const createManifest = onCall({enforceAppCheck: false}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

  const data = request.data as ManifestCallableData;
  const userPermissions = await getUserPermissions(uid);

  // Basic validation
  if (!data.truckId || !data.driverId || !data.fromBranchId || !data.toBranchId || !data.miti || !data.attachedBiltiIds || data.attachedBiltiIds.length === 0) {
    throw new HttpsError("invalid-argument", "Truck, Driver, Branches, Miti, and at least one Bilti are required.");
  }
  if (userPermissions.role !== "superAdmin" && !userPermissions.assignedBranchIds.includes(data.fromBranchId)) {
    throw new HttpsError("permission-denied", "You do not have permission to create manifests for this branch.");
  }

  const batch = db.batch();
  try {
    const newManifestRef = db.collection("manifests").doc(); // Generate ID upfront
    const newManifestData: ManifestData = {
      ...data,
      miti: admin.firestore.Timestamp.fromDate(new Date(data.miti)),
      status: "Open",
      createdBy: uid,
      createdAt: admin.firestore.Timestamp.now(),
    };
    batch.set(newManifestRef, newManifestData);

    for (const biltiId of data.attachedBiltiIds) {
      const biltiRef = db.collection("biltis").doc(biltiId);
      batch.update(biltiRef, {status: "Manifested", manifestId: newManifestRef.id});
    }

    await batch.commit();
    logger.info(`Manifest ${newManifestRef.id} created by ${uid} for branch ${data.fromBranchId}`);
    return {success: true, id: newManifestRef.id, message: "Manifest created successfully."};
  } catch (error: any) {
    logger.error("Error creating manifest:", error);
    throw new HttpsError("internal", error.message || "Failed to create manifest.");
  }
});

export const updateManifest = onCall({enforceAppCheck: false}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

  const {manifestId, ...dataToUpdateClient} = request.data as {manifestId: string} & Partial<ManifestCallableData>;
  if (!manifestId) throw new HttpsError("invalid-argument", "Manifest ID is required.");

  const userPermissions = await getUserPermissions(uid);
  const batch = db.batch();
  const manifestRef = db.collection("manifests").doc(manifestId);

  try {
    const manifestDoc = await manifestRef.get();
    if (!manifestDoc.exists) throw new HttpsError("not-found", "Manifest not found.");
    const existingManifest = manifestDoc.data() as ManifestData;

    if (userPermissions.role !== "superAdmin" && !userPermissions.assignedBranchIds.includes(existingManifest.fromBranchId)) {
      throw new HttpsError("permission-denied", "You do not have permission to update this manifest.");
    }
    // Prevent editing if manifest is no longer "Open" (unless superAdmin)
    if (existingManifest.status !== "Open" && userPermissions.role !== "superAdmin") {
      throw new HttpsError("failed-precondition", `Cannot update manifest. Status: ${existingManifest.status}.`);
    }


    const dataToUpdateFirestore: Partial<ManifestData> = {
      ...dataToUpdateClient,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: uid,
    };
    if (dataToUpdateClient.miti) {
      dataToUpdateFirestore.miti = admin.firestore.Timestamp.fromDate(new Date(dataToUpdateClient.miti));
    }
    batch.update(manifestRef, dataToUpdateFirestore);

    // Handle changes in attachedBiltiIds
    if (dataToUpdateClient.attachedBiltiIds) {
      const newBiltiIds = new Set(dataToUpdateClient.attachedBiltiIds);
      const oldBiltiIds = new Set(existingManifest.attachedBiltiIds);

      // Biltis to remove from manifest (revert to Pending)
      oldBiltiIds.forEach((biltiId) => {
        if (!newBiltiIds.has(biltiId)) {
          const biltiRef = db.collection("biltis").doc(biltiId);
          batch.update(biltiRef, {status: "Pending", manifestId: null});
        }
      });
      // Biltis to add to manifest (set to Manifested)
      newBiltiIds.forEach((biltiId) => {
        if (!oldBiltiIds.has(biltiId)) {
          const biltiRef = db.collection("biltis").doc(biltiId);
          batch.update(biltiRef, {status: "Manifested", manifestId: manifestId});
        }
      });
    }

    await batch.commit();
    logger.info(`Manifest ${manifestId} updated by ${uid}`);
    return {success: true, id: manifestId, message: "Manifest updated successfully."};
  } catch (error: any) {
    logger.error(`Error updating manifest ${manifestId}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to update manifest.");
  }
});

export const deleteManifest = onCall({enforceAppCheck: false}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

  const {manifestId} = request.data as {manifestId: string};
  if (!manifestId) throw new HttpsError("invalid-argument", "Manifest ID is required.");

  const batch = db.batch();
  const manifestRef = db.collection("manifests").doc(manifestId);
  const userPermissions = await getUserPermissions(uid);

  try {
    const manifestDoc = await manifestRef.get();
    if (!manifestDoc.exists) throw new HttpsError("not-found", "Manifest not found.");
    const manifestData = manifestDoc.data() as ManifestData;

    if (userPermissions.role !== "superAdmin" && !userPermissions.assignedBranchIds.includes(manifestData.fromBranchId)) {
      throw new HttpsError("permission-denied", "You do not have permission to delete this manifest.");
    }
    // Prevent deletion if manifest is not "Open" (unless superAdmin)
    if (manifestData.status !== "Open" && userPermissions.role !== "superAdmin") {
      throw new HttpsError("failed-precondition", `Cannot delete manifest. Status: ${manifestData.status}. Only 'Open' manifests can be deleted by non-admins.`);
    }

    batch.delete(manifestRef);

    for (const biltiId of manifestData.attachedBiltiIds) {
      const biltiRef = db.collection("biltis").doc(biltiId);
      batch.update(biltiRef, {status: "Pending", manifestId: null});
    }

    await batch.commit();
    logger.info(`Manifest ${manifestId} deleted by ${uid}`);
    return {success: true, id: manifestId, message: "Manifest deleted successfully."};
  } catch (error: any) {
    logger.error(`Error deleting manifest ${manifestId}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to delete manifest.");
  }
});

// --- Goods Receipt CRUD Functions ---
interface GoodsReceiptCallableData extends Omit<GoodsReceiptData, "id" | "miti" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy"> {
  miti: string;
}

export const createGoodsReceipt = onCall({enforceAppCheck: false}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

  const data = request.data as GoodsReceiptCallableData;
  const userPermissions = await getUserPermissions(uid);

  // Basic validation
  if (!data.manifestId || !data.receivingBranchId || !data.miti) {
    throw new HttpsError("invalid-argument", "Manifest ID, Receiving Branch ID, and Miti are required.");
  }

  if (userPermissions.role !== "superAdmin" && !userPermissions.assignedBranchIds.includes(data.receivingBranchId)) {
    throw new HttpsError("permission-denied", "You do not have permission to create receipts for this branch.");
  }

  const batch = db.batch();
  try {
    // Check manifest exists and is in valid state
    const manifestRef = db.collection("manifests").doc(data.manifestId);
    const manifestDoc = await manifestRef.get();
    if (!manifestDoc.exists) throw new HttpsError("not-found", "Manifest not found.");

    const manifestData = manifestDoc.data() as ManifestData;
    if (manifestData.status !== "In Transit") {
      throw new HttpsError("failed-precondition", `Cannot receive goods. Manifest status: ${manifestData.status}. Expected: In Transit.`);
    }

    const newReceiptRef = db.collection("goodsReceipts").doc();
    const newReceiptData: GoodsReceiptData = {
      ...data,
      miti: admin.firestore.Timestamp.fromDate(new Date(data.miti)),
      createdBy: uid,
      createdAt: admin.firestore.Timestamp.now(),
    };
    batch.set(newReceiptRef, newReceiptData);

    // Update manifest status to "Received"
    batch.update(manifestRef, {
      status: "Received",
      goodsReceiptId: newReceiptRef.id,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: uid,
    });

    // Update bilti statuses to "Received"
    for (const biltiId of manifestData.attachedBiltiIds) {
      const biltiRef = db.collection("biltis").doc(biltiId);
      batch.update(biltiRef, {
        status: "Received",
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: uid,
      });
    }

    await batch.commit();
    logger.info(`Goods Receipt ${newReceiptRef.id} created by ${uid} for manifest ${data.manifestId}`);
    return {success: true, id: newReceiptRef.id, message: "Goods receipt created successfully."};
  } catch (error: any) {
    logger.error("Error creating goods receipt:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to create goods receipt.");
  }
});

export const updateGoodsReceipt = onCall({enforceAppCheck: false}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

  const {receiptId, ...dataToUpdateClient} = request.data as {receiptId: string} & Partial<GoodsReceiptCallableData>;
  if (!receiptId) throw new HttpsError("invalid-argument", "Receipt ID is required.");

  const userPermissions = await getUserPermissions(uid);
  const batch = db.batch();
  const receiptRef = db.collection("goodsReceipts").doc(receiptId);

  try {
    const receiptDoc = await receiptRef.get();
    if (!receiptDoc.exists) throw new HttpsError("not-found", "Goods receipt not found.");
    const existingReceipt = receiptDoc.data() as GoodsReceiptData;

    if (userPermissions.role !== "superAdmin" && !userPermissions.assignedBranchIds.includes(existingReceipt.receivingBranchId)) {
      throw new HttpsError("permission-denied", "You do not have permission to update this receipt.");
    }

    // Process dataToUpdateClient without type conflicts
    const {miti: _, ...otherFields} = dataToUpdateClient;
    const dataToUpdateFirestore: Partial<GoodsReceiptData> = {
      ...otherFields,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: uid,
    };
    if (dataToUpdateClient.miti) {
      dataToUpdateFirestore.miti = admin.firestore.Timestamp.fromDate(new Date(dataToUpdateClient.miti));
    }

    // Handle manifest change if needed
    if (dataToUpdateClient.manifestId && dataToUpdateClient.manifestId !== existingReceipt.manifestId) {
      // Revert old manifest status
      const oldManifestRef = db.collection("manifests").doc(existingReceipt.manifestId);
      batch.update(oldManifestRef, {
        status: "In Transit",
        goodsReceiptId: null,
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: uid,
      });

      // Update new manifest
      const newManifestRef = db.collection("manifests").doc(dataToUpdateClient.manifestId);
      const newManifestDoc = await newManifestRef.get();
      if (!newManifestDoc.exists) throw new HttpsError("not-found", "New manifest not found.");

      const newManifestData = newManifestDoc.data() as ManifestData;
      if (newManifestData.status !== "In Transit") {
        throw new HttpsError("failed-precondition", `Cannot update to this manifest. Status: ${newManifestData.status}. Expected: In Transit.`);
      }

      batch.update(newManifestRef, {
        status: "Received",
        goodsReceiptId: receiptId,
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: uid,
      });
    }

    batch.update(receiptRef, dataToUpdateFirestore);
    await batch.commit();

    logger.info(`Goods Receipt ${receiptId} updated by ${uid}`);
    return {success: true, id: receiptId, message: "Goods receipt updated successfully."};
  } catch (error: any) {
    logger.error(`Error updating goods receipt ${receiptId}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to update goods receipt.");
  }
});

export const deleteGoodsReceipt = onCall({enforceAppCheck: false}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

  const {receiptId} = request.data as {receiptId: string};
  if (!receiptId) throw new HttpsError("invalid-argument", "Receipt ID is required.");

  const batch = db.batch();
  const receiptRef = db.collection("goodsReceipts").doc(receiptId);
  const userPermissions = await getUserPermissions(uid);

  try {
    const receiptDoc = await receiptRef.get();
    if (!receiptDoc.exists) throw new HttpsError("not-found", "Goods receipt not found.");
    const receiptData = receiptDoc.data() as GoodsReceiptData;

    if (userPermissions.role !== "superAdmin" && !userPermissions.assignedBranchIds.includes(receiptData.receivingBranchId)) {
      throw new HttpsError("permission-denied", "You do not have permission to delete this receipt.");
    }

    batch.delete(receiptRef);

    // Revert manifest status to "In Transit"
    const manifestRef = db.collection("manifests").doc(receiptData.manifestId);
    const manifestDoc = await manifestRef.get();
    if (manifestDoc.exists) {
      const manifestData = manifestDoc.data() as ManifestData;
      batch.update(manifestRef, {
        status: "In Transit",
        goodsReceiptId: null,
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: uid,
      });

      // Revert bilti statuses to "Manifested"
      for (const biltiId of manifestData.attachedBiltiIds) {
        const biltiRef = db.collection("biltis").doc(biltiId);
        batch.update(biltiRef, {
          status: "Manifested",
          updatedAt: admin.firestore.Timestamp.now(),
          updatedBy: uid,
        });
      }
    }

    await batch.commit();
    logger.info(`Goods Receipt ${receiptId} deleted by ${uid}`);
    return {success: true, id: receiptId, message: "Goods receipt deleted successfully."};
  } catch (error: any) {
    logger.error(`Error deleting goods receipt ${receiptId}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to delete goods receipt.");
  }
});

// --- Goods Delivery CRUD Functions ---
interface GoodsDeliveryCallableData extends Omit<GoodsDeliveryData, "id" | "miti" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy" | "ledgerProcessed"> {
  miti: string;
}

export const createGoodsDelivery = onCall({enforceAppCheck: false}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

  const data = request.data as GoodsDeliveryCallableData;
  const userPermissions = await getUserPermissions(uid);

  // Basic validation
  if (!data.miti || !data.deliveredBiltis || data.deliveredBiltis.length === 0) {
    throw new HttpsError("invalid-argument", "Miti and at least one delivered bilti are required.");
  }

  const batch = db.batch();
  try {
    // Validate all biltis exist and are in "Received" status
    for (const item of data.deliveredBiltis) {
      const biltiRef = db.collection("biltis").doc(item.biltiId);
      const biltiDoc = await biltiRef.get();
      if (!biltiDoc.exists) {
        throw new HttpsError("not-found", `Bilti ${item.biltiId} not found.`);
      }

      const biltiData = biltiDoc.data() as FunctionsBiltiData;
      if (biltiData.status !== "Received") {
        throw new HttpsError("failed-precondition", `Bilti ${item.biltiId} status: ${biltiData.status}. Expected: Received.`);
      }

      // Check branch permissions for bilti
      if (userPermissions.role !== "superAdmin" && biltiData.branchId && !userPermissions.assignedBranchIds.includes(biltiData.branchId)) {
        throw new HttpsError("permission-denied", `You do not have permission to deliver bilti ${item.biltiId} from branch ${biltiData.branchId}.`);
      }
    }

    const newDeliveryRef = db.collection("goodsDeliveries").doc();
    const newDeliveryData: GoodsDeliveryData = {
      ...data,
      miti: admin.firestore.Timestamp.fromDate(new Date(data.miti)),
      createdBy: uid,
      createdAt: admin.firestore.Timestamp.now(),
    };
    batch.set(newDeliveryRef, newDeliveryData);

    // Update bilti statuses to "Delivered"
    for (const item of data.deliveredBiltis) {
      const biltiRef = db.collection("biltis").doc(item.biltiId);
      batch.update(biltiRef, {
        status: "Delivered",
        goodsDeliveryNoteId: newDeliveryRef.id,
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: uid,
      });
    }

    await batch.commit();
    logger.info(`Goods Delivery ${newDeliveryRef.id} created by ${uid} with ${data.deliveredBiltis.length} biltis`);
    return {success: true, id: newDeliveryRef.id, message: "Goods delivery created successfully."};
  } catch (error: any) {
    logger.error("Error creating goods delivery:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to create goods delivery.");
  }
});

export const updateGoodsDelivery = onCall({enforceAppCheck: false}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

  const {deliveryId, ...dataToUpdateClient} = request.data as {deliveryId: string} & Partial<GoodsDeliveryCallableData>;
  if (!deliveryId) throw new HttpsError("invalid-argument", "Delivery ID is required.");

  const userPermissions = await getUserPermissions(uid);
  const batch = db.batch();
  const deliveryRef = db.collection("goodsDeliveries").doc(deliveryId);

  try {
    const deliveryDoc = await deliveryRef.get();
    if (!deliveryDoc.exists) throw new HttpsError("not-found", "Goods delivery not found.");
    const existingDelivery = deliveryDoc.data() as GoodsDeliveryData;

    // Check permissions for existing delivered biltis
    for (const item of existingDelivery.deliveredBiltis) {
      const biltiRef = db.collection("biltis").doc(item.biltiId);
      const biltiDoc = await biltiRef.get();
      if (biltiDoc.exists) {
        const biltiData = biltiDoc.data() as FunctionsBiltiData;
        if (userPermissions.role !== "superAdmin" && biltiData.branchId && !userPermissions.assignedBranchIds.includes(biltiData.branchId)) {
          throw new HttpsError("permission-denied", `You do not have permission to modify delivery for bilti ${item.biltiId} from branch ${biltiData.branchId}.`);
        }
      }
    }

    // Process dataToUpdateClient without type conflicts
    const {miti: _, ...otherFields} = dataToUpdateClient;
    const dataToUpdateFirestore: Partial<GoodsDeliveryData> = {
      ...otherFields,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: uid,
    };
    if (dataToUpdateClient.miti) {
      dataToUpdateFirestore.miti = admin.firestore.Timestamp.fromDate(new Date(dataToUpdateClient.miti));
    }

    // Handle changes in deliveredBiltis
    if (dataToUpdateClient.deliveredBiltis) {
      const newBiltiIds = new Set(dataToUpdateClient.deliveredBiltis.map((item) => item.biltiId));
      const oldBiltiIds = new Set(existingDelivery.deliveredBiltis.map((item) => item.biltiId));

      // Biltis removed from delivery should become "Received"
      oldBiltiIds.forEach((biltiId) => {
        if (!newBiltiIds.has(biltiId)) {
          const biltiRef = db.collection("biltis").doc(biltiId);
          batch.update(biltiRef, {
            status: "Received",
            goodsDeliveryNoteId: null,
            updatedAt: admin.firestore.Timestamp.now(),
            updatedBy: uid,
          });
        }
      });

      // Validate and add new biltis to delivery
      for (const item of dataToUpdateClient.deliveredBiltis) {
        if (!oldBiltiIds.has(item.biltiId)) {
          const biltiRef = db.collection("biltis").doc(item.biltiId);
          const biltiDoc = await biltiRef.get();
          if (!biltiDoc.exists) {
            throw new HttpsError("not-found", `Bilti ${item.biltiId} not found.`);
          }

          const biltiData = biltiDoc.data() as FunctionsBiltiData;
          if (biltiData.status !== "Received") {
            throw new HttpsError("failed-precondition", `Bilti ${item.biltiId} status: ${biltiData.status}. Expected: Received.`);
          }

          batch.update(biltiRef, {
            status: "Delivered",
            goodsDeliveryNoteId: deliveryId,
            updatedAt: admin.firestore.Timestamp.now(),
            updatedBy: uid,
          });
        }
      }
    }

    batch.update(deliveryRef, dataToUpdateFirestore);
    await batch.commit();

    logger.info(`Goods Delivery ${deliveryId} updated by ${uid}`);
    return {success: true, id: deliveryId, message: "Goods delivery updated successfully."};
  } catch (error: any) {
    logger.error(`Error updating goods delivery ${deliveryId}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to update goods delivery.");
  }
});

export const deleteGoodsDelivery = onCall({enforceAppCheck: false}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

  const {deliveryId} = request.data as {deliveryId: string};
  if (!deliveryId) throw new HttpsError("invalid-argument", "Delivery ID is required.");

  const batch = db.batch();
  const deliveryRef = db.collection("goodsDeliveries").doc(deliveryId);
  const userPermissions = await getUserPermissions(uid);

  try {
    const deliveryDoc = await deliveryRef.get();
    if (!deliveryDoc.exists) throw new HttpsError("not-found", "Goods delivery not found.");
    const deliveryData = deliveryDoc.data() as GoodsDeliveryData;

    // Check permissions for all delivered biltis
    for (const item of deliveryData.deliveredBiltis) {
      const biltiRef = db.collection("biltis").doc(item.biltiId);
      const biltiDoc = await biltiRef.get();
      if (biltiDoc.exists) {
        const biltiData = biltiDoc.data() as FunctionsBiltiData;
        if (userPermissions.role !== "superAdmin" && biltiData.branchId && !userPermissions.assignedBranchIds.includes(biltiData.branchId)) {
          throw new HttpsError("permission-denied", `You do not have permission to delete delivery for bilti ${item.biltiId} from branch ${biltiData.branchId}.`);
        }
      }
    }

    batch.delete(deliveryRef);

    // Revert bilti statuses to "Received"
    for (const item of deliveryData.deliveredBiltis) {
      const biltiRef = db.collection("biltis").doc(item.biltiId);
      batch.update(biltiRef, {
        status: "Received",
        goodsDeliveryNoteId: null,
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: uid,
      });
    }

    await batch.commit();
    logger.info(`Goods Delivery ${deliveryId} deleted by ${uid}`);
    return {success: true, id: deliveryId, message: "Goods delivery deleted successfully."};
  } catch (error: any) {
    logger.error(`Error deleting goods delivery ${deliveryId}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to delete goods delivery.");
  }
});

// --- Ledger Management Functions ---

export const createManualLedgerEntry = onCall({enforceAppCheck: false}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

  const data = request.data as LedgerEntryCallableData;
  if (!data.accountId || !data.description || (data.debit === 0 && data.credit === 0)) {
    throw new HttpsError("invalid-argument", "Account ID, description, and non-zero debit/credit amount are required.");
  }

  if (data.debit > 0 && data.credit > 0) {
    throw new HttpsError("invalid-argument", "Cannot have both debit and credit amounts for a single entry.");
  }

  // Check user permissions for manual ledger entries
  const userPermissions = await getUserPermissions(uid);
  if (!userPermissions || userPermissions.role === "user") {
    throw new HttpsError("permission-denied", "Insufficient permissions to create manual ledger entries.");
  }

  try {
    const newEntryRef = db.collection("ledgerEntries").doc();
    const newEntryData: LedgerEntryData = {
      ...data,
      id: newEntryRef.id,
      miti: admin.firestore.Timestamp.fromDate(new Date(data.miti)),
      status: "Pending", // Manual entries start as pending
      sourceModule: "Manual",
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: uid,
    };

    await newEntryRef.set(newEntryData);
    logger.info(`Manual ledger entry ${newEntryRef.id} created by ${uid} for account ${data.accountId}`);
    return {success: true, id: newEntryRef.id, message: "Manual ledger entry created successfully."};
  } catch (error: any) {
    logger.error("Error creating manual ledger entry:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to create manual ledger entry.");
  }
});

export const updateLedgerEntryStatus = onCall({enforceAppCheck: false}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

  const {entryId, status, approvalRemarks} = request.data as UpdateLedgerEntryStatusPayload;
  if (!entryId || !status) {
    throw new HttpsError("invalid-argument", "Entry ID and status are required.");
  }

  const userPermissions = await getUserPermissions(uid);
  // Check permissions for ledger entry approval
  if (!userPermissions || (userPermissions.role !== "superAdmin" && userPermissions.role !== "manager")) {
    throw new HttpsError("permission-denied", "Only managers and super admins can approve/reject ledger entries.");
  }

  try {
    const entryRef = db.collection("ledgerEntries").doc(entryId);
    const entryDoc = await entryRef.get();

    if (!entryDoc.exists) {
      throw new HttpsError("not-found", "Ledger entry not found.");
    }

    const entryData = entryDoc.data() as LedgerEntryData;
    if (entryData.status !== "Pending") {
      throw new HttpsError("failed-precondition", `Entry is already ${entryData.status}. Cannot change status.`);
    }

    const updateData: Partial<LedgerEntryData> = {
      status,
      approvedBy: uid,
      approvedAt: admin.firestore.Timestamp.now(),
      approvalRemarks: approvalRemarks || `${status} by system`,
    };

    await entryRef.update(updateData);
    logger.info(`Ledger entry ${entryId} ${status.toLowerCase()} by ${uid}`);
    return {success: true, id: entryId, message: `Ledger entry ${status.toLowerCase()} successfully.`};
  } catch (error: any) {
    logger.error(`Error updating ledger entry ${entryId} status:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to update ledger entry status.");
  }
});

// --- Daybook Transaction Management Functions ---

export const createDaybookTransaction = onCall({enforceAppCheck: false}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

  const {daybookId, transactionId, ...transactionData} = request.data as DaybookTransactionCallableData;
  if (!daybookId || !transactionData.transactionType || !transactionData.description) {
    throw new HttpsError("invalid-argument", "Daybook ID, transaction type, and description are required.");
  }

  const userPermissions = await getUserPermissions(uid);
  // Check permissions for daybook editing
  if (!userPermissions) {
    throw new HttpsError("permission-denied", "Unable to verify user permissions.");
  }

  try {
    const daybookRef = db.collection("daybooks").doc(daybookId);
    const daybookDoc = await daybookRef.get();

    if (!daybookDoc.exists) {
      throw new HttpsError("not-found", "Daybook not found.");
    }

    const daybookData = daybookDoc.data() as DaybookData;

    // Check if user has permission to edit this daybook
    if (userPermissions.role !== "superAdmin" &&
        !userPermissions.assignedBranchIds.includes(daybookData.branchId)) {
      throw new HttpsError("permission-denied", "You do not have permission to edit this daybook.");
    }

    // Check if daybook is in editable state
    if (daybookData.status !== "Draft" && daybookData.status !== "Rejected") {
      throw new HttpsError("failed-precondition", `Cannot edit daybook in ${daybookData.status} status.`);
    }

    const newTransactionId = transactionId || `txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newTransaction: DaybookTransaction = {
      id: newTransactionId,
      ...transactionData,
      createdAt: admin.firestore.Timestamp.now(),
    };

    // Update daybook with new transaction
    const existingTransactions = daybookData.transactions || [];
    const transactionIndex = existingTransactions.findIndex((tx) => tx.id === newTransactionId);

    let updatedTransactions: DaybookTransaction[];
    if (transactionIndex >= 0) {
      // Update existing transaction
      updatedTransactions = [...existingTransactions];
      updatedTransactions[transactionIndex] = newTransaction;
    } else {
      // Add new transaction
      updatedTransactions = [...existingTransactions, newTransaction];
    }

    await daybookRef.update({
      transactions: updatedTransactions,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: uid,
    });

    logger.info(`Transaction ${newTransactionId} ${transactionIndex >= 0 ? "updated" : "added"} to daybook ${daybookId} by ${uid}`);
    return {
      success: true,
      id: newTransactionId,
      message: `Transaction ${transactionIndex >= 0 ? "updated" : "added"} successfully.`,
    };
  } catch (error: any) {
    logger.error(`Error managing transaction in daybook ${daybookId}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to manage daybook transaction.");
  }
});

export const deleteDaybookTransaction = onCall({enforceAppCheck: false}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

  const {daybookId, transactionId} = request.data as DeleteDaybookTransactionPayload;
  if (!daybookId || !transactionId) {
    throw new HttpsError("invalid-argument", "Daybook ID and transaction ID are required.");
  }

  const userPermissions = await getUserPermissions(uid);
  // Check permissions for daybook editing
  if (!userPermissions) {
    throw new HttpsError("permission-denied", "Unable to verify user permissions.");
  }

  try {
    const daybookRef = db.collection("daybooks").doc(daybookId);
    const daybookDoc = await daybookRef.get();

    if (!daybookDoc.exists) {
      throw new HttpsError("not-found", "Daybook not found.");
    }

    const daybookData = daybookDoc.data() as DaybookData;

    // Check if user has permission to edit this daybook
    if (userPermissions.role !== "superAdmin" &&
        !userPermissions.assignedBranchIds.includes(daybookData.branchId)) {
      throw new HttpsError("permission-denied", "You do not have permission to edit this daybook.");
    }

    // Check if daybook is in editable status
    if (daybookData.status !== "Draft" && daybookData.status !== "Rejected") {
      throw new HttpsError("failed-precondition", `Cannot edit daybook in ${daybookData.status} status.`);
    }

    // Remove transaction from daybook
    const existingTransactions = daybookData.transactions || [];
    const updatedTransactions = existingTransactions.filter((tx) => tx.id !== transactionId);

    if (updatedTransactions.length === existingTransactions.length) {
      throw new HttpsError("not-found", "Transaction not found in daybook.");
    }

    await daybookRef.update({
      transactions: updatedTransactions,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: uid,
    });

    logger.info(`Transaction ${transactionId} deleted from daybook ${daybookId} by ${uid}`);
    return {success: true, id: transactionId, message: "Transaction deleted successfully."};
  } catch (error: any) {
    logger.error(`Error deleting transaction ${transactionId} from daybook ${daybookId}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to delete daybook transaction.");
  }
});

// --- User Management Functions ---

export const updateUserProfile = onCall(
  {
    enforceAppCheck: false, // Set to true when App Check is enabled
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be authenticated to update a user profile.");
    }

    const data = request.data as UpdateUserProfilePayload;

    if (!data.uid) {
      throw new HttpsError("invalid-argument", "User ID is required.");
    }

    try {
      // Verify the user has permission (only admins or the user themselves)
      const currentUserDoc = await db.collection("users").doc(uid).get();
      const currentUserData = currentUserDoc.data();

      if (!currentUserData) {
        throw new HttpsError("not-found", "Current user not found.");
      }

      const isAdmin = currentUserData.role === "superAdmin" || currentUserData.role === "admin";
      const isSelf = uid === data.uid;

      if (!isAdmin && !isSelf) {
        throw new HttpsError("permission-denied", "You can only update your own profile or you must be an admin.");
      }

      // Prepare update data
      const updateData: any = {
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: uid,
      };

      if (data.displayName !== undefined) updateData.displayName = data.displayName;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.role !== undefined && isAdmin) updateData.role = data.role;
      if (data.status !== undefined && isAdmin) updateData.status = data.status;
      if (data.enableEmailNotifications !== undefined) updateData.enableEmailNotifications = data.enableEmailNotifications;
      if (data.darkModeEnabled !== undefined) updateData.darkModeEnabled = data.darkModeEnabled;
      if (data.autoDataSyncEnabled !== undefined) updateData.autoDataSyncEnabled = data.autoDataSyncEnabled;
      if (data.enableEmailNotifications !== undefined) updateData.enableEmailNotifications = data.enableEmailNotifications;
      if (data.darkModeEnabled !== undefined) updateData.darkModeEnabled = data.darkModeEnabled;
      if (data.autoDataSyncEnabled !== undefined) updateData.autoDataSyncEnabled = data.autoDataSyncEnabled;

      await db.collection("users").doc(data.uid).update(updateData);

      logger.info(`User profile updated: ${data.uid} by ${uid}`);
      return {success: true, uid: data.uid, message: "User profile updated successfully."};
    } catch (error: any) {
      logger.error(`Error updating user profile ${data.uid}:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to update user profile.");
    }
  },
);

export const updateUserBranchAssignments = onCall(
  {
    enforceAppCheck: false, // Set to true when App Check is enabled
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be authenticated to update branch assignments.");
    }

    const data = request.data as UpdateUserBranchAssignmentsPayload;

    if (!data.uid || !data.assignedBranchIds || data.assignedBranchIds.length === 0) {
      throw new HttpsError("invalid-argument", "User ID and at least one branch ID are required.");
    }

    try {
      // Verify the user has permission (only admins)
      const currentUserDoc = await db.collection("users").doc(uid).get();
      const currentUserData = currentUserDoc.data();

      if (!currentUserData || (currentUserData.role !== "superAdmin" && currentUserData.role !== "admin")) {
        throw new HttpsError("permission-denied", "Only administrators can update branch assignments.");
      }

      // Validate branches exist
      const branchChecks = await Promise.all(
        data.assignedBranchIds.map((branchId) => db.collection("branches").doc(branchId).get()),
      );

      const invalidBranches = branchChecks
        .map((doc, index) => ({doc, branchId: data.assignedBranchIds[index]}))
        .filter(({doc}) => !doc.exists)
        .map(({branchId}) => branchId);

      if (invalidBranches.length > 0) {
        throw new HttpsError("invalid-argument", `Invalid branch IDs: ${invalidBranches.join(", ")}`);
      }

      await db.collection("users").doc(data.uid).update({
        assignedBranchIds: data.assignedBranchIds,
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: uid,
      });

      logger.info(`User branch assignments updated: ${data.uid} by ${uid}`);
      return {success: true, uid: data.uid, message: "Branch assignments updated successfully."};
    } catch (error: any) {
      logger.error(`Error updating branch assignments for user ${data.uid}:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to update branch assignments.");
    }
  },
);

// ===============================
// CONTENT CUSTOMIZATION FUNCTIONS
// ===============================

export const createInvoiceLineCustomization = onCall(
  {
    enforceAppCheck: false, // Set to true when App Check is enabled
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be authenticated to create customizations.");
    }

    const data = request.data as CreateInvoiceLineCustomizationPayload;

    if (!data.label || !data.fieldName || !data.type || data.order == null) {
      throw new HttpsError("invalid-argument", "Label, field name, type, and order are required.");
    }

    try {
      // Verify user permissions
      const userPermissions = await getUserPermissions(uid);
      if (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin") {
        throw new HttpsError("permission-denied", "Only administrators can create invoice customizations.");
      }

      const customizationData: InvoiceLineCustomizationData = {
        ...data,
        createdAt: admin.firestore.Timestamp.now(),
        createdBy: uid,
      };

      const docRef = await db.collection("invoiceLineCustomizations").add(customizationData);

      logger.info(`Invoice line customization created: ${docRef.id} by ${uid}`);
      return {success: true, id: docRef.id, message: "Invoice line customization created successfully."};
    } catch (error: any) {
      logger.error("Error creating invoice line customization:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to create invoice line customization.");
    }
  },
);

export const updateInvoiceLineCustomization = onCall(
  {
    enforceAppCheck: false, // Set to true when App Check is enabled
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be authenticated to update customizations.");
    }

    const data = request.data as UpdateInvoiceLineCustomizationPayload;

    if (!data.customizationId) {
      throw new HttpsError("invalid-argument", "Customization ID is required.");
    }

    try {
      // Verify user permissions
      const userPermissions = await getUserPermissions(uid);
      if (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin") {
        throw new HttpsError("permission-denied", "Only administrators can update invoice customizations.");
      }

      const customizationRef = db.collection("invoiceLineCustomizations").doc(data.customizationId);
      const customizationDoc = await customizationRef.get();

      if (!customizationDoc.exists) {
        throw new HttpsError("not-found", "Invoice line customization not found.");
      }

      const updateData: any = {
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: uid,
      };

      if (data.label !== undefined) updateData.label = data.label;
      if (data.fieldName !== undefined) updateData.fieldName = data.fieldName;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.options !== undefined) updateData.options = data.options;
      if (data.required !== undefined) updateData.required = data.required;
      if (data.order !== undefined) updateData.order = data.order;
      if (data.defaultValue !== undefined) updateData.defaultValue = data.defaultValue;
      if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;

      await customizationRef.update(updateData);

      logger.info(`Invoice line customization updated: ${data.customizationId} by ${uid}`);
      return {success: true, id: data.customizationId, message: "Invoice line customization updated successfully."};
    } catch (error: any) {
      logger.error(`Error updating invoice line customization ${data.customizationId}:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to update invoice line customization.");
    }
  },
);

export const deleteInvoiceLineCustomization = onCall(
  {
    enforceAppCheck: false, // Set to true when App Check is enabled
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be authenticated to delete customizations.");
    }

    const data = request.data as DeleteInvoiceLineCustomizationPayload;

    if (!data.customizationId) {
      throw new HttpsError("invalid-argument", "Customization ID is required.");
    }

    try {
      // Verify user permissions
      const userPermissions = await getUserPermissions(uid);
      if (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin") {
        throw new HttpsError("permission-denied", "Only administrators can delete invoice customizations.");
      }

      const customizationRef = db.collection("invoiceLineCustomizations").doc(data.customizationId);
      const customizationDoc = await customizationRef.get();

      if (!customizationDoc.exists) {
        throw new HttpsError("not-found", "Invoice line customization not found.");
      }

      await customizationRef.delete();

      logger.info(`Invoice line customization deleted: ${data.customizationId} by ${uid}`);
      return {success: true, id: data.customizationId, message: "Invoice line customization deleted successfully."};
    } catch (error: any) {
      logger.error(`Error deleting invoice line customization ${data.customizationId}:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to delete invoice line customization.");
    }
  },
);

// ===============================
// Narration Templates Functions
// ===============================

export const createNarrationTemplate = onCall(
  {
    enforceAppCheck: false, // Set to true when App Check is enabled
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be authenticated to create narration templates.");
    }

    const data = request.data as CreateNarrationTemplatePayload;

    if (!data.templateName || !data.templateText || !data.category) {
      throw new HttpsError("invalid-argument", "Template name, text, and category are required.");
    }

    try {
      // Verify user permissions
      const userPermissions = await getUserPermissions(uid);
      if (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin") {
        throw new HttpsError("permission-denied", "Only administrators can create narration templates.");
      }

      const templateData: NarrationTemplateData = {
        ...data,
        createdAt: admin.firestore.Timestamp.now(),
        createdBy: uid,
      };

      const docRef = await db.collection("narrationTemplates").add(templateData);

      logger.info(`Narration template created: ${docRef.id} by ${uid}`);
      return {success: true, id: docRef.id, message: "Narration template created successfully."};
    } catch (error: any) {
      logger.error("Error creating narration template:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to create narration template.");
    }
  },
);

export const updateNarrationTemplate = onCall(
  {
    enforceAppCheck: false, // Set to true when App Check is enabled
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be authenticated to update narration templates.");
    }

    const data = request.data as UpdateNarrationTemplatePayload;

    if (!data.templateId) {
      throw new HttpsError("invalid-argument", "Template ID is required.");
    }

    try {
      // Verify user permissions
      const userPermissions = await getUserPermissions(uid);
      if (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin") {
        throw new HttpsError("permission-denied", "Only administrators can update narration templates.");
      }

      const templateRef = db.collection("narrationTemplates").doc(data.templateId);
      const templateDoc = await templateRef.get();

      if (!templateDoc.exists) {
        throw new HttpsError("not-found", "Narration template not found.");
      }

      const updateData: any = {
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: uid,
      };

      if (data.templateName !== undefined) updateData.templateName = data.templateName;
      if (data.templateText !== undefined) updateData.templateText = data.templateText;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      await templateRef.update(updateData);

      logger.info(`Narration template updated: ${data.templateId} by ${uid}`);
      return {success: true, id: data.templateId, message: "Narration template updated successfully."};
    } catch (error: any) {
      logger.error(`Error updating narration template ${data.templateId}:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to update narration template.");
    }
  },
);

export const deleteNarrationTemplate = onCall(
  {
    enforceAppCheck: false, // Set to true when App Check is enabled
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be authenticated to delete narration templates.");
    }

    const data = request.data as DeleteNarrationTemplatePayload;

    if (!data.templateId) {
      throw new HttpsError("invalid-argument", "Template ID is required.");
    }

    try {
      // Verify user permissions
      const userPermissions = await getUserPermissions(uid);
      if (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin") {
        throw new HttpsError("permission-denied", "Only administrators can delete narration templates.");
      }

      const templateRef = db.collection("narrationTemplates").doc(data.templateId);
      const templateDoc = await templateRef.get();

      if (!templateDoc.exists) {
        throw new HttpsError("not-found", "Narration template not found.");
      }

      await templateRef.delete();

      logger.info(`Narration template deleted: ${data.templateId} by ${uid}`);
      return {success: true, id: data.templateId, message: "Narration template deleted successfully."};
    } catch (error: any) {
      logger.error(`Error deleting narration template ${data.templateId}:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to delete narration template.");
    }
  },
);

// ===============================
// DOCUMENT NUMBERING FUNCTIONS
// ===============================

export const createDocumentNumberingConfig = onCall(
  {
    enforceAppCheck: false, // Set to true when App Check is enabled
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be authenticated to create document numbering configs.");
    }

    const data = request.data as CreateDocumentNumberingConfigPayload;

    if (!data.documentType || !data.prefix || data.startingNumber == null || data.currentNumber == null || data.digitPadding == null) {
      throw new HttpsError("invalid-argument", "Document type, prefix, starting number, current number, and digit padding are required.");
    }

    try {
      // Verify user permissions
      const userPermissions = await getUserPermissions(uid);
      if (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin") {
        throw new HttpsError("permission-denied", "Only administrators can create document numbering configs.");
      }

      // Check for existing config with same document type and branch
      const existingQuery = db.collection("documentNumberingConfigs")
        .where("documentType", "==", data.documentType);

      if (data.branchId) {
        existingQuery.where("branchId", "==", data.branchId);
      }

      const existingConfigs = await existingQuery.get();
      if (!existingConfigs.empty) {
        throw new HttpsError("already-exists", "A configuration for this document type and branch already exists.");
      }

      const configData: DocumentNumberingConfigData = {
        ...data,
        createdAt: admin.firestore.Timestamp.now(),
        createdBy: uid,
      };

      const docRef = await db.collection("documentNumberingConfigs").add(configData);

      logger.info(`Document numbering config created: ${docRef.id} by ${uid}`);
      return {success: true, id: docRef.id, message: "Document numbering config created successfully."};
    } catch (error: any) {
      logger.error("Error creating document numbering config:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to create document numbering config.");
    }
  },
);

export const updateDocumentNumberingConfig = onCall(
  {
    enforceAppCheck: false, // Set to true when App Check is enabled
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be authenticated to update document numbering configs.");
    }

    const data = request.data as UpdateDocumentNumberingConfigPayload;

    if (!data.configId) {
      throw new HttpsError("invalid-argument", "Config ID is required.");
    }

    try {
      // Verify user permissions
      const userPermissions = await getUserPermissions(uid);
      if (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin") {
        throw new HttpsError("permission-denied", "Only administrators can update document numbering configs.");
      }

      const configRef = db.collection("documentNumberingConfigs").doc(data.configId);
      const configDoc = await configRef.get();

      if (!configDoc.exists) {
        throw new HttpsError("not-found", "Document numbering config not found.");
      }

      const updateData: any = {
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: uid,
      };

      if (data.documentType !== undefined) updateData.documentType = data.documentType;
      if (data.prefix !== undefined) updateData.prefix = data.prefix;
      if (data.suffix !== undefined) updateData.suffix = data.suffix;
      if (data.startingNumber !== undefined) updateData.startingNumber = data.startingNumber;
      if (data.currentNumber !== undefined) updateData.currentNumber = data.currentNumber;
      if (data.digitPadding !== undefined) updateData.digitPadding = data.digitPadding;
      if (data.resetFrequency !== undefined) updateData.resetFrequency = data.resetFrequency;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.branchId !== undefined) updateData.branchId = data.branchId;

      await configRef.update(updateData);

      logger.info(`Document numbering config updated: ${data.configId} by ${uid}`);
      return {success: true, id: data.configId, message: "Document numbering config updated successfully."};
    } catch (error: any) {
      logger.error(`Error updating document numbering config ${data.configId}:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to update document numbering config.");
    }
  },
);

export const deleteDocumentNumberingConfig = onCall(
  {
    enforceAppCheck: false, // Set to true when App Check is enabled
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be authenticated to delete document numbering configs.");
    }

    const data = request.data as DeleteDocumentNumberingConfigPayload;

    if (!data.configId) {
      throw new HttpsError("invalid-argument", "Config ID is required.");
    }

    try {
      // Verify user permissions
      const userPermissions = await getUserPermissions(uid);
      if (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin") {
        throw new HttpsError("permission-denied", "Only administrators can delete document numbering configs.");
      }

      const configRef = db.collection("documentNumberingConfigs").doc(data.configId);
      const configDoc = await configRef.get();

      if (!configDoc.exists) {
        throw new HttpsError("not-found", "Document numbering config not found.");
      }

      await configRef.delete();

      logger.info(`Document numbering config deleted: ${data.configId} by ${uid}`);
      return {success: true, id: data.configId, message: "Document numbering config deleted successfully."};
    } catch (error: any) {
      logger.error(`Error deleting document numbering config ${data.configId}:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to delete document numbering config.");
    }
  },
);

export const generateNextDocumentNumber = onCall(
  {
    enforceAppCheck: false, // Set to true when App Check is enabled
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be authenticated to generate document numbers.");
    }

    const data = request.data as GenerateNextDocumentNumberPayload;

    if (!data.documentType) {
      throw new HttpsError("invalid-argument", "Document type is required.");
    }

    try {
      // Verify user permissions
      const userPermissions = await getUserPermissions(uid);
      if (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin" && !userPermissions.assignedBranchIds.length) {
        throw new HttpsError("permission-denied", "You do not have permission to generate document numbers.");
      }

      // Find the active config for this document type and branch
      let configQuery = db.collection("documentNumberingConfigs")
        .where("documentType", "==", data.documentType)
        .where("isActive", "==", true);

      if (data.branchId) {
        configQuery = configQuery.where("branchId", "==", data.branchId);
      }

      const configSnap = await configQuery.limit(1).get();

      if (configSnap.empty) {
        throw new HttpsError("not-found", `No active document numbering config found for ${data.documentType}`);
      }

      const configDoc = configSnap.docs[0];
      const configData = configDoc.data() as DocumentNumberingConfigData;

      // Generate the next number
      const nextNumber = configData.currentNumber;
      const paddedNumber = nextNumber.toString().padStart(configData.digitPadding, "0");
      const fullNumber = `${configData.prefix}${paddedNumber}${configData.suffix || ""}`;

      // Update the current number in the config
      await configDoc.ref.update({
        currentNumber: nextNumber + 1,
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: uid,
      });

      logger.info(`Generated next document number for ${data.documentType}: ${fullNumber}`);
      return {
        nextNumber: fullNumber,
        configId: configDoc.id,
      } as GenerateNextDocumentNumberResult;
    } catch (error: any) {
      logger.error(`Error generating next document number for ${data.documentType}:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to generate next document number.");
    }
  },
);

// =====================================================
//                  DAYBOOK MANAGEMENT
// =====================================================

/**
 * Creates a new daybook
 */
export const createDaybook = onCall({enforceAppCheck: false}, async (request) => {
  const {auth, data} = request;
  const payload = data as CreateDaybookPayload;

  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const uid = auth.uid;
  const userPermissions = await getUserPermissions(uid);

  if (!userPermissions) {
    throw new HttpsError("permission-denied", "Unable to verify user permissions.");
  }

  // Check if user has permission to create daybooks for this branch
  if (userPermissions.role !== "superAdmin" &&
      !userPermissions.assignedBranchIds.includes(payload.branchId)) {
    throw new HttpsError("permission-denied", "You do not have permission to create daybooks for this branch.");
  }

  try {
    // Parse the English date
    const englishDate = new Date(payload.englishMiti);
    if (isNaN(englishDate.getTime())) {
      throw new HttpsError("invalid-argument", "Invalid English date provided.");
    }

    // Check if a daybook already exists for this branch and date
    const existingDaybooks = await db.collection("daybooks")
      .where("branchId", "==", payload.branchId)
      .where("nepaliMiti", "==", payload.nepaliMiti)
      .limit(1)
      .get();

    if (!existingDaybooks.empty) {
      throw new HttpsError("already-exists", "A daybook already exists for this branch and date.");
    }

    // Create the new daybook
    const newDaybook: DaybookData = {
      branchId: payload.branchId,
      nepaliMiti: payload.nepaliMiti,
      englishMiti: admin.firestore.Timestamp.fromDate(englishDate),
      openingBalance: payload.openingBalance || 0,
      totalCashIn: 0,
      totalCashOut: 0,
      closingBalance: payload.openingBalance || 0,
      status: "Draft",
      transactions: [],
      processedByFunction: true,
      createdBy: uid,
      createdAt: admin.firestore.Timestamp.now(),
    };

    const daybookRef = await db.collection("daybooks").add(newDaybook);

    logger.info(`Daybook created with ID: ${daybookRef.id} by user: ${uid}`);
    return {
      success: true,
      id: daybookRef.id,
      message: "Daybook created successfully.",
    } as DaybookCreateResponse;
  } catch (error: any) {
    logger.error("Error creating daybook:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to create daybook.");
  }
});
