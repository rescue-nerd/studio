export type UserRole = 'super_admin' | 'admin' | 'manager' | 'operator';
export type UserStatus = 'active' | 'inactive' | 'disabled';
export type DocumentType = 'bilti' | 'manifest' | 'goods_receipt' | 'goods_delivery' | 'daybook';
export type CashCollectionStatus = 'pending' | 'collected' | 'partially_collected';

export interface User {
  id: string;
  email: string;
  displayName?: string;
  role: UserRole;
  assignedBranchIds: string[];
  enableEmailNotifications?: boolean;
  darkModeEnabled?: boolean;
  autoDataSyncEnabled?: boolean;
  status: UserStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface Branch {
  id: string;
  name: string;
  location: string; // Was address, changed to location as per SQL (text not null)
  branch_code: string | null;
  manager_name: string | null;
  manager_user_id: string | null;
  contact_email: string | null; // Was email
  contact_phone: string | null; // Was contact_no
  status: 'Active' | 'Inactive' | 'Deleted' | 'active' | 'inactive'; // Was is_active (boolean), changed to string status
  // Audit fields
  created_at: string;
  created_by: string;
  updated_at: string | null;
  updated_by: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface DocumentNumberingConfig {
  id: string;
  documentType: DocumentType;
  branchId: string;
  fiscalYear: string;
  prefix?: string;
  suffix?: string;
  lastNumber: number;
  createdAt: string;
  updatedAt?: string;
}

// NOTE: The original Daybook interface seemed to represent a single ledger entry.
// The daybook/page.tsx requires a structure representing a daily summary.
// If the old Daybook type is still used elsewhere, it should be renamed.
// For this refactor, we are defining Daybook as per daybook/page.tsx needs.

export type DaybookStatus = 'pending' | 'submitted' | 'approved' | 'rejected';

export interface Daybook {
  id: string;
  branch_id: string;
  nepali_miti: string; // YYYY-MM-DD
  english_miti: string; // ISO Date string
  opening_balance?: number;
  closing_balance?: number; // This is often calculated, might not be a direct DB field
  status: DaybookStatus;
  remarks?: string; // For rejection etc.
  created_by: string; // user_id
  created_at: string;
  updated_at?: string;
  submitted_at?: string;
  approved_at?: string;
  processing_timestamp?: string;
  transactions_json?: string; // For legacy or denormalized data
  // daybook_transactions is typically populated by a join in the query
}

export type DaybookTransactionType =
  | "Cash In (from Delivery/Receipt)"
  | "Delivery Expense (Cash Out)"
  | "Cash Out (to Expense/Supplier/Other)"
  | "Cash In (Other)"
  | "Cash In (from Party Payment)"
  | "Cash Out (to Driver/Staff, Petty Expense)"
  | "Adjustment/Correction";

export interface DaybookTransaction {
  id: string;
  daybook_id: string;
  transaction_type: DaybookTransactionType;
  amount: number;
  description?: string;
  nepali_miti: string; // YYYY-MM-DD, usually same as parent Daybook's nepali_miti
  reference_id?: string | null; // e.g., bilti_id
  party_id?: string | null;
  ledger_account_id: string; // Assumed mandatory
  auto_linked?: boolean;
  supporting_doc_url?: string | null;
  reason_for_adjustment?: string | null;
  created_by: string; // user_id
  created_at: string;
  updated_at?: string;
  updated_by?: string; // user_id
}

export interface LedgerAccount {
  id: string;
  account_name: string;
  account_code?: string;
  account_type: 'asset' | 'liability' | 'equity' | 'income' | 'expense' | 'bank' | 'cash' | string; // More specific types if available
  branch_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Bilti {
  id: string;
  branchId: string;
  documentNumber: string;
  date: string;
  consignorId: string;
  consigneeId: string;
  fromLocationId: string;
  toLocationId: string;
  goodsDescription: string;
  quantity: number;
  unitId: string;
  rate: number;
  amount: number;
  status: 'draft' | 'issued' | 'manifested' | 'delivered' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
}

export interface Manifest {
  id: string;
  branchId: string;
  documentNumber: string;
  date: string;
  truckId: string;
  driverId: string;
  fromLocationId: string;
  toLocationId: string;
  attachedBiltiIds: string[];
  status: 'draft' | 'in_transit' | 'delivered' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
}

export interface GoodsReceipt {
  id: string;
  branchId: string;
  documentNumber: string;
  date: string;
  manifestId: string;
  receivedBy: string;
  remarks?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GoodsDelivery {
  id: string;
  branchId: string;
  documentNumber: string;
  date: string;
  biltiId: string;
  deliveredTo: string;
  remarks?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Truck {
  id: string;
  branchId: string;
  truckNo: string;
  ownerName: string;
  ownerContactNo?: string;
  assignedLedgerId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Driver {
  id: string;
  branchId: string;
  name: string;
  licenseNo: string;
  contactNo: string;
  assignedLedgerId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Party {
  id: string;
  branchId: string;
  name: string;
  type: 'customer' | 'supplier' | 'both';
  contactNo?: string;
  email?: string;
  address?: string;
  assignedLedgerId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Godown {
  id: string;
  branchId: string;
  name: string;
  address?: string;
  contactNo?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type LocationType = 'country' | 'state' | 'city';
export type LocationStatus = 'active' | 'inactive';
export type UnitType = 'weight' | 'volume' | 'length' | 'count';

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  parent_id?: string | null;
  status: LocationStatus;
  created_at: string;
  created_by?: string;
  updated_at?: string | null;
  updated_by?: string;
  parent?: Location | null; // For joined queries
}

export interface Unit {
  id: string;
  name: string;
  type: UnitType;
  symbol: string;
  conversion_factor: number;
  is_base_unit: boolean;
  created_at: string;
  created_by?: string;
  updated_at?: string | null;
  updated_by?: string;
}

// Request/Payload types for Supabase functions
export interface DaybookTransactionCreateRequest {
  daybook_id: string;
  transaction_type: DaybookTransactionType;
  amount: number;
  description?: string | null;
  nepali_miti: string;
  reference_id?: string | null;
  party_id?: string | null;
  ledger_account_id: string; // Mandatory
  auto_linked?: boolean;
  supporting_doc_url?: string | null;
  reason_for_adjustment?: string | null;
  // created_by will be set by the function from auth user
}

export interface DaybookTransactionDeleteRequest {
  id: string; // ID of the transaction to delete
  daybook_id: string; // Parent daybook ID for context/validation
}