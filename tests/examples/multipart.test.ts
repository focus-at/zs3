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
  test("runs initiate, upload, list, complete and abort requests", async () => {
    const initiateXml = await readFixture("multipart-initiate.xml");
    const requests = mockFetch(
      new Response(initiateXml, { status: 200 }),
      new Response("", { status: 200, headers: { etag: '"part-etag"' } }),
      new Response("<ListPartsResult/>", { status: 200 }),
      new Response("<CompleteMultipartUploadResult/>", { status: 200 }),
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
    expect(requests[2].url.searchParams.get("upload-id")).toBe("upload-123");
    expect(requests[3].url.searchParams.get("upload-id")).toBe("upload-123");
    expect(requests[3].init.body).toBe("<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>part-etag</ETag></Part></CompleteMultipartUpload>");
    expect(new Headers(requests[3].init.headers).get("content-type")).toBe("application/xml");
    expect(requests[4].url.searchParams.get("upload-id")).toBe("upload-123");
  });
});
