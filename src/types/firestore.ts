import type { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string; // Firebase Auth UID
  email: string | null; // Can be null if using anonymous auth or phone
  displayName?: string | null;
  role: "superAdmin" | "manager" | "operator" | string; // string for potential custom roles
  assignedBranchIds: string[];
  createdAt: Timestamp;
  lastLoginAt?: Timestamp;
  enableEmailNotifications?: boolean;
  darkModeEnabled?: boolean;
  autoDataSyncEnabled?: boolean;
}

interface Auditable {
  createdBy: string; // User.uid
  createdAt: Timestamp;
  updatedBy?: string; // User.uid
  updatedAt?: Timestamp;
}

export interface Branch extends Auditable {
  id: string; // Document ID
  name: string;
  location: string;
  managerName?: string | null;
  managerUserId?: string; // Link to User.uid
  contactEmail?: string;
  contactPhone?: string;
  status?: "Active" | "Inactive";
}

export interface Party extends Auditable {
  id: string; // Document ID
  name: string;
  type: "Consignor" | "Consignee" | "Both";
  contactNo: string;
  panNo?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  assignedLedgerId: string; // Link to LedgerAccount.id
  status: "Active" | "Inactive";
}

export interface Truck extends Auditable {
  id: string; // Document ID
  truckNo: string;
  type: string; // e.g., "6-Wheeler", "10-Wheeler", "Trailer"
  capacity?: string; // e.g., "10 Ton", "15 CBM" - Made optional
  ownerName: string;
  ownerPAN?: string;
  status: "Active" | "Inactive" | "Maintenance";
  assignedLedgerId: string; // Link to LedgerAccount.id
}

export interface Driver extends Auditable {
  id: string; // Document ID
  name: string;
  licenseNo: string;
  contactNo: string;
  address?: string;
  joiningDate?: Timestamp; // Stored as Timestamp in Firestore
  status: "Active" | "Inactive" | "On Leave";
  assignedLedgerId: string; // Link to LedgerAccount.id
}

export interface Godown extends Auditable {
  id: string; // Document ID
  name: string;
  branchId: string; // Link to Branch.id
  location: string;
  status: "Active" | "Inactive" | "Operational";
}

export interface Bilti extends Auditable {
  id: string; // Document ID (Bilti No.)
  miti: Timestamp; // Date of Bilti
  nepaliMiti?: string;
  consignorId: string; // Link to Party.id
  consigneeId: string; // Link to Party.id
  origin: string; // Could be Branch name or City name
  destination: string; // Could be Branch name or City name
  description: string; // Description of goods
  packages: number;
  weight?: number; // Optional weight in KG
  rate: number; // Rate per package or per KG (context dependent)
  totalAmount: number;
  payMode: "Paid" | "To Pay" | "Due";
  truckId: string; // Link to Truck.id
  driverId: string; // Link to Driver.id
  status: "Pending" | "Manifested" | "Received" | "Delivered" | "Cancelled";
  manifestId?: string; // Link to Manifest.id if part of a manifest
  goodsDeliveryNoteId?: string; // Link to GoodsDelivery.id if delivered
}

export interface Manifest extends Auditable {
  id: string; // Document ID (Manifest No.)
  miti: Timestamp; // Date of Manifest
  nepaliMiti?: string;
  truckId: string; // Link to Truck.id
  driverId: string; // Link to Driver.id
  fromBranchId: string; // Link to Branch.id
  toBranchId: string; // Link to Branch.id
  attachedBiltiIds: string[]; // Array of Bilti.id
  remarks?: string;
  status: "Open" | "In Transit" | "Completed" | "Cancelled" | "Received";
  goodsReceiptId?: string; // Link to GoodsReceipt.id if received
}

export interface GoodsReceipt extends Auditable {
  id: string; // Document ID (GRN No.)
  miti: Timestamp; // Date of Receipt
  nepaliMiti?: string;
  manifestId: string; // Link to Manifest.id
  receivingBranchId: string; // Link to Branch.id
  receivingGodownId?: string; // Link to Godown.id (optional)
  remarks?: string;
  shortages?: string; // Details of any shortages
  damages?: string; // Details of any damages
  // receivedBy field was present, changed to createdBy from Auditable
}

