import { createClient } from '@supabase/supabase-js';
import { initializeApp } from 'firebase/app';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { getFirebaseConfig } from '../src/lib/firebase-config';
import { getSupabaseConfig } from '../src/lib/supabase-config';

// Initialize Firebase
const firebaseConfig = getFirebaseConfig();
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Initialize Supabase
const supabaseConfig = getSupabaseConfig();
const supabase = createClient(
  supabaseConfig.supabaseUrl,
  supabaseConfig.supabaseAnonKey
);

// Collections to migrate
const collections = [
  'users',
  'branches',
  'parties',
  'trucks',
  'drivers',
  'godowns',
  'biltis',
  'manifests',
  'goodsReceipts',
  'goodsDeliveries',
  'ledgerAccounts',
  'narrationTemplates',
  'invoiceLineCustomizations',
  'locations',
  'units',
  'documentNumberingConfigs',
  'daybookEntries'
];

// Data type transformations
const transformData = (collectionName: string, data: any) => {
  switch (collectionName) {
    case 'users':
      return {
        uid: data.id,
        email: data.email,
        display_name: data.displayName,
        role: data.role,
        assigned_branch_ids: data.assignedBranchIds || [],
        created_at: data.createdAt?.toDate(),
        created_by: data.createdBy,
        last_login_at: data.lastLoginAt?.toDate(),
        enable_email_notifications: data.enableEmailNotifications,
        dark_mode_enabled: data.darkModeEnabled,
        auto_data_sync_enabled: data.autoDataSyncEnabled,
        updated_at: data.updatedAt?.toDate(),
        updated_by: data.updatedBy,
        status: data.status
      };

    case 'branches':
      return {
        name: data.name,
        location: data.location,
        manager_name: data.managerName,
        manager_user_id: data.managerUserId,
        contact_email: data.contactEmail,
        contact_phone: data.contactPhone,
        status: data.status,
        created_at: data.createdAt?.toDate(),
        created_by: data.createdBy,
        updated_at: data.updatedAt?.toDate(),
        updated_by: data.updatedBy
      };

    case 'parties':
      return {
        name: data.name,
        type: data.type,
        contact_no: data.contactNo,
        pan_no: data.panNo,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        assigned_ledger_id: data.assignedLedgerId,
        status: data.status,
        created_at: data.createdAt?.toDate(),
        created_by: data.createdBy,
        updated_at: data.updatedAt?.toDate(),
        updated_by: data.updatedBy
      };

    case 'trucks':
      return {
        truck_no: data.truckNo,
        type: data.type,
        capacity: data.capacity,
        owner_name: data.ownerName,
        owner_pan: data.ownerPAN,
        status: data.status,
        assigned_ledger_id: data.assignedLedgerId,
        created_at: data.createdAt?.toDate(),
        created_by: data.createdBy,
        updated_at: data.updatedAt?.toDate(),
        updated_by: data.updatedBy
      };

    case 'drivers':
      return {
        name: data.name,
        license_no: data.licenseNo,
        contact_no: data.contactNo,
        address: data.address,
        joining_date: data.joiningDate?.toDate(),
        status: data.status,
        assigned_ledger_id: data.assignedLedgerId,
        created_at: data.createdAt?.toDate(),
        created_by: data.createdBy,
        updated_at: data.updatedAt?.toDate(),
        updated_by: data.updatedBy
      };

    case 'godowns':
      return {
        name: data.name,
        branch_id: data.branchId,
        location: data.location,
        status: data.status,
        created_at: data.createdAt?.toDate(),
        created_by: data.createdBy,
        updated_at: data.updatedAt?.toDate(),
        updated_by: data.updatedBy
      };

    case 'biltis':
      return {
        miti: data.miti?.toDate(),
        nepali_miti: data.nepaliMiti,
        consignor_id: data.consignorId,
        consignee_id: data.consigneeId,
        origin: data.origin,
        destination: data.destination,
        description: data.description,
        packages: data.packages,
        weight: data.weight,
        rate: data.rate,
        total_amount: data.totalAmount,
        pay_mode: data.payMode,
        status: data.status,
        manifest_id: data.manifestId,
        goods_delivery_note_id: data.goodsDeliveryNoteId,
        cash_collection_status: data.cashCollectionStatus,
        truck_id: data.truckId,
        driver_id: data.driverId,
        ledger_processed: data.ledgerProcessed,
        branch_id: data.branchId,
        created_at: data.createdAt?.toDate(),
        created_by: data.createdBy,
        updated_at: data.updatedAt?.toDate(),
        updated_by: data.updatedBy
      };

    case 'manifests':
      return {
        miti: data.miti?.toDate(),
        nepali_miti: data.nepaliMiti,
        truck_id: data.truckId,
        driver_id: data.driverId,
        from_branch_id: data.fromBranchId,
        to_branch_id: data.toBranchId,
        attached_bilti_ids: data.attachedBiltiIds || [],
        remarks: data.remarks,
        status: data.status,
        goods_receipt_id: data.goodsReceiptId,
        created_at: data.createdAt?.toDate(),
        created_by: data.createdBy,
        updated_at: data.updatedAt?.toDate(),
        updated_by: data.updatedBy
      };

    case 'goodsReceipts':
      return {
        miti: data.miti?.toDate(),
        nepali_miti: data.nepaliMiti,
        manifest_id: data.manifestId,
        receiving_branch_id: data.receivingBranchId,
        receiving_godown_id: data.receivingGodownId,
        remarks: data.remarks,
        shortages: data.shortages,
        damages: data.damages,
        created_at: data.createdAt?.toDate(),
        created_by: data.createdBy,
        updated_at: data.updatedAt?.toDate(),
        updated_by: data.updatedBy
      };

    case 'goodsDeliveries':
      return {
        miti: data.miti?.toDate(),
        nepali_miti: data.nepaliMiti,
        overall_remarks: data.overallRemarks,
        delivered_to_name: data.deliveredToName,
        delivered_to_contact: data.deliveredToContact,
        ledger_processed: data.ledgerProcessed,
        branch_id: data.branchId,
        created_at: data.createdAt?.toDate(),
        created_by: data.createdBy,
        updated_at: data.updatedAt?.toDate(),
        updated_by: data.updatedBy
      };

    case 'ledgerAccounts':
      return {
        account_id: data.accountId,
        account_name: data.accountName,
        account_type: data.accountType,
        parent_account_id: data.parentAccountId,
        created_at: data.createdAt?.toDate(),
        created_by: data.createdBy,
        updated_at: data.updatedAt?.toDate(),
        updated_by: data.updatedBy
      };

    case 'narrationTemplates':
      return {
        title: data.title,
        template: data.template,
        applicable_to: data.applicableTo || [],
        created_at: data.createdAt?.toDate(),
        created_by: data.createdBy,
        updated_at: data.updatedAt?.toDate(),
        updated_by: data.updatedBy
      };

    case 'invoiceLineCustomizations':
      return {
        name: data.name,
        type: data.type,
        data: data.data || {},
        created_at: data.createdAt?.toDate(),
        created_by: data.createdBy,
        updated_at: data.updatedAt?.toDate(),
        updated_by: data.updatedBy
      };

    case 'locations':
      return {
        name: data.name,
        type: data.type,
        parent_id: data.parentId,
        created_at: data.createdAt?.toDate(),
        created_by: data.createdBy,
        updated_at: data.updatedAt?.toDate(),
        updated_by: data.updatedBy
      };

    case 'units':
      return {
        name: data.name,
        type: data.type,
        symbol: data.symbol,
        conversion_factor: data.conversionFactor,
        is_base_unit: data.isBaseUnit,
        created_at: data.createdAt?.toDate(),
        created_by: data.createdBy,
        updated_at: data.updatedAt?.toDate(),
        updated_by: data.updatedBy
      };

    case 'documentNumberingConfigs':
      return {
        document_type: data.documentType,
        prefix: data.prefix,
        suffix: data.suffix,
        start_number: data.startingNumber,
        current_number: data.currentNumber,
        padding_length: data.digitPadding,
        branch_id: data.branchId,
        fiscal_year: data.fiscalYear,
        is_active: data.isActive,
        created_at: data.createdAt?.toDate(),
        created_by: data.createdBy,
        updated_at: data.updatedAt?.toDate(),
        updated_by: data.updatedBy
      };

    case 'daybookEntries':
      return {
        miti: data.miti?.toDate(),
        nepali_miti: data.nepaliMiti,
        entry_type: data.entryType,
        amount: data.amount,
        description: data.description,
        reference_type: data.referenceType,
        reference_id: data.referenceId,
        branch_id: data.branchId,
        status: data.status,
        is_approved: data.isApproved,
        approved_by: data.approvedBy,
        approved_at: data.approvedAt?.toDate(),
        created_at: data.createdAt?.toDate(),
        created_by: data.createdBy,
        updated_at: data.updatedAt?.toDate(),
        updated_by: data.updatedBy
      };

    default:
      return data;
  }
};

async function migrateCollection(collectionName: string) {
  console.log(`Migrating collection: ${collectionName}`);
  
  try {
    // Get all documents from Firebase
    const querySnapshot = await getDocs(collection(db, collectionName));
    
    // Prepare data for Supabase
    const documents = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...transformData(collectionName, data)
      };
    });

    // Insert data into Supabase
    const { data, error } = await supabase
      .from(collectionName.toLowerCase())
      .upsert(documents);

    if (error) {
      console.error(`Error migrating ${collectionName}:`, error);
      return false;
    }

    console.log(`Successfully migrated ${documents.length} documents from ${collectionName}`);
    return true;
  } catch (error) {
    console.error(`Error migrating ${collectionName}:`, error);
    return false;
  }
}

async function migrateAllCollections() {
  console.log('Starting migration from Firebase to Supabase...');
  
  for (const collectionName of collections) {
    const success = await migrateCollection(collectionName);
    if (!success) {
      console.error(`Failed to migrate collection: ${collectionName}`);
    }
  }
  
  console.log('Migration completed!');
}

// Run the migration
migrateAllCollections().catch(console.error); 