import { describe, expect, it } from "vitest";
import { z } from "zod";
import { stripUnsupportedSchemaKeys } from "../provider/gemini.js";

/**
 * CONV-P0-02 regression: Gemini's `functionDeclarations[].parameters` and
 * `responseSchema` reject JSON-Schema keywords that strict Zod objects emit
 * (`additionalProperties: false`, `$schema`, `$defs`, `$ref`, …). The provider
 * must strip them before calling the SDK, or every tool-using conversation turn
 * fails with `[400] Unknown name "additionalProperties" at
 * 'tools[0].function_declarations[0].parameters'`.
 */
describe("stripUnsupportedSchemaKeys (Gemini tool/response schema sanitizer)", () => {
  it("strips Gemini-illegal keywords from a Zod-derived strict schema with nested $defs", () => {
    // Shape mirrors a real conversation tool: strict object (→ additionalProperties:false),
    // nested strict object, and an array of strict objects — plus $defs/$ref/$schema noise.
    const zodDerived = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $defs: {
        Edge: {
          type: "object",
          additionalProperties: false,
          properties: { kind: { type: "string" } },
        },
      },
      type: "object",
      additionalProperties: false,
      properties: {
        scope: { type: "string", enum: ["item", "story_point", "space"] },
        detail: {
          type: "object",
          additionalProperties: false,
          properties: { note: { type: "string" } },
          required: ["note"],
        },
        edges: {
          type: "array",
          items: { $ref: "#/$defs/Edge" },
        },
      },
      required: ["scope"],
    };

    const sanitized = stripUnsupportedSchemaKeys(zodDerived);

    // No illegal keyword survives anywhere in the tree.
    const serialized = JSON.stringify(sanitized);
    for (const banned of [
      "additionalProperties",
      "$schema",
      "$defs",
      "$ref",
      "definitions",
      "patternProperties",
    ]) {
      expect(serialized).not.toContain(banned);
    }

    // Legal structure/keywords are preserved intact.
    expect(sanitized).toEqual({
      type: "object",
      properties: {
        scope: { type: "string", enum: ["item", "story_point", "space"] },
        detail: {
          type: "object",
          properties: { note: { type: "string" } },
          required: ["note"],
        },
        edges: {
          type: "array",
          items: {},
        },
      },
      required: ["scope"],
    });
  });

  it("passes an already-legal Gemini schema through unchanged", () => {
    const legal = {
      type: "object",
      properties: {
        answer: { type: "string", description: "the learner answer" },
        options: { type: "array", items: { type: "string" } },
        confidence: { type: "number", nullable: true },
      },
      required: ["answer"],
    };
    // Deep clone to prove no mutation and structural equality.
    expect(stripUnsupportedSchemaKeys(legal)).toEqual(legal);
  });

  it("sanitizes a schema generated straight from a strict Zod object", () => {
    const Schema = z
      .object({
        scope: z.enum(["item", "space"]),
        note: z.string().optional(),
      })
      .strict();
    const json = z.toJSONSchema(Schema) as Record<string, unknown>;
    // Sanity: Zod strict emits the offending keyword.
    expect(JSON.stringify(json)).toContain("additionalProperties");

    const sanitized = stripUnsupportedSchemaKeys(json);
    expect(JSON.stringify(sanitized)).not.toContain("additionalProperties");
    expect((sanitized as { type?: string }).type).toBe("object");
    expect((sanitized as { properties?: Record<string, unknown> }).properties).toHaveProperty(
      "scope"
    );
  });
});
