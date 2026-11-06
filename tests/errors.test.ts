import { afterEach, describe, expect, test } from "bun:test";
import { zs3 } from "../index.ts";
import { readFixture } from "./helpers/fixtures.ts";
import { mockFetch, restoreMockFetch } from "./helpers/mock-fetch.ts";

afterEach(restoreMockFetch);

describe("S3 errors and edge cases", () => {
  test("returns status and parsed XML error envelope", async () => {
    const xml = await readFixture("access-denied.xml");
    mockFetch(new Response(xml, { status: 403 }));
    const client = zs3({ endpoint: "https://s3.example.test", accessKeyId: "key", secretAccessKey: "secret" });

    const response = await client.exec({ method: "GET" });
    const result = await response.json();
    expect(response.status).toBe(403);
    expect(result.key).toBe("Error");
    expect(result.data).toEqual({ Code: "AccessDenied", Message: "Access Denied" });
  });
});
