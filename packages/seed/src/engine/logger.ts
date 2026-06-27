/** Minimal, level-aware logger seam for the seed engine (no external deps). */

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

const RANK: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export interface Logger {
  level: LogLevel;
  error(msg: string, ...rest: unknown[]): void;
  warn(msg: string, ...rest: unknown[]): void;
  info(msg: string, ...rest: unknown[]): void;
  debug(msg: string, ...rest: unknown[]): void;
  /** Returns a logger that prefixes every message with `[scope]`. */
  child(scope: string): Logger;
}

export function createLogger(level: LogLevel = "info", prefix = ""): Logger {
  const enabled = (l: LogLevel) => RANK[level] >= RANK[l];
  const fmt = (msg: string) => (prefix ? `${prefix} ${msg}` : msg);
  return {
    level,
    error: (msg, ...rest) => enabled("error") && console.error(fmt(`✖ ${msg}`), ...rest),
    warn: (msg, ...rest) => enabled("warn") && console.warn(fmt(`! ${msg}`), ...rest),
    info: (msg, ...rest) => enabled("info") && console.log(fmt(msg), ...rest),
    debug: (msg, ...rest) => enabled("debug") && console.log(fmt(`· ${msg}`), ...rest),
    child: (scope: string) => createLogger(level, prefix ? `${prefix}[${scope}]` : `[${scope}]`),
  };
}
