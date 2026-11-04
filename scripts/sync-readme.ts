import { file } from "bun";

const testPath = `${import.meta.dir}/../tests/index.test.ts`;
const readmePath = `${import.meta.dir}/../README.md`;
const source = await file(testPath).text();
let readme = await file(readmePath).text();
const blockPattern = /\/\/ #DOC_START:\s*([\w-]+)([\s\S]*?)\/\/ #DOC_END:\s*\1/g;
const blocks = new Map<string, string>();

for (const [, id, rawCode] of source.matchAll(blockPattern)) {
  const lines = rawCode.split("\n");
  const nonEmptyIndent = lines
    .filter((line) => line.trim())
    .map((line) => line.match(/^\s*/)?.[0].length ?? 0);
  const indent = Math.min(...nonEmptyIndent);
  const code = lines.map((line) => line.slice(indent)).join("\n").trim();
  blocks.set(id, code);
}

if (blocks.size === 0) {
  throw new Error("No README example blocks found in tests/index.test.ts");
}

for (const [id, code] of blocks) {
  const marker = `<!-- DOC_INJECT: ${id} -->`;
  if (!readme.includes(marker)) {
    throw new Error(`Missing README injection marker: ${marker}`);
  }

  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regionPattern = new RegExp(
    `(${escapedMarker})([\\s\\S]*?)(?=\\n(?:#{1,3}\\s|<!-- DOC_INJECT:|$))`,
  );
  const markdown = `\n\n\`\`\`typescript\n${code}\n\`\`\``;
  readme = readme.replace(regionPattern, (_match, foundMarker: string) => `${foundMarker}${markdown}`);
}

await Bun.write(readmePath, readme);
console.log(`Updated ${blocks.size} README examples. Tests do not write to README; run: bun scripts/sync-readme.ts`);
