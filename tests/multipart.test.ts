import { afterEach, describe, expect, test } from "bun:test";
import { zs3 } from "../index.ts";
import { mockFetch, restoreMockFetch } from "./helpers/mock-fetch.ts";

afterEach(restoreMockFetch);

describe("multipart query serialization", () => {
  test("normalizes option names and encodes query values for direct client calls", async () => {
    const requests = mockFetch(new Response("", { status: 200 }));
    const client = zs3({ endpoint: "https://s3.example.test", accessKeyId: "key", secretAccessKey: "secret" });

    await client.exec(
      { method: "PUT", bucket: "demo", key: "large archive.zip", body: "part" },
      { query: { uploadId: "upload id/1", partNumber: 7 } },
    );

    expect(requests[0].url.pathname).toBe("/demo/large%20archive.zip");
    expect(requests[0].url.searchParams.get("upload-id")).toBe("upload id/1");
    expect(requests[0].url.searchParams.get("part-number")).toBe("7");
  });
});
