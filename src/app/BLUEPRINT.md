
# GorkhaTrans Application Blueprint

## 1. Introduction

This document provides an architectural overview of the GorkhaTrans Transportation Management System (TMS). It details the core technologies, application structure, feature breakdown by module, and the status of backend integration for CRUD operations.

## 2. Core Technologies

*   **Frontend Framework:** Next.js (App Router) with React and TypeScript
*   **UI Components:** ShadCN UI
*   **Styling:** Tailwind CSS
*   **Backend Services:** Firebase
    *   **Database:** Firestore
    *   **Authentication:** Firebase Authentication
    *   **Serverless Logic:** Firebase Cloud Functions for Node.js (HTTPS Callable Functions & Triggers)
*   **AI Toolkit (Setup Exists):** Genkit (Smart Route Optimization feature removed, but Genkit setup remains)

## 3. Application Structure

*   **`src/app/`**: Contains all Next.js pages (routes) and layout components. Each feature module typically has its own directory here (e.g., `src/app/invoicing/`).
*   **`src/components/`**:
    *   **`ui/`**: Reusable UI components from ShadCN.
    *   **`layout/`**: Components related to the overall application layout (sidebar, header).
    *   **`shared/`**: Custom reusable components shared across different features (e.g., smart selection dialogs).
*   **`src/lib/`**: Utility functions and Firebase initialization (`firebase.ts`, `utils.ts`).
*   **`src/contexts/`**: React Context API providers (e.g., `auth-context.tsx`).
*   **`src/hooks/`**: Custom React hooks (e.g., `use-toast.ts`, `use-mobile.ts`).
*   **`src/types/`**: TypeScript type definitions, especially `firestore.ts` which defines database structures.
*   **`functions/`**: Source code for Firebase Cloud Functions.
    *   **`src/index.ts`**: Main file for defining HTTPS Callable Functions and Firestore Triggers.
    *   **`src/types.ts`**: TypeScript types specific to backend functions.

## 4. Feature Breakdown by Module & Backend Status

This section details each module, its features, and whether its Create, Update, Delete (CUD) operations are handled by backend Cloud Functions or client-side Firestore SDK calls. "Read" operations for listing data are generally client-side unless specified.

---

### **A. Masters Modules**

1.  **Branch Management (`/branch-management`)**
    *   Features: Create, view, update, delete company branches.
    *   **Backend CUD Status:**
        *   `createBranch`: **Done** (HTTPS Callable Function)
        *   `updateBranch`: **Done** (HTTPS Callable Function)
        *   `deleteBranch`: **Done** (HTTPS Callable Function)

2.  **Locations & Units Management (`/locations`)**
    *   Features: Manage countries, states, cities, and measurement units.
    *   **Countries:**
        *   `createCountry`: **Done** (HTTPS Callable Function)
        *   `updateCountry`: **Done** (HTTPS Callable Function)
        *   `deleteCountry`: **Done** (HTTPS Callable Function, includes check for linked states)
    *   **States:**
        *   `createState`: **Done** (HTTPS Callable Function)
        *   `updateState`: **Done** (HTTPS Callable Function)
        *   `deleteState`: **Done** (HTTPS Callable Function, includes check for linked cities)
    *   **Cities:**
        *   `createCity`: **Done** (HTTPS Callable Function)
        *   `updateCity`: **Done** (HTTPS Callable Function)
        *   `deleteCity`: **Done** (HTTPS Callable Function)
    *   **Units:**
        *   `createUnit`: **Done** (HTTPS Callable Function)
        *   `updateUnit`: **Done** (HTTPS Callable Function)
        *   `deleteUnit`: **Done** (HTTPS Callable Function)

3.  **Truck Management (`/trucks`)**
    *   Features: Maintain records of trucks, their types, capacity, and ownership details.
    *   **Backend CUD Status:**
        *   `createTruck`: **Done** (HTTPS Callable Function)
        *   `updateTruck`: **Done** (HTTPS Callable Function)
        *   `deleteTruck`: **Done** (HTTPS Callable Function)

4.  **Driver Management (`/drivers`)**
    *   Features: Manage driver profiles, license information, and contact details.
    *   **Backend CUD Status:**
        *   `createDriver`: **Done** (HTTPS Callable Function)
        *   `updateDriver`: **Done** (HTTPS Callable Function)
        *   `deleteDriver`: **Done** (HTTPS Callable Function)

