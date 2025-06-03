
import type { Timestamp } from "firebase-admin/firestore"; // Use admin SDK Timestamp for functions

// This file mirrors relevant parts of src/types/firestore.ts but for backend functions.
// Ensure consistency or share types if possible in a monorepo setup.

export interface UserData {
  id?: string; // Firestore document ID
  uid: string; // Firebase Auth UID - This should be the document ID in 'users' collection
  status?: "active" | "disabled";
  role?: string;
  email?: string;
  displayName?: string;
  assignedBranchIds?: string[];
  // Add other fields from your main User type if needed by functions
}

export interface DaybookTransaction {
  id: string;
  transactionType: string; // Consider using your DaybookTransactionType union type
  amount: number;
  description: string;
  ledgerAccountId?: string;
  partyId?: string;
  referenceId?: string;
  nepaliMiti?: string;
  createdAt: Timestamp; // Firestore Timestamp
}

export interface DaybookData {
  id?: string; // Firestore document ID
  status?: "Draft" | "Pending Approval" | "Approved" | "Rejected";
  nepaliMiti: string;
  englishMiti: Timestamp; // Firestore Timestamp
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
  submittedBy?: string;
  submittedAt?: Timestamp;
  approvalRemarks?: string;
}

export interface BiltiData {
  id?: string; // Document ID is implicit
  miti: Timestamp; // Firestore Timestamp
  nepaliMiti?: string;
  consignorId: string;
  consigneeId: string;
  origin: string;
  destination: string;
  description: string;
  packages: number;
  weight?: number;
  rate: number;
  totalAmount: number;
  payMode: "Paid" | "To Pay" | "Due";
  status: "Pending" | "Manifested" | "Received" | "Delivered" | "Paid" | "Cancelled";
  manifestId?: string | null;
  goodsDeliveryNoteId?: string | null;
  cashCollectionStatus?: "Pending" | "Partial" | "Collected";
  truckId: string;
  driverId: string;
  ledgerProcessed?: boolean;
  createdBy?: string;
  createdAt?: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
  branchId?: string; // Assuming bilti can be associated with a branch for context
  // Add other fields from your main Bilti type if needed
}

export interface DeliveredBiltiItemData {
  biltiId: string;
  rebateAmount: number;
  rebateReason?: string;
  discountAmount: number;
  discountReason?: string;
  // Add other fields from your main DeliveredBiltiItem type if needed
}

export interface GoodsDeliveryData {
  id?: string; // Document ID is implicit
  miti: Timestamp; // Firestore Timestamp
  nepaliMiti?: string;
  deliveredBiltis: DeliveredBiltiItemData[];
  ledgerProcessed?: boolean;
  createdBy?: string;
  // Add other fields from your main GoodsDelivery type if needed
}

export interface PartyData {
  id?: string; // Document ID is implicit
  name: string;
  assignedLedgerId: string; // Crucial for ledger posting
  type?: "Consignor" | "Consignee" | "Both";
  contactNo?: string;
  panNo?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  status?: "Active" | "Inactive";
  // Add other fields from your main Party type if needed
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
  id?: string; // Document ID is implicit
  accountId: string;
  miti: Timestamp; // Firestore Timestamp
  nepaliMiti?: string;
  description: string;
  debit: number;
  credit: number;
  referenceNo?: string;
  transactionType: LedgerTransactionType;
  status: "Pending" | "Approved" | "Rejected"; // Status of the ledger entry itself
  sourceModule?: string;
  branchId?: string;
  createdAt: Timestamp; // Firestore Timestamp
  createdBy?: string;
  // Add other fields from your main LedgerEntry type if needed
}

export interface BranchData {
    id?: string; // Document ID, optional for creation
    name: string;
    location: string;
    managerName?: string | null;
    managerUserId?: string;
    contactEmail?: string;
    contactPhone?: string;
    status?: "Active" | "Inactive";
    // Auditable fields, optional for client input, set by server
    createdBy?: string;
    createdAt?: Timestamp;
    updatedBy?: string;
    updatedAt?: Timestamp;
}

// ---- Locations & Units Types for Functions ----
export interface CountryData {
  id?: string;
  name: string;
  code: string;
  // Auditable fields can be added if needed by functions beyond what's set by default
}

export interface StateData {
  id?: string;
  name: string;
  countryId: string;
}

export interface CityData {
  id?: string;
  name: string;
  stateId: string;
}

export type UnitType = "Weight" | "Distance" | "Volume" | "Other";

export interface UnitData {
  id?: string;
  name: string;
  symbol: string;
  type: UnitType;
}

// ---- Truck and Driver Types for Functions ----
export interface TruckData {
  id?: string;
  truckNo: string;
  type: string; // e.g., "6-Wheeler", "10-Wheeler"
  capacity?: string;
  ownerName: string;
  ownerPAN?: string;
  status: "Active" | "Inactive" | "Maintenance";
  assignedLedgerId: string;
  // createdAt, createdBy, etc. are handled by the function
}

export interface DriverData {
  id?: string;
  name: string;
  licenseNo: string;
  contactNo: string;
  address?: string;
  joiningDate?: Timestamp | string; // Client might send string, function converts to Timestamp
  status: "Active" | "Inactive" | "On Leave";
  assignedLedgerId: string;
  // createdAt, createdBy, etc. are handled by the function
}

export interface GodownData {
  id?: string;
  name: string;
  branchId: string;
  location: string;
  status: "Active" | "Inactive" | "Operational";
  // createdAt, createdBy, etc. are handled by the function
}


// Auditable fields are set by the functions themselves
// export interface Auditable {
//   createdBy?: string;
//   createdAt?: Timestamp;
//   updatedBy?: string;
//   updatedAt?: Timestamp;
// }

