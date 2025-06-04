import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import type { DriverData, TruckData, UserData } from "./types";

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

// --- Truck Management CRUD Functions ---

export const createTruck = onCall(
  {enforceAppCheck: false},
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

    const data = request.data as Omit<TruckData, "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy">;
    if (!data.truckNo || !data.ownerName || !data.assignedLedgerId) {
      throw new HttpsError("invalid-argument", "Truck No, Owner Name, and Assigned Ledger ID are required.");
    }

    const userPermissions = await getUserPermissions(uid);
    if (!userPermissions) throw new HttpsError("permission-denied", "Unable to verify user permissions.");

    if (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin") {
      throw new HttpsError("permission-denied", "Only administrators can create trucks.");
    }

    try {
      // Check if truck number already exists
      const existingTruckQuery = await db.collection("trucks")
        .where("truckNo", "==", data.truckNo)
        .limit(1)
        .get();
      
      if (!existingTruckQuery.empty) {
        throw new HttpsError("already-exists", "A truck with this number already exists.");
      }

      const truckRef = db.collection("trucks").doc();
      const truckData: TruckData = {
        ...data,
        id: truckRef.id,
        createdBy: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
        updatedBy: uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
      };

      await truckRef.set(truckData);

      logger.info(`Truck created: ${truckRef.id} by ${uid}`);
      return {success: true, id: truckRef.id, message: "Truck created successfully."};
    } catch (error: any) {
      logger.error(`Error creating truck:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to create truck.");
    }
  }
);

export const updateTruck = onCall(
  {enforceAppCheck: false},
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

    const data = request.data as Partial<Omit<TruckData, "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy">> & { truckId: string };
    if (!data.truckId) throw new HttpsError("invalid-argument", "Truck ID is required.");

    const userPermissions = await getUserPermissions(uid);
    if (!userPermissions) throw new HttpsError("permission-denied", "Unable to verify user permissions.");

    if (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin") {
      throw new HttpsError("permission-denied", "Only administrators can update trucks.");
    }

    try {
      const truckRef = db.collection("trucks").doc(data.truckId);
      const truckDoc = await truckRef.get();
      
      if (!truckDoc.exists) throw new HttpsError("not-found", "Truck not found.");

      // If updating truck number, check for duplicates
      if (data.truckNo) {
        const existingTruckQuery = await db.collection("trucks")
          .where("truckNo", "==", data.truckNo)
          .limit(1)
          .get();
        
        if (!existingTruckQuery.empty && existingTruckQuery.docs[0].id !== data.truckId) {
          throw new HttpsError("already-exists", "A truck with this number already exists.");
        }
      }

      const { truckId, ...updateData } = data;
      const updatedTruckData = {
        ...updateData,
        updatedBy: uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await truckRef.update(updatedTruckData);

      logger.info(`Truck updated: ${data.truckId} by ${uid}`);
      return {success: true, id: data.truckId, message: "Truck updated successfully."};
    } catch (error: any) {
      logger.error(`Error updating truck:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to update truck.");
    }
  }
);

