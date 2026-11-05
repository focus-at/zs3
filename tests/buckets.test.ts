import { afterEach, describe, expect, test } from "bun:test";
import { zs3 } from "../index.ts";
import { mockFetch, restoreMockFetch } from "./helpers/mock-fetch.ts";

afterEach(restoreMockFetch);

describe("bucket-level client request signing", () => {
  test("signs a bucket listing request and includes default list parameters", async () => {
    const requests = mockFetch(new Response("<ListAllMyBucketsResult/>", { status: 200 }));
    const client = zs3({ endpoint: "https://s3.example.test", accessKeyId: "key", secretAccessKey: "secret" });

    await client.exec({ method: "GET" });

    expect(requests[0].url.searchParams.get("list-type")).toBe("2");
    expect(requests[0].url.searchParams.get("max-keys")).toBe("1000");
    expect(new Headers(requests[0].init.headers).get("authorization")).toContain("AWS4-HMAC-SHA256");
    expect(new Headers(requests[0].init.headers).get("x-amz-content-sha256")).toMatch(/^[a-f0-9]{64}$/);
  });
});
