import { afterEach, describe, expect, test } from "bun:test";
import { hash, hmac, toHex, zs3 } from "../index.ts";

const originalFetch = globalThis.fetch;
const endpoint = "s3.local";
const storage = zs3({
  endpoint,
  accessKeyId: "mock-access-key",
  secretAccessKey: "mock-secret-key",
  bucket: "test-bucket",
});

let lastRequest = { url: null as URL | null, method: "", headers: new Headers() };

const mockFetch = (xmlContent = "", status = 200, extraHeaders: Record<string, string> = {}) => {
  globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    lastRequest.url = input instanceof URL ? input : new URL(input.toString());
    lastRequest.method = init?.method || "GET";
    lastRequest.headers = new Headers(init?.headers || {});
    return new Response(xmlContent, {
      status,
      headers: {
        "last-modified": "Tue, 03 Nov 2026 10:00:00 GMT",
        "content-length": "100",
        ...extraHeaders,
      },
    });
  }) as typeof fetch;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  lastRequest = { url: null, method: "", headers: new Headers() };
});

describe("cryptographic utilities", () => {
  test("exports deterministic HMAC, hash, and hex helpers", async () => {
    const signature = await hmac("secret", "data");
    expect(signature).toBeInstanceOf(Uint8Array);
    expect(toHex(signature)).toBe("1b2c16b75bd2a870c114153ccda5bcfca63314bc722fa160d690de133ccbb9db");
    expect(await hash("hello zeros3")).toBe("dea9a435609aadbdaf641ddb2b0d1ad1d97263798769b6e43188d0ba57b79fad");
  });
});

describe("client configuration and object operations", () => {
  test("downloads an object and clones configuration overrides", async () => {
    mockFetch();

    // #DOC_START: get-key
    /** Download an object by key. The returned response is a native Response. */
    const res = await storage.execute({ method: "GET", key: "file.txt" });
    // #DOC_END: get-key

    expect(lastRequest.url?.pathname).toBe("/test-bucket/file.txt");
    expect(lastRequest.url?.host).toBe(endpoint);
    expect(lastRequest.headers.get("authorization")).toContain("/us-east-1/s3/aws4_request");
    expect(res).toBeInstanceOf(Response);

    // #DOC_START: instance-clone
    /** Clone a client while overriding its bucket, endpoint, or region. */
    const dynamic = storage.clone({ bucket: "dynamic-bucket", endpoint: "://zone.com", region: "eu-west-1" });
    // #DOC_END: instance-clone

    // #DOC_START: put-key
    /** Upload a string, buffer, Blob, or stream as an object. */
    await dynamic.execute({ method: "PUT", key: "image.png", body: "payload" });
    // #DOC_END: put-key

    expect(lastRequest.url?.host).toBe("zone.com");
    expect(lastRequest.url?.protocol).toBe("https:");
    expect(lastRequest.url?.pathname).toBe("/dynamic-bucket/image.png");
    expect(lastRequest.headers.get("authorization")).toContain("/eu-west-1/s3/aws4_request");
  });

  test("preserves native HEAD response headers", async () => {
    mockFetch("", 200, { "x-amz-meta-custom": "hello" });

    // #DOC_START: stats-key
    /** Read object metadata without downloading its body. */
    const response = await storage.execute({ method: "HEAD", key: "doc.pdf" });
    // #DOC_END: stats-key

    expect(lastRequest.method).toBe("HEAD");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe("100");
    expect(response.headers.get("x-amz-meta-custom")).toBe("hello");
  });

  test("deletes an object", async () => {
    mockFetch("", 204);

    // #DOC_START: delete-key
    /** Permanently delete an object by key. */
    const response = await storage.execute({ method: "DELETE", key: "stale-file.tmp" });
    // #DOC_END: delete-key

    expect(lastRequest.method).toBe("DELETE");
    expect(lastRequest.url?.pathname).toBe("/test-bucket/stale-file.tmp");
    expect(response.status).toBe(204);
  });

  test("executes custom signed requests", async () => {
    mockFetch("", 200);
    const adminClient = zs3({
      endpoint: "https://amazonaws.com",
      accessKeyId: "ADMIN_ACCESS_KEY",
      secretAccessKey: "ADMIN_SECRET_KEY",
    });

    // #DOC_START: add-user
    /** Sign a custom request path and query parameters with AWS4. */
    const accessKey = "new-user-123";
    const secretKey = "super-secret-password";
    const body = JSON.stringify({ secretKey, status: "enabled" });
    const response = await adminClient.execute({
      method: "PUT",
      key: "admin/v3/add-user",
      body,
    }, {
      query: { accessKey },
      headers: { "Content-Type": "application/json" },
    });
    // #DOC_END: add-user

    expect(response.status).toBe(200);
    expect(lastRequest.method).toBe("PUT");
    expect(lastRequest.url?.pathname).toBe("/admin/v3/add-user");
    expect(lastRequest.url?.searchParams.get("access-key")).toBe("new-user-123");
    expect(lastRequest.headers.get("authorization")).toContain("AWS4-HMAC-SHA256");
    expect(lastRequest.headers.get("content-type")).toBe("application/json");
  });
});

