import { afterEach, describe, expect, test } from "bun:test";
import { zs3 } from "../index.ts";
import { mockFetch, restoreMockFetch } from "./helpers/mock-fetch.ts";

afterEach(restoreMockFetch);

describe("XML response parsing details", () => {
  test("normalizes repeated object entries and strips quotes from ETags", async () => {
    mockFetch(new Response(
      '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>a.txt</Key><Size>1</Size><ETag>"etag-a"</ETag></Contents><Contents><Key>b.txt</Key><Size>2</Size><ETag>"etag-b"</ETag></Contents></ListBucketResult>',
      { status: 200 },
    ));
    const client = zs3({ endpoint: "https://s3.example.test", accessKeyId: "key", secretAccessKey: "secret" });

    const response = await client.exec({ method: "GET", bucket: "demo", prefix: "reports/" });
    const result = await response.json();

    expect(result.Contents).toHaveLength(2);
    expect(result.Contents.map(({ ETag }: { ETag: string }) => ETag)).toEqual(["etag-a", "etag-b"]);
  });
});
