import { readdir } from "node:fs/promises";
import { join } from "node:path";

const examplesDir = join(import.meta.dir, "..", "examples");
const files = (await readdir(examplesDir)).filter((name) => name.endsWith(".ts"));
if (!files.length) throw new Error("No examples found");
const result = await Bun.build({
  entrypoints: files.map((name) => join(examplesDir, name)),
  outdir: "/tmp/zs3-examples-check",
  target: "bun",
  write: false,
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exitCode = 1;
} else {
  console.log(`Bundled ${files.length} examples.`);
}
