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
  id?: string; // Firestore document ID
  truckNo: string;
  type: string; // e.g., "6-Wheeler", "10-Wheeler"
  capacity?: string; // e.g., "10 Ton", "16000 Ltrs"
  ownerName: string;
  ownerPAN?: string;
  status: "Active" | "Inactive" | "Maintenance";
  assignedLedgerId: string; // Link to LedgerAccount.id
  // Auditable fields
  createdBy?: string;
  createdAt?: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
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

// Additional Function Types for Document Numbering, Invoice Customization, etc.

export interface DocumentNumberingConfigData {
  id?: string;
  documentType: "bilti" | "manifest" | "invoice" | "receipt" | "delivery";
  prefix: string;
  suffix?: string;
  startingNumber: number;
  currentNumber: number;
  branchSpecific: boolean;
  branchId?: string;
  isActive: boolean;
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

export interface InvoiceLineCustomizationData {
  id?: string;
  lineType: "header" | "item" | "footer";
  label: string;
  isRequired: boolean;
  fieldType: "text" | "number" | "select" | "textarea";
  selectOptions?: string[];
  defaultValue?: string;
  displayOrder: number;
  isActive: boolean;
  branchId?: string;
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

export interface NarrationTemplateData {
  id?: string;
  templateName: string;
  narrationText: string;
  category: "income" | "expense" | "transfer" | "adjustment";
  placeholders: string[];
  isActive: boolean;
  branchId?: string;
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

export interface ManifestData {
  id?: string;
  manifestNo: string;
  miti: Timestamp;
  nepaliMiti?: string;
  truckId: string;
  driverId: string;
  origin: string;
  destination: string;
  biltiIds: string[];
  attachedBiltiIds: string[]; // Alternative name for biltiIds used in some functions
  fromBranchId: string;
  toBranchId: string;
  status: "Draft" | "Open" | "In Transit" | "Delivered" | "Cancelled";
  departureDateTime?: Timestamp;
  arrivalDateTime?: Timestamp;
  totalWeight?: number;
  totalPackages: number;
  totalAmount: number;
  remarks?: string;
  ledgerProcessed?: boolean;
  branchId?: string;
  createdBy?: string;
  createdAt?: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

export interface LedgerEntryCallableData {
  ledgerAccountId: string;
  transactionType: LedgerTransactionType;
  amount: number;
  description: string;
  referenceType?: "bilti" | "manifest" | "receipt" | "payment" | "adjustment";
  referenceId?: string;
  nepaliMiti?: string;
  branchId?: string;
}

export interface UpdateLedgerEntryStatusPayload {
  entryId: string;
  status: "pending" | "approved" | "rejected";
  remarks?: string;
}

export interface DaybookTransactionCallableData extends Omit<DaybookTransaction, "id" | "createdAt"> {
  nepaliMiti: string;
}

export interface DeleteDaybookTransactionPayload {
  daybookId: string;
  transactionId: string;
}

export interface UpdateUserProfilePayload {
  userId: string;
  displayName?: string;
  email?: string;
  role?: string;
  status?: "active" | "disabled";
}

export interface UpdateUserBranchAssignmentsPayload {
  userId: string;
  assignedBranchIds: string[];
}
