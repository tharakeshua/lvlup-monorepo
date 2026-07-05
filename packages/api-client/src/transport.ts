/**
 * The injected `Transport` seam (api-client-core.md §0 "Transport", §3.1;
 * transport-realtime.md §1).
 *
 * DP-1: the canonical `Transport` / `SubscriptionHandle` / `SubscriptionCallbacks`
 * / `SubscriptionListener` interfaces now live in `@levelup/api-contract`
 * (`src/transport/`). api-client is transport-agnostic — it NEVER imports
 * `@levelup/transport-*` or `firebase` — and receives a concrete impl by
 * injection. This module re-exports the canonical seam so api-client's public
 * surface (`index.ts`) and internals (`realtime.ts`, `create-client.ts`) keep
 * importing them from `./transport.js` unchanged.
 *
 * The subscription `error` callback carries the wire-edge `ApiErrorDetails`
 * envelope (the canonical seam type); api-client's own `normalizeError` still
 * produces the richer `ApiError` class downstream — the seam just stops
 * over-claiming that it carries the class.
 */
export type {
  Transport,
  SubscriptionHandle,
  SubscriptionCallbacks,
  SubscriptionListener,
  StorageTransport,
} from "@levelup/api-contract";
