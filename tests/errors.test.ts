import { afterEach, describe, expect, test } from "bun:test";
import { zs3 } from "../index.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe("S3 errors and edge cases", () => {
  test("returns status and parsed XML error payload", async () => {
    globalThis.fetch = (async () => new Response("<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>", { status: 403 })) as typeof fetch;
    const client = zs3({ endpoint: "https://s3.example.test", accessKeyId: "key", secretAccessKey: "secret" });
    const response = await client.execute({ method: "GET" });
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.Code).toBe("AccessDenied");
    expect(body.Message).toBe("Access Denied");
  });
});