5.  **Party Management (`/parties`)**
    *   Features: Manage consignors, consignees, and other business parties.
    *   **Backend CUD Status:**
        *   `createParty`: **Done** (HTTPS Callable Function)
        *   `updateParty`: **Done** (HTTPS Callable Function)
        *   `deleteParty`: **Done** (HTTPS Callable Function)

6.  **Godown Management (`/godowns`)**
    *   Features: Manage godowns (warehouses), their locations, and linked branches.
    *   **Backend CUD Status:**
        *   `createGodown`: **Done** (HTTPS Callable Function)
        *   `updateGodown`: **Done** (HTTPS Callable Function)
        *   `deleteGodown`: **Done** (HTTPS Callable Function)

---

### **B. Operations Modules**

1.  **Bilti / Invoicing (`/invoicing`)**
    *   Features: Create, update, and delete Biltis (shipment invoices).
    *   **Backend CUD Status:**
        *   `createBilti`: **Done** (HTTPS Callable Function)
        *   `updateBilti`: **Done** (HTTPS Callable Function)
        *   `deleteBilti`: **Done** (HTTPS Callable Function)
    *   **Automated Ledger Posting:** `postBiltiLedgerEntries` (Firestore Trigger `onDocumentCreated`) **Done**.

2.  **Manifests (`/manifests`)**
    *   Features: Consolidate multiple Biltis into manifests for truck trips.
    *   **Backend CUD Status:**
        *   `createManifest`: **Done** (HTTPS Callable Function - also updates Bilti statuses)
        *   `updateManifest`: **Done** (HTTPS Callable Function - also updates Bilti statuses)
        *   `deleteManifest`: **Done** (HTTPS Callable Function - also updates Bilti statuses)

3.  **Goods Receipt (`/goods-receipt`)**
    *   Features: Record the receipt of goods from a manifest at a destination branch/godown.
    *   **Backend CUD Status:**
        *   `createGoodsReceipt`: **Done** (HTTPS Callable Function - updates Manifest & Bilti statuses)
        *   `updateGoodsReceipt`: **Done** (HTTPS Callable Function)
        *   `deleteGoodsReceipt`: **Done** (HTTPS Callable Function - updates Manifest & Bilti statuses)

4.  **Goods Delivery (`/goods-delivery`)**
    *   Features: Mark goods as delivered to the final consignee, manage rebates & discounts.
    *   **Backend CUD Status:**
        *   `createGoodsDelivery`: **Pending Refactor** (Client-side Firestore writes)
        *   `updateGoodsDelivery`: **Pending Refactor** (Client-side Firestore writes)
        *   `deleteGoodsDelivery`: **Pending Refactor** (Client-side Firestore writes)
    *   **Automated Ledger Posting:** `postGoodsDeliveryLedgerEntries` (Firestore Trigger `onDocumentCreated` for rebates/discounts) **Done**.

---

### **C. Finance Modules**

1.  **Ledgers (`/ledgers`)**
    *   Features: View ledger statements for various accounts (parties, trucks, etc.). Add manual ledger entries.
    *   **Backend CUD Status (for Manual Entries):**
        *   `createManualLedgerEntry`: **Pending Refactor** (Client-side Firestore writes for "Pending" entries)
        *   `updateLedgerEntryStatus` (Approve/Reject): **Pending Refactor** (Client-side, but ideally backend for security)
    *   Note: Ledger entries are also created by backend triggers from Bilti, Goods Delivery, and Daybook modules.

2.  **Daybook (`/daybook`)**
    *   Features: Manage daily cash transactions with an approval workflow.
    *   **Backend Workflow Status:**
        *   `submitDaybook`: **Done** (HTTPS Callable Function)
        *   `approveDaybook`: **Done** (HTTPS Callable Function)
        *   `rejectDaybook`: **Done** (HTTPS Callable Function)
    *   **Automated Ledger Posting:** `processApprovedDaybook` (Firestore Trigger `onDocumentWritten`) **Done**.
    *   **Transaction CUD within a Daybook:** Currently client-side updates to the Daybook document; could be further secured if needed.

---

### **D. Configuration Modules**

