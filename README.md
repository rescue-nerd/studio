
# GorkhaTrans - Transportation Management System

GorkhaTrans is a comprehensive Transportation Management System (TMS) built with a modern technology stack to streamline logistics operations.

## 🚀 Tech Stack

- **Frontend**: Next.js 15, TypeScript, TailwindCSS, Shadcn UI
- **Backend**: Firebase (Firestore, Cloud Functions, Authentication, Storage, Hosting)
- **Infrastructure**: Google Cloud Platform
- **Development**: Firebase Emulators, Hot Reload, TypeScript

## 📋 Prerequisites

- Node.js (v18.x or later)
- npm (v9.x or later)
- Firebase CLI (`npm install -g firebase-tools`)
- Git

## 🛠️ Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/gorkhatrans.git
cd gorkhatrans
```

### 2. Install Dependencies
```bash
npm install
cd functions && npm install && cd ..
```

### 3. Firebase Configuration
```bash
# Copy environment template
cp .env.example .env.local

# Login to Firebase
firebase login

# Select your Firebase project
firebase use your-project-id
```

### 4. Configure Environment Variables
Edit `.env.local` with your Firebase configuration:
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# For local development with emulators
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
```

## 🔥 Development

### Local Development (Production Firebase)
```bash
npm run dev
```

### Local Development with Firebase Emulators
```bash
# Start emulators (recommended for development)
./firebase-dev.sh start-emulators

# In another terminal, start the Next.js app
npm run dev
```

### Firebase Development Utilities
```bash
# Available commands
./firebase-dev.sh help

# Start emulators with data persistence
./firebase-dev.sh start-emulators

# Test Firebase connection
./firebase-dev.sh test-connection

# Export/import emulator data
./firebase-dev.sh export-data
./firebase-dev.sh import-data
```

## 🚀 Deployment

### Using the Deploy Script
```bash
./deploy.sh
```

Choose from:
1. Deploy everything (Hosting, Functions, Firestore rules)
2. Deploy only Hosting
3. Deploy only Functions
4. Deploy only Firestore rules and indexes
5. Start Firebase emulators
6. Start emulators with data persistence

### Manual Deployment
```bash
# Build the application
npm run build

# Deploy to Firebase
firebase deploy
```

## 🧪 Testing Firebase Integration

Run Firebase integration tests:
```bash
# In browser console or Node.js environment
import { runFirebaseTests } from './src/lib/firebase-test';
runFirebaseTests();
```

## 🏗️ Architecture

### Firebase Services Integration
- **Authentication**: Secure user authentication with role-based access
- **Firestore**: Real-time database with offline persistence
- **Cloud Functions**: Serverless backend logic with TypeScript
- **Storage**: File uploads and document management
- **Hosting**: Static site hosting with CDN

### Enhanced Error Handling
- Comprehensive Firebase error handling with user-friendly messages
- Structured error logging with context
- Toast notifications for user feedback

### Development Features
- Firebase emulators for local development
- Hot reload with emulator data persistence
- Environment-aware configuration
- Comprehensive testing utilities

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
