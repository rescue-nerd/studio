
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

export interface FunctionsBiltiData { // Renamed to avoid conflict
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
  branchId?: string;
}

export interface DeliveredBiltiItemData {
  biltiId: string;
  rebateAmount: number;
  rebateReason?: string;
  discountAmount: number;
  discountReason?: string;
}

export interface GoodsDeliveryData {
  id?: string;
  miti: Timestamp;
  nepaliMiti?: string;
  deliveredBiltis: DeliveredBiltiItemData[];
  ledgerProcessed?: boolean;
  createdBy?: string;
}

export interface PartyData {
  id?: string;
  name: string;
  assignedLedgerId: string;
  type?: "Consignor" | "Consignee" | "Both";
  contactNo?: string;
  panNo?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  status?: "Active" | "Inactive";
  // Auditable fields added if passed from client for creation, otherwise set by server
  createdBy?: string;
  createdAt?: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
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
  id?: string;
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

export interface BranchData {
    id?: string;
    name: string;
    location: string;
    managerName?: string | null;
    managerUserId?: string;
    contactEmail?: string;
    contactPhone?: string;
    status?: "Active" | "Inactive";
    createdBy?: string;
    createdAt?: Timestamp;
    updatedBy?: string;
    updatedAt?: Timestamp;
}

export interface CountryData {
  id?: string;
  name: string;
  code: string;
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

export interface TruckData {
  id?: string;
  truckNo: string;
  type: string;
  capacity?: string;
  ownerName: string;
  ownerPAN?: string;
  status: "Active" | "Inactive" | "Maintenance";
  assignedLedgerId: string;
}

export interface DriverData {
  id?: string;
  name: string;
  licenseNo: string;
  contactNo: string;
  address?: string;
  joiningDate?: Timestamp | string;
  status: "Active" | "Inactive" | "On Leave";
  assignedLedgerId: string;
}

export interface GodownData {
  id?: string;
  name: string;
  branchId: string;
  location: string;
  status: "Active" | "Inactive" | "Operational";
}

export interface ManifestData {
  id?: string;
  miti: Timestamp | string; // Client might send string, function converts
  nepaliMiti?: string;
  truckId: string;
  driverId: string;
  fromBranchId: string;
  toBranchId: string;
  attachedBiltiIds: string[];
  remarks?: string;
  status: "Open" | "In Transit" | "Received" | "Completed" | "Cancelled";
  // Auditable fields
  createdBy?: string;
  createdAt?: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
}
