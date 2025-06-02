
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
  updatedBy?: string;
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
  updatedBy?: string;
}

export interface Godown extends Auditable {
  id: string; // Document ID
  name: string;
  branchId: string; // Link to Branch.id
  location: string;
  status: "Active" | "Inactive" | "Operational";
  updatedBy?: string;
}

export interface Bilti extends Auditable {
  id: string; // Document ID (Bilti No.)
  miti: Timestamp; // Date of Bilti
  nepaliMiti?: string;
  consignorId: string; // Link to Party.id
  consigneeId: string; // Link to Party.id
  origin: string;
  destination: string;
  description: string;
  packages: number;
  weight?: number;
  rate: number;
  totalAmount: number;
  payMode: "Paid" | "To Pay" | "Due";
  status: "Pending" | "Manifested" | "Received" | "Delivered" | "Paid" | "Cancelled";
  manifestId?: string;
  goodsDeliveryNoteId?: string;
  cashCollectionStatus?: "Pending" | "Partial" | "Collected"; // Enhanced for Daybook
  deliveryExpenses?: Array<{ // Enhanced for Daybook
    daybookTransactionId: string;
    amount: number;
    description: string;
    miti: Timestamp; // Could be Date of Daybook transaction or Bilti date
  }>;
  daybookCashInRef?: string; // Enhanced for Daybook: Reference to the Daybook transaction ID that collected cash
}

export interface Manifest extends Auditable {
  id: string; // Document ID (Manifest No.)
  miti: Timestamp; // Date of Manifest
  nepaliMiti?: string;
  truckId: string;
  driverId: string;
  fromBranchId: string;
  toBranchId: string;
  attachedBiltiIds: string[];
  remarks?: string;
  status: "Open" | "In Transit" | "Completed" | "Cancelled" | "Received";
  goodsReceiptId?: string;
}

export interface GoodsReceipt extends Auditable {
  id: string; // Document ID (GRN No.)
  miti: Timestamp; // Date of Receipt
  nepaliMiti?: string;
  manifestId: string;
  receivingBranchId: string;
  receivingGodownId?: string;
  remarks?: string;
  shortages?: string;
  damages?: string;
}

export interface DeliveredBiltiItem {
  biltiId: string;
  biltiData?: Bilti; // Note: This field is for UI convenience and might not be directly stored in Firestore like this in GoodsDelivery
  rebateAmount: number;
  rebateReason: string;
  discountAmount: number;
  discountReason: string;
}

export interface GoodsDelivery extends Auditable {
  id: string; // Document ID (Delivery Note No.)
  miti: Timestamp; // Date of Delivery
  nepaliMiti?: string;
  deliveredBiltis: DeliveredBiltiItem[]; // This structure might be simplified in Firestore to just IDs and rebate/discount info
  overallRemarks?: string;
  deliveredToName?: string;
  deliveredToContact?: string;
}

