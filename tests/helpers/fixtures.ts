export async function readFixture(name: string): Promise<string> {
  return Bun.file(new URL(`../fixtures/${name}`, import.meta.url)).text();
}
