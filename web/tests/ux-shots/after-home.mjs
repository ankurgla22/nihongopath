import { chromium } from "playwright";
const b = await chromium.launch();
for (const [name, vp] of [["desktop", { width: 1366, height: 850 }], ["mobile", { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp });
  await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await p.screenshot({ path: `tests/ux-shots/after-home-${name}.png`, fullPage: false });
  if (name === "mobile") { await p.mouse.wheel(0, 1600); await p.waitForTimeout(600); await p.screenshot({ path: `tests/ux-shots/after-home-mobile-scrolled.png` }); }
  await p.goto("http://localhost:3000/japanese", { waitUntil: "networkidle" });
  await p.screenshot({ path: `tests/ux-shots/after-japanese-${name}.png`, fullPage: false });
  await p.close();
}
await b.close(); console.log("shots done");
