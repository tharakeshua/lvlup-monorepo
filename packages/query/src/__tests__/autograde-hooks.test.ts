import { beforeEach, describe, expect, it, vi } from "vitest";

const hookState = vi.hoisted(() => ({
  useInfiniteQuery: vi.fn((options: unknown) => options),
  useQuery: vi.fn((options: unknown) => options),
  repos: {
    examRepo: {
      list: vi.fn(),
    },
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: hookState.useInfiniteQuery,
  useQuery: hookState.useQuery,
}));

vi.mock("../provider/useApi.js", () => ({
  useApi: () => ({ repos: hookState.repos }),
}));

import { useExams } from "../autograde/hooks.js";

describe("autograde hooks", () => {
  beforeEach(() => {
    hookState.useInfiniteQuery.mockClear();
    hookState.useQuery.mockClear();
    hookState.repos.examRepo.list.mockReset();
  });

  it("useExams starts with a concrete page param and threads next-page cursors through the repo", async () => {
    hookState.repos.examRepo.list.mockResolvedValue({ items: [], nextCursor: null });

    const options = useExams({ status: "published" } as never) as unknown as {
      initialPageParam: string | null;
      queryFn: (args: { pageParam: unknown }) => Promise<unknown>;
    };

    expect(options.initialPageParam).toBeNull();

    await options.queryFn({ pageParam: null });
    expect(hookState.repos.examRepo.list).toHaveBeenCalledWith({ status: "published" });

    await options.queryFn({ pageParam: "cursor__next" });
    expect(hookState.repos.examRepo.list).toHaveBeenLastCalledWith({
      status: "published",
      cursor: "cursor__next",
    });
  });
});
