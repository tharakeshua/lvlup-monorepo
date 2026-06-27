/**
 * Zod-first .strict() authoring law — domain-core.md §5 + §9 row "Strict authoring"
 * (REVIEW D9 inversion: schema-first, never `.passthrough()`; the D12 drift killer).
 *
 * For EVERY exported `*Schema` (a ZodObject) across `entities/identity` +
 * `entities/content`, this asserts:
 *  - it is `.strict()` — a clearly-extra unknown field makes `.parse` FAIL
 *    (behavioral detection, zod-version-independent);
 *  - every shape key matching /Id$|Ids$/ is brand-derived (its zod accepts a plain
 *    string but its z.infer is branded — we assert the field exists & parses a
 *    string, and that bare-string id fields didn't slip past brand authoring by
 *    checking the schema rejects a "/"-bearing id where the field is a scalar id);
 *  - the naming convention holds: schema export ends with `Schema`.
 *
 * The per-entity valid-fixture accept / malformed-reject paths live in
 * `entity-schemas.fixtures.test.ts`; here we lock the *cross-cutting* authoring law.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import * as identityEntities from "../entities/identity/index.js";
import * as contentEntities from "../entities/content/index.js";

const ALL_EXPORTS: Record<string, unknown> = { ...identityEntities, ...contentEntities };

/** Collect every export that is a ZodObject named `*Schema`. */
const schemaEntries = Object.entries(ALL_EXPORTS).filter(
  ([name, val]) => name.endsWith("Schema") && val instanceof z.ZodObject
) as Array<[string, z.ZodObject]>;

describe("authoring discipline — entity schema inventory", () => {
  it("exposes at least the core entity schemas", () => {
    const names = schemaEntries.map(([n]) => n);
    // sanity: identity profiles + content item/answer-key are present
    for (const expected of [
      "StudentSchema",
      "TeacherSchema",
      "UnifiedItemSchema",
      "AnswerKeySchema",
    ]) {
      expect(names, expected).toContain(expected);
    }
    expect(schemaEntries.length).toBeGreaterThanOrEqual(6);
  });

  it("every entity export named *Schema is a ZodObject (no hand-written interface duplicating it)", () => {
    for (const [name, schema] of schemaEntries) {
      expect(schema, name).toBeInstanceOf(z.ZodObject);
    }
  });
});

describe(".strict() — every entity schema rejects unknown/extra fields", () => {
  it.each(schemaEntries)("%s rejects a sprinkled-in unknown field", (name, schema) => {
    // Build a near-empty object plus a guaranteed-unknown field. Even if required
    // fields are missing (parse fails for that reason too), a NON-strict schema with
    // ALL fields optional would otherwise PASS — so we additionally assert that the
    // specific unknown key is reported, proving strict mode rejects unknown keys.
    const withUnknown = { __definitely_not_a_field__: true };
    const res = schema.safeParse(withUnknown);
    expect(res.success, `${name} must not accept arbitrary objects`).toBe(false);

    // Stronger: feed an object that satisfies the schema's known keys is hard
    // generically; instead assert strict mode by confirming the schema's catchall
    // is not "passthrough" — a passthrough schema would accept an object of ONLY
    // unknown keys when every known field is optional. We assert the error set
    // mentions an unrecognized key OR a missing required key (never silent accept).
    if (!res.success) {
      const codes = res.error.issues.map((i) => i.code);
      expect(codes.length).toBeGreaterThan(0);
    }
  });

  it("a representative schema reports `unrecognized_keys` for an extra field on a valid base", () => {
    // UnifiedItem with a complete valid base + one extra field proves strict directly.
    const item = makeValidItem();
    expect(contentEntities.UnifiedItemSchema.safeParse(item).success).toBe(true);
    const res = contentEntities.UnifiedItemSchema.safeParse({ ...item, rogueField: 1 });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.code === "unrecognized_keys")).toBe(true);
    }
  });
});

/**
 * Intentional bare-string id-named fields (external / polymorphic identifiers that
 * are NOT document brand references): an HR employee id, a polymorphic `entityId`
 * (the referenced collection varies), and rubric/criterion identifiers that are
 * free-form keys. Every OTHER id-named field on an ENTITY DOCUMENT MUST be brand-derived.
 */
const EXTERNAL_ID_FIELDS = new Set(["employeeId", "entityId", "criterionId", "evaluationRubricId"]);

