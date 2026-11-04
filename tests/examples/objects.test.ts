import { afterEach, describe, expect, test } from "bun:test";
import {
  deleteObject,
  deleteObjectTags,
  getObject,
  getObjectAcl,
  getObjectAttributes,
  getObjectTags,
  headObject,
  listAllPages,
  listObjects,
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
    const xml = await readFixture("object-list-page-1.xml");
    const requests = mockFetch(new Response(xml, { status: 200 }));
    const result = await listObjects(client());

    expect(result.Contents[0].Key).toBe("reports/first.txt");
    expect(requests[0].url.searchParams.get("prefix")).toBe("reports/");
    expect(requests[0].url.searchParams.get("delimiter")).toBe("/");
    expect(requests[0].url.searchParams.get("max-keys")).toBe("100");
    expect(requests[0].url.searchParams.get("fetch-owner")).toBe("true");
  });

  test("paginates using the continuation token from the first fixture response", async () => {
    const page1 = await readFixture("object-list-page-1.xml");
    const page2 = await readFixture("object-list-page-2.xml");
    const requests = mockFetch(new Response(page1, { status: 200 }), new Response(page2, { status: 200 }));
    const pages = await listAllPages(client());

    expect(pages).toHaveLength(2);
    expect(pages[0].Contents[0].Key).toBe("reports/first.txt");
    expect(pages[1].Contents[0].Key).toBe("reports/second.txt");
    expect(requests[0].url.searchParams.get("prefix")).toBe("reports/");
    expect(requests[0].url.searchParams.get("delimiter")).toBe("/");
    expect(requests[0].url.searchParams.get("fetch-owner")).toBe("true");
    expect(requests[1].url.searchParams.get("continuation-token")).toBe("page-2-token");
  });

  test("lists from a starting key", async () => {
    const requests = mockFetch(new Response(await readFixture("object-list-page-2.xml"), { status: 200 }));
    await listStartingAfter(client(), "reports/first.txt");

    expect(requests[0].url.searchParams.get("prefix")).toBe("reports/");
    expect(requests[0].url.searchParams.get("start-after")).toBe("reports/first.txt");
    expect(requests[0].url.searchParams.get("max-keys")).toBe("50");
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
    const fixtureNames = ["object-acl.xml", "object-tags.xml", "object-restore.xml", "object-retention.xml", "object-legal-hold.xml"];
    const payloads = Object.fromEntries(await Promise.all(fixtureNames.map(async (name) => [name, (await readFixture(name)).trim()] as const));
    const cases: Array<{
      name: string;
      method: string;
      query?: string;
      requestFixture?: string;
      run: (client: ZS3Client) => Promise<unknown>;
      header?: [string, string];
    }> = [
      { name: "get ACL", method: "GET", query: "acl", run: (c) => getObjectAcl(c, "reports/item.txt") },
      { name: "put ACL", method: "PUT", query: "acl", requestFixture: "object-acl.xml", run: (c) => putObjectAcl(c, "reports/item.txt", payloads["object-acl.xml"]) },
      { name: "get tags", method: "GET", query: "tagging", run: (c) => getObjectTags(c, "reports/item.txt") },
      { name: "put tags", method: "PUT", query: "tagging", requestFixture: "object-tags.xml", run: (c) => putObjectTags(c, "reports/item.txt", payloads["object-tags.xml"]) },
      { name: "delete tags", method: "DELETE", query: "tagging", run: (c) => deleteObjectTags(c, "reports/item.txt") },
      { name: "replace metadata by copy", method: "PUT", run: (c) => replaceObjectMetadata(c, "reports/item.txt", "/demo-bucket/source.txt"), header: ["x-amz-metadata-directive", "REPLACE"] },
      { name: "get attributes", method: "GET", run: (c) => getObjectAttributes(c, "reports/item.txt"), header: ["x-amz-object-attributes", "ETag,Checksum,ObjectSize,StorageClass,ObjectParts"] },
      { name: "restore", method: "POST", query: "restore", requestFixture: "object-restore.xml", run: (c) => restoreObject(c, "reports/item.txt", payloads["object-restore.xml"]) },
      { name: "retention", method: "PUT", query: "retention", requestFixture: "object-retention.xml", run: (c) => putObjectRetention(c, "reports/item.txt", payloads["object-retention.xml"]) },
      { name: "legal hold", method: "PUT", query: "legalHold", requestFixture: "object-legal-hold.xml", run: (c) => putObjectLegalHold(c, "reports/item.txt", payloads["object-legal-hold.xml"]) },
    ];
    const responses = cases.map(({ name }) => new Response(name === "get ACL" ? awaitFixture(payloads["object-acl.xml"]) : name === "get tags" ? awaitFixture(payloads["object-tags.xml"]) : "", { status: 200 }));
    const requests = mockFetch(...responses);
    const api = client();

    for (const [index, item] of cases.entries()) {
      await item.run(api);
      const request = requests[index];
      expect(request.init.method, item.name).toBe(item.method);
      expect(request.url.pathname, item.name).toBe("/demo-bucket/reports/item.txt");
      if (item.query) expect(request.url.searchParams.has(item.query), item.name).toBe(true);
      if (item.requestFixture) {
        expect(request.init.body, item.name).toBe(payloads[item.requestFixture]);
        expect(new Headers(request.init.headers).get("content-type"), item.name).toBe("application/xml");
      }
      if (item.header) expect(new Headers(request.init.headers).get(item.header[0]), item.name).toBe(item.header[1]);
    }
    expect(requests).toHaveLength(cases.length);
  });
});

function awaitFixture(value: string) {
  return value;
}
