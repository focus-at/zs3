import { afterEach, describe, expect, test } from "bun:test";
import { createDownloadUrl, downloadWithFetch } from "../../examples/presigned-fetch.ts";
import { zs3 } from "../../index.ts";
import { mockFetch, restoreMockFetch } from "../helpers/mock-fetch.ts";

afterEach(restoreMockFetch);

describe("pre-signed fetch example", () => {
  test("creates a short-lived URL and downloads it with standard fetch", async () => {
    const url = new URL(await createDownloadUrl("reports/private.pdf"));
    const requests = mockFetch(new Response("pdf bytes", { status: 200 }));

    const response = await downloadWithFetch(url.toString());

    expect(url.pathname).toBe("/private-documents/reports/private.pdf");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("pdf bytes");
    expect(requests[0].url.href).toBe(url.href);
    expect(requests[0].init.method).toBe("GET");
  });

  test("can independently sign an operation without sending a request", async () => {
    const signer = zs3({ endpoint: "https://s3.example.test", accessKeyId: "key", secretAccessKey: "secret" });
    const url = new URL(await signer.sign({ method: "GET", bucket: "private-documents", key: "doc.txt" }, { expiresIn: 60 }));

    expect(url.searchParams.get("X-Amz-Expires")).toBe("60");
    expect(url.pathname).toBe("/private-documents/doc.txt");
  });
});
