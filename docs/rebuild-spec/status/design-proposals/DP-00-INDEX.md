# Fat-SDK Design Proposals — Index

**Author:** Program-Lead 🧭 · **Date:** 2026-06-27 · **Branch:** `staging` ·
**Status:** DESIGN-ONLY (no code changed, awaiting approval).

These 10 standalone design proposals are the **rethink** of the fat-SDK
requested after Phase-1 review + the 4 deep re-reviews. Each fixes findings _by
construction_. Master synthesis:
[`../SDK-DESIGN-PROPOSALS.md`](../SDK-DESIGN-PROPOSALS.md). Evidence base:
`../SDK-REVIEW-PHASE1.md` (+R1–R4), `../SDK-REVIEW-A-LEARNING-DOMAIN.md`,
`../SDK-REVIEW-B-IDENTITY-DOMAIN.md`, `../SDK-RR-T1..T4-*.md`.

## The 5 principles

1. **One source of truth, derive the rest.** No shape declared twice;
   `as const satisfies` drives enums/unions/maps.
2. **Make illegal states unrepresentable.** Invariants are types, not
   conventions.
3. **Honest effects.** Returned success == committed; `tx` == atomic; reads
   never mutate; no swallowed failures.
4. **Layer purity, enforced.**
   `domain ← api-contract ← api-client ← repositories ← query`; apps touch only
   `query`+`domain`; gate green.
5. **Extend the sound foundation, don't replace it.**

## The proposals

| DP                                                 | Title                                                      | Closes                                                   | Wave  |
| -------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- | ----- |
| [DP-1](./DP-01-canonical-transport-seam.md)        | Canonical transport seam in `api-contract`                 | TR-1, TR-2, REPO-4, MISC-3, MISC-11, LB-03/Q-DUP-1 (~13) | W1    |
| [DP-2](./DP-02-extensibility-registries.md)        | Registry-driven extensibility (question types + roles)     | LD-03, B-IDN-12/13/23, RR-T2-A/B/C                       | W1    |
| [DP-3](./DP-03-typed-answer-grading-axis.md)       | Typed answer/grading axis + QTI item split + re-validation | LD-01 (live leak), LD-02, LD-10, F-SSOT-04               | W0+W2 |
| [DP-4](./DP-04-honest-transaction-model.md)        | Honest transaction model (authority layer)                 | SVC-1/2/3/4, RR-T4 NEW-1/2, SEC-04                       | W0    |
| [DP-5](./DP-05-composable-domain-primitives.md)    | Composable domain primitives                               | B-IDN-10/11, LD-04/05/06/07/08/09, F-SSOT-03             | W2    |
| [DP-6](./DP-06-identity-correctness.md)            | Identity correctness + single tenant-code resolver         | B-IDN-01/02/03/20/21, RR-T2-A                            | W0+W2 |
| [DP-7](./DP-07-boundary-integrity-sdk-factory.md)  | `createLevelUpSdk()` factory + green boundary gate         | LB-01/Q-GUARD-1, LB-02/04/05                             | W3    |
| [DP-8](./DP-08-dedupe-and-live-realtime.md)        | Dedupe wave + live realtime + delete dead runtimes         | CON-2/4, REPO-5/6, QRY-1/2/5, MISC-1/2                   | W3    |
| [DP-9](./DP-09-deploy-safety-prefix-timestamps.md) | Prefix-aware subscriptions + timestamp wire sweep          | F-NS-01/02, F-TS-01                                      | W3    |
| [DP-10](./DP-10-test-and-build-hygiene.md)         | Test & build hygiene matched to risk                       | Q-TEST-1/2/3, Q-BUILD-1/2/3, Q-DEP-1/2                   | W4    |

## Rollout waves

- **W0 — Correctness (stop the bleeding):** 4 P0s + DP-4 + DP-3 leak strip-fix.
- **W1 — Spine:** DP-1 → DP-2.
- **W2 — Type the axes:** DP-3 + DP-5 + DP-6.
- **W3 — Integrity:** DP-7 + DP-8 + DP-9.
- **W4 — Confidence:** DP-10.

> Dependencies: DP-2 is the spine (DP-3/DP-6 derive from it). DP-1 enables the
> wire work (DP-3/DP-9). DP-4 is independent pure-correctness. DP-7 is the
> hand-off into Phase 2.
