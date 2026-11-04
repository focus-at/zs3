import { describe, test, expect, afterEach, beforeEach } from "bun:test";
import { zs3, hash, hmac, toHex } from "../index.ts";

describe("ZeroS3 / zs3 Core Tests", () => {
  const originalFetch = globalThis.fetch;
  const endpoint = 's3.local';

  // #DOC_START: client-init
  /**
   * Initialize a new S3 client instance.
   * Accepts full S3-compatible API credentials and endpoints (e.g., AWS S3, MinIO, Yandex Cloud).
   */
  const storage = zs3({
    endpoint,
    accessKeyId: "mock-access-key",
    secretAccessKey: "mock-secret-key",
    bucket: "test-bucket",
  });
  // #DOC_END: client-init

  let lastRequest = { url: null as URL | null, method: "", headers: new Headers() };

  const mockFetch = (xmlContent = "", status = 200, extraHeaders: Record<string, string> = {}) => {
    globalThis.fetch = (async (url: URL | string, init?: RequestInit) => {
      lastRequest.url = typeof url === "string" ? new URL(url) : url;
      lastRequest.method = init?.method || "GET";

      // Безопасно парсим любые варианты переданных заголовков (объект или Headers)
      lastRequest.headers = new Headers(init?.headers || {});

      return new Response(xmlContent, {
        status,
        headers: { "last-modified": "Tue, 03 Nov 2026 10:00:00 GMT", "content-length": "100", ...extraHeaders }
      });
    }) as unknown as typeof fetch;
  };

  beforeEach(() => {
    lastRequest = { url: null, method: "", headers: new Headers() };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("should correctly export core cryptographic utilities with strict check", async () => {
    const signature = await hmac("secret", "data");
    expect(signature).toBeInstanceOf(Uint8Array);
    expect(toHex(signature)).toBe("1b2c16b75bd2a870c114153ccda5bcfca63314bc722fa160d690de133ccbb9db");
    expect(await hash("hello zeros3")).toBe("dea9a435609aadbdaf641ddb2b0d1ad1d97263798769b6e43188d0ba57b79fad");
  });

  test("should correctly merge config defaults and reactively update on changes via execute", async () => {
    mockFetch();

    // #DOC_START: get-key
    /**
     * Download a specific object from the S3 bucket by its key.
     * Returns a native Response object containing the file data stream or payload.
     */
    const res = await storage.execute({ method: "GET", key: "file.txt" });
    // #DOC_END: get-key

    expect(lastRequest.url?.pathname).toBe("/test-bucket/file.txt");
    expect(lastRequest.url?.host).toBe(endpoint);


    expect(lastRequest.headers.get("Authorization")).toContain("/us-east-1/s3/aws4_request");

    // #DOC_START: instance-clone
    /**
     * Clone an existing S3 client instance to override specific configuration settings
     * such as the bucket, endpoint, or region while maintaining the original credentials.
     */
    const dynamic = storage.clone({
      bucket: "dynamic-bucket",
      endpoint: "://zone.com",
      region: "eu-west-1"
    });
    // #DOC_END: instance-clone

    // #DOC_START: put-key
    /**
     * Upload a payload or file directly to the S3 bucket using the PUT method.
     * Supports string payloads, buffers, blobs, and streams.
     */
    await dynamic.execute({ method: "PUT", key: "image.png", body: "payload" });
    // #DOC_END: put-key

    expect(lastRequest.url?.host).toBe("zone.com");
    expect(lastRequest.url?.protocol).toBe("https:");
    expect(lastRequest.url?.pathname).toBe("/dynamic-bucket/image.png");
    expect(lastRequest.headers.get("Authorization")).toContain("/eu-west-1/s3/aws4_request");
  });

  test("should perfectly parse ListObjectsV2 XML data and format PascalCase fields", async () => {
    const xmlMock = `
      <ListBucketResult>
        <Name>test-bucket</Name>
        <Prefix>production/</Prefix>
        <MaxKeys>1000</MaxKeys>
        <IsTruncated>false</IsTruncated>
        <Marker></Marker>
        <NextMarker/>
        <Contents>
          <Key>production/app.tar</Key>
          <Size>31457280</Size>
        </Contents>
        <Contents>
          <Key>production/config.json</Key>
          <Size>2048</Size>
        </Contents>
      </ListBucketResult>
    `;

    mockFetch(xmlMock);

    // #DOC_START: get-prefix
    /**
     * List objects within the bucket that match a specific key prefix.
     * Automatically parses the S3 XML response into a clean JSON structure.
     */
    const response = await storage.execute({ method: "GET", prefix: "production/" });
    const result = await response.json();
    // #DOC_END: get-prefix

    // Проверяем строго оригинальный регистр XML (PascalCase)
    expect(result.Name).toBe("test-bucket");
    expect(result.Marker).toBe("");
    expect(result.NextMarker).toBe("");
    expect(result.IsTruncated).toBe(false);
    expect(result.MaxKeys).toBe(1000);

    // Проверяем массив Contents
    expect(result.Contents).toBeInstanceOf(Array);
    expect(result.Contents.length).toBe(2);
    expect(result.Contents[0].Key).toBe("production/app.tar");
    expect(result.Contents[0].Size).toBe(31457280);
    expect(result.Contents[1].Key).toBe("production/config.json");
    expect(result.Contents[1].Size).toBe(2048);
  });

  test("should clean root prefix and handle completely empty buckets with empty Contents array", async () => {
    mockFetch(`
      <ListBucketResult>
        <Name>test-bucket</Name>
        <Prefix></Prefix>
        <MaxKeys>1000</MaxKeys>
        <IsTruncated>false</IsTruncated>
        <Contents>
          <Key>production/app.tar</Key>
          <Size>31457280</Size>
        </Contents>
      </ListBucketResult>
    `);

    const response = await storage.execute({ method: "GET", prefix: "" });
    const result = await response.json();

    expect(lastRequest.url?.search).toContain("prefix=");
    expect(lastRequest.url?.pathname).toBe("/test-bucket/");

    expect(result.Prefix).toBe("");
    // Ключевой контракт: Contents обязан быть массивом, даже если тега нет в XML
    expect(result.Contents).toBeInstanceOf(Array);
    expect(result.Contents.length).toBe(1);
  });

  // --- ДОБАВЛЕННЫЕ ТЕСТЫ НА РАЗЛИЧНЫЕ ТИПЫ ЗАПРОСОВ И ОШИБКИ ---

  test("should correctly execute HEAD requests and preserve native headers", async () => {
    mockFetch("", 200, { "x-amz-meta-custom": "hello" });

    // #DOC_START: stats-key
    /**
     * Retrieve metadata and headers for a specific object without downloading its content.
     * Useful for checking file existence, size, or content type efficiently.
     */
    const response = await storage.execute({ method: "HEAD", key: "doc.pdf" });
    // #DOC_END: stats-key

    expect(lastRequest.method).toBe("HEAD");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe("100");
    expect(response.headers.get("x-amz-meta-custom")).toBe("hello");
  });

  test("should correctly execute DELETE requests", async () => {
    mockFetch("", 204);
    // #DOC_START: delete-key
    /**
     * Permanently delete a specific object from the S3 bucket by its key.
     * This operation is irreversible and removes the target file immediately.
     */
    const response = await storage.execute({ method: "DELETE", key: "stale-file.tmp" });
    // #DOC_END: delete-key
    expect(lastRequest.method).toBe("DELETE");
    expect(lastRequest.url?.pathname).toBe("/test-bucket/stale-file.tmp");
    expect(response.status).toBe(204);
  });

  test("sign request", async () => {
    // #DOC_START: sign-request
    /**
     * Generate a pre-signed URL for a specific S3 operation.
     * This allows temporary, secure access to a resource with dynamic parameters
     * without exposing permanent AWS credentials to the client.
     */
    // Минимальный инстанс только со статичными ключами
    const signer = zs3({
      endpoint: 'https://amazonaws.com',
      accessKeyId: 'YOUR_ACCESS_KEY_ID',
      secretAccessKey: 'YOUR_SECRET_ACCESS_KEY'
    });

    // Все динамические параметры передаем в сам запрос
    const url = await signer.sign({
      method: 'GET',
      bucket: 'my-dynamic-bucket', // Указываем тут
      key: 'photo.jpg'
    }, {
      query: { 'X-Amz-Region': 'eu-west-1' } // Если регион отличается от дефолтного
    });
    // #DOC_END: sign-request

    expect(url).toBeDefined();
    expect(typeof url).toBe("string");
    expect(url).toContain("my-dynamic-bucket");
    expect(url).toContain("photo.jpg");
    expect(url).toContain("X-Amz-Region=eu-west-1");
  });

  test("should correctly execute custom AWS4 request", async () => {
    mockFetch("/admin/v3/add-user?accessKey=new-user-123", 200);

    // #DOC_START: add-user
    /**
     * Execute custom request using AWS4 signature without prepending a bucket name to the URI.
     */

    const adminClient = zs3({
      endpoint: 'https://amazonaws.com',
      accessKeyId: 'ADMIN_ACCESS_KEY',
      secretAccessKey: 'ADMIN_SECRET_KEY'
    });

    const accessKey = "new-user-123";
    const secretKey = "super-secret-password";
    const body = JSON.stringify({ secretKey, status: 'enabled' });

    const response = await adminClient.execute({
      method: 'PUT',
      key: 'admin/v3/add-user',
      body: body
    }, {
      query: { accessKey },
      headers: { 'Content-Type': 'application/json' }
    });
    // #DOC_END: add-user

    expect(lastRequest.method).toBe("PUT");
    expect(lastRequest.url?.pathname).toBe("/admin/v3/add-user");
    expect(lastRequest.url?.searchParams.get("access-key")).toBe("new-user-123");
    expect(lastRequest.headers.get("authorization")).toContain("AWS4-HMAC-SHA256");
    expect(lastRequest.headers.get("content-type")).toBe("application/json");
  });

  test("should correctly handle and throw structured S3 errors (403, 404)", async () => {
    const errorXml = `
      <Error>
        <Code>AccessDenied</Code>
        <Message>Access Denied</Message>
      </Error>
    `;
    mockFetch(errorXml, 403);

    try {
      await storage.execute({ method: "GET" });
      expect().fail("Should have thrown an S3 error");
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.Error.Code).toBe("AccessDenied");
      expect(err.Error.Message).toBe("Access Denied");
    }
  });

  test("should catch network failures and mask them into a unified 500 error", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    try {
      await storage.execute({ method: "GET", key: "file.bin" });
      expect().fail("Should have thrown a 500 network error");
    } catch (err: any) {
      expect(err.status).toBe(500);
      expect(err.Error.Code).toBe("TypeError");
      expect(err.Error.Message).toBe("fetch failed");
    }
  });

  const runIntegration = !!process.env.S3_ENDPOINT;

  (runIntegration ? describe : describe.skip)("S3 Real Integration Tests", () => {
    expect(runIntegration).toBe(true);

    test("should catch network failures and mask them into a unified 500 error", async () => {
      const storage = zs3({
        endpoint: process.env.S3_ENDPOINT ?? '',
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
        bucket: process.env.S3_BUCKET,
      });

      console.log('created');

      const res = await storage.execute({ method: 'POST', key: 'large-file.zip', bucket: 'my-bucket' });

      const { UploadId } = await res.json();

      const chunkBytes = new Uint8Array([1, 2, 3, 4, 5]);

      const partRes = await storage.execute({
        method: 'PUT',
        key: 'large-file.zip',
        bucket: 'my-bucket',
        uploadId: UploadId,
        partNumber: 1,
        body: chunkBytes // Blob, Uint8Array или ArrayBuffer
      });


      const completeRes = await storage.execute({
        method: 'POST',
        key: 'large-file.zip',
        bucket: 'my-bucket',
        uploadId: UploadId,
        parts: [{ partNumber: 1, etag: partRes.headers.get('etag') ?? '' }]
      });
    });
  });
});
