import { afterEach, describe, expect, test } from "bun:test";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  initiateMultipartUpload,
  listParts,
  uploadPart,
} from "../../examples/multipart.ts";
import { zs3 } from "../../index.ts";
import { readFixture } from "../helpers/fixtures.ts";
import { mockFetch, restoreMockFetch } from "../helpers/mock-fetch.ts";

afterEach(restoreMockFetch);

const client = () => zs3({ endpoint: "https://s3.example.test", accessKeyId: "test-key", secretAccessKey: "test-secret" });

describe("multipart example", () => {
  test("runs initiate, upload, list, complete and abort using XML response fixtures", async () => {
    const names = ["multipart-initiate.xml", "multipart-list-parts.xml", "multipart-complete.xml"];
    const fixtures = Object.fromEntries(await Promise.all(names.map(async (name) => [name, await readFixture(name)] as const));
    const requests = mockFetch(
      new Response(fixtures["multipart-initiate.xml"], { status: 200 }),
      new Response("", { status: 200, headers: { etag: '"part-etag"' } }),
      new Response(fixtures["multipart-list-parts.xml"], { status: 200 }),
      new Response(fixtures["multipart-complete.xml"], { status: 200 }),
      new Response("", { status: 200 }),
    );
    const api = client();

    const initiated = await initiateMultipartUpload(api);
    expect((await initiated.json()).UploadId).toBe("upload-123");
    await uploadPart(api, "upload-123", 1, "part data");
    await listParts(api, "upload-123");
    await completeMultipartUpload(api, "upload-123", [{ partNumber: 1, etag: "part-etag" }]);
    await abortMultipartUpload(api, "upload-123");

    expect(requests.map(({ init }) => init.method)).toEqual(["POST", "PUT", "GET", "POST", "DELETE"]);
    expect(requests[0].url.searchParams.has("uploads")).toBe(true);
    expect(requests[1].url.searchParams.get("part-number")).toBe("1");
    expect(requests[1].init.body).toBe("part data");
    expect(requests[2].url.searchParams.get("upload-id")).toBe("upload-123");
    expect(requests[3].url.searchParams.get("upload-id")).toBe("upload-123");
    expect(requests[3].init.body).toBe((await readFixture("multipart-complete-request.xml")).trim());
    expect(new Headers(requests[3].init.headers).get("content-type")).toBe("application/xml");
    expect(requests[4].url.searchParams.get("upload-id")).toBe("upload-123");
  });
});
