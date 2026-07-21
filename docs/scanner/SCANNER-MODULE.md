# Scanner Module — Orchestration Stub

**Status:** Scaffold only (develop)  
**Priority:** P0 (see `docs/PRODUCT-IMPROVEMENTS-ROADMAP.md`)  
**Related:** `docs/requirements/EXAM-QR-BATCH-JOURNEY.md`

## Purpose

The **Manual Agent** (scanner role) captures offline exam answer sheets via QR-attached photos. This module orchestrates scanner sessions, uploads, and pipeline handoff without exposing answer keys (LD-01).

## Surfaces

| Surface | Path | Status |
| ------- | ---- | ------ |
| Admin provisioning & ops | `apps/admin-web` → `/scanner` | **Stub** |
| Scanner PWA | `apps/scanner-web` (planned) | Not built |
| Service orchestration | `packages/services/src/scanner/orchestration.ts` | **Stub** |

## Session lifecycle (target)

```
startSession(examId, scannerId)
  → attachQr(qrPayload)
  → uploadPage(sessionId, image)
  → closeSession(sessionId, signature)
  → enqueueSubmissionPipeline()
```

## Security invariants (P0)

1. Scanner credentials are admin-provisioned; no self-signup.
2. QR payload MUST bind `tenantId + examId + studentId`.
3. Handwriting verification scoped to single student; cross-student match = hard fail.
4. Scanner API responses MUST NOT include answer keys.

## TODO

- [ ] `bulkImportScanners` callable + CSV template
- [ ] Firestore `scannerSessions/{id}` schema
- [ ] sdk-v1 callables: `scanner.startSession`, `scanner.uploadPage`, `scanner.closeSession`
- [ ] Admin UI: active sessions, failed uploads, requeue
- [ ] PWA: camera capture, offline queue, QR scanner
