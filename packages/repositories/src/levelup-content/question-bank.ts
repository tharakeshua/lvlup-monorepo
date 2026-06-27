/**
 * questionBankRepo (SDK-LAYERS-PLAN §4.1, levelup-content.md).
 *
 *   list(filter)   — listQuestionBank (paginated)
 *   get(id)        — single bank item (via the batched read)
 *   getMany(ids)   — batched
 *   save(input)    — metadata only; `delete?` archive convention (D5)
 */
import {
  type ApiClientLike,
  type Page,
  type PageBag,
  type PageRequest,
  batchGetMany,
  makePaginator,
  toPage,
} from "./_kit";

export interface QuestionBankFilter extends PageRequest {
  questionType?: string;
  subject?: string;
  topics?: string[];
  difficulty?: string;
}

export interface SaveQuestionBankItemInput {
  id?: string;
  data?: Record<string, unknown>;
  delete?: boolean;
}

export interface QuestionBankRepo {
  list(filter?: QuestionBankFilter): Promise<Page<unknown>>;
  paginate(filter?: QuestionBankFilter): Promise<PageBag<unknown>>;
  getMany(ids: readonly string[]): Promise<unknown[]>;
  save(input: SaveQuestionBankItemInput): Promise<unknown>;
}

export function createQuestionBankRepo(api: ApiClientLike): QuestionBankRepo {
  const lv = api.levelup;
  return {
    list: (filter = {}) => lv["listQuestionBank"]!(filter).then((r) => toPage(r)),
    paginate: (filter = {}) => makePaginator((req) => lv["listQuestionBank"]!(req), filter),
    getMany: (ids) => batchGetMany((req) => lv["listQuestionBank"]!(req), ids),
    save: (input) => lv["saveQuestionBankItem"]!(input),
  };
}