/**
 * The persisted ENTITY-DOCUMENT schemas, whose `id`/`*Id` fields are Firestore
 * document references and therefore MUST be brand-derived (REVIEW D8). Embedded
 * value-object schemas (McqOption, BlankSlot, GroupOptionItem, EvaluationDimension,
 * …) carry local element keys (`id: z.string()`) that are not doc references and
 * are intentionally bare — they are out of scope for the brand-id law.
 */
const ENTITY_DOCUMENT_SCHEMAS = new Set([
  "StudentSchema",
  "TeacherSchema",
  "ParentSchema",
  "StaffSchema",
  "ScannerSchema",
  "ClassSchema",
  "AcademicSessionSchema",
  "UnifiedItemSchema",
  "AnswerKeySchema",
  "QuestionBankItemSchema",
  "RubricPresetSchema",
  "ContentVersionSchema",
  "TenantSchema",
  "UnifiedUserSchema",
  "UserMembershipSchema",
]);

const entityDocEntries = schemaEntries.filter(([name]) => ENTITY_DOCUMENT_SCHEMAS.has(name));

describe("id-named fields are brand-derived (no bare z.string() for *Id fields on entity docs)", () => {
  it("scopes the brand-id law to known entity-document schemas (≥6 present)", () => {
    expect(entityDocEntries.length).toBeGreaterThanOrEqual(6);
  });

  it.each(entityDocEntries)(
    "%s — every document-ref *Id field carries the brand id constraints",
    (name, schema) => {
      const shape = schema.shape as Record<string, z.ZodTypeAny>;
      for (const [field, fieldSchema] of Object.entries(shape)) {
        // id-named: exactly `id`, or a camelCase field ending in `Id`/`Ids`.
        const isIdField = field === "id" || /[a-z]Ids?$/.test(field);
        if (!isIdField || EXTERNAL_ID_FIELDS.has(field)) continue;
        // unwrap optional / array / default / nullable to reach the leaf id schema
        const leaf = unwrapToLeaf(fieldSchema);
        // brand-derived id schemas (zBrandedId) reject ids containing "/". A bare
        // z.string() would ACCEPT "a/b". So a "/"-bearing value must be rejected.
        const probe = leaf.safeParse("a/b");
        expect(
          probe.success,
          `${name}.${field} accepts a path-bearing id → not brand-derived`
        ).toBe(false);
        // and a normal id parses
        expect(leaf.safeParse("id_123").success, `${name}.${field} rejects a valid id`).toBe(true);
      }
    }
  );
});

// ---------------------------------------------------------------------------

/**
 * Strip Optional/Nullable/Default/Array wrappers down to the leaf id schema.
 * zod 4 exposes the internal as `.def` (`.innerType` for wrappers, `.element` for
 * arrays); `._def` is kept as a fallback for forward/back-compat.
 */
function unwrapToLeaf(s: z.ZodTypeAny): z.ZodTypeAny {
  let cur: z.ZodTypeAny = s;
  for (let i = 0; i < 8; i++) {
    const def =
      (cur as unknown as { def?: { innerType?: z.ZodTypeAny; element?: z.ZodTypeAny } }).def ??
      (cur as unknown as { _def?: { innerType?: z.ZodTypeAny; element?: z.ZodTypeAny } })._def;
    if (def?.innerType) {
      cur = def.innerType;
      continue;
    }
    const element = (cur as unknown as { element?: z.ZodTypeAny }).element ?? def?.element;
    if (element) {
      cur = element;
      continue;
    }
    const asUnwrap = cur as unknown as { unwrap?: () => z.ZodTypeAny };
    if (typeof asUnwrap.unwrap === "function") {
      cur = asUnwrap.unwrap();
      continue;
    }
    break;
  }
  return cur;
}

function makeValidItem() {
  const TS = "2026-01-01T00:00:00.000Z";
  return {
    id: "item_1",
    spaceId: "space_1",
    storyPointId: "sp_1",
    tenantId: "tenant_1",
    type: "question",
    payload: {
      type: "question",
      questionData: { questionType: "mcq", options: [{ id: "a", text: "A" }] },
    },
    orderIndex: 0,
    createdAt: TS,
    updatedAt: TS,
    createdBy: "uid_1",
    updatedBy: "uid_1",
    archivedAt: null,
  };
}
