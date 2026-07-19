/** Minimal static server for the expo web export (dist/), SPA-fallback to
 *  index.html so expo-router client navigation works under Playwright. */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = new URL("../dist/", import.meta.url).pathname;
const PORT = Number(process.env.PORT || 8095);
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

const send = async (res, path) => {
  const body = await readFile(path);
  res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream" });
  res.end(body);
};

createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    let rel = normalize(url).replace(/^(\.\.[/\\])+/, "");
    let path = join(ROOT, rel);
    try {
      const s = await stat(path);
      if (s.isDirectory()) path = join(path, "index.html");
      await send(res, path);
      return;
    } catch {}
    // try route.html (expo static output), else SPA fallback to index.html
    try {
      await send(res, join(ROOT, `${rel}.html`));
      return;
    } catch {}
    await send(res, join(ROOT, "index.html"));
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
}).listen(PORT, () => console.log(`static-serve dist on http://localhost:${PORT}`));
