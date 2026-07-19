import { describe, expect, it } from "vitest";
import { makeEntityRepo } from "./entity-repo";

interface FakeRow {
  id: string;
  [key: string]: unknown;
}

class FakeDocSnap {
  constructor(private readonly row: FakeRow) {}

  get id(): string {
    return this.row.id;
  }

  data(): Record<string, unknown> {
    const { id: _id, ...data } = this.row;
    return data;
  }

  get(field: string): unknown {
    return this.row[field];
  }
}

class FakeQuery {
  private whereClauses: Array<[unknown, string, unknown]> = [];
  private orderField: unknown = "__name__";
  private afterArgs: unknown[] | null = null;
  private limitValue = Number.POSITIVE_INFINITY;

  constructor(private readonly rows: FakeRow[]) {}

  where(field: unknown, op: string, value: unknown): FakeQuery {
    expect(["==", "array-contains"]).toContain(op);
    const next = this.clone();
    next.whereClauses.push([field, op, value]);
    return next;
  }

  orderBy(field: unknown): FakeQuery {
    const next = this.clone();
    next.orderField = field;
    return next;
  }

  startAfter(...args: unknown[]): FakeQuery {
    const next = this.clone();
    next.afterArgs = args;
    return next;
  }

  limit(n: number): FakeQuery {
    const next = this.clone();
    next.limitValue = n;
    return next;
  }

  async get(): Promise<{ docs: FakeDocSnap[] }> {
    const ordered = this.rows
      .filter((row) =>
        this.whereClauses.every(([field, op, value]) => {
          const fieldVal = this.value(row, field);
          if (op === "array-contains") {
            return Array.isArray(fieldVal) && fieldVal.includes(value);
          }
          return fieldVal === value;
        })
      )
      .sort((a, b) =>
        String(this.value(a, this.orderField)).localeCompare(String(this.value(b, this.orderField)))
      );
    const start = this.afterArgs ? this.indexAfter(ordered, this.afterArgs) : 0;
    return {
      docs: ordered.slice(start, start + this.limitValue).map((row) => new FakeDocSnap(row)),
    };
  }

  doc(): { id: string } {
    return { id: "new_doc" };
  }

  private clone(): FakeQuery {
    const next = new FakeQuery(this.rows);
    next.whereClauses = [...this.whereClauses];
    next.orderField = this.orderField;
    next.afterArgs = this.afterArgs ? [...this.afterArgs] : null;
    next.limitValue = this.limitValue;
    return next;
  }

  private value(row: FakeRow, field: unknown): unknown {
    return typeof field === "string" && field !== "__name__" ? row[field] : row.id;
  }

  private indexAfter(rows: FakeRow[], args: unknown[]): number {
    const idx =
      args.length === 1
        ? rows.findIndex((row) => row.id === args[0])
        : rows.findIndex(
            (row) => this.value(row, this.orderField) === args[0] && row.id === args[1]
          );
    return idx >= 0 ? idx + 1 : 0;
  }
}

describe("makeEntityRepo.list", () => {
  it("continues past filtered mixed-kind docs before returning an exam page", async () => {
    const rows: FakeRow[] = [
      { id: "exam_1", title: "Parent 1" },
      ...Array.from({ length: 24 }, (_, i) => ({
        id: `exam_1_q${String(i + 1).padStart(2, "0")}`,
        _kind: "examQuestion",
        examId: "exam_1",
      })),
      { id: "exam_2", title: "Parent 2" },
      { id: "exam_3", title: "Parent 3" },
    ];
    const firestore = {
      collection: () => new FakeQuery(rows),
    };
    const repo = makeEntityRepo(firestore as never, "exams", () => "2026-01-01T00:00:00.000Z");

    const first = await repo.list("tenant_subhang", {
      filter: (d) => d["_kind"] !== "examQuestion",
      limit: 2,
    });
    expect(first.items.map((item) => item["id"])).toEqual(["exam_1", "exam_2"]);
    expect(first.nextCursor).toBeTruthy();

    const second = await repo.list("tenant_subhang", {
      filter: (d) => d["_kind"] !== "examQuestion",
      cursor: first.nextCursor ?? undefined,
      limit: 2,
    });
    expect(second.items.map((item) => item["id"])).toEqual(["exam_3"]);
    expect(second.nextCursor).toBeNull();
  });

  it("filters array membership fields (classIds) via array-contains, not ==", async () => {
    const rows: FakeRow[] = [
      { id: "stu_1", displayName: "Aarav", classIds: ["cls_a", "cls_b"] },
      { id: "stu_2", displayName: "Diya", classIds: ["cls_b"] },
      { id: "stu_3", displayName: "Rohan", classIds: ["cls_c"] },
    ];
    const firestore = { collection: () => new FakeQuery(rows) };
    const repo = makeEntityRepo(firestore as never, "students", () => "2026-01-01T00:00:00.000Z");

    const inClassA = await repo.list("tenant_subhang", { where: { classIds: "cls_a" } });
    expect(inClassA.items.map((i) => i["id"])).toEqual(["stu_1"]);

    const inClassB = await repo.list("tenant_subhang", { where: { classIds: "cls_b" } });
    expect(inClassB.items.map((i) => i["id"]).sort()).toEqual(["stu_1", "stu_2"]);
  });
});
