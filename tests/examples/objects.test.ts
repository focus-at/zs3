import { afterEach, describe, expect, test } from "bun:test";
import {
  deleteObject,
  deleteObjectTags,
  deleteObjectVersion,
  getObject,
  getObjectAcl,
  getObjectAttributes,
  getObjectTags,
  getObjectVersion,
  headObject,
  listAllPages,
  listObjects,
  listObjectVersions,
  listStartingAfter,
  putObject,
  putObjectAcl,
  putObjectLegalHold,
  putObjectRetention,
  putObjectTags,
  replaceObjectMetadata,
  restoreObject,
} from "../../examples/objects.ts";
import type { ZS3Client } from "../../types.ts";
import { zs3 } from "../../index.ts";
import { readFixture } from "../helpers/fixtures.ts";
import { mockFetch, restoreMockFetch } from "../helpers/mock-fetch.ts";

afterEach(restoreMockFetch);

const client = () => zs3({ endpoint: "https://s3.example.test", accessKeyId: "test-key", secretAccessKey: "test-secret" });

describe("object examples", () => {
  test("lists objects with owner, delimiter and max-keys options", async () => {
    const requests = mockFetch(new Response(await readFixture("object-list-page-1.xml"), { status: 200 }));
    const result = await listObjects(client());

    expect(result.Contents[0].Key).toBe("reports/first.txt");
    expect(requests[0].url.searchParams.get("prefix")).toBe("reports/");
    expect(requests[0].url.searchParams.get("delimiter")).toBe("/");
    expect(requests[0].url.searchParams.get("max-keys")).toBe("100");
    expect(requests[0].url.searchParams.get("fetch-owner")).toBe("true");
  });

  test("paginates using the continuation token from the first fixture response", async () => {
    const requests = mockFetch(
      new Response(await readFixture("object-list-page-1.xml"), { status: 200 }),
      new Response(await readFixture("object-list-page-2.xml"), { status: 200 }),
    );
    const pages = await listAllPages(client());
    expect(pages).toHaveLength(2);
    expect(pages[0].Contents[0].Key).toBe("reports/first.txt");
    expect(pages[1].Contents[0].Key).toBe("reports/second.txt");
    expect(requests[0].url.searchParams.get("fetch-owner")).toBe("true");
    expect(requests[1].url.searchParams.get("continuation-token")).toBe("page-2-token");
  });

  test("lists starting after a key", async () => {
    const requests = mockFetch(new Response(await readFixture("object-list-page-2.xml"), { status: 200 }));
    await listStartingAfter(client(), "reports/first.txt");
    expect(requests[0].url.searchParams.get("start-after")).toBe("reports/first.txt");
    expect(requests[0].url.searchParams.get("max-keys")).toBe("50");
  });

  test("lists, downloads and deletes a specific object version", async () => {
    const requests = mockFetch(
      new Response(await readFixture("object-versions.xml"), { status: 200 }),
      new Response("version data", { status: 200 }),
      new Response("", { status: 200 }),
    );
    const api = client();
    const prefix = "reports/";

    const versionsResponse = await listObjectVersions(api, prefix);
    const { key, data } = await versionsResponse.json();

    expect(data.Version.VersionId).toBe("version-123");
    expect(data.Version.Key).toBe("reports/annual.pdf");
    expect(requests[0].url.searchParams.has("versions")).toBe(true);
    expect(requests[0].url.searchParams.get("prefix")).toBe(prefix);


    const objectResponse = await getObjectVersion(api, "reports/annual.pdf", "version-123");
    expect(await objectResponse.text()).toBe("version data");

    expect(requests[1].url.pathname).toBe("/demo-bucket/reports/annual.pdf");
    expect(requests[1].url.searchParams.get("version-id")).toBe("version-123");

    const deleteResponse = await deleteObjectVersion(api, "reports/annual.pdf", "version-123");
    expect(deleteResponse.status).toBe(200);
    expect(requests[2].url.pathname).toBe("/demo-bucket/reports/annual.pdf");
    expect(requests[2].url.searchParams.get("version-id")).toBe("version-123");
  });

  test("uploads, downloads, heads and deletes an object", async () => {
    const requests = mockFetch(
      new Response("", { status: 200 }),
      new Response("hello", { status: 200 }),
      new Response("", { status: 200, headers: { "x-amz-meta-source": "example" } }),
      new Response("", { status: 200 }),
    );
    const api = client();
    await putObject(api, "reports/report.txt", "hello");
    const downloaded = await getObject(api, "reports/report.txt");
    const head = await headObject(api, "reports/report.txt");
    await deleteObject(api, "reports/report.txt");

    expect(await downloaded.text()).toBe("hello");
    expect(head.headers.get("x-amz-meta-source")).toBe("example");
    expect(requests.map(({ init }) => init.method)).toEqual(["PUT", "GET", "HEAD", "DELETE"]);
    expect(new Headers(requests[0].init.headers).get("content-type")).toBe("application/octet-stream");
    expect(new Headers(requests[0].init.headers).get("x-amz-meta-source")).toBe("example");
    expect(new Headers(requests[0].init.headers).get("x-amz-meta-cache-control")).toBe("private");
  });

  test("covers object ACL, tags, metadata replacement, attributes, restore, retention and legal hold", async () => {
    const cases = [
      { name: "get ACL", method: "GET", query: "acl", run: (c: ZS3Client) => getObjectAcl(c, "reports/item.txt"), response: "object-acl.xml" },
      { name: "put ACL", method: "PUT", query: "acl", run: async (c: ZS3Client) => putObjectAcl(c, "reports/item.txt", (await readFixture("object-acl.xml")).trim()), body: "object-acl.xml" },
      { name: "get tags", method: "GET", query: "tagging", run: (c: ZS3Client) => getObjectTags(c, "reports/item.txt"), response: "object-tags.xml" },
      { name: "put tags", method: "PUT", query: "tagging", run: async (c: ZS3Client) => putObjectTags(c, "reports/item.txt", (await readFixture("object-tags.xml")).trim()), body: "object-tags.xml" },
      { name: "delete tags", method: "DELETE", query: "tagging", run: (c: ZS3Client) => deleteObjectTags(c, "reports/item.txt") },
      { name: "replace metadata by copy", method: "PUT", run: (c: ZS3Client) => replaceObjectMetadata(c, "reports/item.txt", "/demo-bucket/source.txt"), header: ["x-amz-metadata-directive", "REPLACE"] },
      { name: "get attributes", method: "GET", run: (c: ZS3Client) => getObjectAttributes(c, "reports/item.txt"), header: ["x-amz-object-attributes", "ETag,Checksum,ObjectSize,StorageClass,ObjectParts"], response: "object-attributes.xml" },
      { name: "restore", method: "POST", query: "restore", run: async (c: ZS3Client) => restoreObject(c, "reports/item.txt", (await readFixture("object-restore.xml")).trim()), body: "object-restore.xml" },
      { name: "retention", method: "PUT", query: "retention", run: async (c: ZS3Client) => putObjectRetention(c, "reports/item.txt", (await readFixture("object-retention.xml")).trim()), body: "object-retention.xml" },
      { name: "legal hold", method: "PUT", query: "legal-hold", run: async (c: ZS3Client) => putObjectLegalHold(c, "reports/item.txt", (await readFixture("object-legal-hold.xml")).trim()), body: "object-legal-hold.xml" },
    ];
    const responses = await Promise.all(cases.map(async (item) => new Response(item.response ? await readFixture(item.response) : "", { status: 200 })));
    const requests = mockFetch(...responses);
    const api = client();

    for (const [index, item] of cases.entries()) {
      await item.run(api);
      const request = requests[index];
      expect(request.init.method, item.name).toBe(item.method);
      expect(request.url.pathname, item.name).toBe("/demo-bucket/reports/item.txt");
      if (item.query) expect(request.url.searchParams.has(item.query), item.name).toBe(true);
      if (item.body) {
        expect(request.init.body, item.name).toBe((await readFixture(item.body)).trim());
        expect(new Headers(request.init.headers).get("content-type"), item.name).toBe("application/xml");
      }
      if (item.header) expect(new Headers(request.init.headers).get(item.header[0]), item.name).toBe(item.header[1]);
    }
    expect(requests).toHaveLength(cases.length);
  });
});
