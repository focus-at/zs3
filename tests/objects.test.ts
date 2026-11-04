import { afterEach, describe, expect, test } from "bun:test";
import { zs3 } from "../index.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe("object listing and pagination", () => {
  test("passes list options and continuation token between pages", async () => {
    const urls: URL[] = [];
    globalThis.fetch = (async (input: URL | RequestInfo) => {
      urls.push(input instanceof URL ? input : new URL(input.toString()));
      const xml = urls.length === 1
        ? "<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>next-token</NextContinuationToken><Contents><Key>a</Key><Size>1</Size><Owner><ID>owner-1</ID></Owner></Contents></ListBucketResult>"
        : "<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>b</Key><Size>2</Size></Contents></ListBucketResult>";
      return new Response(xml, { status: 200 });
    }) as typeof fetch;
    const client = zs3({ endpoint: "https://s3.example.test", accessKeyId: "key", secretAccessKey: "secret", bucket: "demo" });
    const first = await client.execute({ method: "GET", prefix: "reports/" }, { query: { delimiter: "/", "fetch-owner": true, "max-keys": 1 } });
    const firstPage = await first.json();
    const second = await client.execute({ method: "GET", prefix: "reports/" }, { query: { "continuation-token": firstPage.NextContinuationToken, "fetch-owner": true } });
    const secondPage = await second.json();
    expect(urls[0].searchParams.get("prefix")).toBe("reports/");
    expect(urls[0].searchParams.get("delimiter")).toBe("/");
    expect(urls[0].searchParams.get("fetch-owner")).toBe("true");
    expect(urls[1].searchParams.get("continuation-token")).toBe("next-token");
    expect(firstPage.Contents[0].Owner.ID).toBe("owner-1");
    expect(secondPage.Contents[0].Key).toBe("b");
  });
});

describe("single-object operations and subresources", () => {
  test("sends metadata on upload and exposes it in HEAD response headers", async () => {
    const requests: RequestInit[] = [];
    globalThis.fetch = (async (_input: URL | RequestInfo, init?: RequestInit) => {
      requests.push(init ?? {});
      return new Response("", { status: 200, headers: { "x-amz-meta-source": "example" } });
    }) as typeof fetch;
    const client = zs3({ endpoint: "https://s3.example.test", accessKeyId: "key", secretAccessKey: "secret", bucket: "demo" });
    await client.execute({ method: "PUT", key: "report.txt", body: "hello" }, { meta: { source: "example" } });
    const head = await client.execute({ method: "HEAD", key: "report.txt" });
    expect(new Headers(requests[0].headers).get("x-amz-meta-source")).toBe("example");
    expect(head.headers.get("x-amz-meta-source")).toBe("example");
  });

  test("sends object ACL and tagging subresources without list parameters", async () => {
    const urls: URL[] = [];
    globalThis.fetch = (async (input: URL | RequestInfo) => {
      urls.push(input instanceof URL ? input : new URL(input.toString()));
      return new Response("", { status: 200 });
    }) as typeof fetch;
    const client = zs3({ endpoint: "https://s3.example.test", accessKeyId: "key", secretAccessKey: "secret", bucket: "demo" });
    await client.execute({ method: "GET", key: "report.txt" }, { query: { acl: "" } });
    await client.execute({ method: "PUT", key: "report.txt", body: "<Tagging/>" }, { query: { tagging: "" } });
    await client.execute({ method: "DELETE", key: "report.txt" }, { query: { tagging: "" } });
    expect(urls[0].searchParams.has("acl")).toBe(true);
    expect(urls[1].searchParams.has("tagging")).toBe(true);
    expect(urls[2].searchParams.has("tagging")).toBe(true);
    expect(urls.every((url) => !url.searchParams.has("list-type"))).toBe(true);
  });
});