1.  **Content Customization (`/content-customization`)**
    *   Features: Define custom fields and lines for invoices and bills.
    *   **Backend CUD Status:** **Pending Refactor** (Client-side Firestore writes)

2.  **Narration Setup (`/narration-setup`)**
    *   Features: Create and manage reusable invoice narration templates.
    *   **Backend CUD Status:** **Pending Refactor** (Client-side Firestore writes)

3.  **Automatic Numbering (`/automatic-numbering`)**
    *   Features: Configure auto-numbering schemes for various document types.
    *   **Backend CUD Status:** **Pending Refactor** (Client-side Firestore writes)

---

### **E. Analytics & AI Modules**

1.  **Reports (`/reports`)**
    *   Features: View various operational and financial reports.
    *   **Status:** Currently UI placeholders with mock data. Data fetching and aggregation logic needs implementation (potentially via backend functions for complex reports).

2.  **Smart Route Optimization (`/route-optimization`)**
    *   Features: Suggest optimal routes and load configurations.
    *   **Status:** Feature **Removed**. Genkit setup exists if re-introduction is desired.

---

### **F. User & System Settings**

1.  **Login/Signup (`/login`, `/signup`)**
    *   Features: User authentication.
    *   **Status:** **Done** (Firebase Authentication with client-side SDK, Firestore user document creation on signup).

2.  **Settings (`/settings`)**
    *   Features: User profile updates, branch assignments by superAdmin.
    *   **Backend CUD Status:**
        *   Profile Updates (displayName, preferences): **Pending Refactor** (Client-side Firestore writes)
        *   Branch Assignments: **Pending Refactor** (Client-side Firestore writes by superAdmin)
    *   **User Status Sync:** `syncUserStatusToAuth` (Firestore Trigger `onDocumentWritten` for User status field) **Done**.

## 5. Key Backend Functions (Overview)

*   **CRUD Functions:** A growing suite of `create<Entity>`, `update<Entity>`, `delete<Entity>` functions for secure data manipulation (e.g., `createBranch`, `updateBilti`).
*   **Workflow Functions:** `submitDaybook`, `approveDaybook`, `rejectDaybook`.
*   **Data Processing Triggers:**
    *   `postBiltiLedgerEntries`: Posts to ledger on Bilti creation.
    *   `processApprovedDaybook`: Posts to ledger when a Daybook is approved.
    *   `postGoodsDeliveryLedgerEntries`: Posts rebates/discounts to ledger from Goods Delivery.
    *   `syncUserStatusToAuth`: Syncs user `status` field in Firestore to Firebase Auth user `disabled` state.
*   **Helper Functions:** `getUserPermissions` (used internally by other functions for authZ).

## 6. Authentication & Authorization

*   **Authentication:** Firebase Authentication is used for user login and signup.
*   **Authorization:**
    *   Client-side route guards (basic, via `useAuth` context).
    *   Backend HTTPS Callable Functions implement role-based access control (RBAC). Currently, many CUD operations for master data are restricted to `superAdmin`. Workflow functions (Daybook) and operational functions (Manifests, Goods Receipt) incorporate branch-level permissions based on `assignedBranchIds` in the User document.

## 7. Database (Firestore)

Key Collections:
`users`, `branches`, `parties`, `trucks`, `drivers`, `godowns`, `biltis`, `manifests`, `goodsReceipts`, `goodsDeliveries`, `ledgerAccounts`, `ledgerEntries`, `daybooks`, `documentNumberingConfigs`, `narrationTemplates`, `invoiceLineCustomizations`, `countries`, `states`, `cities`, `units`.

Relationships are primarily managed via storing IDs (e.g., `bilti.consignorId` links to `parties/{partyId}`).

## 8. Future Enhancements / To-Do (from current perspective)

*   Complete refactoring of remaining client-side CUD operations to backend HTTPS Callable Functions for:
    *   Goods Delivery
    *   Content Customization
    *   Narration Setup
    *   Automatic Numbering
    *   Ledger Manual Entry (and status updates)
    *   Settings (Profile & User Management aspects like role changes if needed)
*   Implement data fetching for Reports page (potentially using backend functions).
*   Thoroughly review and implement comprehensive Firestore Security Rules for all collections.
*   Enforce Firebase App Check for all callable functions.
*   Implement comprehensive unit and integration testing.
*   Refine UI/UX for all modules.
*   Consider more granular role/permission management.
