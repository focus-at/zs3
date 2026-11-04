import { afterEach, describe, expect, test } from "bun:test";
import { zs3 } from "../index.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe("AWS signing and pre-signed fetch flow", () => {
  test("signs a URL that can be sent with standard fetch", async () => {
    const client = zs3({ endpoint: "https://s3.example.test", accessKeyId: "test-key", secretAccessKey: "test-secret", region: "eu-west-1" });
    const url = new URL(await client.sign({ method: "GET", bucket: "photos", key: "image.jpg" }, { expiresIn: 600, query: { download: true } }));
    expect(url.pathname).toBe("/photos/image.jpg");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(url.searchParams.get("X-Amz-Credential")).toContain("/eu-west-1/s3/aws4_request");
    expect(url.searchParams.get("download")).toBe("true");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);

    let fetched: URL | undefined;
    globalThis.fetch = (async (input: URL | RequestInfo) => {
      fetched = input instanceof URL ? input : new URL(input.toString());
      return new Response("image", { status: 200 });
    }) as typeof fetch;
    const response = await fetch(url, { method: "GET" });
    expect(response.status).toBe(200);
    expect(fetched?.href).toBe(url.href);
  });

  test("signs direct execute requests with session token and metadata headers", async () => {
    let headers = new Headers();
    globalThis.fetch = (async (_input: URL | RequestInfo, init?: RequestInit) => {
      headers = new Headers(init?.headers);
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    const client = zs3({ endpoint: "https://s3.example.test", accessKeyId: "test-key", secretAccessKey: "test-secret", sessionToken: "temporary" });
    await client.execute({ method: "PUT", bucket: "docs", key: "report.pdf", body: "contents" }, {
      headers: { "Content-Type": "application/pdf" }, meta: { cacheControl: "private" },
    });
    expect(headers.get("x-amz-security-token")).toBe("temporary");
    expect(headers.get("x-amz-meta-cache-control")).toBe("private");
    expect(headers.get("authorization")).toContain("AWS4-HMAC-SHA256");
  });
});
