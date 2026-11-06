import { afterEach, describe, expect, test } from "bun:test";
import {
  createBucket,
  deleteBucket,
  deleteBucketLifecycle,
  deleteBucketPolicy,
  deleteBucketTags,
  deleteBucketCors,
  deleteBucketEncryption,
  deleteBucketWebsite,
  deleteBucketReplication,
  deletePublicAccessBlock,
  getBucketAcl,
  getBucketCors,
  getBucketEncryption,
  getBucketLifecycle,
  getBucketLogging,
  getBucketNotification,
  getBucketPolicy,
  getBucketReplication,
  getBucketTags,
  getBucketVersioning,
  getBucketWebsite,
  getObjectLockConfiguration,
  getPublicAccessBlock,
  listBuckets,
  putBucketAcl,
  putBucketCors,
  putBucketEncryption,
  putBucketLifecycle,
  putBucketLogging,
  putBucketNotification,
  putBucketPolicy,
  putBucketReplication,
  putBucketTags,
  putBucketVersioning,
  putBucketWebsite,
  putObjectLockConfiguration,
  putPublicAccessBlock,
} from "../../examples/buckets.ts";
import type { ZS3Client } from "../../types.ts";
import { zs3 } from "../../index.ts";
import { readFixture } from "../helpers/fixtures.ts";
import { mockFetch, restoreMockFetch } from "../helpers/mock-fetch.ts";

afterEach(restoreMockFetch);

const client = () => zs3({ endpoint: "https://s3.example.test", accessKeyId: "test-key", secretAccessKey: "test-secret" });
const aclObject = await readFixture("bucket-acl.xml");

const bucketCases: Array<{
  name: string;
  subresource: string;
  method: string;
  run: (client: ZS3Client) => Promise<unknown>;
  requestFixture?: string;
  responseFixture?: string;
}> = [
  { name: "ACL GET", subresource: "acl", method: "GET", run: getBucketAcl, responseFixture: "bucket-acl-response.xml" },
  { name: "ACL PUT", subresource: "acl", method: "PUT", run: async (c) => putBucketAcl(c, await readFixture("bucket-acl.xml")), requestFixture: "bucket-acl.xml" },
  { name: "versioning GET", subresource: "versioning", method: "GET", run: getBucketVersioning, responseFixture: "bucket-versioning-response.xml" },
  { name: "versioning PUT", subresource: "versioning", method: "PUT", run: async (c) => putBucketVersioning(c, await readFixture("bucket-versioning.xml")), requestFixture: "bucket-versioning.xml" },
  { name: "lifecycle GET", subresource: "lifecycle", method: "GET", run: getBucketLifecycle, responseFixture: "bucket-lifecycle-response.xml" },
  { name: "lifecycle PUT", subresource: "lifecycle", method: "PUT", run: async (c) => putBucketLifecycle(c, await readFixture("bucket-lifecycle.xml")), requestFixture: "bucket-lifecycle.xml" },
  { name: "lifecycle DELETE", subresource: "lifecycle", method: "DELETE", run: deleteBucketLifecycle },
  { name: "policy GET", subresource: "policy", method: "GET", run: getBucketPolicy, responseFixture: "bucket-policy.json" },
  { name: "policy PUT", subresource: "policy", method: "PUT", run: (c) => putBucketPolicy(c, '{"Version":"2012-10-17","Statement":[]}') },
  { name: "policy DELETE", subresource: "policy", method: "DELETE", run: deleteBucketPolicy },
  { name: "tags GET", subresource: "tagging", method: "GET", run: getBucketTags, responseFixture: "bucket-tags-response.xml" },
  { name: "tags PUT", subresource: "tagging", method: "PUT", run: async (c) => putBucketTags(c, await readFixture("bucket-tags.xml")), requestFixture: "bucket-tags.xml" },
  { name: "tags DELETE", subresource: "tagging", method: "DELETE", run: deleteBucketTags },
  { name: "CORS GET", subresource: "cors", method: "GET", run: getBucketCors, responseFixture: "bucket-cors-response.xml" },
  { name: "CORS PUT", subresource: "cors", method: "PUT", run: async (c) => putBucketCors(c, await readFixture("bucket-cors.xml")), requestFixture: "bucket-cors.xml" },
  { name: "CORS DELETE", subresource: "cors", method: "DELETE", run: deleteBucketCors },
  { name: "encryption GET", subresource: "encryption", method: "GET", run: getBucketEncryption, responseFixture: "bucket-encryption-response.xml" },
  { name: "encryption PUT", subresource: "encryption", method: "PUT", run: async (c) => putBucketEncryption(c, await readFixture("bucket-encryption.xml")), requestFixture: "bucket-encryption.xml" },
  { name: "encryption DELETE", subresource: "encryption", method: "DELETE", run: deleteBucketEncryption },
  { name: "website GET", subresource: "website", method: "GET", run: getBucketWebsite, responseFixture: "bucket-website-response.xml" },
  { name: "website PUT", subresource: "website", method: "PUT", run: async (c) => putBucketWebsite(c, await readFixture("bucket-website.xml")), requestFixture: "bucket-website.xml" },
  { name: "website DELETE", subresource: "website", method: "DELETE", run: deleteBucketWebsite },
  { name: "notification GET", subresource: "notification", method: "GET", run: getBucketNotification, responseFixture: "bucket-notification-response.xml" },
  { name: "notification PUT", subresource: "notification", method: "PUT", run: async (c) => putBucketNotification(c, await readFixture("bucket-notification.xml")), requestFixture: "bucket-notification.xml" },
  { name: "logging GET", subresource: "logging", method: "GET", run: getBucketLogging, responseFixture: "bucket-logging-response.xml" },
  { name: "logging PUT", subresource: "logging", method: "PUT", run: async (c) => putBucketLogging(c, await readFixture("bucket-logging.xml")), requestFixture: "bucket-logging.xml" },
  { name: "replication GET", subresource: "replication", method: "GET", run: getBucketReplication, responseFixture: "bucket-replication-response.xml" },
  { name: "replication PUT", subresource: "replication", method: "PUT", run: async (c) => putBucketReplication(c, await readFixture("bucket-replication.xml")), requestFixture: "bucket-replication.xml" },
  { name: "replication DELETE", subresource: "replication", method: "DELETE", run: deleteBucketReplication },
  { name: "public access block GET", subresource: "public-access-block", method: "GET", run: getPublicAccessBlock, responseFixture: "bucket-public-access-block-response.xml" },
  { name: "public access block PUT", subresource: "public-access-block", method: "PUT", run: async (c) => putPublicAccessBlock(c, await readFixture("bucket-public-access-block.xml")), requestFixture: "bucket-public-access-block.xml" },
  { name: "public access block DELETE", subresource: "public-access-block", method: "DELETE", run: deletePublicAccessBlock },
  { name: "object lock GET", subresource: "object-lock", method: "GET", run: getObjectLockConfiguration, responseFixture: "bucket-object-lock-response.xml" },
  { name: "object lock PUT", subresource: "object-lock", method: "PUT", run: async (c) => putObjectLockConfiguration(c, await readFixture("bucket-object-lock.xml")), requestFixture: "bucket-object-lock.xml" },
];

