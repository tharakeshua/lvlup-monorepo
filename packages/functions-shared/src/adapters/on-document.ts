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
import { REGION } from "../config/config.js";
import { makeSystemContext, type SystemContext } from "../context/auth-context.js";
import { getRepos, getAi, getClock } from "./runtime.js";
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
  return makeSystemContext(tenantId, { repos: getRepos(), ai: getAi(), clock: getClock() });
}

export function makeTrigger<T = Record<string, unknown>>(
  ref: TriggerRef,
  service: TriggerService<T>
) {
  const opts = { region: REGION, document: ref.document } as const;

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
