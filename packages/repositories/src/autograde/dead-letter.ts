/**
 * `deadLetterRepo` (SDK-LAYERS-PLAN §4.1, domain plan autograde.md).
 *
 *   list(filter?, cursor?) — over listDeadLetter → Page<DeadLetterView>
 *   paginate(filter?)      — cursor-managing PageBag walker
 *   resolve(input)         — over resolveDeadLetter ({ entryId, method })
 *   isResolved(entry)      — derived: resolvedAt present
 *
 * Per-entity repo — imports `api` ONLY; never a sibling repo (R6). teacher/admin
 * only (server enforces via `deadLetter.read` / `submission.grade`).
 */
import type {
  ApiClient,
  DeadLetterFilter,
  DeadLetterResolutionMethod,
  DeadLetterView,
  ListDeadLetterRequest,
  PageResponse,
  ResolveDeadLetterResponse,
} from "./api-types.js";
import { listOnce, paginate, type PageBag } from "./paginate.js";

/** Minimal DLQ entry shape the derived helper reads. */
interface DeadLetterLike {
  resolvedAt?: unknown;
}

export interface ResolveDeadLetterInput {
  entryId: string;
  method: DeadLetterResolutionMethod;
}

export interface DeadLetterRepo {
  list(filter?: DeadLetterFilter): Promise<PageResponse<DeadLetterView>>;
  paginate(filter?: DeadLetterFilter): Promise<PageBag<DeadLetterView>>;
  resolve(input: ResolveDeadLetterInput): Promise<ResolveDeadLetterResponse>;

  // derived (computed once; no wire call)
  isResolved(entry: DeadLetterLike): boolean;
}

export function createDeadLetterRepo(api: ApiClient): DeadLetterRepo {
  const ag = api.autograde;

  const toReq = (filter?: DeadLetterFilter): ListDeadLetterRequest =>
    filter === undefined ? {} : { filter };

  return {
    list: (filter) =>
      listOnce<ListDeadLetterRequest, DeadLetterView>(
        (req) => ag.listDeadLetter(req),
        toReq(filter)
      ),
    paginate: (filter) =>
      paginate<ListDeadLetterRequest, DeadLetterView>(
        (req) => ag.listDeadLetter(req),
        toReq(filter)
      ),
    resolve: (input) =>
      ag.resolveDeadLetter({ entryId: input.entryId as never, method: input.method }),

    isResolved: (entry) => entry.resolvedAt != null,
  };
}
