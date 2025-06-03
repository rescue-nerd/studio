
import type { Timestamp } from 'firebase/firestore';

// Placeholder Account IDs - In a real app, these would come from config/settings
export const PLACEHOLDER_FREIGHT_INCOME_ACCOUNT_ID = "ACC_FREIGHT_INCOME";
export const PLACEHOLDER_REBATE_EXPENSE_ACCOUNT_ID = "ACC_REBATE_EXPENSE";
export const PLACEHOLDER_DISCOUNT_EXPENSE_ACCOUNT_ID = "ACC_DISCOUNT_EXPENSE";
export const PLACEHOLDER_CASH_ACCOUNT_ID = "ACC_CASH_MAIN"; // General cash account


export interface User {
  uid: string; // Firebase Auth UID - This should be the document ID in 'users' collection
  email: string | null;
  displayName?: string | null;
  role: "superAdmin" | "manager" | "operator" | string;
  assignedBranchIds: string[];
  createdAt: Timestamp;
  lastLoginAt?: Timestamp;
  enableEmailNotifications?: boolean;
  darkModeEnabled?: boolean;
  autoDataSyncEnabled?: boolean;
  updatedAt?: Timestamp;
  status?: "active" | "disabled";
}

interface Auditable {
  createdBy: string; // User.uid
  createdAt: Timestamp;
  updatedBy?: string; // User.uid
  updatedAt?: Timestamp;
}

export interface Branch extends Auditable {
  id: string;
  name: string;
  location: string;
  managerName?: string | null;
  managerUserId?: string;
  contactEmail?: string;
  contactPhone?: string;
  status?: "Active" | "Inactive";
}

export interface Party extends Auditable {
  id: string;
  name: string;
  type: "Consignor" | "Consignee" | "Both";
  contactNo: string;
  panNo?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  assignedLedgerId: string;
  status: "Active" | "Inactive";
}

export interface Truck extends Auditable {
  id: string;
  truckNo: string;
  type: string;
  capacity?: string;
  ownerName: string;
  ownerPAN?: string;
  status: "Active" | "Inactive" | "Maintenance";
  assignedLedgerId: string;
}

export interface Driver extends Auditable {
  id: string;
  name: string;
  licenseNo: string;
  contactNo: string;
  address?: string;
  joiningDate?: Timestamp;
  status: "Active" | "Inactive" | "On Leave";
  assignedLedgerId: string;
}

export interface Godown extends Auditable {
  id: string;
  name: string;
  branchId: string;
  location: string;
  status: "Active" | "Inactive" | "Operational";
}

export interface Bilti extends Auditable {
  id: string;
  miti: Timestamp;
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
  deliveryExpenses?: Array<{
    daybookTransactionId: string;
    amount: number;
    description: string;
    miti: Timestamp;
  }>;
  daybookCashInRef?: string | null;
  truckId: string;
  driverId: string;
  ledgerProcessed?: boolean; // To prevent double posting
}

export interface Manifest extends Auditable {
  id: string;
  miti: Timestamp;
  nepaliMiti?: string;
  truckId: string;
  driverId: string;
  fromBranchId: string;
  toBranchId: string;
  attachedBiltiIds: string[];
  remarks?: string;
  status: "Open" | "In Transit" | "Completed" | "Cancelled" | "Received";
  goodsReceiptId?: string | null;
}

export interface GoodsReceipt extends Auditable {
  id: string;
  miti: Timestamp;
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
  biltiData?: Bilti; // UI only, not stored in Firestore GoodsDelivery directly
  rebateAmount: number;
  rebateReason: string;
  discountAmount: number;
  discountReason: string;
}

export interface GoodsDelivery extends Auditable {
  id: string;
  miti: Timestamp;
  nepaliMiti?: string;
  deliveredBiltis: DeliveredBiltiItem[];
  overallRemarks?: string;
  deliveredToName?: string;
  deliveredToContact?: string;
  ledgerProcessed?: boolean; // To prevent double posting
}

export interface LedgerAccount extends Auditable {
  id: string; // Firestore Document ID
  accountId: string; // Custom/User-defined Account ID or Same as Firestore ID
  accountName: string;
  accountType: "Party" | "Truck" | "Driver" | "Branch" | "Expense" | "Income" | "Bank" | "Cash" | string;
  currentBalance: number;
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
  | "DaybookCashIn"
  | "DaybookCashOut"
  | string;

export interface LedgerEntry extends Auditable {
  id: string;
  accountId: string;
  miti: Timestamp;
  nepaliMiti?: string;
  description: string;
  debit: number;
  credit: number;
  balanceAfterTransaction?: number; // This is typically calculated, not stored, or updated via triggers
  referenceNo?: string;
  transactionType: LedgerTransactionType;
  status: "Pending" | "Approved" | "Rejected"; // For manual entries or entries requiring approval
  approvalRemarks?: string;
  approvedBy?: string; // User.uid
  approvedAt?: Timestamp;
  sourceModule?: "Bilti" | "GoodsDelivery" | "GoodsReceipt" | "Manual" | "Payment" | "Daybook" | string;
  branchId?: string; // Link to Branch.id
}

interface AuditableConfig extends Auditable {}

export interface DocumentNumberingConfig extends AuditableConfig {
  id: string;
  documentType: string;
  prefix?: string;
  suffix?: string;
  startingNumber: number;
  lastGeneratedNumber: number;
  minLength?: number;
  perBranch: boolean;
  branchId?: string;
}

export interface NarrationTemplate extends AuditableConfig {
  id: string;
  title: string;
  template: string;
  applicableTo?: string[];
}

export type InvoiceLineType = "Text" | "Number" | "Currency" | "Percentage" | "Date" | "Textarea" | "Boolean" | "Select";

export interface InvoiceLineCustomization extends AuditableConfig {
  id: string;
  label: string;
  fieldName: string;
  type: InvoiceLineType;
  options?: string[];
  required: boolean;
  order: number;
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
  name: string;
  symbol: string;
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
  id: string;
  transactionType: DaybookTransactionType;
  amount: number;
  debit?: number; // For consistency if directly mapping to ledger thinking
  credit?: number; // For consistency
  referenceId?: string; // e.g., Bilti ID, Expense Voucher ID
  partyId?: string;
  ledgerAccountId?: string; // Primary ledger affected other than cash
  expenseHead?: string; // Specific for expenses
  description: string;
  supportingDocUrl?: string;
  autoLinked: boolean; // If system automatically created this from another module
  reasonForAdjustment?: string; // For "Adjustment/Correction" type
  createdBy: string; // User.uid
  createdAt: Timestamp;
  nepaliMiti?: string;
}

export interface FirestoreDaybook extends Auditable { // Extends Auditable now
  // id implicitly from document
  branchId: string;
  nepaliMiti: string;
  englishMiti: Timestamp;
  openingBalance: number;
  totalCashIn: number;
  totalCashOut: number;
  closingBalance: number;
  status: "Draft" | "Pending Approval" | "Approved" | "Rejected";
  transactions: DaybookTransaction[];
  processingTimestamp?: Timestamp;
  submittedBy?: string; // User.uid
  submittedAt?: Timestamp;
  approvedBy?: string; // User.uid
  approvalRemarks?: string;
  // createdBy, createdAt, updatedBy, updatedAt inherited from Auditable
}
