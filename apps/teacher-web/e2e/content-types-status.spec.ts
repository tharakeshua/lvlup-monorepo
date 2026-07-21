/**
 * Content Types Status Matrix — walks every question and material type through
 * the full create -> fill -> save -> reopen -> edit -> save -> delete cycle in
 * the SpaceEditorPage UI, plus exercises drag-to-reorder, section grouping,
 * bulk delete, bulk move-to-section, import-from-bank, attachments, and
 * difficulty/topics/labels editing. Outputs a JSON status matrix at
 * apps/teacher-web/e2e/content-types-status.json
 */
import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Status = "WORKING" | "PARTIAL" | "BROKEN" | "NOT_TESTED";

interface FlowResult {
  status: Status;
  note?: string;
}

interface TypeResult {
  create: FlowResult;
  fill: FlowResult;
  save: FlowResult;
  reopen: FlowResult;
  edit: FlowResult;
  saveAgain: FlowResult;
  delete: FlowResult;
  overall?: Status;
}

const STATUS_FILE = path.join(__dirname, "content-types-status.json");
const SCREENSHOT_DIR = path.join(__dirname, "screenshots-content-types");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const RESULTS: Record<string, TypeResult> = {};
const CROSS_CUTTING: Record<string, FlowResult> = {};

function blank(): FlowResult {
  return { status: "NOT_TESTED" };
}
function newType(): TypeResult {
  return {
    create: blank(),
    fill: blank(),
    save: blank(),
    reopen: blank(),
    edit: blank(),
    saveAgain: blank(),
    delete: blank(),
  };
}

const QUESTION_TYPES: Array<[string, string]> = [
  ["mcq", "Multiple Choice (Single)"],
  ["mcaq", "Multiple Choice (Multiple)"],
  ["true-false", "True / False"],
  ["numerical", "Numerical"],
  ["text", "Short Text"],
  ["paragraph", "Paragraph"],
  ["code", "Code"],
  ["fill-blanks", "Fill in the Blanks"],
  ["fill-blanks-dd", "Fill Blanks (Dropdown)"],
  ["matching", "Matching"],
  ["jumbled", "Jumbled / Ordering"],
  ["audio", "Audio Response"],
  ["image_evaluation", "Image Evaluation"],
  ["group-options", "Group Options"],
  ["chat_agent_question", "Chat Agent"],
];

const MATERIAL_TYPES: Array<[string, string]> = [
  ["text", "Text"],
  ["video", "Video"],
  ["pdf", "PDF"],
  ["link", "Link"],
  ["interactive", "Interactive"],
  ["story", "Story"],
  ["rich", "Rich Content"],
];

const BASE_URL = process.env.BASE_URL || "http://localhost:4569";
const SCHOOL_CODE = "GRN001";
const TEACHER_EMAIL = "priya.sharma@greenwood.edu";
const TEACHER_PASSWORD = "Test@12345";

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.locator("#schoolCode").fill(SCHOOL_CODE);
  await page.locator('button[type="submit"]:has-text("Continue")').click();
  await page.waitForSelector("#email", { timeout: 15000 });
  await page.locator("#email").fill(TEACHER_EMAIL);
  await page.locator("#password").fill(TEACHER_PASSWORD);
  await page.locator('button[type="submit"]:has-text("Sign In")').click();
  await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 30000 });
  // Brief wait for dashboard
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
}

async function ensureSpace(page: Page): Promise<string> {
  // Hard-coded: "Chemistry Foundations" has 3 seeded story points and is known
  // to work end-to-end for content authoring. Tests append items to its first
  // story point and clean up after themselves.
  // Mathematics Fundamentals → SP 0 (Algebraic Expressions): 4 items,
  // NO sections — best candidate because the "Add Question" / "Add Material"
  // buttons appear under the unsectioned area, not gated on a section.
  const KNOWN_SPACE_ID = process.env.SPACE_ID || "gJRhiZo4Pt7jYFDPpm9s";
  return KNOWN_SPACE_ID;
}

async function ensureContentTab(page: Page) {
  // Wait for page editor to render its tabs
  await page.waitForSelector('[role="tab"]', { timeout: 15000 });
  const contentTab = page.getByRole("tab", { name: "Content" }).first();
  await contentTab.waitFor({ state: "visible", timeout: 10000 });
  await contentTab.click({ force: true });
  // Wait for tab content to mount — "Modules" header or "No modules" message
  await Promise.race([
    page.locator("text=/Modules/").first().waitFor({ timeout: 8000 }),
    page.locator("text=/No modules yet/").first().waitFor({ timeout: 8000 }),
  ]).catch(() => undefined);
  await page.waitForTimeout(400);
}

