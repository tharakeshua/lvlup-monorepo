---
name: firebase-seed-engine
description:
  Patterns for building config-driven, reusable Firebase Admin SDK seeding
  systems. Covers BatchWriter, ensureAuthUser, custom claims, idempotent entity
  creation, and config-to-database pipelines.
origin: custom
---

# Firebase Seed Engine Patterns

Conventions and patterns for building reusable data seeding systems using
Firebase Admin SDK for the Auto-LevelUp EdTech platform.

## When to Activate

- Building or modifying seed scripts for Firebase Auth + Firestore
- Creating reusable seeding infrastructure
- Adding new entity types to the seeding pipeline
- Debugging seed script failures or data integrity issues
- Creating config-driven entity creation flows

## Project Context

- **Monorepo**: `auto-levleup` (pnpm + Turborepo)
- **Database**: Firestore (production: `lvlup-ff6fa`)
- **Auth**: Firebase Authentication
- **Existing scripts**: `scripts/seed-emulator.ts`, `scripts/seed-production.ts`
- **Types**: `packages/shared-types/src/`
- **Service account**: `lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json`
  (root)

## Core Patterns

### 1. Firebase Admin Initialization

```typescript
import admin from "firebase-admin";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SERVICE_ACCOUNT_PATH = resolve(
  __dirname,
  "../lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json"
);
const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "lvlup-ff6fa",
  databaseURL: "https://lvlup-ff6fa-default-rtdb.firebaseio.com",
});

const db = admin.firestore();
const auth = admin.auth();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;
```

### 2. ensureAuthUser (Idempotent)

```typescript
async function ensureAuthUser(
  email: string,
  password: string,
  displayName: string
): Promise<string> {
  try {
    const existing = await auth.getUserByEmail(email);
    console.log(`  Auth user exists: ${email} (${existing.uid})`);
    return existing.uid;
  } catch {
    const userRecord = await auth.createUser({ email, password, displayName });
    console.log(`  Auth user created: ${email} (${userRecord.uid})`);
    return userRecord.uid;
  }
}
```

### 3. BatchWriter (Auto-flush at 490)

```typescript
class BatchWriter {
  private batch = db.batch();
  private count = 0;
  private totalWrites = 0;

  async set(
    ref: admin.firestore.DocumentReference,
    data: Record<string, unknown>
  ): Promise<void> {
    this.batch.set(ref, data);
    this.count++;
    this.totalWrites++;
    if (this.count >= 490) await this.flush();
  }

  async flush(): Promise<void> {
    if (this.count > 0) {
      await this.batch.commit();
      console.log(
        `  Batch committed (${this.count} writes, total: ${this.totalWrites})`
      );
      this.batch = db.batch();
      this.count = 0;
    }
  }
}
```

### 4. Custom Claims Builder

```typescript
const MAX_CLAIM_CLASS_IDS = 15;

function buildClaimsForMembership(m: MembershipLike): Record<string, unknown> {
  const classIds = m.permissions?.managedClassIds ?? [];
  const claims: Record<string, unknown> = {
    role: m.role,
    tenantId: m.tenantId,
    tenantCode: m.tenantCode,
  };
  switch (m.role) {
    case "teacher":
      claims.teacherId = m.teacherId;
      claims.classIds = classIds.slice(0, MAX_CLAIM_CLASS_IDS);
      claims.classIdsOverflow = classIds.length > MAX_CLAIM_CLASS_IDS;
      break;
    case "student":
      claims.studentId = m.studentId;
      claims.classIds = classIds.slice(0, MAX_CLAIM_CLASS_IDS);
      claims.classIdsOverflow = classIds.length > MAX_CLAIM_CLASS_IDS;
      break;
    case "parent":
      claims.parentId = m.parentId;
      claims.studentIds = m.parentLinkedStudentIds ?? [];
      break;
    case "tenantAdmin":
      break;
  }
  return claims;
}
```

### 5. Entity Creation Order (Dependencies)

Always create entities in this order to satisfy references:

```
1. Firebase Auth users (ensureAuthUser)
2. /users/{uid}
3. /tenants/{tenantId}
4. /tenantCodes/{code} (index doc)
5. /tenants/{tenantId}/academicSessions/{sessionId}
6. /tenants/{tenantId}/teachers/{teacherId}
7. /tenants/{tenantId}/students/{studentId}
8. /tenants/{tenantId}/parents/{parentId}
9. /tenants/{tenantId}/classes/{classId}
10. /userMemberships/{uid}_{tenantId}
11. Custom claims (auth.setCustomUserClaims)
12. /tenants/{tenantId}/spaces/{spaceId}
13. /tenants/{tenantId}/spaces/{spaceId}/storyPoints/{spId}
14. /tenants/{tenantId}/spaces/{spaceId}/storyPoints/{spId}/items/{itemId}
```

### 6. Firestore Document Patterns

#### Tenant Document

```typescript
{
  id: tenantId,
  name: schoolName,
  code: tenantCode,
  slug: generateSlug(schoolName),
  status: 'active',
  plan: 'premium',
  contact: { email, phone },
  settings: { defaultLanguage: 'en', timezone: 'Asia/Kolkata' },
  stats: { totalStudents: 0, totalTeachers: 0, totalClasses: 0, totalSpaces: 0 },
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
}
```

#### User Membership

```typescript
// Doc ID: `${uid}_${tenantId}`
{
  userId: uid,
  tenantId,
  tenantCode,
  tenantName: schoolName,
  role, // 'tenantAdmin' | 'teacher' | 'student' | 'parent'
  teacherId?, studentId?, parentId?,
  permissions: { managedClassIds: [] },
  status: 'active',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
}
```

### 7. Config-Driven Seeding

Define seed configs as TypeScript objects validated with Zod:

```typescript
interface SeedConfig {
  tenant: { name: string; code: string; ownerEmail: string; plan: string };
  academicSession: { name: string; startDate: string; endDate: string };
  accounts: {
    admin: { email: string; password: string; displayName: string };
    teachers: TeacherConfig[];
    students: StudentConfig[];
    parents: ParentConfig[];
  };
  classes: ClassConfig[];
  spaces: SpaceConfig[];
}
```

### 8. Execution Pattern

```bash
# Production
GOOGLE_APPLICATION_CREDENTIALS=./lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json npx tsx scripts/seed-{name}.ts

# Emulator
FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npx tsx scripts/seed-{name}.ts
```

### 9. Idempotency Rules

- Always use `ensureAuthUser` (handles existing users)
- Use `.set()` with merge for documents that may already exist
- Generate deterministic IDs from config when possible (e.g., `tenant_${slug}`)
- Log all created IDs for downstream use
- Write results to JSON file for test consumption

### 10. Validation Checklist

After seeding, verify:

- [ ] All auth users exist (`firebase auth:export`)
- [ ] Custom claims are set correctly
- [ ] All tenant sub-collections populated
- [ ] Membership docs match auth UIDs
- [ ] Space status is `published` for student visibility
- [ ] Class references are bidirectional (teacher → class, class → teacher)
- [ ] Parent → student links are correct
