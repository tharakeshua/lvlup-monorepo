/**
 * `makeTrigger` — the thin Firestore trigger shell (server-shared.md §2.9).
 * Builds a `SystemContext` scoped to the triggering tenant (extracted from the
 * document path params) and delegates 100% into `@levelup/services`.
 */
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
  onDocumentWritten,
  type FirestoreEvent,
  type QueryDocumentSnapshot,
  type DocumentSnapshot,
  type Change,
} from "firebase-functions/v2/firestore";
import type { TenantId } from "@levelup/domain";
// THE one collection-prefix source (repo-admin paths.ts, `LVLUP_COLLECTION_PREFIX`).
// Triggers must register on the SAME prefixed roots the repos read/write, or they
// listen on dead paths in prefixed deployments (e.g. prod data at `v2_tenants/…`
// while the trigger watches `tenants/…`). Never introduce a second env read.
import { paths } from "@levelup/services/repo-admin";
import { REGION } from "../config/config.js";
import { makeSystemContext, type SystemContext } from "../context/auth-context.js";
import { getRepos, getAi, getClock, getStorage, getPipelineTasks } from "./runtime.js";
import { mapError } from "../request/map-error.js";

export type TriggerEventType = "created" | "updated" | "deleted" | "written";

export interface TriggerRef {
  document: string;
  eventType: TriggerEventType;
  /** Path param that holds the tenant id (defaults to `t`). */
  tenantParam?: string;
}

/** Normalized event passed to the service: before/after snapshots + path params. */
export interface TriggerEvent<T = Record<string, unknown>> {
  type: TriggerEventType;
  params: Record<string, string>;
  before: T | null;
  after: T | null;
  id: string;
}

export type TriggerService<T> = (event: TriggerEvent<T>, ctx: SystemContext) => Promise<void>;

function tenantOf(ref: TriggerRef, params: Record<string, string>): TenantId | null {
  const key = ref.tenantParam ?? "t";
  return (params[key] as TenantId | undefined) ?? null;
}

function systemCtx(tenantId: TenantId | null): SystemContext {
  return makeSystemContext(tenantId, {
    repos: getRepos(),
    ai: getAi(),
    clock: getClock(),
    storage: getStorage(),
    // Safe to curry here: a trigger ctx's tenant comes from the doc path param
    // and is fixed for the invocation (never re-scoped by a fan-out spread).
    pipelineTasks: getPipelineTasks(),
  });
}

/**
 * Apply the env-driven top-level collection prefix to a trigger document path.
 * Prefixes the FIRST path segment only (`tenants/{t}/…` → `v2_tenants/{t}/…`);
 * subcollections inherit via the prefixed root — mirroring repo-admin `topLevel()`.
 *
 * ⚠ DEPLOY-TIME resolution: `makeTrigger` runs at module load, so the deployed
 * listen path bakes whatever `LVLUP_COLLECTION_PREFIX` is visible during the
 * Firebase CLI's function-discovery pass (`functions/<codebase>/.env.<project>`),
 * not at event time. Keep the runtime env identical or repos and triggers diverge.
 */
export function prefixTriggerDocument(document: string): string {
  const prefix = paths.collectionPrefix();
  if (!prefix) return document;
  const path = document.startsWith("/") ? document.slice(1) : document;
  return `${prefix}${path}`;
}

export function makeTrigger<T = Record<string, unknown>>(
  ref: TriggerRef,
  service: TriggerService<T>
) {
  const opts = { region: REGION, document: prefixTriggerDocument(ref.document) } as const;

  const runCreated = async (
    event: FirestoreEvent<QueryDocumentSnapshot | undefined, Record<string, string>>
  ): Promise<void> => {
    try {
      const ctx = systemCtx(tenantOf(ref, event.params));
      await service(
        {
          type: "created",
          params: event.params,
          before: null,
          after: (event.data?.data() as T) ?? null,
          id: event.data?.id ?? "",
        },
        ctx
      );
    } catch (e) {
      throw mapError(e);
    }
  };

  const runDeleted = async (
    event: FirestoreEvent<QueryDocumentSnapshot | undefined, Record<string, string>>
  ): Promise<void> => {
    try {
      const ctx = systemCtx(tenantOf(ref, event.params));
      await service(
        {
          type: "deleted",
          params: event.params,
          before: (event.data?.data() as T) ?? null,
          after: null,
          id: event.data?.id ?? "",
        },
        ctx
      );
    } catch (e) {
      throw mapError(e);
    }
  };

  const runChange = async (
    type: "updated" | "written",
    event: FirestoreEvent<Change<DocumentSnapshot> | undefined, Record<string, string>>
  ): Promise<void> => {
    try {
      const ctx = systemCtx(tenantOf(ref, event.params));
      await service(
        {
          type,
          params: event.params,
          before: (event.data?.before?.data() as T) ?? null,
          after: (event.data?.after?.data() as T) ?? null,
          id: event.data?.after?.id ?? event.data?.before?.id ?? "",
        },
        ctx
      );
    } catch (e) {
      throw mapError(e);
    }
  };

  switch (ref.eventType) {
    case "created":
      return onDocumentCreated(opts, runCreated);
    case "deleted":
      return onDocumentDeleted(opts, runDeleted);
    case "updated":
      return onDocumentUpdated(opts, (e) => runChange("updated", e));
    case "written":
      return onDocumentWritten(opts, (e) => runChange("written", e));
  }
}
