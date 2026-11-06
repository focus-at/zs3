import { describe, expect, test } from "bun:test";
import { handler } from "../index.ts";
import { largeBucketListResponse, largeObjectListResponse } from "./helpers/large-fixtures.ts";

describe("large XML responses", () => {
  test("parses 1,000 buckets from a single response chunk larger than the initial buffer", async () => {
    const response = handler(largeBucketListResponse());
    const result = await response.json();

    expect(result.key).toBe("ListAllMyBucketsResult");
    expect(result.data.Buckets.Bucket).toHaveLength(1_000);
    expect(result.data.Buckets.Bucket[0].Name).toBe("bucket-0");
    expect(result.data.Buckets.Bucket[999].Name).toBe("bucket-999");
  });

  test("parses 1,000 objects from a single response chunk larger than the initial buffer", async () => {
    const response = handler(largeObjectListResponse());
    const result = await response.json();

    expect(result.key).toBe("ListBucketResult");
    expect(result.data.Contents).toHaveLength(1_000);
    expect(result.data.Contents[0].Key).toBe("reports/object-0.dat");
    expect(result.data.Contents[999].Key).toBe("reports/object-999.dat");
  });
});
