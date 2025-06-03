
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2/firestore"; // Using v2 Firestore triggers
import {logger} from "firebase-functions"; // Using v2 logger
import {onCall, HttpsError} from "firebase-functions/v2/https"; // For HTTPS Callable Functions v2

import type {
  UserData,
  DaybookData,
  FunctionsBiltiData,
  GoodsDeliveryData,
  PartyData,
  LedgerEntryData,
  LedgerTransactionType,
  BranchData,
  CountryData,
  StateData,
  CityData,
  UnitData,
  TruckData,
  DriverData,
  GodownData,
  ManifestData,
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
      miti: biltiData.miti, nepaliMiti: biltiData.nepaliMiti || "", referenceNo: `BLT-${biltiId}`, sourceModule: "Bilti", status: "Approved", createdAt: admin.firestore.Timestamp.now(), createdBy: biltiData.createdBy || "system-bilti-processor", transactionType: "Bilti", branchId: biltiData.branchId || "UNKNOWN_BRANCH",
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
export const submitDaybook = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const approveDaybook = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const rejectDaybook = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });

// Branch Management CRUD Functions ...
export const createBranch = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const updateBranch = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const deleteBranch = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });

// Locations & Units CRUD Functions ...
export const createCountry = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const updateCountry = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const deleteCountry = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const createState = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const updateState = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const deleteState = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const createCity = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const updateCity = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const deleteCity = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const createUnit = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const updateUnit = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const deleteUnit = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });

// Truck Management CRUD Functions ...
export const createTruck = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const updateTruck = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const deleteTruck = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });

// Driver Management CRUD Functions ...
export const createDriver = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const updateDriver = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const deleteDriver = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });

// Party Management CRUD Functions ...
export const createParty = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const updateParty = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const deleteParty = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });

// Godown Management CRUD Functions ...
export const createGodown = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const updateGodown = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const deleteGodown = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });

// Bilti / Invoicing CRUD Functions ...
interface BiltiCallableData extends Omit<FunctionsBiltiData, "id" | "miti" | "totalAmount" | "status" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy" | "ledgerProcessed"> {miti: string;}
export const createBilti = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const updateBilti = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });
export const deleteBilti = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => { /* ... */ });


// --- Manifest CRUD Functions ---
interface ManifestCallableData extends Omit<ManifestData, "id" | "miti" | "status" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy"> { miti: string; }

export const createManifest = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => {
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

export const updateManifest = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => {
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
      oldBiltiIds.forEach(biltiId => {
        if (!newBiltiIds.has(biltiId)) {
          const biltiRef = db.collection("biltis").doc(biltiId);
          batch.update(biltiRef, {status: "Pending", manifestId: null});
        }
      });
      // Biltis to add to manifest (set to Manifested)
      newBiltiIds.forEach(biltiId => {
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

export const deleteManifest = onCall({enforceAppCheck: false, consumeAppCheck: "lenient"}, async (request) => {
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
