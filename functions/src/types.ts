import type {Timestamp} from "firebase-admin/firestore"; // Use admin SDK Timestamp for functions

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
  overallRemarks?: string;
  deliveredToName?: string;
  deliveredToContact?: string;
  ledgerProcessed?: boolean;
  createdBy?: string;
  createdAt?: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

export interface GoodsReceiptData {
  id?: string;
  miti: Timestamp;
  nepaliMiti?: string;
  manifestId: string;
  receivingBranchId: string;
  receivingGodownId?: string;
  remarks?: string;
  shortages?: string;
  damages?: string;
  createdBy?: string;
  createdAt?: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
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
  approvedBy?: string;
  approvedAt?: Timestamp;
  approvalRemarks?: string;
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

// Callable Data Interfaces for HTTPS Callable Functions
// These are sent from client to functions (miti as string)

export interface GoodsReceiptCallableData extends Omit<GoodsReceiptData, "id" | "miti" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy"> {
  miti: string;
}

export interface GoodsDeliveryCallableData extends Omit<GoodsDeliveryData, "id" | "miti" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy" | "ledgerProcessed"> {
  miti: string;
}

// Optional: Update/Delete payload types for clarity
export interface UpdateGoodsReceiptPayload extends Partial<GoodsReceiptCallableData> {
  receiptId: string;
}

export interface DeleteGoodsReceiptPayload {
  receiptId: string;
}

export interface UpdateGoodsDeliveryPayload extends Partial<GoodsDeliveryCallableData> {
  deliveryId: string;
}

export interface DeleteGoodsDeliveryPayload {
  deliveryId: string;
}

// Ledger Cloud Function Types
export interface LedgerEntryCallableData extends Omit<LedgerEntryData, "id" | "miti" | "createdAt" | "createdBy" | "status"> {
  miti: string; // Client sends as string
  accountId: string;
}

export interface UpdateLedgerEntryStatusPayload {
  entryId: string;
  status: "Approved" | "Rejected";
  approvalRemarks?: string;
}

// Daybook Transaction Cloud Function Types
export interface DaybookTransactionCallableData extends Omit<DaybookTransaction, "id" | "createdAt"> {
  daybookId: string;
  transactionId?: string; // For updates, if not provided a new ID will be generated
}

export interface DeleteDaybookTransactionPayload {
  daybookId: string;
  transactionId: string;
}

// User Management Function Types
export interface UpdateUserProfilePayload {
  uid: string;
  displayName?: string;
  email?: string;
  role?: string;
  status?: "active" | "disabled";
  enableEmailNotifications?: boolean;
  darkModeEnabled?: boolean;
  autoDataSyncEnabled?: boolean;
}

export interface UpdateUserBranchAssignmentsPayload {
  uid: string;
  assignedBranchIds: string[];
}

// Content Customization Function Types
export interface InvoiceLineCustomizationData {
  id?: string;
  label: string;
  fieldName: string;
  type: "Text" | "Number" | "Currency" | "Percentage" | "Date" | "Textarea" | "Boolean" | "Select";
  options?: string[];
  required: boolean;
  order: number;
  defaultValue?: string | number | boolean;
  isEnabled: boolean;
  createdBy?: string;
  createdAt?: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

export interface CreateInvoiceLineCustomizationPayload extends Omit<InvoiceLineCustomizationData, "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy"> {}

export interface UpdateInvoiceLineCustomizationPayload extends Partial<CreateInvoiceLineCustomizationPayload> {
  customizationId: string;
}

export interface DeleteInvoiceLineCustomizationPayload {
  customizationId: string;
}

// Narration Template Function Types
export interface NarrationTemplateData {
  id?: string;
  templateName: string;
  templateText: string;
  category: "bilti" | "delivery" | "payment" | "expense" | "general";
  isActive: boolean;
  createdBy?: string;
  createdAt?: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

export interface CreateNarrationTemplatePayload extends Omit<NarrationTemplateData, "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy"> {}

export interface UpdateNarrationTemplatePayload extends Partial<CreateNarrationTemplatePayload> {
  templateId: string;
}

export interface DeleteNarrationTemplatePayload {
  templateId: string;
}

// Document Numbering Function Types
export interface DocumentNumberingConfigData {
  id?: string;
  documentType: "bilti" | "manifest" | "invoice" | "receipt" | "delivery";
  prefix: string;
  suffix?: string;
  startingNumber: number;
  currentNumber: number;
  digitPadding: number;
  resetFrequency: "none" | "daily" | "monthly" | "yearly";
  isActive: boolean;
  branchId?: string; // For branch-specific numbering
  createdBy?: string;
  createdAt?: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

export interface CreateDocumentNumberingConfigPayload extends Omit<DocumentNumberingConfigData, "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy"> {}

export interface UpdateDocumentNumberingConfigPayload extends Partial<CreateDocumentNumberingConfigPayload> {
  configId: string;
}

export interface DeleteDocumentNumberingConfigPayload {
  configId: string;
}

export interface GenerateNextDocumentNumberPayload {
  documentType: "bilti" | "manifest" | "invoice" | "receipt" | "delivery";
  branchId?: string;
}

export interface GenerateNextDocumentNumberResult {
  nextNumber: string;
  configId: string;
}

// Daybook Function Types
export interface CreateDaybookPayload {
  branchId: string;
  nepaliMiti: string;
  englishMiti: string; // ISO date string
  openingBalance?: number;
}

export interface DaybookCreateResponse {
  success: boolean;
  id: string;
  message: string;
}
