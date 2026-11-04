import { afterEach, describe, expect, test } from "bun:test";
import {
  deleteObject,
  getObject,
  getObjectTags,
  headObject,
  listAllPages,
  putObject,
  putObjectTags,
} from "../../examples/objects.ts";
import { zs3 } from "../../index.ts";
import { readFixture } from "../helpers/fixtures.ts";
import { mockFetch, restoreMockFetch } from "../helpers/mock-fetch.ts";

afterEach(restoreMockFetch);

const client = () => zs3({ endpoint: "https://s3.example.test", accessKeyId: "test-key", secretAccessKey: "test-secret" });

describe("object examples", () => {
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
    expect(requests[1].url.searchParams.get("continuation-token")).toBe("page-2-token");
  });

  test("uploads with example metadata, downloads, heads and deletes an object", async () => {
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
  });

  test("writes and reads object tags through the tagging subresource", async () => {
    const requests = mockFetch(new Response("", { status: 200 }), new Response("<Tagging/>", { status: 200 }));
    const api = client();

    await putObjectTags(api, "reports/report.txt", "<Tagging/>");
    await getObjectTags(api, "reports/report.txt");

    expect(requests.every(({ url }) => url.searchParams.has("tagging"))).toBe(true);
    expect(requests[0].init.body).toBe("<Tagging/>");
    expect(new Headers(requests[0].init.headers).get("content-type")).toBe("application/xml");
  });
});
