/**
 * Two timestamp zod flavors on purpose:
 * - `zTimestamp`: strict, canonical — used in entities + wire response schemas.
 * - `zTimestampInput`: lenient, edge-only — accepts the trichotomy and normalizes
 *   via toTimestamp. Reserved for the server admin adapter; never in a wire response.
 */
import { z } from "zod";
import { ISO_8601_UTC, toTimestamp } from "./timestamp.js";
import type { Timestamp, TimestampInput } from "./timestamp.js";

export const zTimestamp = z
  .string()
  .regex(ISO_8601_UTC)
  .transform((s) => s as Timestamp);

export const zTimestampInput = z.preprocess((v) => toTimestamp(v as TimestampInput), zTimestamp);
