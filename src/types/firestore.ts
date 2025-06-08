import type { Bilti, DaybookTransaction } from "@/types/supabase";

// Placeholder Account IDs - In a real app, these would come from config/settings
export const PLACEHOLDER_FREIGHT_INCOME_ACCOUNT_ID = "ACC_FREIGHT_INCOME";
export const PLACEHOLDER_REBATE_EXPENSE_ACCOUNT_ID = "ACC_REBATE_EXPENSE";
export const PLACEHOLDER_DISCOUNT_EXPENSE_ACCOUNT_ID = "ACC_DISCOUNT_EXPENSE";
export const PLACEHOLDER_CASH_ACCOUNT_ID = "ACC_CASH_MAIN"; // General cash account


export interface User {
  id: string; // Document ID
  uid: string; // Firebase Auth UID
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
  managerUserId?: string | null; // User.uid
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
  assignedLedgerId: string; // Link to LedgerAccount.id
  status: "Active" | "Inactive";
}

export interface Truck extends Auditable {
  id: string;
  truckNo: string;
  type: string; // e.g., "6-Wheeler", "10-Wheeler"
  capacity?: string; // e.g., "10 Ton", "16000 Ltrs"
  ownerName: string;
  ownerPAN?: string;
  status: "Active" | "Inactive" | "Maintenance";
  assignedLedgerId: string; // Link to LedgerAccount.id
}

export interface Driver extends Auditable {
  id: string;
  name: string;
  licenseNo: string;
  contactNo: string;
  address?: string;
  joiningDate?: Timestamp;
  status: "Active" | "Inactive" | "On Leave";
  assignedLedgerId: string; // Link to LedgerAccount.id
}

export interface Godown extends Auditable {
  id: string;
  name: string;
  branchId: string; // Link to Branch.id
  location: string;
  status: "Active" | "Inactive" | "Operational";
}

export interface Bilti extends Auditable {
  id: string;
  miti: Timestamp; // AD Date of Bilti
  nepaliMiti?: string; // BS Date of Bilti
  consignorId: string; // Link to Party.id
  consigneeId: string; // Link to Party.id
  origin: string; // City name or Godown name
  destination: string; // City name or Godown name
  description: string; // Description of goods
  packages: number;
  weight?: number; // Optional weight in kg
  rate: number; // Rate per package or per weight unit
  totalAmount: number; // Calculated: packages * rate (or based on weight)
  payMode: "Paid" | "To Pay" | "Due";
  status: "Pending" | "Manifested" | "Received" | "Delivered" | "Paid" | "Cancelled";
  manifestId?: string | null; // Link to Manifest.id if manifested
  goodsDeliveryNoteId?: string | null; // Link to GoodsDelivery.id if delivered
  cashCollectionStatus?: "Pending" | "Partial" | "Collected";
  deliveryExpenses?: Array<{
    daybookTransactionId: string; // Link to DaybookTransaction.id
    amount: number;
    description: string;
    miti: Timestamp; // Miti of the expense
  }>;
  daybookCashInRef?: string | null; // Link to DaybookTransaction.id if cash collected via daybook
  truckId: string; // Link to Truck.id
  driverId: string; // Link to Driver.id
  ledgerProcessed?: boolean; // Flag to prevent double posting to ledger
  branchId?: string; // Branch where the Bilti was created
}

export interface Manifest extends Auditable {
  id: string;
  miti: Timestamp; // AD Date of Manifest
  nepaliMiti?: string; // BS Date of Manifest
  truckId: string; // Link to Truck.id
  driverId: string; // Link to Driver.id
  fromBranchId: string; // Link to Branch.id
  toBranchId: string; // Link to Branch.id
  attachedBiltiIds: string[]; // Array of Bilti.id
  remarks?: string;
  status: "Open" | "In Transit" | "Received" | "Completed" | "Cancelled"; // "Received" means goods at destination branch/godown
  goodsReceiptId?: string | null; // Link to GoodsReceipt.id when received
}

export interface GoodsReceipt extends Auditable {
  id: string;
  miti: Timestamp; // AD Date of Receipt
  nepaliMiti?: string; // BS Date of Receipt
  manifestId: string; // Link to Manifest.id
  receivingBranchId: string; // Link to Branch.id
  receivingGodownId?: string; // Optional: Link to Godown.id if received at specific godown
  remarks?: string;
  shortages?: string; // Description of any shortages
  damages?: string; // Description of any damages
}

export interface DeliveredBiltiItem {
  biltiId: string;
  biltiData?: Bilti; // For UI display only, not stored in GoodsDelivery's Firestore sub-object
  rebateAmount: number;
  rebateReason: string; // Required if rebateAmount > 0
  discountAmount: number;
  discountReason: string; // Required if discountAmount > 0
}

