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

describe("bucket examples", () => {
  test("lists buckets and parses the ListAllMyBucketsResult fixture", async () => {
    const requests = mockFetch(new Response(await readFixture("bucket-list.xml"), { status: 200 }));
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

  test("covers every bucket configuration helper and its request shape", async () => {
    const xmlNames = [
      "bucket-acl.xml", "bucket-versioning.xml", "bucket-lifecycle.xml", "bucket-tags.xml",
      "bucket-cors.xml", "bucket-encryption.xml", "bucket-website.xml", "bucket-notification.xml",
      "bucket-logging.xml", "bucket-replication.xml", "bucket-public-access-block.xml", "bucket-object-lock.xml",
    ];
    const xml = Object.fromEntries(await Promise.all(xmlNames.map(async (name) => [name, (await readFixture(name)).trim()] as const));
    const cases: Array<{
      name: string;
      subresource: string;
      method: string;
      run: (client: ZS3Client) => Promise<unknown>;
      requestFixture?: string;
      contentType?: string;
    }> = [
      { name: "ACL GET", subresource: "acl", method: "GET", run: getBucketAcl },
      { name: "ACL PUT", subresource: "acl", method: "PUT", run: (c) => putBucketAcl(c, xml["bucket-acl.xml"]), requestFixture: "bucket-acl.xml" },
      { name: "versioning GET", subresource: "versioning", method: "GET", run: getBucketVersioning },
      { name: "versioning PUT", subresource: "versioning", method: "PUT", run: (c) => putBucketVersioning(c, xml["bucket-versioning.xml"]), requestFixture: "bucket-versioning.xml" },
      { name: "lifecycle GET", subresource: "lifecycle", method: "GET", run: getBucketLifecycle },
      { name: "lifecycle PUT", subresource: "lifecycle", method: "PUT", run: (c) => putBucketLifecycle(c, xml["bucket-lifecycle.xml"]), requestFixture: "bucket-lifecycle.xml" },
      { name: "lifecycle DELETE", subresource: "lifecycle", method: "DELETE", run: deleteBucketLifecycle },
      { name: "policy GET", subresource: "policy", method: "GET", run: getBucketPolicy },
      { name: "policy PUT", subresource: "policy", method: "PUT", run: (c) => putBucketPolicy(c, '{"Version":"2012-10-17","Statement":[]}'), contentType: "application/json" },
      { name: "policy DELETE", subresource: "policy", method: "DELETE", run: deleteBucketPolicy },
      { name: "tags GET", subresource: "tagging", method: "GET", run: getBucketTags },
      { name: "tags PUT", subresource: "tagging", method: "PUT", run: (c) => putBucketTags(c, xml["bucket-tags.xml"]), requestFixture: "bucket-tags.xml" },
      { name: "tags DELETE", subresource: "tagging", method: "DELETE", run: deleteBucketTags },
      { name: "CORS GET", subresource: "cors", method: "GET", run: getBucketCors },
      { name: "CORS PUT", subresource: "cors", method: "PUT", run: (c) => putBucketCors(c, xml["bucket-cors.xml"]), requestFixture: "bucket-cors.xml" },
      { name: "CORS DELETE", subresource: "cors", method: "DELETE", run: deleteBucketCors },
      { name: "encryption GET", subresource: "encryption", method: "GET", run: getBucketEncryption },
      { name: "encryption PUT", subresource: "encryption", method: "PUT", run: (c) => putBucketEncryption(c, xml["bucket-encryption.xml"]), requestFixture: "bucket-encryption.xml" },
      { name: "encryption DELETE", subresource: "encryption", method: "DELETE", run: deleteBucketEncryption },
      { name: "website GET", subresource: "website", method: "GET", run: getBucketWebsite },
      { name: "website PUT", subresource: "website", method: "PUT", run: (c) => putBucketWebsite(c, xml["bucket-website.xml"]), requestFixture: "bucket-website.xml" },
      { name: "website DELETE", subresource: "website", method: "DELETE", run: deleteBucketWebsite },
      { name: "notification GET", subresource: "notification", method: "GET", run: getBucketNotification },
      { name: "notification PUT", subresource: "notification", method: "PUT", run: (c) => putBucketNotification(c, xml["bucket-notification.xml"]), requestFixture: "bucket-notification.xml" },
      { name: "logging GET", subresource: "logging", method: "GET", run: getBucketLogging },
      { name: "logging PUT", subresource: "logging", method: "PUT", run: (c) => putBucketLogging(c, xml["bucket-logging.xml"]), requestFixture: "bucket-logging.xml" },
      { name: "replication GET", subresource: "replication", method: "GET", run: getBucketReplication },
      { name: "replication PUT", subresource: "replication", method: "PUT", run: (c) => putBucketReplication(c, xml["bucket-replication.xml"]), requestFixture: "bucket-replication.xml" },
      { name: "replication DELETE", subresource: "replication", method: "DELETE", run: deleteBucketReplication },
      { name: "public access block GET", subresource: "public-access-block", method: "GET", run: getPublicAccessBlock },
      { name: "public access block PUT", subresource: "public-access-block", method: "PUT", run: (c) => putPublicAccessBlock(c, xml["bucket-public-access-block.xml"]), requestFixture: "bucket-public-access-block.xml" },
      { name: "public access block DELETE", subresource: "public-access-block", method: "DELETE", run: deletePublicAccessBlock },
      { name: "object lock GET", subresource: "object-lock", method: "GET", run: getObjectLockConfiguration, requestFixture: "bucket-object-lock.xml" },
      { name: "object lock PUT", subresource: "object-lock", method: "PUT", run: (c) => putObjectLockConfiguration(c, xml["bucket-object-lock.xml"]), requestFixture: "bucket-object-lock.xml" },
    ];
    const responses = await Promise.all(cases.map(async ({ method, subresource }) => {
      if (method !== "GET") return new Response("", { status: 200 });
      const fixtureName = subresource === "policy" ? "bucket-policy.json" : `bucket-${subresource === "tagging" ? "tags" : subresource === "public-access-block" ? "public-access-block" : subresource === "object-lock" ? "object-lock" : subresource}.xml`;
      return new Response(await readFixture(fixtureName), { status: 200 });
    }));
    const requests = mockFetch(...responses);
    const api = client();

    for (const [index, item] of cases.entries()) {
      await item.run(api);
      const request = requests[index];
      expect(request.init.method, item.name).toBe(item.method);
      expect(request.url.pathname, item.name).toBe("/demo-bucket/");
      expect(request.url.searchParams.has(item.subresource), item.name).toBe(true);
      expect(request.url.searchParams.has("list-type"), item.name).toBe(true);
      if (item.requestFixture) {
        expect(request.init.body, item.name).toBe(xml[item.requestFixture]);
        expect(new Headers(request.init.headers).get("content-type"), item.name).toBe("application/xml");
      }
      if (item.contentType) {
        expect(request.init.body, item.name).toBe('{"Version":"2012-10-17","Statement":[]}');
        expect(new Headers(request.init.headers).get("content-type"), item.name).toBe(item.contentType);
      }
    }
    expect(requests).toHaveLength(cases.length);
  });
});
