import { chromium } from "@playwright/test";

const OUT = process.argv[2] || "/tmp/out.png";
const URL = process.argv[3] || "http://localhost:3311/dev/plant3d";
const tight = process.argv[4] === "tight";
const clean = process.argv[5] === "clean";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("PAGE EXC:", e.message));
await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("canvas", { timeout: 30000 });
if (tight) {
  await page.locator("input[type=checkbox]").check();
  await page.waitForTimeout(500);
}
if (clean) {
  await page.evaluate(() => {
    document.querySelectorAll("header, nav, [data-hud]").forEach((el) => {
      el.style.display = "none";
    });
    // Hide any small fixed-position chrome (floating buttons, dev indicators).
    document.querySelectorAll("body *").forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.position === "fixed") {
        const r = el.getBoundingClientRect();
        if (r.width < 160 && r.height < 160) el.style.display = "none";
      }
    });
  });
}
await page.waitForTimeout(5000);
await page.screenshot({ path: OUT });
console.log("saved", OUT);
await browser.close();