export interface GoodsDelivery extends Auditable {
  id: string;
  miti: Timestamp; // AD Date of Delivery
  nepaliMiti?: string; // BS Date of Delivery
  deliveredBiltis: DeliveredBiltiItem[]; // Array of items delivered
  overallRemarks?: string;
  deliveredToName?: string; // Name of person who received the goods
  deliveredToContact?: string; // Contact of person who received
  ledgerProcessed?: boolean; // Flag to prevent double posting of rebates/discounts
  branchId?: string; // Branch from which delivery was made or recorded
}

export interface LedgerAccount extends Auditable {
  id: string; // Firestore Document ID
  accountId: string; // Custom/User-defined Account ID or Same as Firestore ID if preferred
  accountName: string;
  accountType: "Party" | "Truck" | "Driver" | "Branch" | "Expense" | "Income" | "Bank" | "Cash" | string;
  // `currentBalance` is often calculated on read. Storing it requires careful transactional updates.
  currentBalance: number;
  panNo?: string; // If party or own-truck account
  truckNo?: string; // If truck account
  lastTransactionAt?: Timestamp;
}

export type LedgerTransactionType =
  | "Bilti"
  | "Delivery" // Could represent revenue from delivery or an expense associated with it
  | "Rebate"
  | "Discount"
  | "Manual Credit"
  | "Manual Debit"
  | "Opening Balance"
  | "Payment" // Payment made
  | "Receipt" // Payment received
  | "Expense" // General expense
  | "Fuel"
  | "Maintenance"
  | "DaybookCashIn"
  | "DaybookCashOut"
  | string; // For custom types

export interface LedgerEntry extends Auditable {
  id: string;
  accountId: string; // Link to LedgerAccount.id
  miti: Timestamp; // AD Date of transaction
  nepaliMiti?: string; // BS Date of transaction
  description: string;
  debit: number;
  credit: number;
  balanceAfterTransaction?: number; // Calculated for display, not reliably stored unless via triggers
  referenceNo?: string; // e.g., Bilti ID, Bill No, Voucher No.
  transactionType: LedgerTransactionType;
  status: "Pending" | "Approved" | "Rejected"; // Especially for manual entries or those needing review
  approvalRemarks?: string;
  approvedBy?: string; // User.uid
  approvedAt?: Timestamp;
  sourceModule?: "Bilti" | "GoodsDelivery" | "GoodsReceipt" | "Manual" | "Payment" | "Daybook" | string;
  branchId?: string; // Link to Branch.id for branch-specific accounting
}


interface AuditableConfig extends Auditable {} // Config items can also be auditable

export interface DocumentNumberingConfig extends AuditableConfig {
  id: string;
  documentType: string; // e.g., "Invoice", "Manifest", "Bilti"
  prefix?: string;
  suffix?: string;
  startingNumber: number;
  lastGeneratedNumber: number; // The actual last number generated and stored
  minLength?: number; // Padded with zeros if current number is shorter
  perBranch: boolean;
  branchId?: string; // If perBranch is true, this specifies the branch
}

export interface NarrationTemplate extends AuditableConfig {
  id: string;
  title: string;
  template: string; // e.g., "Freight charges for Bilti No. {{biltiNo}} from {{origin}} to {{destination}}"
  applicableTo?: string[]; // e.g., ["Bilti", "Invoice"]
}

export type InvoiceLineType = "Text" | "Number" | "Currency" | "Percentage" | "Date" | "Textarea" | "Boolean" | "Select";

export interface InvoiceLineCustomization extends AuditableConfig {
  id: string;
  label: string; // Display label for the field
  fieldName: string; // Internal field name (e.g., "item_description", "quantity")
  type: InvoiceLineType;
  options?: string[]; // For "Select" type, comma-separated values
  required: boolean;
  order: number; // Display order in the line item form
  defaultValue?: string | number | boolean;
  isEnabled: boolean; // Whether this field is active
}

export interface Country extends Auditable {
  id: string;
  name: string;
  code: string; // e.g., "NP", "IN"
}

export interface State extends Auditable {
  id: string;
  name: string;
  countryId: string; // Link to Country.id
}

export interface City extends Auditable {
  id: string;
  name: string;
  stateId: string; // Link to State.id
}

export interface Unit extends Auditable {
  id: string;
  name: string; // e.g., "Kilogram", "Kilometer", "Liter"
  symbol: string; // e.g., "kg", "km", "L"
  type: "Weight" | "Distance" | "Volume" | "Other";
}


// --- Daybook Module ---
export type DaybookTransactionType =
  | "Cash In (from Delivery/Receipt)" // Cash received for a Bilti (To Pay/Due collection)
  | "Delivery Expense (Cash Out)"    // Expenses paid for a specific Bilti/Delivery
  | "Cash Out (to Expense/Supplier/Other)" // General cash out
  | "Cash In (Other)"                  // General cash in
  | "Cash In (from Party Payment)"     // Payment received from a party (not direct Bilti collection)
  | "Cash Out (to Driver/Staff, Petty Expense)" // Advances, salaries, petty cash
  | "Adjustment/Correction";           // For correcting previous entries

