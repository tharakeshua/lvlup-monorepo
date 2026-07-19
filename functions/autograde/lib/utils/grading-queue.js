"use strict";
/**
 * GradingQueue — Rate limiting and batch processing for LLM grading calls.
 *
 * Controls concurrency per submission to avoid overwhelming the Gemini API,
 * and provides batch utilities for processing question groups.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.processBatch = processBatch;
exports.getDefaultBatchConfig = getDefaultBatchConfig;
const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_MAX_CONCURRENT = 5;
/**
 * Simple semaphore for limiting concurrent async operations.
 */
class Semaphore {
  maxConcurrent;
  running = 0;
  queue = [];
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
  }
  async acquire() {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.running++;
        resolve();
      });
    });
  }
  release() {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
}
/**
 * Process items in configurable batches with semaphore-based concurrency control.
 * Within each batch, only `maxConcurrent` promises run simultaneously.
 */
async function processBatch(items, processor, config = {}, onBatchComplete) {
  const batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxConcurrent = config.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
  const startTime = Date.now();
  const allResults = [];
  let successCount = 0;
  let failureCount = 0;
  const totalBatches = Math.ceil(items.length / batchSize);
  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batchStart = batchIdx * batchSize;
    const batchItems = items.slice(batchStart, batchStart + batchSize);
    // Use semaphore to limit concurrent processing within this batch
    const semaphore = new Semaphore(maxConcurrent);
    const settlements = await Promise.allSettled(
      batchItems.map(async (item, localIdx) => {
        await semaphore.acquire();
        try {
          return await processor(item, batchStart + localIdx);
        } finally {
          semaphore.release();
        }
      })
    );
    for (let i = 0; i < settlements.length; i++) {
      const settlement = settlements[i];
      const globalIdx = batchStart + i;
      if (settlement.status === "fulfilled") {
        allResults.push({ index: globalIdx, value: settlement.value });
        successCount++;
      } else {
        const errorMsg =
          settlement.reason instanceof Error
            ? settlement.reason.message
            : String(settlement.reason);
        allResults.push({ index: globalIdx, error: errorMsg });
        failureCount++;
      }
    }
    if (onBatchComplete) {
      onBatchComplete(batchIdx + 1, totalBatches);
    }
  }
  return {
    results: allResults,
    successCount,
    failureCount,
    totalDurationMs: Date.now() - startTime,
  };
}
/**
 * Get the default batch configuration.
 */
function getDefaultBatchConfig() {
  return {
    batchSize: DEFAULT_BATCH_SIZE,
    maxConcurrent: DEFAULT_MAX_CONCURRENT,
  };
}
//# sourceMappingURL=grading-queue.js.map
