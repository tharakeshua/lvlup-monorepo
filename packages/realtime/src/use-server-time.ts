/**
 * `use-server-time.ts` — the single client-side server-time primitive
 * (transport-realtime layer §3.2 / SDK-SERVER §7.1 open-Q #1).
 *
 * `now()` = `Date.now() + offsetMs`. Subscribes the shared `serverTimeOffset` store once
 * (deduped across all consumers via the provider). Consumed by the test-runtime countdown UI;
 * the deadline math itself lives in `@levelup/repositories`, not here (REVIEW §6 #6).
 */
import { useEffect, useState } from "react";
import { useRealtime } from "./realtime-provider.js";
import type { ServerTime } from "./types.js";

export function useServerTime(): ServerTime {
  const { serverTime } = useRealtime();
  const [offsetMs, setOffsetMs] = useState<number>(() => serverTime.getOffset());

  useEffect(() => serverTime.subscribe(setOffsetMs), [serverTime]);

  return {
    offsetMs,
    now: () => Date.now() + offsetMs,
    toServerDate: (d?: Date) => new Date((d ? d.getTime() : Date.now()) + offsetMs),
  };
}
