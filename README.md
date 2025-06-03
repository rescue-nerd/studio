
# GorkhaTrans - Transportation Management System

GorkhaTrans is a comprehensive Transportation Management System (TMS) built with a modern technology stack to streamline logistics operations.

## Core Features Implemented

*   **Branch Management:** Create, update, and delete branches.
*   **Locations & Units Management:** Manage countries, states, cities, and measurement units.
*   **Truck & Driver Management:** Maintain records of trucks and drivers.
*   **Party Management:** Manage consignors and consignees.
*   **Godown Management:** Track godown (warehouse) details.
*   **Bilti / Invoicing:** Create, update, and delete Biltis (shipment invoices). Ledger entries are automatically posted on Bilti creation.
*   **Manifest Creation:** Consolidate Biltis into manifests for truck trips. Bilti statuses are updated accordingly.
*   **Goods Receipt:** Record the receipt of goods from a manifest, updating manifest and Bilti statuses.
*   **Goods Delivery:** Mark goods as delivered, manage rebates/discounts. Ledger entries for rebates/discounts are posted.
*   **Daybook / Daily Cash Book:** Manage daily cash transactions with an approval workflow. Approved daybook transactions are posted to the ledger.
*   **User Authentication:** Secure login and signup functionality.
*   **Basic Settings & Profile Management:** Users can view their profile; superAdmins can manage branch assignments.
*   **Configuration:**
    *   **Content Customization:** Define custom fields for invoices/bills.
    *   **Narration Setup:** Create reusable narration templates for billing.
    *   **Automatic Numbering:** Configure auto-numbering schemes for documents.
*   **Ledger Viewing:** View ledger statements for accounts (manual entry posting needs approval).
*   **Reporting (Mock Data):** UI for daily bilti activity, bilti register, party ledger summary, and truck performance reports (currently uses mock data).

## Technology Stack

*   **Frontend:** Next.js (App Router), React, TypeScript
*   **UI:** ShadCN UI Components, Tailwind CSS
*   **State Management:** React Context API (for Auth), component-level state
*   **Backend:** Firebase (Firestore, Authentication, Cloud Functions for Node.js)
*   **AI (Planned/Placeholder):** Genkit (Route Optimization feature removed, but Genkit setup exists)

## Development Status - Backend Integration

Many modules have had their Create, Update, and Delete (CUD) operations refactored to use secure backend HTTPS Callable Firebase Functions, centralizing business logic and enhancing security. Read operations for lists are generally still client-side direct Firestore reads.

**Modules with Backend CUD Functions:**
*   Branches
*   Locations (Countries, States, Cities)
*   Units
*   Trucks
*   Drivers
*   Parties
*   Godowns
*   Bilti / Invoicing
*   Manifests
*   Goods Receipt

**Modules with Backend Workflow Functions (not full CRUD yet unless listed above):**
*   Daybook (Submit, Approve, Reject)

**Modules primarily client-side or pending full backend CUD refactor:**
*   Goods Delivery (Create/Update/Delete logic is client-side with direct Firestore writes)
*   Content Customization (CRUD via client-side Firestore)
*   Narration Setup (CRUD via client-side Firestore)
*   Automatic Numbering (CRUD via client-side Firestore)
*   Ledger (Manual entry submission via client-side Firestore, status updates planned for backend)
*   Settings (Profile updates via client-side Firestore, branch assignment updates via client-side Firestore)
*   Reports (Currently UI with mock data)

## Getting Started (Placeholder)

To get started with development:
1.  Ensure you have Node.js and Firebase CLI installed.
2.  Set up your Firebase project and replace the placeholder Firebase config in `src/lib/firebase.ts` with your project's configuration.
3.  Populate necessary Firebase extensions or configurations if any.
4.  Run `npm install` to install dependencies.
5.  To run the Next.js frontend: `npm run dev`
6.  To deploy Cloud Functions: `firebase deploy --only functions`
7.  To run Genkit (if AI features are re-introduced): `npm run genkit:dev`

For detailed setup instructions and Firebase project configuration, refer to the official Firebase and Next.js documentation.
