/**
 * The `Transport` contract this adapter IMPLEMENTS (transport-realtime.md §1).
 *
 * DP-1: the canonical `Transport` / `SubscriptionHandle` / `SubscriptionCallbacks`
 * / `StorageTransport` / `UploadBytesInput` interfaces now live in
 * `@levelup/api-contract` (`src/transport/`). This module re-exports them under
 * the names this package's internals + public barrel use (so `storage-transport.ts`,
 * `subscribe/*`, `server-time/*`, and `index.ts` resolve unchanged).
 *
 * This file imports ONLY `@levelup/api-contract` types — no firebase, no upward deps.
 */
import type { ApiErrorDetails } from "@levelup/api-contract";

/**
 * The wire-edge error envelope surfaced through subscription `error` callbacks.
 * The transport only carries the typed `ApiErrorDetails` envelope; api-client owns
 * the richer `ApiError` *mapping*. Aliased here so the contract reads cleanly.
 */
export type TransportError = ApiErrorDetails;

export type {
  Transport,
  SubscriptionHandle,
  SubscriptionCallbacks,
  StorageTransport,
  UploadBytesInput,
} from "@levelup/api-contract";

/** `next`-only function form or the full callbacks object (canonical `SubscriptionListener`). */
export type { SubscriptionListener as SubscribeCallback } from "@levelup/api-contract";
