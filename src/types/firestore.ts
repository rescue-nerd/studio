
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
  cashCollectionStatus?: "Pending" | "Partial" | "Collected";
  deliveryExpenses?: Array<{
    daybookTransactionId: string;
    amount: number;
    description: string;
    miti: Timestamp;
  }>;
  daybookCashInRef?: string;
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
  biltiData?: Bilti; 
  rebateAmount: number;
  rebateReason: string;
  discountAmount: number;
  discountReason: string;
}

export interface GoodsDelivery extends Auditable {
  id: string; // Document ID (Delivery Note No.)
  miti: Timestamp; // Date of Delivery
  nepaliMiti?: string;
  deliveredBiltis: DeliveredBiltiItem[]; 
  overallRemarks?: string;
  deliveredToName?: string;
  deliveredToContact?: string;
}

export interface LedgerAccount extends Auditable {
  id: string;
  accountId: string; 
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
  balanceAfterTransaction?: number; 
  referenceNo?: string; 
  transactionType: LedgerTransactionType;
  status: "Pending" | "Approved" | "Rejected"; 
  approvalRemarks?: string;
  approvedBy?: string;
  approvedAt?: Timestamp;
  sourceModule?: "Bilti" | "GoodsDelivery" | "GoodsReceipt" | "Manual" | "Payment" | "Daybook" | string;
  branchId?: string; 
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
}

export interface NarrationTemplate extends AuditableConfig {
  id: string;
  title: string;
  template: string; 
  applicableTo?: string[]; 
}

export interface InvoiceLineCustomization extends AuditableConfig {
  id: string;
  fieldName: string; 
  label: string; 
  type: "Text" | "Number" | "Currency" | "Percentage" | "Date" | "Textarea" | "Boolean" | "Select";
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
  referenceId?: string; 
  partyId?: string; 
  ledgerAccountId?: string; 
  expenseHead?: string; 
  description: string;
  supportingDocUrl?: string; 
  autoLinked: boolean; 
  reasonForAdjustment?: string; 
  createdBy: string; 
  createdAt: Timestamp;
}

export interface FirestoreDaybook extends Auditable {
  // id field will be the document ID from Firestore, not explicitly in the object here
  branchId: string;
  nepaliMiti: string;
  englishMiti: Timestamp;
  openingBalance: number;
  totalCashIn: number; 
  totalCashOut: number; 
  closingBalance: number; 
  status: "Draft" | "Pending Approval" | "Approved" | "Rejected";
  transactions: DaybookTransaction[];
  processingTimestamp?: Timestamp; // New field for default date and time stamp
  submittedBy?: string;
  submittedAt?: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
  approvalRemarks?: string;
}
