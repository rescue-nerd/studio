
import type { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string; // Firebase Auth UID
  email: string | null; // Can be null if using anonymous auth or phone
  displayName?: string | null;
  role: "superAdmin" | "manager" | "operator" | string; // string for potential custom roles
  assignedBranchIds: string[];
  createdAt: Timestamp;
  lastLoginAt?: Timestamp;
}

export interface Branch {
  id: string; // Document ID
  name: string;
  location: string;
  managerName?: string | null;
  managerUserId?: string; // Link to User.uid
  contactEmail?: string;
  contactPhone?: string;
  status?: "Active" | "Inactive"; // Added this field
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface Party {
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
  createdBy: string; // User.uid
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface Truck {
  id: string; // Document ID
  truckNo: string;
  type: string; // e.g., "6-Wheeler", "10-Wheeler", "Trailer"
  capacity: string; // e.g., "10 Ton", "15 CBM"
  ownerName: string;
  ownerPAN?: string;
  status: "Active" | "Inactive" | "Maintenance";
  assignedLedgerId: string; // Link to LedgerAccount.id
  createdBy: string; // User.uid
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface Driver {
  id: string; // Document ID
  name: string;
  licenseNo: string;
  contactNo: string;
  address?: string;
  joiningDate?: Timestamp;
  status: "Active" | "Inactive" | "On Leave";
  assignedLedgerId: string; // Link to LedgerAccount.id
  createdBy: string; // User.uid
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface Godown {
  id: string; // Document ID
  name: string;
  branchId: string; // Link to Branch.id
  location: string;
  status: "Active" | "Inactive";
  createdBy: string; // User.uid
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface Bilti {
  id: string; // Document ID (Bilti No.)
  miti: Timestamp; // Date of Bilti
  nepaliMiti?: string; // Added for Bikram Sambat date
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
  createdBy: string; // User.uid
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface Manifest {
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
  createdBy: string; // User.uid
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface GoodsReceipt {
  id: string; // Document ID (GRN No.)
  miti: Timestamp; // Date of Receipt
  nepaliMiti?: string;
  manifestId: string; // Link to Manifest.id
  receivingBranchId: string; // Link to Branch.id
  receivingGodownId?: string; // Link to Godown.id (optional)
  remarks?: string;
  shortages?: string; // Details of any shortages
  damages?: string; // Details of any damages
  receivedBy: string; // User.uid
  createdBy: string; // User.uid
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface DeliveredBiltiItem {
  biltiId: string; // Link to Bilti.id
  rebateAmount: number;
  rebateReason?: string;
  discountAmount: number;
  discountReason?: string;
}

export interface GoodsDelivery {
  id: string; // Document ID (Delivery Note No.)
  miti: Timestamp; // Date of Delivery
  nepaliMiti?: string;
  deliveredBiltis: DeliveredBiltiItem[];
  overallRemarks?: string;
  deliveredToName?: string; // Name of person receiving
  deliveredToContact?: string; // Contact of person receiving
  createdBy: string; // User.uid
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface LedgerAccount {
  id: string; // Document ID (often same as accountId for simplicity)
  accountId: string; // The ID of the entity this ledger belongs to (e.g., Party.id, Truck.id)
  accountName: string; // Name of the party, truck no., driver name
  accountType: "Party" | "Truck" | "Driver" | "Branch" | "Expense" | "Income" | "Bank" | "Cash" | string;
  currentBalance: number; // Denormalized; should be updated by backend functions
  panNo?: string; // If Party
  truckNo?: string; // If Truck
  lastTransactionAt?: Timestamp;
  createdAt: Timestamp;
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
  | string; // Allow for future custom types

export interface LedgerEntry {
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
  createdBy: string; // User.uid
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  sourceModule?: "Bilti" | "GoodsDelivery" | "GoodsReceipt" | "Manual" | "Payment" | string;
  branchId?: string; // Branch associated with this transaction, if applicable
}

// --- Settings / Configurations ---

export interface DocumentNumberingConfig {
  id: string; // e.g., "bilti", "manifest"
  documentType: string; // User-friendly name like "Bilti", "Manifest"
  prefix?: string;
  suffix?: string;
  startingNumber: number;
  lastGeneratedNumber: number; // Current counter
  minLength?: number; // e.g., 5 means INV-00001
  perBranch: boolean;
  // If perBranch, configurations might be nested under branchId or have branch-specific records
  // For a global config, perBranch would be false.
  // For branch-specific, you might have an array of these within a branch document,
  // or a separate collection like `branchDocumentNumberingConfigs`
}

export interface NarrationTemplate {
  id: string; // Document ID
  title: string;
  template: string; // e.g., "Being freight charges for {{biltiNo}} from {{origin}} to {{destination}}."
  applicableTo?: string[]; // e.g., ["Bilti", "Invoice"]
  createdBy: string; // User.uid
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface InvoiceLineCustomization {
  id: string; // Document ID
  fieldName: string; // e.g., "itemSKU", "discountPercentage"
  label: string; // User-friendly label
  type: "Text" | "Number" | "Currency" | "Percentage" | "Date" | "Textarea" | "Boolean" | "Select";
  options?: string[]; // For "Select" type
  required: boolean;
  order: number; // Display order
  defaultValue?: string | number | boolean;
  isEnabled: boolean;
  createdBy: string; // User.uid
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// General Audit fields can be in an interface and extended
export interface Auditable {
  createdBy: string; // User.uid
  createdAt: Timestamp;
  updatedBy?: string; // User.uid
  updatedAt?: Timestamp;
}

    
