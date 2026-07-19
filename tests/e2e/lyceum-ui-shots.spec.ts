import { test } from "@playwright/test";
import { SEED_DATASETS } from "./helpers/selectors";

const SHOTS = "test-results/lyceum-ui";

test("lyceum spaces journey screenshots", async ({ page }) => {
  await page.goto("/login");
  await page.waitForSelector("#schoolCode, #credential", { timeout: 20000 });
  if (await page.locator("#schoolCode").count()) {
    await page.fill("#schoolCode", SEED_DATASETS.subhang.schoolCode);
    await page.click('button[type="submit"]:has-text("Continue")');
  }
  await page.waitForSelector("#credential", { timeout: 15000 });
  await page.getByRole("tab", { name: "Email" }).click();
  await page.fill("#credential", SEED_DATASETS.subhang.student.email);
  await page.fill("#password", SEED_DATASETS.subhang.student.password);
  await page.click('button[type="submit"]:has-text("Sign In")');
  await page.waitForURL(/\/(dashboard)?$/, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);

  // 1. Spaces list
  await page.goto("/spaces");
  await page.waitForSelector('h1:has-text("My Spaces")', { timeout: 20000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${SHOTS}/01-spaces-list.png`, fullPage: true });

  // 2. Space detail (first card)
  const firstCard = page.locator('a[href^="/spaces/"]').first();
  await firstCard.click();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${SHOTS}/02-space-detail.png`, fullPage: true });

  // 3. Story point viewer — first learning node on the track
  const learnNode = page.locator('a[href*="/story-points/"]').first();
  if (await learnNode.count()) {
    await learnNode.click();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${SHOTS}/03-story-point.png`, fullPage: true });

    // open first section if collapsed
    const sectionTrigger = page.locator('button[aria-expanded="false"]').first();
    if (await sectionTrigger.count()) {
      await sectionTrigger.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: `${SHOTS}/04-story-point-open.png`, fullPage: true });
    await page.goBack();
    await page.waitForTimeout(2500);
    await page.goBack();
    await page.waitForTimeout(2500);
  }

  // 4. Practice mode if the space has one
  await page.goto("/spaces");
  await page.waitForTimeout(3000);
  const cards = page.locator('a[href^="/spaces/"]');
  const cardCount = await cards.count();
  let practiceShot = false;
  for (let i = 0; i < cardCount && !practiceShot; i++) {
    await page.goto("/spaces");
    await page.waitForTimeout(3000);
    await page.locator('a[href^="/spaces/"]').nth(i).click();
    await page.waitForTimeout(4000);
    const practiceNode = page.locator('a[href*="/practice/"]').first();
    if (await practiceNode.count()) {
      await practiceNode.click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: `${SHOTS}/05-practice.png`, fullPage: true });
      practiceShot = true;
    }
  }
});
