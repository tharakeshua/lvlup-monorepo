/**
 * Migration logging with progress tracking.
 * Logs to console and optionally writes a migration log to Firestore.
 */

export interface MigrationLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  context?: Record<string, unknown>;
}

export class MigrationLogger {
  private runId: string;
  private source: string;
  private entries: MigrationLogEntry[] = [];
  private startTime: number;
  private counters = {
    created: 0,
    skipped: 0,
    errors: 0,
    total: 0,
  };

  constructor(runId: string, source: string) {
    this.runId = runId;
    this.source = source;
    this.startTime = Date.now();
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log("error", message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log("debug", message, context);
  }

  private log(
    level: MigrationLogEntry["level"],
    message: string,
    context?: Record<string, unknown>
  ): void {
    const entry: MigrationLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };
    this.entries.push(entry);

    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${this.source}]`;
    if (level === "error") {
      console.error(`${prefix} ${message}`, context ? JSON.stringify(context, null, 2) : "");
    } else if (level === "warn") {
      console.warn(`${prefix} ${message}`, context ? JSON.stringify(context, null, 2) : "");
    } else {
      console.log(`${prefix} ${message}`, context ? JSON.stringify(context, null, 2) : "");
    }
  }

  incrementCreated(count = 1): void {
    this.counters.created += count;
  }

  incrementSkipped(count = 1): void {
    this.counters.skipped += count;
  }

  incrementErrors(count = 1): void {
    this.counters.errors += count;
  }

  incrementTotal(count = 1): void {
    this.counters.total += count;
  }

  getCounters(): typeof this.counters {
    return { ...this.counters };
  }

  getSummary(): {
    runId: string;
    source: string;
    durationMs: number;
    counters: { created: number; skipped: number; errors: number; total: number };
    errorCount: number;
  } {
    return {
      runId: this.runId,
      source: this.source,
      durationMs: Date.now() - this.startTime,
      counters: { ...this.counters },
      errorCount: this.entries.filter((e) => e.level === "error").length,
    };
  }

  printSummary(): void {
    const summary = this.getSummary();
    console.log("\n========== Migration Summary ==========");
    console.log(`Run ID:   ${summary.runId}`);
    console.log(`Source:   ${summary.source}`);
    console.log(`Duration: ${(summary.durationMs / 1000).toFixed(1)}s`);
    console.log(`Created:  ${summary.counters.created}`);
    console.log(`Skipped:  ${summary.counters.skipped}`);
    console.log(`Errors:   ${summary.counters.errors}`);
    console.log(`Total:    ${summary.counters.total}`);
    console.log("========================================\n");
  }
}

/** Generate a unique run ID. */
export function generateRunId(): string {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const rand = Math.random().toString(36).slice(2, 8);
  return `migration-${dateStr}-${rand}`;
}