export interface LedgerAccount extends Auditable {
  id: string;
  accountId: string; // Often same as id, or a custom account code
  accountName: string;
  accountType: "Party" | "Truck" | "Driver" | "Branch" | "Expense" | "Income" | "Bank" | "Cash" | string;
  currentBalance: number; // This should ideally be updated by backend triggers for accuracy
  panNo?: string;
  truckNo?: string;
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
  | "DaybookCashIn" // For entries coming from Daybook approvals
  | "DaybookCashOut" // For entries coming from Daybook approvals
  | string;

export interface LedgerEntry extends Auditable {
  id: string;
  accountId: string;
  miti: Timestamp;
  nepaliMiti?: string;
  description: string;
  debit: number;
  credit: number;
  balanceAfterTransaction?: number; // Calculated at the time of entry, or dynamically
  referenceNo?: string; // e.g., Bilti ID, Manifest ID, Daybook Txn ID
  transactionType: LedgerTransactionType;
  status: "Pending" | "Approved" | "Rejected"; // Status for ledger entries themselves if they go through approval
  approvalRemarks?: string;
  approvedBy?: string;
  approvedAt?: Timestamp;
  sourceModule?: "Bilti" | "GoodsDelivery" | "GoodsReceipt" | "Manual" | "Payment" | "Daybook" | string;
  branchId?: string; // The branch this ledger entry is associated with
}

interface AuditableConfig extends Auditable {} // Base for config type documents

export interface DocumentNumberingConfig extends AuditableConfig {
  id: string;
  documentType: string; // e.g., "Bilti", "Manifest", "Daybook"
  prefix?: string;
  suffix?: string;
  startingNumber: number;
  lastGeneratedNumber: number;
  minLength?: number; // e.g., 5 for "00001"
  perBranch: boolean; // If true, numbering is unique per branch
  // For per-branch, might need a subcollection or map: branchNumbering: { branchId: lastNumber }
}

export interface NarrationTemplate extends AuditableConfig {
  id: string;
  title: string;
  template: string; // e.g., "Being freight charges for Bilti {{biltiNo}} to {{destination}}"
  applicableTo?: string[]; // e.g., ["Bilti", "Invoice"]
}

export interface InvoiceLineCustomization extends AuditableConfig {
  id: string;
  fieldName: string; // e.g., "item_sku", "custom_notes"
  label: string; // How it appears in UI
  type: "Text" | "Number" | "Currency" | "Percentage" | "Date" | "Textarea" | "Boolean" | "Select";
  options?: string[]; // For "Select" type
  required: boolean;
  order: number; // Display order
  defaultValue?: string | number | boolean;
  isEnabled: boolean;
}


export interface Country extends Auditable {
  id: string;
  name: string;
  code: string;
}
export interface State extends Auditable {
  id: string;
  name: string;
  countryId: string;
}
export interface City extends Auditable {
  id: string;
  name: string;
  stateId: string;
}
export interface Unit extends Auditable {
  id: string;
  name: string; // e.g., Kilogram, Kilometer, Liter
  symbol: string; // e.g., kg, km, L
  type: "Weight" | "Distance" | "Volume" | "Other";
}

// --- Daybook Module ---
export type DaybookTransactionType =
  | "Cash In (from Delivery/Receipt)"
  | "Delivery Expense (Cash Out)"
  | "Cash Out (to Expense/Supplier/Other)"
  | "Cash In (Other)"
  | "Cash Out (Other)"
  | "Cash In (from Party Payment)"
  | "Cash Out (to Driver/Staff, Petty Expense)"
  | "Adjustment/Correction";

export interface DaybookTransaction {
  id: string; // Local unique ID for the transaction within the daybook
  transactionType: DaybookTransactionType;
  amount: number;
  referenceId?: string; // Bilti.id or GoodsDelivery.id for delivery-linked transactions
  partyId?: string; // Link to Party.id (for 'Other Cash In', 'Expense/Supplier')
  ledgerAccountId?: string; // Link to LedgerAccount.id (e.g., for specific cash/bank ledger, or expense ledger)
  expenseHead?: string; // For "Cash Out (Expense/Supplier/Other)" or "Delivery Expense (Cash Out)" if not using detailed ledger
  description: string;
  supportingDocUrl?: string; // URL to Firebase Storage
  autoLinked: boolean; // True if transactionType is delivery-related and successfully linked
  reasonForAdjustment?: string; // Mandatory if transactionType is "Adjustment/Correction"
  createdBy: string; // User.uid
  createdAt: Timestamp;
}

export interface Daybook extends Auditable {
  id: string; // Firestore Document ID (e.g., branchId_nepaliMiti or auto-ID)
  branchId: string;
  nepaliMiti: string;
  englishMiti: Timestamp;
  openingBalance: number;
  totalCashIn: number; // Calculated based on transactions
  totalCashOut: number; // Calculated based on transactions
  closingBalance: number; // Calculated: openingBalance + totalCashIn - totalCashOut
  status: "Draft" | "Pending Approval" | "Approved" | "Rejected";
  transactions: DaybookTransaction[];
  submittedBy?: string;
  submittedAt?: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
  approvalRemarks?: string;
}
