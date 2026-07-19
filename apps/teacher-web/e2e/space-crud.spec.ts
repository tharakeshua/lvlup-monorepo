import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");

type AxeViolation = {
  id: string;
  impact: string | null;
  nodes: unknown[];
};

async function runWcagAudit(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ path: axePath });
  return page.evaluate(async () => {
    const axe = (
      globalThis as typeof globalThis & {
        axe: {
          run: (
            root: Document,
            options: Record<string, unknown>
          ) => Promise<{ violations: AxeViolation[] }>;
        };
      }
    ).axe;
    const result = await axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      },
    });
    return result.violations;
  });
}

test.describe("Teacher Spaces deterministic browser gate", () => {
  for (const viewport of [
    { name: "mobile", width: 375, height: 812 },
    { name: "desktop", width: 1280, height: 800 },
  ]) {
    test(`protects Spaces and keeps the sign-in gate WCAG-clean on ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/spaces");

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: "Teacher Portal" })).toBeVisible();
      await expect(page.getByLabel("School Code")).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);

      const violations = await runWcagAudit(page);
      expect(
        violations.filter(({ impact }) => impact === "critical" || impact === "serious"),
        JSON.stringify(violations, null, 2)
      ).toEqual([]);
    });
  }

  test("supports keyboard submit and preserves the school code after an offline failure", async ({
    page,
  }) => {
    await page.route("**/v1-identity-lookupTenantByCode", (route) =>
      route.abort("internetdisconnected")
    );
    await page.goto("/spaces");
    const schoolCode = page.getByLabel("School Code");
    const continueButton = page.getByRole("button", { name: "Continue" });

    await expect(page).toHaveURL(/\/login$/);
    await expect(schoolCode).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(schoolCode).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(continueButton).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await schoolCode.fill("OFFLINE01");
    await schoolCode.press("Enter");

    await expect(page.getByText("Failed to look up school code. Please try again.")).toBeVisible({
      timeout: 10_000,
    });
    await expect(schoolCode).toHaveValue("OFFLINE01");
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  test("runs every item/preview type and structural operation in the real browser module graph", async ({
    page,
  }) => {
    await page.goto("/login");

    const result = await page.evaluate(async () => {
      const itemModelPath = "/src/components/spaces/item-authoring-model.ts";
      const previewModelPath = "/src/components/spaces/student-preview-model.ts";
      const structurePath = "/src/components/spaces/story-point-structure.ts";
      const itemModel = await import(itemModelPath);
      const previewModel = await import(previewModelPath);
      const structure = await import(structurePath);

      const questionTypes = itemModel.QUESTION_TYPES.map(({ value }: { value: string }) => value);
      const materialTypes = itemModel.MATERIAL_TYPES.map(({ value }: { value: string }) => value);
      const questionPreviewSupport = questionTypes.map((type: string) =>
        previewModel.isSupportedPreviewItem({
          id: `question-${type}`,
          type: "question",
          content: "Prompt",
          payload: { questionType: type, questionData: { questionType: type } },
        })
      );
      const materialPreviewSupport = materialTypes.map((type: string) =>
        previewModel.isSupportedPreviewItem({
          id: `material-${type}`,
          type: "material",
          payload: { materialType: type },
        })
      );

      const reordered = structure.reorderStoryPoints(
        [
          { id: "first", title: "First", orderIndex: 9, sections: [] },
          { id: "second", title: "Second", orderIndex: 9, sections: [] },
          { id: "third", title: "Third", orderIndex: 1, sections: [] },
        ],
        2,
        0
      );
      const duplicate = structure.createStoryPointDuplicatePlan(
        {
          id: "source",
          title: "Source",
          type: "quiz",
          orderIndex: 0,
          sections: [
            { id: "later", title: "Later", orderIndex: 4 },
            { id: "first", title: "First", orderIndex: 1 },
          ],
        },
        3,
        (section: { id: string }) => `copy-${section.id}`
      );

      return {
        questionTypes,
        materialTypes,
        questionPreviewSupport,
        materialPreviewSupport,
        reordered: reordered.map(({ id, orderIndex }: { id: string; orderIndex: number }) => [
          id,
          orderIndex,
        ]),
        duplicateTitle: duplicate.data.title,
        duplicateSections: duplicate.data.sections.map(
          ({ id, orderIndex }: { id: string; orderIndex: number }) => [id, orderIndex]
        ),
      };
    });

    expect(result.questionTypes).toEqual([
      "mcq",
      "mcaq",
      "true-false",
      "numerical",
      "text",
      "paragraph",
      "code",
      "fill-blanks",
      "fill-blanks-dd",
      "matching",
      "jumbled",
      "audio",
      "image_evaluation",
      "group-options",
      "chat_agent_question",
    ]);
    expect(result.materialTypes).toEqual([
      "text",
      "video",
      "pdf",
      "link",
      "interactive",
      "story",
      "rich",
    ]);
    expect(result.questionPreviewSupport).toEqual(Array(15).fill(true));
    expect(result.materialPreviewSupport).toEqual(Array(7).fill(true));
    expect(result.reordered).toEqual([
      ["third", 0],
      ["first", 1],
      ["second", 2],
    ]);
    expect(result.duplicateTitle).toBe("Source copy");
    expect(result.duplicateSections).toEqual([
      ["copy-first", 0],
      ["copy-later", 1],
    ]);
  });
});
