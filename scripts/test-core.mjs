import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
for (const name of readdirSync(new URL("./", import.meta.url)).filter(name => /^test-.*\.mjs$/.test(name) && name !== "test-core.mjs").sort()) {
  console.log(`\nRunning ${name}`);
  const result = spawnSync(process.execPath, [...(name === "test-songbook.mjs" ? ["--experimental-vm-modules"] : []), `scripts/${name}`], {cwd: root, stdio: "inherit"});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("\nAll web/database checks passed.");
