# @levelup/shared-services

Shared Firebase service layer for the LevelUp unified platform.

## Features

- 🔥 **Firebase Configuration**: Centralized Firebase initialization with
  environment variable support
- 🔐 **Auth Service**: Clean interface for Firebase Authentication operations
- 📦 **Firestore Service**: Org-scoped Firestore operations with multi-tenancy
  support
- 📁 **Storage Service**: Org-scoped file storage operations
- ⚡ **Realtime DB Service**: Org-scoped realtime data operations
- 🏢 **Multi-tenancy**: All services support organization-scoped data paths

## Installation

```bash
pnpm add @levelup/shared-services
```

## Usage

### Initialize Firebase

```typescript
import { initializeFirebase } from "@levelup/shared-services";

// Initialize with environment variables
const services = initializeFirebase();

// Or with custom config
const services = initializeFirebase({
  apiKey: "your-api-key",
  authDomain: "your-auth-domain",
  projectId: "your-project-id",
  // ...
});
```

### Auth Service

```typescript
import { authService } from "@levelup/shared-services";

// Sign in
await authService.signIn("user@example.com", "password");

// Sign up
await authService.signUp("user@example.com", "password");

// Sign out
await authService.signOut();

// Get current user
const user = authService.getCurrentUser();

// Listen to auth state changes
const unsubscribe = authService.onAuthStateChange((user) => {
  console.log("Auth state changed:", user);
});
```

### Firestore Service

```typescript
import { firestoreService } from "@levelup/shared-services";

// Get a document
const doc = await firestoreService.getDoc("orgId", "students", "studentId");

// Get all documents
const docs = await firestoreService.getAllDocs("orgId", "students");

// Set a document
await firestoreService.setDoc("orgId", "students", "studentId", {
  name: "John Doe",
  email: "john@example.com",
});

// Update a document
await firestoreService.updateDoc("orgId", "students", "studentId", {
  name: "Jane Doe",
});

// Delete a document
await firestoreService.deleteDoc("orgId", "students", "studentId");
```

### Storage Service

```typescript
import { storageService } from "@levelup/shared-services";

// Upload a file
await storageService.uploadFile("orgId", "path/to/file.pdf", file);

// Get download URL
const url = await storageService.getDownloadURL("orgId", "path/to/file.pdf");

// Delete a file
await storageService.deleteFile("orgId", "path/to/file.pdf");

// List files
const files = await storageService.listFiles("orgId", "path/to/folder");
```

### Realtime DB Service

```typescript
import { realtimeDBService } from "@levelup/shared-services";

// Get data once
const data = await realtimeDBService.getData("orgId", "leaderboard");

// Set data
await realtimeDBService.setData("orgId", "leaderboard", { score: 100 });

// Subscribe to real-time updates
const unsubscribe = realtimeDBService.subscribe(
  "orgId",
  "leaderboard",
  (data) => {
    console.log("Data updated:", data);
  }
);

// Push to a list
const newKey = await realtimeDBService.pushData("orgId", "events", {
  type: "login",
  timestamp: Date.now(),
});
```

## Environment Variables

The package supports the following environment variables:

- `VITE_FIREBASE_API_KEY` or `NEXT_PUBLIC_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN` or `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID` or `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET` or `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID` or
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID` or `NEXT_PUBLIC_FIREBASE_APP_ID`
- `VITE_FIREBASE_DATABASE_URL` or `NEXT_PUBLIC_FIREBASE_DATABASE_URL` (optional)
- `VITE_FIREBASE_MEASUREMENT_ID` or `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
  (optional)

## Multi-tenancy

All services support organization-scoped data paths following the pattern:

```
organizations/{orgId}/{collection}/{docId}
```

This ensures data isolation between different organizations/tenants.
