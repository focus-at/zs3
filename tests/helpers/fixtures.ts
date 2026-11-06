const FIXTURES_URL = new URL("../fixtures/", import.meta.url);
const INCLUDE_DIRECTIVE = /<!--include:([^<>]+)-->/g;

function fixtureURL(name: string, relativeTo = FIXTURES_URL): URL {
  const url = new URL(name, relativeTo);
  if (!url.href.startsWith(FIXTURES_URL.href)) {
    throw new Error(`Fixture path must stay inside tests/fixtures: ${name}`);
  }
  return url;
}

async function readExpandedFixture(url: URL, includeStack: string[]): Promise<string> {
  if (includeStack.includes(url.href)) {
    throw new Error(`Circular fixture include: ${[...includeStack, url.href].join(" -> ")}`);
  }

  const file = Bun.file(url);
  if (!(await file.exists())) {
    throw new Error(`Fixture not found: ${url.pathname}`);
  }

  const contents = await file.text();
  const directives = [...contents.matchAll(INCLUDE_DIRECTIVE)];
  if (!directives.length) return contents;

  let expanded = contents;
  for (const directive of directives.reverse()) {
    const [placeholder, includeName] = directive;
    const includeURL = fixtureURL(includeName.trim(), url);
    const replacement = await readExpandedFixture(includeURL, [...includeStack, url.href]);
    const start = directive.index!;
    expanded = expanded.slice(0, start) + replacement + expanded.slice(start + placeholder.length);
  }

  return expanded;
}

/** Read a fixture, expanding <!--include:filename.xml--> directives recursively. */
export async function readFixture(name: string): Promise<string> {
  return readExpandedFixture(fixtureURL(name), []);
}
