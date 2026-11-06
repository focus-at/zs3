import { afterEach, describe, expect, test } from "bun:test";
import { addUser } from "../../examples/custom-request.ts";
import { mockFetch, restoreMockFetch } from "../helpers/mock-fetch.ts";

afterEach(restoreMockFetch);

describe("custom request example", () => {
  test("sends the application-specific path, query and JSON payload", async () => {
    const requests = mockFetch(new Response("", { status: 200 }));

    await addUser("new-access-key", "new-secret-key");

    expect(requests[0].url.pathname).toBe("/admin/v3/add-user");
    expect(requests[0].url.searchParams.get("access-key")).toBe("new-access-key");
    expect(requests[0].init.method).toBe("PUT");
    expect(requests[0].init.body).toBe('{"secretKey":"new-secret-key","status":"enabled"}');
    expect(new Headers(requests[0].init.headers).get("content-type")).toBe("application/json");
    expect(new Headers(requests[0].init.headers).get("authorization")).toContain("AWS4-HMAC-SHA256");
  });
});
