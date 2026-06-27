/**
 * agentRepo (SDK-LAYERS-PLAN §4.1, levelup-content.md).
 *
 *   list(spaceId)  — listAgents (paginated — MERGE-PAGINATION; prompts stripped
 *                    server-side for non-authoring roles, §6.7)
 *   getMany(ids)   — batched
 *   save(input)    — metadata only; `delete?` archive convention (D5)
 *   isActive(a)    — derived boolean (D12: Agent gains `isActive`)
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

export interface AgentFilter extends PageRequest {
  spaceId: string;
  type?: string;
}

export interface SaveAgentInput {
  id?: string;
  spaceId: string;
  data?: Record<string, unknown>;
  delete?: boolean;
}

export interface AgentRepo {
  list(filter: AgentFilter): Promise<Page<unknown>>;
  paginate(filter: AgentFilter): Promise<PageBag<unknown>>;
  getMany(ids: readonly string[]): Promise<unknown[]>;
  save(input: SaveAgentInput): Promise<unknown>;
  isActive(agent: { isActive?: boolean }): boolean;
}

export function createAgentRepo(api: ApiClientLike): AgentRepo {
  const lv = api.levelup;
  return {
    list: (filter) => lv["listAgents"]!(filter).then((r) => toPage(r)),
    paginate: (filter) => makePaginator((req) => lv["listAgents"]!(req), filter),
    getMany: (ids) => batchGetMany((req) => lv["listAgents"]!(req), ids),
    save: (input) => lv["saveAgent"]!(input),
    isActive: (agent) => agent.isActive !== false,
  };
}
