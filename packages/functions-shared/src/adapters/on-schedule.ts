/**
 * `makeScheduler` — the thin scheduler shell (server-shared.md §2.9). Delegates
 * into a `@levelup/services` scheduler service. A scheduler runs platform-wide,
 * so it builds a tenant-null SystemContext; per-tenant fan-out is the service's job.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { REGION } from "../config/config.js";
import { makeSystemContext, type SystemContext } from "../context/auth-context.js";
import { getRepos, getAi, getClock } from "./runtime.js";
import { mapError } from "../request/map-error.js";

export type SchedulerService = (ctx: SystemContext) => Promise<void>;

export function makeScheduler(schedule: string, service: SchedulerService) {
  return onSchedule({ region: REGION, schedule }, async (): Promise<void> => {
    try {
      const ctx = makeSystemContext(null, { repos: getRepos(), ai: getAi(), clock: getClock() });
      await service(ctx);
    } catch (e) {
      throw mapError(e);
    }
  });
}
