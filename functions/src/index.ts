import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import type { DriverData, UserData, BranchData } from "./types";

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

// --- Branch Management CRUD Functions ---

export const createBranch = onCall(
  { 
    enforceAppCheck: false
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

    const data = request.data as Omit<BranchData, "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy">;
    if (!data.name || !data.location) {
      throw new HttpsError("invalid-argument", "Branch name and location are required.");
    }

    // Get user permissions to verify they can create branches
    const userPermissions = await getUserPermissions(uid);
    if (!userPermissions) throw new HttpsError("permission-denied", "Unable to verify user permissions.");

    if (userPermissions.role !== "superAdmin") {
      throw new HttpsError("permission-denied", "Only super administrators can create branches.");
    }

    try {
      // Check for duplicate branch name
      const existingBranchQuery = await db.collection("branches")
        .where("name", "==", data.name)
        .limit(1)
        .get();
      
      if (!existingBranchQuery.empty) {
        throw new HttpsError("already-exists", "A branch with this name already exists.");
      }

      // Verify manager user exists if provided
      if (data.managerUserId) {
        const managerDoc = await db.collection("users").doc(data.managerUserId).get();
        if (!managerDoc.exists) {
          throw new HttpsError("not-found", "Manager user not found.");
        }
      }

      const branchRef = db.collection("branches").doc();
      await branchRef.set({
        ...data,
        status: data.status || "Active",
        createdAt: admin.firestore.Timestamp.now(),
        createdBy: uid,
      });

      logger.info(`Branch created: ${branchRef.id} by ${uid}`);
      return {success: true, id: branchRef.id, message: "Branch created successfully."};
    } catch (error: any) {
      logger.error(`Error creating branch:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to create branch.");
    }
  }
);

export const updateBranch = onCall(
  { 
    enforceAppCheck: false
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

    const data = request.data as { branchId: string } & Partial<Omit<BranchData, "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy">>;
    if (!data.branchId) throw new HttpsError("invalid-argument", "Branch ID is required.");

    const userPermissions = await getUserPermissions(uid);
    if (!userPermissions) throw new HttpsError("permission-denied", "Unable to verify user permissions.");

    if (userPermissions.role !== "superAdmin") {
      throw new HttpsError("permission-denied", "Only super administrators can update branches.");
    }

    try {
      const branchRef = db.collection("branches").doc(data.branchId);
      const branchDoc = await branchRef.get();
      
      if (!branchDoc.exists) {
        throw new HttpsError("not-found", "Branch not found.");
      }

      // Check for duplicate branch name if name is being updated
      if (data.name) {
        const existingBranchQuery = await db.collection("branches")
          .where("name", "==", data.name)
          .limit(2)
          .get();
        
        // Allow if no duplicates found, or if the only match is the branch being updated
        const duplicateFound = existingBranchQuery.docs.some(doc => 
          doc.id !== data.branchId && doc.data().name === data.name
        );
        
        if (duplicateFound) {
          throw new HttpsError("already-exists", "A branch with this name already exists.");
        }
      }

      // Verify manager user exists if being updated
      if (data.managerUserId) {
        const managerDoc = await db.collection("users").doc(data.managerUserId).get();
        if (!managerDoc.exists) {
          throw new HttpsError("not-found", "Manager user not found.");
        }
      }

      const { branchId, ...updateData } = data;
      await branchRef.update({
        ...updateData,
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: uid,
      });

      logger.info(`Branch updated: ${branchId} by ${uid}`);
      return {success: true, id: branchId, message: "Branch updated successfully."};
    } catch (error: any) {
      logger.error(`Error updating branch:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to update branch.");
    }
  }
);

export const deleteBranch = onCall(
  { 
    enforceAppCheck: false
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

    const { branchId } = request.data as { branchId: string };
    if (!branchId) throw new HttpsError("invalid-argument", "Branch ID is required.");

    const userPermissions = await getUserPermissions(uid);
    if (!userPermissions) throw new HttpsError("permission-denied", "Unable to verify user permissions.");

    if (userPermissions.role !== "superAdmin") {
      throw new HttpsError("permission-denied", "Only super administrators can delete branches.");
    }

    try {
      const branchRef = db.collection("branches").doc(branchId);
      const branchDoc = await branchRef.get();
      
      if (!branchDoc.exists) {
        throw new HttpsError("not-found", "Branch not found.");
      }

      // Check if branch is referenced in any godowns
      const godownsQuery = await db.collection("godowns")
        .where("branchId", "==", branchId)
        .limit(1)
        .get();
      
      if (!godownsQuery.empty) {
        throw new HttpsError("failed-precondition", "Cannot delete branch: branch has associated godowns.");
      }

      // Check if branch is referenced in any users
      const usersQuery = await db.collection("users")
        .where("assignedBranchIds", "array-contains", branchId)
        .limit(1)
        .get();
      
      if (!usersQuery.empty) {
        throw new HttpsError("failed-precondition", "Cannot delete branch: branch is assigned to users.");
      }

      await branchRef.delete();

      logger.info(`Branch deleted: ${branchId} by ${uid}`);
      return {success: true, id: branchId, message: "Branch deleted successfully."};
    } catch (error: any) {
      logger.error(`Error deleting branch:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to delete branch.");
    }
  }
);

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