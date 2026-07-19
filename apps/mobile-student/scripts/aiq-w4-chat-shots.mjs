/**
 * AIQ-W4 chat-question (Surface C) live verification — HEADLESS.
 * login → direct lesson URL for "The Interview Room" (chat_agent_question) →
 * restyled ConversationScaffold. Captures intro (header/scenario/objectives/
 * starters), active transcript (bubbles + composer), a sent learner reply, and
 * the interviewer's follow-up. Shots → screenshots/aiq-w4/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:8095";
const OUT = new URL("../screenshots/aiq-w4/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const SPACE = "spc_subhang-ai-lab-space-ai-assessment-lab_09dd3311c0";
const STP = "stp_subhang-ai-lab-storypoint-ai-assessment-_2a0fd86ef0";
const LESSON = `${BASE}/learner/learn/content?spaceId=${SPACE}&storyPointId=${STP}`;

const shot = async (page, name) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: true });
  console.log("shot:", name);
};

const run = async () => {
  const browser = await chromium.launch(); // headless by default
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", (m) => {
    if (/error/i.test(m.text())) console.log("  [page]", m.text().slice(0, 140));
  });

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await page.getByPlaceholder("you@example.com").fill("student.test@subhang.academy");
  await page.getByPlaceholder("••••••••").fill("Test@12345");
  await page.getByText("Sign in", { exact: true }).click();
  await page.waitForTimeout(8000);

  // Direct to the interview lesson (chat_agent_question autostarts)
  await page.goto(LESSON, { waitUntil: "networkidle" });
  await page.waitForTimeout(7000);
  await shot(page, "10-intro-header");

  // Scroll the page down to reveal objectives / starters / transcript / composer
  await page.mouse.wheel(0, 700);
  await shot(page, "11-objectives-starters");
  await page.mouse.wheel(0, 700);
  await shot(page, "12-transcript-composer");

  // Wait for the interviewer's opening bubble to arrive, then capture
  await page.waitForTimeout(8000);
  await page.mouse.wheel(0, 400);
  await shot(page, "13-interviewer-opening");

  // Type + send a reply → learner bubble (bg-brand) + typing dots
  const composer = page
    .getByPlaceholder(/Respond to the interviewer|Write a message|Ask your tutor/i)
    .first();
  if (await composer.count()) {
    await composer.click();
    await composer.fill(
      "Before designing, I'd clarify scale: 100M DAU, read-heavy, and how we treat celebrity fan-out. I'd start with fan-out-on-write for most users and fan-out-on-read for high-follower accounts."
    );
    await page.waitForTimeout(500);
    await shot(page, "14-composer-filled");

    const send = page.getByLabel(/Send message/i).first();
    if (await send.count()) {
      await send.click();
      await page.waitForTimeout(2500);
      await shot(page, "15-reply-sent");
      await page.waitForTimeout(14000); // interviewer follow-up turn
      await page.mouse.wheel(0, 600);
      await shot(page, "16-interviewer-followup");
    } else {
      console.log("send button not found");
    }
  } else {
    console.log("composer not found (session may still be bootstrapping)");
  }

  await browser.close();
  console.log("done");
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