export interface DaybookTransaction {
  id: string; // Unique ID for the transaction within the daybook
  transactionType: DaybookTransactionType;
  amount: number; // Always positive. Type determines if it's in or out. For Adjustments, sign matters.
  debit?: number; // Optional, for direct mapping to ledger views. Calculated from amount & type.
  credit?: number; // Optional, for direct mapping to ledger views. Calculated from amount & type.
  referenceId?: string; // e.g., Bilti ID, Expense Voucher ID, Party ID for payment
  partyId?: string; // Link to Party.id for party payments or collections
  ledgerAccountId?: string; // Main ledger account affected OTHER than the cash account (e.g., specific expense head, party ledger)
  expenseHead?: string; // Specific for expenses, can be more granular than ledgerAccountId
  description: string; // Narration for the transaction
  supportingDocUrl?: string; // Link to scanned bill/voucher
  autoLinked: boolean; // True if system automatically created this from another module (e.g., Bilti cash collection)
  reasonForAdjustment?: string; // For "Adjustment/Correction" type
  createdBy: string; // User.uid who added this transaction
  createdAt: Timestamp; // Timestamp when this transaction was added
  nepaliMiti?: string; // Optional BS date for this specific transaction if different from Daybook's
}

export interface FirestoreDaybook extends Auditable {
  // `id` is implicit from Firestore document ID
  branchId: string; // Link to Branch.id
  nepaliMiti: string; // BS Date for which the daybook is made
  englishMiti: Timestamp; // AD Date corresponding to nepaliMiti
  openingBalance: number; // Cash balance at the start of the day
  totalCashIn: number; // Calculated sum of all cash in transactions
  totalCashOut: number; // Calculated sum of all cash out transactions
  closingBalance: number; // Calculated: openingBalance + totalCashIn - totalCashOut
  status: "Draft" | "Pending Approval" | "Approved" | "Rejected";
  transactions: DaybookTransaction[]; // Array of transactions for the day
  processingTimestamp?: Timestamp; // When the function last processed/updated totals
  submittedBy?: string; // User.uid who submitted for approval
  submittedAt?: Timestamp;
  approvedBy?: string; // User.uid who approved/rejected
  approvalRemarks?: string; // Remarks from approver/rejector
  // createdBy, createdAt, updatedBy, updatedAt inherited from Auditable
}

// Cloud Function Request/Response Types
export interface CloudFunctionResponse {
  success: boolean;
  id?: string;
  message: string;
}

// Goods Receipt Cloud Function Types
export interface GoodsReceiptCreateRequest {
  miti: string; // ISO date string
  nepaliMiti?: string;
  manifestId: string;
  receivingBranchId: string;
  receivingGodownId?: string;
  remarks?: string;
  shortages?: string;
  damages?: string;
}

export interface GoodsReceiptUpdateRequest {
  receiptId: string;
  miti?: string; // ISO date string
  nepaliMiti?: string;
  manifestId?: string;
  receivingBranchId?: string;
  receivingGodownId?: string;
  remarks?: string;
  shortages?: string;
  damages?: string;
}

export interface GoodsReceiptDeleteRequest {
  receiptId: string;
}

// Goods Delivery Cloud Function Types
export interface GoodsDeliveryCreateRequest {
  miti: string; // ISO date string
  nepaliMiti?: string;
  deliveredBiltis: DeliveredBiltiItem[];
  overallRemarks?: string;
  deliveredToName?: string;
  deliveredToContact?: string;
}

export interface GoodsDeliveryUpdateRequest {
  deliveryId: string;
  miti?: string; // ISO date string
  nepaliMiti?: string;
  deliveredBiltis?: DeliveredBiltiItem[];
  overallRemarks?: string;
  deliveredToName?: string;
  deliveredToContact?: string;
}

export interface GoodsDeliveryDeleteRequest {
  deliveryId: string;
}

// Ledger Cloud Function Types
export interface LedgerEntryCreateRequest {
  accountId: string;
  miti: string; // ISO date string
  nepaliMiti?: string;
  description: string;
  debit: number;
  credit: number;
  referenceNo?: string;
  transactionType: LedgerTransactionType;
}

export interface LedgerEntryUpdateStatusRequest {
  entryId: string;
  status: "Approved" | "Rejected";
  approvalRemarks?: string;
}

// Daybook Transaction Cloud Function Types
export interface DaybookTransactionCreateRequest {
  daybookId: string;
  transactionId?: string; // For updates, if not provided a new ID will be generated
  transactionType: DaybookTransactionType;
  amount: number;
  description: string;
  ledgerAccountId?: string;
  partyId?: string;
  referenceId?: string;
  nepaliMiti?: string;
}

export interface DaybookTransactionDeleteRequest {
  daybookId: string;
  transactionId: string;
}