describe("bucket listing and XML response parsing", () => {
  test("lists objects with a prefix and parses PascalCase XML fields", async () => {
    mockFetch(`
      <ListBucketResult>
        <Name>test-bucket</Name>
        <Prefix>production/</Prefix>
        <MaxKeys>1000</MaxKeys>
        <IsTruncated>false</IsTruncated>
        <Contents><Key>production/app.tar</Key><Size>31457280</Size></Contents>
        <Contents><Key>production/config.json</Key><Size>2048</Size></Contents>
      </ListBucketResult>
    `);

    // #DOC_START: get-prefix
    /** List and parse objects matching a key prefix. */
    const response = await storage.execute({ method: "GET", prefix: "production/" });
    const result = await response.json();
    // #DOC_END: get-prefix

    expect(lastRequest.url?.searchParams.get("prefix")).toBe("production/");
    expect(result.Name).toBe("test-bucket");
    expect(result.IsTruncated).toBe(false);
    expect(result.MaxKeys).toBe(1000);
    expect(result.Contents).toHaveLength(2);
    expect(result.Contents[0]).toMatchObject({ Key: "production/app.tar", Size: 31457280 });
    expect(result.Contents[1]).toMatchObject({ Key: "production/config.json", Size: 2048 });
  });

  test("normalizes missing Contents to an empty array", async () => {
    mockFetch("<ListBucketResult><Name>empty-bucket</Name><IsTruncated>false</IsTruncated></ListBucketResult>");
    const response = await storage.execute({ method: "GET" });
    const result = await response.json();
    expect(result.Name).toBe("empty-bucket");
    expect(result.IsTruncated).toBe(false);
    expect(result.Contents).toEqual([]);
  });

  test("preserves an explicitly empty root prefix", async () => {
    mockFetch("<ListBucketResult><Name>test-bucket</Name><Prefix></Prefix><IsTruncated>false</IsTruncated></ListBucketResult>");
    const response = await storage.execute({ method: "GET", prefix: "" });
    const result = await response.json();
    expect(lastRequest.url?.search).toContain("prefix=");
    expect(lastRequest.url?.pathname).toBe("/test-bucket/");
    expect(result.Prefix).toBe("");
    expect(result.Contents).toEqual([]);
  });
});

describe("S3 error responses", () => {
  test("returns structured XML error data for non-success statuses", async () => {
    mockFetch("<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>", 403);
    const response = await storage.execute({ method: "GET" });
    const data = await response.json();
    expect(response.status).toBe(403);
    expect(data.Code).toBe("AccessDenied");
    expect(data.Message).toBe("Access Denied");
  });
});

describe.skipIf(!process.env.S3_ENDPOINT)("live S3 integration", () => {
  test("lists buckets against the configured endpoint", async () => {
    const client = zs3({
      endpoint: process.env.S3_ENDPOINT ?? "",
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    });
    const response = await client.execute({ method: "GET" });
    const data = await response.json();
    expect(data).toHaveProperty("Buckets");
    expect(data).toHaveProperty("Owner.ID");
  }, 10000);
});
