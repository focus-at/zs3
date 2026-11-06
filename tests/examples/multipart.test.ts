import type { ZS3Client } from "../types.ts";

const bucket = "demo-bucket";
const key = "large-archive.zip";
const S3_XML_NAMESPACE = "http://s3.amazonaws.com/doc/2006-03-01/";

export const initiateMultipartUpload = (client: ZS3Client) => client.exec(
  { method: "POST", bucket, key }, { query: { uploads: "" } },
);
export const uploadPart = (client: ZS3Client, uploadId: string, partNumber: number, body: BodyInit) => client.exec(
  { method: "PUT", bucket, key, body }, { query: { uploadId, partNumber } },
);
export const listParts = (client: ZS3Client, uploadId: string) => client.exec(
  { method: "GET", bucket, key }, { query: { uploadId } },
);
export const completeMultipartUpload = (
  client: ZS3Client,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>,
) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CompleteMultipartUpload xmlns="${S3_XML_NAMESPACE}">
${parts.map(({ partNumber, etag }) => `  <Part>
    <PartNumber>${partNumber}</PartNumber>
    <ETag>${etag}</ETag>
  </Part>`).join("\n")}
</CompleteMultipartUpload>`;
  return client.exec(
    { method: "POST", bucket, key, body: xml },
    { query: { uploadId }, headers: { "Content-Type": "application/xml" } },
  );
};
export const abortMultipartUpload = (client: ZS3Client, uploadId: string) => client.exec(
  { method: "DELETE", bucket, key }, { query: { uploadId } },
);
