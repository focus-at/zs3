import { afterEach, describe, expect, test } from "bun:test";
import { zs3 } from "../index.ts";

describe("signing and request options", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("creates a presigned URL with expiry and custom query parameters", async () => {
    const client = zs3({
      endpoint: "https://s3.example.test",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      region: "eu-west-1",
    });

    const signedUrl = new URL(await client.sign(
      { method: "GET", bucket: "photos", key: "image.jpg" },
      {
        expiresIn: 600,
        query: { download: true },
      },
    ));

    expect(signedUrl.origin).toBe("https://s3.example.test");
    expect(signedUrl.pathname).toBe("/photos/image.jpg");
    expect(signedUrl.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(signedUrl.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(signedUrl.searchParams.get("X-Amz-Credential")).toContain("/eu-west-1/s3/aws4_request");
    expect(signedUrl.searchParams.get("download")).toBe("true");
    expect(signedUrl.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
  });

  test("sends session tokens and custom metadata as request headers", async () => {
    let capturedHeaders = new Headers();
    globalThis.fetch = (async (_input: URL | RequestInfo, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    const client = zs3({
      endpoint: "https://s3.example.test",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      sessionToken: "temporary-session-token",
      bucket: "documents",
    });

    const response = await client.execute(
      { method: "PUT", key: "report.pdf", body: "contents" },
      {
        headers: { "Content-Type": "application/pdf" },
        meta: { cacheControl: "private" },
      },
    );

    expect(response.status).toBe(200);
    expect(capturedHeaders.get("x-amz-security-token")).toBe("temporary-session-token");
    expect(capturedHeaders.get("content-type")).toBe("application/pdf");
    expect(capturedHeaders.get("x-amz-meta-cache-control")).toBe("private");
    expect(capturedHeaders.get("authorization")).toContain("AWS4-HMAC-SHA256");
  });

  test("parses an empty ListObjects response with an empty Contents array", async () => {
    globalThis.fetch = (async () => new Response(
      "<ListBucketResult><Name>empty-bucket</Name><IsTruncated>false</IsTruncated></ListBucketResult>",
      { status: 200 },
    )) as typeof fetch;

    const client = zs3({
      endpoint: "https://s3.example.test",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      bucket: "empty-bucket",
    });

    const response = await client.execute({ method: "GET" });
    const result = await response.json();

    expect(result.Name).toBe("empty-bucket");
    expect(result.IsTruncated).toBe(false);
    expect(result.Contents).toEqual([]);
  });
});
