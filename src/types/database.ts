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
  code?: string;
  address?: string;
  location?: string;
  contactNo?: string;
  email?: string;
  isActive: boolean;
  managerName?: string;
  managerUserId?: string;
  createdAt: string;
  updatedAt?: string;
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

export interface Daybook {
  id: string;
  branchId: string;
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  category: string;
  referenceNo?: string;
  status: CashCollectionStatus;
  createdAt: string;
  updatedAt?: string;
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

export interface Location {
  id: string;
  name: string;
  type: 'country' | 'state' | 'city';
  parentId?: string;
  code?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}