const encoder = new TextEncoder();

function xmlResponse(xml: string, CHUNK_SIZE = 32 * 1024): Response {
  const bytes = encoder.encode(xml);

  return new Response(new ReadableStream({
    start(controller) {
      let offset = 0;

      while (offset < bytes.length) {
        const chunk = bytes.subarray(offset, offset + CHUNK_SIZE);
        controller.enqueue(chunk);
        offset += CHUNK_SIZE;
      }

      controller.close();
    },
  }));
}

export function largeBucketListResponse(count = 1_000): Response {
  const buckets = Array.from({ length: count }, (_, i) =>
    `<Bucket><Name>bucket-${i}</Name><CreationDate>2026-01-01T00:00:00.000Z</CreationDate></Bucket>`,
  ).join("");

  return xmlResponse(
    `<ListAllMyBucketsResult><Owner><ID>owner-1</ID></Owner><Buckets>${buckets}</Buckets></ListAllMyBucketsResult>`,
  );
}

export function largeObjectListResponse(count = 1_000): Response {
  const objects = Array.from({ length: count }, (_, i) =>
    `<Contents><Key>reports/object-${i}.dat</Key><Size>${i}</Size><ETag>etag-${i}</ETag></Contents>`,
  ).join("");

  return xmlResponse(`<ListBucketResult><IsTruncated>false</IsTruncated>${objects}</ListBucketResult>`);
}
