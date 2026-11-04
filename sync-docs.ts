const testFilePath = './tests/index.test.ts';
const readmeFilePath = './README.md';

const testContent = await Bun.file(testFilePath).text();
let readmeContent = await Bun.file(readmeFilePath).text();

const blockRegex = /\/\/ #DOC_START:\s*([\w-]+)([\s\S]*?)\/\/ #DOC_END:\s*\1/g;
const examples: Record<string, string> = {};

let match;
while ((match = blockRegex.exec(testContent)) !== null) {
  const [_, blockId, blockCode] = match;

  const lines = blockCode.split('\n');
  const minIndent = lines
    .filter(line => line.trim())
    .reduce((min, line) => Math.min(min, line.match(/^ */)?.[0].length || 0), Infinity);

  examples[blockId] = lines
    .map(line => line.slice(minIndent))
    .join('\n')
    .trim();
}

Object.entries(examples).forEach(([id, code]) => {
  const injectMarker = `<!-- DOC_INJECT: ${id} -->`;

  const targetRegex = new RegExp(`(${injectMarker})([\\s\\S]*?)(?=\\n(?:###|##|#|<!-- DOC_INJECT:|$))`);

  const markdownBlock = `\n\n\`\`\`typescript\n${code}\n\`\`\``;

  if (targetRegex.test(readmeContent)) {
    readmeContent = readmeContent.replace(targetRegex, `$1${markdownBlock}`);
  } else {
    readmeContent = readmeContent.replace(injectMarker, `${injectMarker}${markdownBlock}`);
  }
});

await Bun.write(readmeFilePath, readmeContent);
console.log(`✅ Updated Examples: ${Object.keys(examples).length}`);
