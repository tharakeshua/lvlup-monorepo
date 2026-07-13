/**
 * GradingQueue — Rate limiting and batch processing for LLM grading calls.
 *
 * Controls concurrency per submission to avoid overwhelming the Gemini API,
 * and provides batch utilities for processing question groups.
 */
export interface BatchConfig {
  /** Number of questions to process per batch. Default: 5. */
  batchSize: number;
  /** Max concurrent LLM calls within a batch. Default: 5. */
  maxConcurrent: number;
}
export interface BatchResult<T> {
  results: Array<
    | {
        index: number;
        value: T;
      }
    | {
        index: number;
        error: string;
      }
  >;
  successCount: number;
  failureCount: number;
  totalDurationMs: number;
}
/**
 * Process items in configurable batches with semaphore-based concurrency control.
 * Within each batch, only `maxConcurrent` promises run simultaneously.
 */
export declare function processBatch<TItem, TResult>(
  items: TItem[],
  processor: (item: TItem, index: number) => Promise<TResult>,
  config?: Partial<BatchConfig>,
  onBatchComplete?: (batchIndex: number, totalBatches: number) => void
): Promise<BatchResult<TResult>>;
/**
 * Get the default batch configuration.
 */
export declare function getDefaultBatchConfig(): BatchConfig;