describe("bucket examples", () => {
  test("lists buckets and parses the ListAllMyBucketsResult fixture", async () => {
    const requests = mockFetch(new Response(await readFixture("bucket-list.xml"), { status: 200 }));
    const response = await listBuckets(client());
    const result = await response.json();

    expect(requests[0].url.pathname).toBe("/");
    console.log(result);
    expect(result.Buckets.Bucket.Name).toBe("demo-bucket"); // FIXME Buckets -> Bucket ?
    expect(result.Owner.ID).toBe("owner-1");
  });

  test("creates and deletes the example bucket", async () => {
    const requests = mockFetch(new Response("", { status: 200 }), new Response("", { status: 200 }));
    await createBucket(client());
    await deleteBucket(client());

    expect(requests.map(({ init }) => init.method)).toEqual(["PUT", "DELETE"]);
    expect(requests.map(({ url }) => url.pathname)).toEqual(["/demo-bucket", "/demo-bucket"]);
  });

  test("exercises every bucket configuration helper", async () => {
    const responses = await Promise.all(bucketCases.map(async (item) => new Response(
      item.responseFixture ? await readFixture(item.responseFixture) : "",
      { status: 200 },
    )));
    const requests = mockFetch(...responses);
    const api = client();

    for (const [index, item] of bucketCases.entries()) {
      await item.run(api);
      const request = requests[index];
      expect(request.init.method, item.name).toBe(item.method);
      expect(request.url.pathname, item.name).toBe("/demo-bucket");
      expect(request.url.searchParams.has(item.subresource), item.name).toBe(true);
      if (item.requestFixture) {
        expect(request.init.body).toBe((await readFixture(item.requestFixture)));
        expect(new Headers(request.init.headers).get("content-type"), item.name).toBe("application/xml");
      }
      if (item.name === "policy PUT") {
        expect(request.init.body).toBe('{"Version":"2012-10-17","Statement":[]}');
        expect(new Headers(request.init.headers).get("content-type")).toBe("application/json");
      }
    }
    expect(requests).toHaveLength(bucketCases.length);
  });
});