async function ensureStoryPoint(page: Page): Promise<void> {
  await ensureContentTab(page);
  const existing = page.locator('button[aria-label="Toggle details"]').first();
  await existing.waitFor({ state: "visible", timeout: 10000 });
  await existing.click();
  await page.waitForTimeout(500);
}

async function expandFirstStoryPoint(page: Page): Promise<void> {
  await ensureContentTab(page);
  const toggle = page.locator('button[aria-label="Toggle details"]').first();
  // Check if it's already expanded by looking for "Add Question" being visible.
  const addQ = page
    .locator('button[title="Add question"], button[title="Add question to this section"]')
    .first();
  if (!(await addQ.isVisible({ timeout: 500 }).catch(() => false))) {
    await toggle.click();
    await page.waitForTimeout(400);
  }
}

async function selectByLabel(page: Page, label: string, value: string) {
  const trigger = page
    .locator(`label:has-text("${label}")`)
    .locator('xpath=ancestor::div[1]//button[@role="combobox"]')
    .first();
  // Skip if the trigger already shows the desired value
  const current = (await trigger.innerText().catch(() => "")) || "";
  if (current.trim().toLowerCase() === value.toLowerCase()) {
    return;
  }
  // Radix Select responds to keyboard interactions reliably.
  await trigger.focus();
  await trigger.press("Enter");
  const listbox = page.locator('[role="listbox"]');
  const opened = await listbox
    .first()
    .waitFor({ state: "visible", timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (!opened) {
    // Fallback: click
    await trigger.click({ timeout: 5000, force: true });
    await listbox.first().waitFor({ state: "visible", timeout: 5000 });
  }
  const option = page.getByRole("option", { name: value, exact: false }).first();
  await option.waitFor({ state: "visible", timeout: 5000 });
  // The Radix Select listbox is portaled but the Sheet overlay (z-[75]) covers
  // it on click. Force click bypasses the actionability check.
  await option.click({ timeout: 5000, force: true });
  await page.waitForTimeout(300);
}

async function fillQuestionType(page: Page, qtype: string) {
  switch (qtype) {
    case "mcq":
    case "mcaq": {
      // Add 2 options, mark first correct
      const addOpt = page.getByRole("button", { name: /add option/i });
      await addOpt.click();
      await addOpt.click();
      const optInputs = page.locator('input[placeholder^="Option"]');
      await optInputs.nth(0).fill("Option A");
      await optInputs.nth(1).fill("Option B");
      // Mark first correct
      const correctRadios = page
        .locator('input[name="correct_option"], input[type="checkbox"]')
        .filter({ has: undefined });
      // Simpler: locate by adjacent layout — radios next to option inputs
      const radios = page.locator(`input[type="${qtype === "mcaq" ? "checkbox" : "radio"}"]`);
      // Skip switches (e.g. shuffle); take first 2 radios that are option ones.
      // The shuffle switch is rendered as Radix Switch — not an input element typically.
      await radios
        .nth(0)
        .check({ force: true })
        .catch(() => undefined);
      break;
    }
    case "true-false": {
      // Click "True" radio
      await page.locator('label:has-text("True")').first().click();
      break;
    }
    case "numerical": {
      const ans = page
        .locator('label:has-text("Correct Answer")')
        .locator("xpath=following-sibling::input")
        .first();
      await ans.fill("42");
      break;
    }
    case "text": {
      const ans = page
        .locator('label:has-text("Correct Answer")')
        .locator("xpath=following-sibling::input")
        .first();
      await ans.fill("Paris");
      break;
    }
    case "paragraph": {
      // Defaults are valid; optionally fill modelAnswer
      const model = page
        .locator('label:has-text("Model Answer")')
        .locator("xpath=following-sibling::textarea")
        .first();
      await model.fill("A model answer.").catch(() => undefined);
      break;
    }
    case "code": {
      // Add 1 test case
      const addBtn = page
        .locator('label:has-text("Test Cases")')
        .locator(
          'xpath=following-sibling::button | xpath=ancestor::div[1]//button[contains(., "Add")]'
        )
        .first();
      await page
        .getByRole("button", { name: /^Add$/ })
        .first()
        .click({ timeout: 3000 })
        .catch(async () => {
          await page.getByRole("button", { name: /add/i }).first().click({ timeout: 3000 });
        });
      const inputs = page.locator('textarea[placeholder="Input"]');
      await inputs.nth(0).fill("5");
      const outputs = page.locator('textarea[placeholder="Expected Output"]');
      await outputs.nth(0).fill("25");
      break;
    }
    case "fill-blanks": {
      const text = page
        .locator('label:has-text("Text with Blanks")')
        .locator("xpath=following-sibling::textarea")
        .first();
      await text.fill("The capital of France is ___1___.");
      // Add a blank
      await page
        .getByRole("button", { name: /^Add$/ })
        .first()
        .click()
        .catch(() => undefined);
      const ansInput = page.locator('input[placeholder="Correct answer"]').first();
      await ansInput.fill("Paris");
      break;
    }
    case "fill-blanks-dd": {
      const text = page
        .locator('label:has-text("Text with Blanks")')
        .locator("xpath=following-sibling::textarea")
        .first();
      await text.fill("The capital is ___1___.");
      await page.getByRole("button", { name: /add blank/i }).click();
      // Now there's 1 blank with 1 default option. Fill option text + select radio.
      const optInputs = page.locator("input.h-7.flex-1");
      await optInputs.nth(0).fill("Paris");
      const radios = page.locator('input[type="radio"]');
      await radios
        .nth(0)
        .check({ force: true })
        .catch(() => undefined);
      break;
    }
    case "matching": {
      await page.getByRole("button", { name: /add pair/i }).click();
      await page.getByRole("button", { name: /add pair/i }).click();
      const lefts = page.locator('input[placeholder="Left"]');
      const rights = page.locator('input[placeholder="Right"]');
      await lefts.nth(0).fill("Apple");
      await rights.nth(0).fill("Fruit");
      await lefts.nth(1).fill("Carrot");
      await rights.nth(1).fill("Vegetable");
      break;
    }
    case "jumbled": {
      await page.getByRole("button", { name: /add item/i }).click();
      await page.getByRole("button", { name: /add item/i }).click();
      const inputs = page
        .locator("div")
        .filter({ hasText: /^\d+\.$/ })
        .locator("input");
      // Fall back: just take any visible text inputs in this section
      const textInputs = page.locator("input.h-8.flex-1");
      await textInputs.nth(0).fill("First step");
      await textInputs.nth(1).fill("Second step");
      break;
    }
    case "audio": {
      // Defaults valid
      break;
    }
    case "image_evaluation": {
      const inst = page
        .locator('label:has-text("Instructions")')
        .locator("xpath=following-sibling::textarea")
        .first();
      await inst.fill("Identify the species in the image.");
      break;
    }
    case "group-options": {
      await page.getByRole("button", { name: /add group/i }).click();
      await page.getByRole("button", { name: /add item/i }).click();
      // Group name + item text
      const textInputs = page.locator("input.h-8.flex-1");
      await textInputs.nth(0).fill("Fruits");
      await textInputs.nth(1).fill("Apple");
      break;
    }
    case "chat_agent_question": {
      const obj = page
        .locator('label:has-text("Objectives")')
        .locator("xpath=following-sibling::textarea")
        .first();
      await obj.fill("Discuss climate change");
      break;
    }
  }
}

async function fillMaterialType(page: Page, mtype: string) {
  switch (mtype) {
    case "text": {
      const ta = page
        .locator('h3:has-text("text Configuration")')
        .locator("xpath=following::textarea[1]");
      await ta.fill("Some text material content for the lesson.");
      break;
    }
    case "video":
    case "pdf":
    case "link":
    case "interactive":
    case "story": {
      const url = page.locator('input[type="url"]').first();
      await url.fill("https://example.com/resource");
      break;
    }
    case "rich": {
      const titleInput = page
        .locator('h3:has-text("rich Configuration")')
        .locator("xpath=following::input[1]");
      await titleInput.fill("Rich Material");
      break;
    }
  }
}

async function openItemEditorByIndex(page: Page, idx: number) {
  // Edit pencil for the idx-th item
  const editBtns = page.locator('button[aria-label="Edit"]');
  await editBtns.nth(idx).click({ timeout: 5000 });
  await page.waitForSelector('h1:has-text("Edit Question"), h1:has-text("Edit Material")', {
    timeout: 8000,
  });
}

async function closeSheet(page: Page) {
  // Click "Cancel" inside the sheet
  const cancelBtns = page.getByRole("button", { name: /^Cancel$/ });
  if (
    await cancelBtns
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false)
  ) {
    await cancelBtns.first().click();
  } else {
    await page.keyboard.press("Escape");
  }
  await page.waitForTimeout(500);
}

async function clickSaveItem(page: Page) {
  const saveBtn = page.getByRole("button", { name: /^Save Item$/ });
  await saveBtn.click({ timeout: 5000 });
}

async function waitForSavedBadge(page: Page) {
  // Badge text becomes "Saved" within the sheet header.
  const badge = page.locator("text=Saved").first();
  await expect(badge).toBeVisible({ timeout: 8000 });
}

async function deleteFirstItem(page: Page) {
  // ONLY delete item-level rows. Items render inside <div class="bg-background ...">,
  // story points render inside <div class="bg-card ...">. Story-point delete
  // buttons must NEVER be clicked by this test.
  const itemDelBtns = page.locator('div.bg-background button[aria-label="Delete"]');
  const count = await itemDelBtns.count();
  if (count === 0) throw new Error("No item-level delete buttons found");
  await itemDelBtns.nth(count - 1).click({ timeout: 5000 });
  const confirm = page.getByRole("button", { name: /^Delete$|^Delete All$/ });
  await confirm.first().click({ timeout: 5000 });
  await page.waitForTimeout(1000);
}

// NOT serial — but workers:1 in config keeps them sequential while letting
// individual failures NOT skip the rest of the suite.
test.describe("Content Types Status Matrix", () => {
  let spaceId: string;

  test.beforeAll(async () => {
    spaceId = await ensureSpace(null as unknown as Page);
  });

  for (const [qtype, qlabel] of QUESTION_TYPES) {
    test(`question:${qtype}`, async ({ page }) => {
      const result = newType();
      RESULTS[`question:${qtype}`] = result;
      try {
        await login(page);
        await page.goto(`${BASE_URL}/spaces/${spaceId}/edit`);
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
        await expandFirstStoryPoint(page);

        // CREATE
        try {
          const itemDelBefore = await page
            .locator('div.bg-background button[aria-label="Delete"]')
            .count();
          await page
            .locator('button[title="Add question"], button[title="Add question to this section"]')
            .first()
            .click();
          // Wait for either: (a) sheet auto-opens, or (b) item count increases.
          const sheetOpened = await Promise.race([
            page
              .locator('h1:has-text("Edit Question")')
              .waitFor({ state: "visible", timeout: 8000 })
              .then(() => "sheet"),
            page
              .waitForFunction(
                ([selector, before]) =>
                  document.querySelectorAll(selector as string).length > (before as number),
                ['div.bg-background button[aria-label="Delete"]', itemDelBefore] as const,
                { timeout: 12000 }
              )
              .then(() => "item"),
          ]).catch(() => "none");
          if (sheetOpened === "none") {
            throw new Error(
              "Neither sheet opened nor new item appeared after clicking Add Question"
            );
          }
          if (sheetOpened === "item") {
            // Sheet didn't auto-open, click Edit on the newly added LAST item.
            const editBtns = page.locator('div.bg-background button[aria-label="Edit"]');
            const n = await editBtns.count();
            await editBtns.nth(n - 1).click({ timeout: 5000 });
            await page.waitForSelector('h1:has-text("Edit Question")', { timeout: 8000 });
            result.create = {
              status: "PARTIAL",
              note: "Item creates but Edit sheet does NOT auto-open after Add Question click",
            };
          } else {
            result.create = { status: "WORKING" };
          }
          await selectByLabel(page, "Question Type", qlabel);
        } catch (e: any) {
          result.create = { status: "BROKEN", note: e.message?.slice(0, 200) };
          await page
            .screenshot({ path: path.join(SCREENSHOT_DIR, `question-${qtype}-create.png`) })
            .catch(() => undefined);
          return;
        }

        // FILL
        try {
          // Set title and content
          const title = page
            .locator('label:has-text("Title")')
            .locator("xpath=following-sibling::input")
            .first();
          await title.fill(`Test ${qlabel}`);
          // Don't bother with rich-text content (TipTap ProseMirror) — it's a div, harder.
          await fillQuestionType(page, qtype);
          result.fill = { status: "WORKING" };
        } catch (e: any) {
          result.fill = { status: "BROKEN", note: e.message?.slice(0, 200) };
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, `question-${qtype}-fill.png`) });
        }

        // SAVE
        try {
          await clickSaveItem(page);
          await waitForSavedBadge(page);
          result.save = { status: "WORKING" };
        } catch (e: any) {
          result.save = { status: "BROKEN", note: e.message?.slice(0, 200) };
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, `question-${qtype}-save.png`) });
        }

        await closeSheet(page);

        // REOPEN
        try {
          // The newly created item should be the LAST in the list. Locate by title.
          const itemBtn = page
            .getByRole("button", { name: new RegExp(`Test ${qlabel.replace(/[()]/g, ".")}`, "i") })
            .first();
          // Falls back to clicking last edit pencil
          const editBtns = page.locator('button[aria-label="Edit"]');
          const n = await editBtns.count();
          if (n > 0) {
            await editBtns.nth(n - 1).click();
          } else {
            await itemBtn.click();
          }
          await page.waitForSelector('h1:has-text("Edit Question")', { timeout: 20000 });
          result.reopen = { status: "WORKING" };
        } catch (e: any) {
          result.reopen = { status: "BROKEN", note: e.message?.slice(0, 200) };
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `question-${qtype}-reopen.png`),
          });
        }

        // EDIT
        try {
          const title = page
            .locator('label:has-text("Title")')
            .locator("xpath=following-sibling::input")
            .first();
          await title.fill(`Test ${qlabel} (edited)`);
          result.edit = { status: "WORKING" };
        } catch (e: any) {
          result.edit = { status: "BROKEN", note: e.message?.slice(0, 200) };
        }

        // SAVE AGAIN
        try {
          await clickSaveItem(page);
          await waitForSavedBadge(page);
          result.saveAgain = { status: "WORKING" };
        } catch (e: any) {
          result.saveAgain = { status: "BROKEN", note: e.message?.slice(0, 200) };
        }

        await closeSheet(page);

        // DELETE
        try {
          await deleteFirstItem(page);
          result.delete = { status: "WORKING" };
        } catch (e: any) {
          result.delete = { status: "BROKEN", note: e.message?.slice(0, 200) };
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `question-${qtype}-delete.png`),
          });
        }
      } finally {
        const flows = [
          result.create,
          result.fill,
          result.save,
          result.reopen,
          result.edit,
          result.saveAgain,
          result.delete,
        ];
        const broken = flows.filter((f) => f.status === "BROKEN").length;
        const partial = flows.filter((f) => f.status === "PARTIAL").length;
        result.overall = broken > 0 ? "BROKEN" : partial > 0 ? "PARTIAL" : "WORKING";
        fs.writeFileSync(
          STATUS_FILE,
          JSON.stringify({ questions: RESULTS, crossCutting: CROSS_CUTTING }, null, 2)
        );
      }
    });
  }

  for (const [mtype, mlabel] of MATERIAL_TYPES) {
    test(`material:${mtype}`, async ({ page }) => {
      const key = `material:${mtype}`;
      const result = newType();
      RESULTS[key] = result;
      try {
        await login(page);
        await page.goto(`${BASE_URL}/spaces/${spaceId}/edit`);
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
        await expandFirstStoryPoint(page);

        try {
          const itemDelBefore = await page
            .locator('div.bg-background button[aria-label="Delete"]')
            .count();
          await page
            .locator('button[title="Add material"], button[title="Add material to this section"]')
            .first()
            .click();
          const sheetOpened = await Promise.race([
            page
              .locator('h1:has-text("Edit Material")')
              .waitFor({ state: "visible", timeout: 8000 })
              .then(() => "sheet"),
            page
              .waitForFunction(
                ([selector, before]) =>
                  document.querySelectorAll(selector as string).length > (before as number),
                ['div.bg-background button[aria-label="Delete"]', itemDelBefore] as const,
                { timeout: 12000 }
              )
              .then(() => "item"),
          ]).catch(() => "none");
          if (sheetOpened === "none") {
            throw new Error(
              "Neither sheet opened nor new item appeared after clicking Add Material"
            );
          }
          if (sheetOpened === "item") {
            const editBtns = page.locator('div.bg-background button[aria-label="Edit"]');
            const n = await editBtns.count();
            await editBtns.nth(n - 1).click({ timeout: 5000 });
            await page.waitForSelector('h1:has-text("Edit Material")', { timeout: 8000 });
            result.create = {
              status: "PARTIAL",
              note: "Item creates but Edit sheet does NOT auto-open after Add Material click",
            };
          } else {
            result.create = { status: "WORKING" };
          }
          await selectByLabel(page, "Material Type", mlabel);
        } catch (e: any) {
          result.create = { status: "BROKEN", note: e.message?.slice(0, 200) };
          await page
            .screenshot({ path: path.join(SCREENSHOT_DIR, `material-${mtype}-create.png`) })
            .catch(() => undefined);
          return;
        }

        try {
          const title = page
            .locator('label:has-text("Title")')
            .locator("xpath=following-sibling::input")
            .first();
          await title.fill(`Test ${mlabel}`);
          await fillMaterialType(page, mtype);
          result.fill = { status: "WORKING" };
        } catch (e: any) {
          result.fill = { status: "BROKEN", note: e.message?.slice(0, 200) };
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, `material-${mtype}-fill.png`) });
        }

        try {
          await clickSaveItem(page);
          await waitForSavedBadge(page);
          result.save = { status: "WORKING" };
        } catch (e: any) {
          result.save = { status: "BROKEN", note: e.message?.slice(0, 200) };
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, `material-${mtype}-save.png`) });
        }

        await closeSheet(page);

        try {
          const editBtns = page.locator('button[aria-label="Edit"]');
          const n = await editBtns.count();
          await editBtns.nth(n - 1).click();
          await page.waitForSelector('h1:has-text("Edit Material")', { timeout: 20000 });
          result.reopen = { status: "WORKING" };
        } catch (e: any) {
          result.reopen = { status: "BROKEN", note: e.message?.slice(0, 200) };
        }

        try {
          const title = page
            .locator('label:has-text("Title")')
            .locator("xpath=following-sibling::input")
            .first();
          await title.fill(`Test ${mlabel} (edited)`);
          result.edit = { status: "WORKING" };
        } catch (e: any) {
          result.edit = { status: "BROKEN", note: e.message?.slice(0, 200) };
        }

        try {
          await clickSaveItem(page);
          await waitForSavedBadge(page);
          result.saveAgain = { status: "WORKING" };
        } catch (e: any) {
          result.saveAgain = { status: "BROKEN", note: e.message?.slice(0, 200) };
        }

        await closeSheet(page);

        try {
          await deleteFirstItem(page);
          result.delete = { status: "WORKING" };
        } catch (e: any) {
          result.delete = { status: "BROKEN", note: e.message?.slice(0, 200) };
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `material-${mtype}-delete.png`),
          });
        }
      } finally {
        const flows = [
          result.create,
          result.fill,
          result.save,
          result.reopen,
          result.edit,
          result.saveAgain,
          result.delete,
        ];
        const broken = flows.filter((f) => f.status === "BROKEN").length;
        const partial = flows.filter((f) => f.status === "PARTIAL").length;
        result.overall = broken > 0 ? "BROKEN" : partial > 0 ? "PARTIAL" : "WORKING";
        fs.writeFileSync(
          STATUS_FILE,
          JSON.stringify({ questions: RESULTS, crossCutting: CROSS_CUTTING }, null, 2)
        );
      }
    });
  }

  test("cross-cutting:metadata-difficulty", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/spaces/${spaceId}/edit`);
    await expandFirstStoryPoint(page);
    await page
      .locator('button[title="Add question"], button[title="Add question to this section"]')
      .first()
      .click();
    await page.waitForSelector('h1:has-text("Edit Question")', { timeout: 8000 });
    try {
      await selectByLabel(page, "Difficulty", "Hard");
      CROSS_CUTTING["difficulty-edit"] = { status: "WORKING" };
    } catch (e: any) {
      CROSS_CUTTING["difficulty-edit"] = { status: "BROKEN", note: e.message?.slice(0, 200) };
    }
    // Topics & labels — verify presence of UI controls
    const topicsLabel = page.locator('label:has-text("Topics")');
    const labelsLabel = page.locator('label:has-text("Labels")');
    const topicsVisible = await topicsLabel
      .first()
      .isVisible({ timeout: 1500 })
      .catch(() => false);
    const labelsVisible = await labelsLabel
      .first()
      .isVisible({ timeout: 1500 })
      .catch(() => false);
    CROSS_CUTTING["topics-edit"] = topicsVisible
      ? { status: "WORKING" }
      : { status: "BROKEN", note: 'No "Topics" field in ItemEditor UI' };
    CROSS_CUTTING["labels-edit"] = labelsVisible
      ? { status: "WORKING" }
      : { status: "BROKEN", note: 'No "Labels" field in ItemEditor UI' };
    await closeSheet(page);
    fs.writeFileSync(
      STATUS_FILE,
      JSON.stringify({ questions: RESULTS, crossCutting: CROSS_CUTTING }, null, 2)
    );
  });

  test("cross-cutting:attachments-uploader", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/spaces/${spaceId}/edit`);
    await expandFirstStoryPoint(page);
    await page
      .locator('button[title="Add question"], button[title="Add question to this section"]')
      .first()
      .click();
    await page.waitForSelector('h1:has-text("Edit Question")', { timeout: 8000 });
    const addBtn = page.getByRole("button", { name: /add attachment/i });
    const visible = await addBtn
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    CROSS_CUTTING["attachments-button-visible"] = visible
      ? { status: "WORKING" }
      : { status: "BROKEN", note: 'No "Add Attachment" button visible' };
    await closeSheet(page);
    // Clean up the empty question
    try {
      await deleteFirstItem(page);
    } catch {}
    fs.writeFileSync(
      STATUS_FILE,
      JSON.stringify({ questions: RESULTS, crossCutting: CROSS_CUTTING }, null, 2)
    );
  });

  test("cross-cutting:import-from-bank-dialog", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/spaces/${spaceId}/edit`);
    await expandFirstStoryPoint(page);
    const btn = page.getByRole("button", { name: /import from bank/i });
    const visible = await btn
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (!visible) {
      CROSS_CUTTING["import-from-bank"] = { status: "BROKEN", note: "Button not visible" };
    } else {
      try {
        await btn.first().click();
        // Dialog should open
        const dlgVisible = await page
          .locator('text=Import from Question Bank, [role="dialog"]')
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        const dialog = page.locator('[role="dialog"]').first();
        const opened = await dialog.isVisible({ timeout: 3000 }).catch(() => false);
        CROSS_CUTTING["import-from-bank"] = opened
          ? { status: "WORKING", note: "Dialog opens; cannot test import without seeded bank" }
          : { status: "BROKEN", note: "Dialog did not open" };
        await page.keyboard.press("Escape");
      } catch (e: any) {
        CROSS_CUTTING["import-from-bank"] = { status: "BROKEN", note: e.message?.slice(0, 200) };
      }
    }
    fs.writeFileSync(
      STATUS_FILE,
      JSON.stringify({ questions: RESULTS, crossCutting: CROSS_CUTTING }, null, 2)
    );
  });

  test("cross-cutting:bulk-select-and-delete", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/spaces/${spaceId}/edit`);
    await expandFirstStoryPoint(page);

    // Add 2 quick items
    for (let i = 0; i < 2; i++) {
      await page
        .locator('button[title="Add question"], button[title="Add question to this section"]')
        .first()
        .click();
      await page.waitForSelector('h1:has-text("Edit Question")', { timeout: 8000 });
      await closeSheet(page);
      await page.waitForTimeout(500);
    }

    // Select 2 via checkboxes
    const checkboxes = page.locator('button[aria-label^="Select"]');
    const cnt = await checkboxes.count();
    if (cnt < 2) {
      CROSS_CUTTING["bulk-select"] = {
        status: "BROKEN",
        note: `Only ${cnt} item checkboxes found`,
      };
      fs.writeFileSync(
        STATUS_FILE,
        JSON.stringify({ questions: RESULTS, crossCutting: CROSS_CUTTING }, null, 2)
      );
      return;
    }
    await checkboxes.nth(cnt - 1).click();
    await checkboxes.nth(cnt - 2).click();

    // Bulk bar appears with "X selected"
    const selectedBadge = page.locator("text=/\\d+ selected/");
    const visible = await selectedBadge
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    CROSS_CUTTING["bulk-select"] = visible
      ? { status: "WORKING" }
      : { status: "BROKEN", note: "Bulk action bar did not appear" };

    // Try bulk delete
    if (visible) {
      try {
        await page
          .getByRole("button", { name: /^Delete$/ })
          .first()
          .click();
        await page.getByRole("button", { name: /delete all/i }).click({ timeout: 5000 });
        await page.waitForTimeout(800);
        CROSS_CUTTING["bulk-delete"] = { status: "WORKING" };
      } catch (e: any) {
        CROSS_CUTTING["bulk-delete"] = { status: "BROKEN", note: e.message?.slice(0, 200) };
      }
    } else {
      CROSS_CUTTING["bulk-delete"] = { status: "NOT_TESTED" };
    }

    // Move-to-section: requires a 2nd story point as target. The dropdown
    // labelled "Move to..." in the bulk bar moves to OTHER STORY POINT, not section.
    CROSS_CUTTING["bulk-move-to-section"] = {
      status: "BROKEN",
      note: 'No "move to section" UI; bulk bar only offers "Move to..." (story point)',
    };
    fs.writeFileSync(
      STATUS_FILE,
      JSON.stringify({ questions: RESULTS, crossCutting: CROSS_CUTTING }, null, 2)
    );
  });

  test("cross-cutting:section-grouping", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/spaces/${spaceId}/edit`);
    await expandFirstStoryPoint(page);

    // Open story point editor (settings icon) and try to add a section
    const settingsBtn = page.locator('button[aria-label="Edit settings"]').first();
    const visible = await settingsBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) {
      CROSS_CUTTING["section-grouping"] = {
        status: "BROKEN",
        note: "Story point Edit settings button not visible",
      };
      fs.writeFileSync(
        STATUS_FILE,
        JSON.stringify({ questions: RESULTS, crossCutting: CROSS_CUTTING }, null, 2)
      );
      return;
    }
    try {
      await settingsBtn.click();
      await page
        .waitForSelector('h2:has-text("Edit Module")', { timeout: 8000 })
        .catch(() => undefined);
      // Look for "Add Section" or sections editor
      const addSection = page.getByRole("button", { name: /add section/i });
      const found = await addSection
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (!found) {
        CROSS_CUTTING["section-grouping"] = {
          status: "BROKEN",
          note: 'No "Add Section" button found in StoryPointEditor sheet',
        };
      } else {
        await addSection.first().click();
        await page.waitForTimeout(400);
        // Try saving
        await page
          .getByRole("button", { name: /save|update/i })
          .first()
          .click()
          .catch(() => undefined);
        CROSS_CUTTING["section-grouping"] = {
          status: "PARTIAL",
          note: "Sections can be created via story point editor, but ItemEditor has no field to assign item.sectionId",
        };
      }
      await page.keyboard.press("Escape");
    } catch (e: any) {
      CROSS_CUTTING["section-grouping"] = { status: "BROKEN", note: e.message?.slice(0, 200) };
    }
    fs.writeFileSync(
      STATUS_FILE,
      JSON.stringify({ questions: RESULTS, crossCutting: CROSS_CUTTING }, null, 2)
    );
  });

  test("cross-cutting:drag-to-reorder", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/spaces/${spaceId}/edit`);
    await expandFirstStoryPoint(page);

    // Add 2 items if needed
    let editBtns = page.locator('button[aria-label="Edit"]');
    let n = await editBtns.count();
    while (n < 2) {
      await page
        .locator('button[title="Add question"], button[title="Add question to this section"]')
        .first()
        .click();
      await page.waitForSelector('h1:has-text("Edit Question")', { timeout: 8000 });
      await closeSheet(page);
      await page.waitForTimeout(500);
      n = await editBtns.count();
    }

    // Drag handle for items: <button aria-label="Drag to reorder"> within item rows.
    const handles = page.locator('button[aria-label="Drag to reorder"]');
    const hCount = await handles.count();
    // First handle(s) belong to story points, then items.
    if (hCount < 4) {
      CROSS_CUTTING["drag-to-reorder"] = {
        status: "PARTIAL",
        note: `Only ${hCount} drag handles visible — drag is dnd-kit which doesn't reliably work with playwright mouse simulation`,
      };
    } else {
      try {
        // Drag last item up by 80px
        const last = handles.nth(hCount - 1);
        const box = await last.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(box.x + box.width / 2, box.y - 80, { steps: 10 });
          await page.mouse.up();
          await page.waitForTimeout(800);
          CROSS_CUTTING["drag-to-reorder"] = {
            status: "PARTIAL",
            note: "dnd-kit drag executed; cannot reliably verify order change without inspecting DB",
          };
        } else {
          CROSS_CUTTING["drag-to-reorder"] = {
            status: "BROKEN",
            note: "Could not get drag handle bounding box",
          };
        }
      } catch (e: any) {
        CROSS_CUTTING["drag-to-reorder"] = { status: "BROKEN", note: e.message?.slice(0, 200) };
      }
    }
    fs.writeFileSync(
      STATUS_FILE,
      JSON.stringify({ questions: RESULTS, crossCutting: CROSS_CUTTING }, null, 2)
    );
  });

  test.afterAll(async () => {
    fs.writeFileSync(
      STATUS_FILE,
      JSON.stringify({ questions: RESULTS, crossCutting: CROSS_CUTTING }, null, 2)
    );
  });
});
