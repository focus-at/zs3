import { afterEach, describe, expect, test } from "bun:test";
import { zs3 } from "../index.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe("multipart upload request shapes", () => {
  test("covers initiate, upload part, list, complete, and abort", async () => {
    const requests: Array<{ url: URL; method: string; body: BodyInit | null | undefined }> = [];
    globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
      requests.push({ url: input instanceof URL ? input : new URL(input.toString()), method: init?.method ?? "GET", body: init?.body });
      return new Response("<InitiateMultipartUploadResult><UploadId>upload-1</UploadId></InitiateMultipartUploadResult>", { status: 200 });
    }) as typeof fetch;
    const client = zs3({ endpoint: "https://s3.example.test", accessKeyId: "key", secretAccessKey: "secret", bucket: "demo" });
    await client.exec({ method: "POST", key: "large.zip" }, { query: { uploads: "" } });
    await client.exec({ method: "PUT", key: "large.zip", body: "part" }, { query: { uploadId: "upload-1", partNumber: 1 } });
    await client.exec({ method: "GET", key: "large.zip" }, { query: { uploadId: "upload-1" } });
    await client.exec({ method: "POST", key: "large.zip", body: "<CompleteMultipartUpload/>" }, { query: { uploadId: "upload-1" } });
    await client.exec({ method: "DELETE", key: "large.zip" }, { query: { uploadId: "upload-1" } });
    expect(requests.map(({ method }) => method)).toEqual(["POST", "PUT", "GET", "POST", "DELETE"]);
    expect(requests[0].url.searchParams.has("uploads")).toBe(true);
    expect(requests[1].url.searchParams.get("part-number")).toBe("1");
    expect(requests[2].url.searchParams.get("upload-id")).toBe("upload-1");
    expect(requests[3].body).toBe("<CompleteMultipartUpload/>");
  });
});