export const deleteTruck = onCall(
  {enforceAppCheck: false},
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

    const data = request.data as { truckId: string };
    if (!data.truckId) throw new HttpsError("invalid-argument", "Truck ID is required.");

    const userPermissions = await getUserPermissions(uid);
    if (!userPermissions) throw new HttpsError("permission-denied", "Unable to verify user permissions.");

    if (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin") {
      throw new HttpsError("permission-denied", "Only administrators can delete trucks.");
    }

    try {
      const truckRef = db.collection("trucks").doc(data.truckId);
      const truckDoc = await truckRef.get();
      
      if (!truckDoc.exists) throw new HttpsError("not-found", "Truck not found.");

      // Check if truck is referenced in any bilti or manifest documents
      const biltiQuery = await db.collection("biltis")
        .where("truckId", "==", data.truckId)
        .limit(1)
        .get();
      
      if (!biltiQuery.empty) {
        throw new HttpsError("failed-precondition", "Cannot delete truck. It is referenced in existing bilti documents.");
      }

      const manifestQuery = await db.collection("manifests")
        .where("truckId", "==", data.truckId)
        .limit(1)
        .get();
      
      if (!manifestQuery.empty) {
        throw new HttpsError("failed-precondition", "Cannot delete truck. It is referenced in existing manifest documents.");
      }

      await truckRef.delete();

      logger.info(`Truck deleted: ${data.truckId} by ${uid}`);
      return {success: true, id: data.truckId, message: "Truck deleted successfully."};
    } catch (error: any) {
      logger.error(`Error deleting truck:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to delete truck.");
    }
  }
);

// Driver Management CRUD Functions
export const createDriver = onCall(
  { enforceAppCheck: false },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

    const data = request.data as Omit<DriverData, "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy">;
    if (!data.name || !data.licenseNo || !data.contactNo || !data.assignedLedgerId) {
      throw new HttpsError("invalid-argument", "Driver name, license number, contact number, and assigned ledger ID are required.");
    }

    const userPermissions = await getUserPermissions(uid);
    if (!userPermissions || (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin")) {
      throw new HttpsError("permission-denied", "Only administrators can create drivers.");
    }

    try {
      const existingDriverQuery = await db.collection("drivers")
        .where("licenseNo", "==", data.licenseNo)
        .limit(1)
        .get();
      
      if (!existingDriverQuery.empty) {
        throw new HttpsError("already-exists", "A driver with this license number already exists.");
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
  { enforceAppCheck: false },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

    const data = request.data as { driverId: string } & Partial<Omit<DriverData, "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy">>;
    if (!data.driverId) throw new HttpsError("invalid-argument", "Driver ID is required.");

    const userPermissions = await getUserPermissions(uid);
    if (!userPermissions || (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin")) {
      throw new HttpsError("permission-denied", "Only administrators can update drivers.");
    }

    try {
      const driverRef = db.collection("drivers").doc(data.driverId);
      const driverDoc = await driverRef.get();
      
      if (!driverDoc.exists) throw new HttpsError("not-found", "Driver not found.");
      
      const updateData: Record<string, any> = {
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: uid,
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.licenseNo !== undefined) updateData.licenseNo = data.licenseNo;
      if (data.contactNo !== undefined) updateData.contactNo = data.contactNo;
      if (data.address !== undefined) updateData.address = data.address;
      if (data.joiningDate !== undefined) updateData.joiningDate = data.joiningDate;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.assignedLedgerId !== undefined) updateData.assignedLedgerId = data.assignedLedgerId;

      await driverRef.update(updateData);

      logger.info(`Driver updated: ${data.driverId} by ${uid}`);
      return {success: true, id: data.driverId, message: "Driver updated successfully."};
    } catch (error: any) {
      logger.error(`Error updating driver:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to update driver.");
    }
  }
);

export const deleteDriver = onCall(
  { enforceAppCheck: false },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required.");

    const { driverId } = request.data as { driverId: string };
    if (!driverId) throw new HttpsError("invalid-argument", "Driver ID is required.");

    const userPermissions = await getUserPermissions(uid);
    if (!userPermissions || (userPermissions.role !== "superAdmin" && userPermissions.role !== "admin")) {
      throw new HttpsError("permission-denied", "Only administrators can delete drivers.");
    }

    try {
      const driverRef = db.collection("drivers").doc(driverId);
      const driverDoc = await driverRef.get();
      
      if (!driverDoc.exists) throw new HttpsError("not-found", "Driver not found.");
      
      const manifestsWithDriver = await db.collection("manifests")
        .where("driverId", "==", driverId)
        .limit(1)
        .get();
      
      if (!manifestsWithDriver.empty) {
        throw new HttpsError(
          "failed-precondition",
          "Cannot delete driver because they are referenced in manifests."
        );
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
