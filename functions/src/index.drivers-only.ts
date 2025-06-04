import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import type { DriverData, UserData } from "./types";

admin.initializeApp();
const db = admin.firestore();

// Helper function to get user permissions
async function getUserPermissions(uid: string): Promise<UserData | null> {
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      logger.warn(`User document not found for UID: ${uid}`);
      return null;
    }
    
    const userData = userDoc.data() as UserData;
    if (!userData) {
      logger.warn(`User data is empty for UID: ${uid}`);
      return null;
    }
    
    return { ...userData, id: userDoc.id };
  } catch (error: any) {
    logger.error(`Error fetching user permissions for UID ${uid}:`, error);
    return null;
  }
}

// --- Driver Management CRUD Functions ---

export const createDriver = onCall(
  { 
    enforceAppCheck: false
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

    const data = request.data as Omit<DriverData, "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy">;
    if (!data.name || !data.licenseNo || !data.contactNo || !data.assignedLedgerId) {
      throw new HttpsError("invalid-argument", "Driver name, license number, contact number, and assigned ledger ID are required.");
    }

    // Get user permissions to verify they can create drivers
    const userPermissions = await getUserPermissions(uid);
    if (!userPermissions) throw new HttpsError("permission-denied", "Unable to verify user permissions.");

    if (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin") {
      throw new HttpsError("permission-denied", "Only administrators can create drivers.");
    }

    try {
      // Check for duplicate license number
      const existingDriverQuery = await db.collection("drivers")
        .where("licenseNo", "==", data.licenseNo)
        .limit(1)
        .get();
      
      if (!existingDriverQuery.empty) {
        throw new HttpsError("already-exists", "A driver with this license number already exists.");
      }

      // Verify that the assigned ledger account exists
      const ledgerDoc = await db.collection("ledgerAccounts").doc(data.assignedLedgerId).get();
      if (!ledgerDoc.exists) {
        throw new HttpsError("not-found", "Assigned ledger account not found.");
      }

      const driverRef = db.collection("drivers").doc();
      await driverRef.set({
        ...data,
        createdAt: admin.firestore.Timestamp.now(),
        createdBy: uid,
      });

      logger.info(`Driver created: ${driverRef.id} by ${uid}`);
      return {success: true, id: driverRef.id, message: "Driver created successfully."};
    } catch (error: any) {
      logger.error(`Error creating driver:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to create driver.");
    }
  }
);

export const updateDriver = onCall(
  { 
    enforceAppCheck: false
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

    const data = request.data as { driverId: string } & Partial<Omit<DriverData, "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy">>;
    if (!data.driverId) throw new HttpsError("invalid-argument", "Driver ID is required.");

    const userPermissions = await getUserPermissions(uid);
    if (!userPermissions) throw new HttpsError("permission-denied", "Unable to verify user permissions.");

    if (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin") {
      throw new HttpsError("permission-denied", "Only administrators can update drivers.");
    }

    try {
      const driverRef = db.collection("drivers").doc(data.driverId);
      const driverDoc = await driverRef.get();
      
      if (!driverDoc.exists) {
        throw new HttpsError("not-found", "Driver not found.");
      }

      // Check for duplicate license number if license is being updated
      if (data.licenseNo) {
        const existingDriverQuery = await db.collection("drivers")
          .where("licenseNo", "==", data.licenseNo)
          .limit(2)
          .get();
        
        // Allow if no duplicates found, or if the only match is the driver being updated
        const duplicateFound = existingDriverQuery.docs.some(doc => 
          doc.id !== data.driverId && doc.data().licenseNo === data.licenseNo
        );
        
        if (duplicateFound) {
          throw new HttpsError("already-exists", "A driver with this license number already exists.");
        }
      }

      // Verify ledger account exists if being updated
      if (data.assignedLedgerId) {
        const ledgerDoc = await db.collection("ledgerAccounts").doc(data.assignedLedgerId).get();
        if (!ledgerDoc.exists) {
          throw new HttpsError("not-found", "Assigned ledger account not found.");
        }
      }

      const { driverId, ...updateData } = data;
      await driverRef.update({
        ...updateData,
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: uid,
      });

      logger.info(`Driver updated: ${driverId} by ${uid}`);
      return {success: true, id: driverId, message: "Driver updated successfully."};
    } catch (error: any) {
      logger.error(`Error updating driver:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to update driver.");
    }
  }
);

export const deleteDriver = onCall(
  { 
    enforceAppCheck: false
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

    const { driverId } = request.data as { driverId: string };
    if (!driverId) throw new HttpsError("invalid-argument", "Driver ID is required.");

    const userPermissions = await getUserPermissions(uid);
    if (!userPermissions) throw new HttpsError("permission-denied", "Unable to verify user permissions.");

    if (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin") {
      throw new HttpsError("permission-denied", "Only administrators can delete drivers.");
    }

    try {
      const driverRef = db.collection("drivers").doc(driverId);
      const driverDoc = await driverRef.get();
      
      if (!driverDoc.exists) {
        throw new HttpsError("not-found", "Driver not found.");
      }

      // Check if driver is referenced in any manifests
      const manifestsQuery = await db.collection("manifests")
        .where("driverId", "==", driverId)
        .limit(1)
        .get();
      
      if (!manifestsQuery.empty) {
        throw new HttpsError("failed-precondition", "Cannot delete driver: driver is referenced in existing manifests.");
      }

      await driverRef.delete();

      logger.info(`Driver deleted: ${driverId} by ${uid}`);
      return {success: true, id: driverId, message: "Driver deleted successfully."};
    } catch (error: any) {
      logger.error(`Error deleting driver:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to delete driver.");
    }
  }
);
