import { afterEach, describe, expect, test } from "bun:test";
import {
  createBucket,
  deleteBucket,
  getBucketAcl,
  listBuckets,
  putBucketAcl,
  putBucketPolicy,
} from "../../examples/buckets.ts";
import { zs3 } from "../../index.ts";
import { readFixture } from "../helpers/fixtures.ts";
import { mockFetch, restoreMockFetch } from "../helpers/mock-fetch.ts";

afterEach(restoreMockFetch);

const client = () => zs3({ endpoint: "https://s3.example.test", accessKeyId: "test-key", secretAccessKey: "test-secret" });

describe("bucket examples", () => {
  test("lists buckets and parses the S3 response fixture", async () => {
    const xml = await readFixture("bucket-list.xml");
    const requests = mockFetch(new Response(xml, { status: 200 }));

    const response = await listBuckets(client());
    const result = await response.json();

    expect(requests[0].url.pathname).toBe("/");
    expect(result.Buckets.Bucket.Name).toBe("demo-bucket");
    expect(result.Owner.ID).toBe("owner-1");
  });

  test("creates and deletes the example bucket", async () => {
    const requests = mockFetch(new Response("", { status: 200 }), new Response("", { status: 200 }));

    await createBucket(client());
    await deleteBucket(client());

    expect(requests.map(({ init }) => init.method)).toEqual(["PUT", "DELETE"]);
    expect(requests.map(({ url }) => url.pathname)).toEqual(["/demo-bucket/", "/demo-bucket/"]);
  });

  test("sends bucket subresource queries, XML and JSON bodies with matching content types", async () => {
    const requests = mockFetch(
      new Response("<AccessControlPolicy/>", { status: 200 }),
      new Response("", { status: 200 }),
      new Response("", { status: 200 }),
    );
    const api = client();

    await getBucketAcl(api);
    await putBucketAcl(api, "<AccessControlPolicy/>");
    await putBucketPolicy(api, '{"Version":"2012-10-17"}');

    expect(requests.map(({ url }) => [...url.searchParams.keys()].filter((key) => key !== "list-type" && key !== "max-keys" && key !== "prefix"))).toEqual([
      ["acl"], ["acl"], ["policy"],
    ]);
    expect(requests[1].init.body).toBe("<AccessControlPolicy/>");
    expect(new Headers(requests[1].init.headers).get("content-type")).toBe("application/xml");
    expect(requests[2].init.body).toBe('{"Version":"2012-10-17"}');
    expect(new Headers(requests[2].init.headers).get("content-type")).toBe("application/json");
  });
});
