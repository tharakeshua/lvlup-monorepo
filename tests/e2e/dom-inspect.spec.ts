import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";

const AUTH = "/tmp/regression-c3-auth.json";
const BASE = "http://localhost:4570";

async function ensureAuth(page: Page) {
  if (fs.existsSync(AUTH)) {
    const data = JSON.parse(fs.readFileSync(AUTH, "utf-8"));
    if (data.cookies) await page.context().addCookies(data.cookies);
  }
}

test("DOM Inspection", async ({ page }) => {
  await ensureAuth(page);

  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 25000 });
  await page.waitForTimeout(3000);

  const h1s = await page.evaluate(() =>
    Array.from(document.querySelectorAll("h1")).map((el) => ({
      text: (el as HTMLElement).innerText?.trim() || el.textContent?.trim(),
      visible: (el as HTMLElement).offsetParent !== null,
      class: el.className,
    }))
  );
  console.log("DASHBOARD h1s:", JSON.stringify(h1s, null, 2));

  // Check sidebar and nav
  const navItems = await page.evaluate(() =>
    Array.from(document.querySelectorAll('nav a, [class*="sidebar"] a, [class*="nav"] a'))
      .slice(0, 15)
      .map((el) => ({
        text: (el as HTMLElement).innerText?.trim(),
        href: (el as HTMLAnchorElement).href,
      }))
  );
  console.log("Nav items:", JSON.stringify(navItems, null, 2));

  // Check sign out
  const signOutEls = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button, a"))
      .filter(
        (el) =>
          el.textContent?.toLowerCase().includes("sign out") ||
          el.textContent?.toLowerCase().includes("logout")
      )
      .map((el) => ({
        text: el.textContent?.trim(),
        tag: el.tagName,
        visible: (el as HTMLElement).offsetParent !== null,
      }))
  );
  console.log("Sign out buttons:", JSON.stringify(signOutEls, null, 2));

  // Study planner
  await page.goto(BASE + "/study-planner", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);

  const planH1s = await page.evaluate(() =>
    Array.from(document.querySelectorAll("h1")).map((el) => ({
      text: (el as HTMLElement).innerText?.trim(),
      visible: (el as HTMLElement).offsetParent !== null,
    }))
  );
  console.log("STUDY PLANNER h1s:", JSON.stringify(planH1s, null, 2));

  const url = page.url();
  console.log("Study planner URL:", url);

  const bodySnippet = await page.evaluate(() => document.body.innerText?.slice(0, 500));
  console.log("Study planner body:", bodySnippet);

  // Check sidebar
  const sidebarEl = await page.evaluate(() => {
    const sidebar = document.querySelector('nav, [class*="sidebar"], aside');
    return sidebar
      ? { found: true, class: sidebar.className, childCount: sidebar.children.length }
      : { found: false };
  });
  console.log("Sidebar:", JSON.stringify(sidebarEl));
});
