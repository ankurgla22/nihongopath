// Cross-platform launcher for the opt-in SSR test: sets RUN_SSR_TESTS=1 then runs vitest on tests/ssr.test.ts.
import { spawnSync } from "node:child_process";
const win = process.platform === "win32";
const r = spawnSync(win ? "npx.cmd" : "npx", ["vitest", "run", "tests/ssr.test.ts"], {
  stdio: "inherit",
  shell: win,
  env: { ...process.env, RUN_SSR_TESTS: "1" },
});
process.exit(r.status ?? 1);
