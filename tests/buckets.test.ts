import { afterEach, describe, expect, test } from "bun:test";
import { zs3 } from "../index.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe("bucket operations", () => {
  test("issues independent requests for bucket subresources", async () => {
    const urls: URL[] = [];
    globalThis.fetch = (async (input: URL | RequestInfo) => {
      urls.push(input instanceof URL ? input : new URL(input.toString()));
      return new Response("<Configuration/>", { status: 200 });
    }) as typeof fetch;
    const client = zs3({ endpoint: "https://s3.example.test", accessKeyId: "key", secretAccessKey: "secret" });
    for (const subresource of ["acl", "versioning", "lifecycle", "policy", "tagging", "cors", "encryption", "website", "notification", "logging", "replication", "public-access-block", "object-lock"] ) {
      await client.execute({ method: "GET", bucket: "demo", key: "" }, { query: { [subresource]: "" } });
    }
    expect(urls).toHaveLength(13);
    for (const [index, subresource] of ["acl", "versioning", "lifecycle", "policy", "tagging", "cors", "encryption", "website", "notification", "logging", "replication", "public-access-block", "object-lock"].entries()) {
      expect(urls[index].searchParams.has(subresource)).toBe(true);
    }
  });

  test("sends bucket configuration request body", async () => {
    let body: BodyInit | null | undefined;
    let url: URL | undefined;
    globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
      url = input instanceof URL ? input : new URL(input.toString());
      body = init?.body;
      return new Response("", { status: 200 });
    }) as typeof fetch;
    const client = zs3({ endpoint: "https://s3.example.test", accessKeyId: "key", secretAccessKey: "secret" });
    await client.execute({ method: "PUT", bucket: "demo", key: "", body: "<VersioningConfiguration/>" }, { query: { versioning: "" } });
    expect(url?.searchParams.has("versioning")).toBe(true);
    expect(body).toBe("<VersioningConfiguration/>");
  });
});
