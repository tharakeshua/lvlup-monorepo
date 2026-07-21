import { test } from "@playwright/test";
import { loginAsStudent } from "./helpers";

test("explore spaces and questions", async ({ page }) => {
  page.on("console", (msg) => console.log("BROWSER:", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("PAGEERROR:", err.message));
  await page.goto("/login");
  await page.waitForTimeout(3000);
  console.log("TITLE:", await page.title());
  console.log("BODY LEN:", (await page.content()).length);
  await loginAsStudent(page);
  await page.goto("/spaces");
  await page.waitForTimeout(2000);
  const spaceLinks = await page.locator('a[href^="/spaces/"]').evaluateAll((els) =>
    els.map((e) => ({ href: (e as HTMLAnchorElement).getAttribute("href"), text: e.textContent }))
  );
  console.log("SPACES:", JSON.stringify(spaceLinks, null, 2));

  for (const s of spaceLinks) {
    if (!s.href) continue;
    await page.goto(s.href);
    await page.waitForTimeout(1500);
    const practiceLinks = await page.locator('a[href*="/practice/"]').evaluateAll((els) =>
      els.map((e) => ({ href: (e as HTMLAnchorElement).getAttribute("href"), text: e.textContent }))
    );
    console.log(`SPACE ${s.href} PRACTICE LINKS:`, JSON.stringify(practiceLinks));
  }
});