export interface DeliveredBiltiItem {
  biltiId: string; // Link to Bilti.id
  biltiData?: Bilti; // For UI purposes, not stored in Firestore directly in this sub-object
  rebateAmount: number;
  rebateReason: string;
  discountAmount: number;
  discountReason: string;
}

export interface GoodsDelivery extends Auditable {
  id: string; // Document ID (Delivery Note No.)
  miti: Timestamp; // Date of Delivery
  nepaliMiti?: string;
  deliveredBiltis: DeliveredBiltiItem[]; // Note: biltiData is for UI only, not stored in this array in Firestore.
  overallRemarks?: string;
  deliveredToName?: string; // Name of person receiving
  deliveredToContact?: string; // Contact of person receiving
}

export interface LedgerAccount extends Auditable {
  id: string; // Document ID (often same as accountId for simplicity)
  accountId: string; // The ID of the entity this ledger belongs to (e.g., Party.id, Truck.id)
  accountName: string; // Name of the party, truck no., driver name
  accountType: "Party" | "Truck" | "Driver" | "Branch" | "Expense" | "Income" | "Bank" | "Cash" | string;
  currentBalance: number; // Denormalized; should be updated by backend functions
  panNo?: string; // If Party
  truckNo?: string; // If Truck
  lastTransactionAt?: Timestamp;
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
  | string; // Allow for future custom types

export interface LedgerEntry extends Auditable {
  id: string; // Document ID
  accountId: string; // Link to LedgerAccount.id
  miti: Timestamp; // Date of transaction
  nepaliMiti?: string;
  description: string;
  debit: number;
  credit: number;
  balanceAfterTransaction?: number; // Running balance after this specific entry in sequence for that account
  referenceNo?: string; // e.g., Bilti.id, GoodsDelivery.id, Cheque No.
  transactionType: LedgerTransactionType;
  status: "Pending" | "Approved" | "Rejected"; // For manual entries/vouchers needing approval
  approvalRemarks?: string;
  approvedBy?: string; // User.uid
  approvedAt?: Timestamp;
  sourceModule?: "Bilti" | "GoodsDelivery" | "GoodsReceipt" | "Manual" | "Payment" | string;
  branchId?: string; // Branch associated with this transaction, if applicable
}

// --- Settings / Configurations ---
interface AuditableConfigBase { // Renamed from AuditableConfig to avoid conflict, and made fields optional for base
  createdBy?: string;
  createdAt?: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

export interface DocumentNumberingConfig extends AuditableConfigBase {
  id: string; // Document ID
  documentType: string;
  prefix?: string;
  suffix?: string;
  startingNumber: number;
  lastGeneratedNumber: number;
  minLength?: number;
  perBranch: boolean;
}

export interface NarrationTemplate extends AuditableConfigBase {
  id: string; // Document ID
  title: string;
  template: string;
  applicableTo?: string[];
}

export interface InvoiceLineCustomization extends AuditableConfigBase {
  id: string; // Document ID
  fieldName: string;
  label: string;
  type: "Text" | "Number" | "Currency" | "Percentage" | "Date" | "Textarea" | "Boolean" | "Select";
  options?: string[];
  required: boolean;
  order: number;
  defaultValue?: string | number | boolean;
  isEnabled: boolean;
}

// Location and Unit Types with Auditing
// Combined Auditable fields for consistency
interface AuditableEntity { // This was already defined, I'll keep it
    id: string;
    createdBy: string;
    createdAt: Timestamp;
    updatedBy?: string;
    updatedAt?: Timestamp;
}

export interface Country extends AuditableEntity {
  name: string;
  code: string;
}
export interface State extends AuditableEntity {
  name: string;
  countryId: string; // Link to Country.id
}
export interface City extends AuditableEntity {
  name: string;
  stateId: string; // Link to State.id
}
export interface Unit extends AuditableEntity {
  name: string;
  symbol: string;
  type: "Weight" | "Distance" | "Volume" | "Other";
}