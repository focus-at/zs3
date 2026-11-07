import { describe, expect, test } from "bun:test";
import { handler } from "../index.ts";
import { largeBucketListResponse, largeObjectListResponse } from "./helpers/large-fixtures.ts";

export function trackPerf(label = 'Process') {
  if (globalThis.gc) globalThis.gc();

  const memStart = process.memoryUsage().heapUsed;
  const timeStart = performance.now();
  const end = () => {
    const timeEnd = performance.now();
    const memEnd = process.memoryUsage().heapUsed;

    const timeTaken = timeEnd - timeStart;
    const memDiff = memEnd - memStart;

    return { timeTaken, memDiff };
  };

  return {
    end,
    log() {
      const res = end();
      const mem = (res.memDiff / 1024 / 1024).toLocaleString(undefined, {
        style: 'unit',
        unit: 'megabyte',
        minimumFractionDigits: 2
      });

      console.log(`⏱️  ${label} ${res.timeTaken.toFixed(2)} ms, ${mem}`);
      return res;
    }
  };
}

describe("large XML responses", () => {
  const S100K = 100_000;

  test(`parses ${S100K.toLocaleString()} buckets from a single response chunk larger than the initial buffer`, async () => {
    const perf = trackPerf(`s3-parse-${S100K}`);

    const response = handler(largeBucketListResponse(S100K));
    const result = await response.json();

    expect(result.key).toBe("ListAllMyBucketsResult");
    expect(result.data.Buckets.Bucket).toHaveLength(S100K);
    expect(result.data.Buckets.Bucket[0].Name).toBe("bucket-0");
    expect(result.data.Buckets.Bucket[S100K - 1].Name).toBe(`bucket-${S100K - 1}`);

    perf.log();
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
