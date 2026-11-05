import type { ZS3Client, ZS3Objects } from "../types.ts";

const bucket = "demo-bucket";

// ListObjectsV2. fetch-owner includes owner information for each listed object.
export async function listObjects(client: ZS3Client, prefix = "reports/") {
  const response = await client.exec<ZS3Objects>(
    { method: "GET", bucket, prefix },
    { query: { delimiter: "/", "max-keys": 100, "fetch-owner": true } },
  );
  return response.json();
}

// Continue from NextContinuationToken until IsTruncated is false.
export async function listAllPages(client: ZS3Client, prefix = "reports/") {
  const pages: ZS3Objects[] = [];
  let continuationToken: string | undefined;
  do {
    const response = await client.exec<ZS3Objects>(
      { method: "GET", bucket, prefix },
      { query: {
        delimiter: "/",
        "fetch-owner": true,
        ...(continuationToken ? { "continuation-token": continuationToken } : {}),
      } },
    );
    const page = await response.json();
    pages.push(page);
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return pages;
}

export const listStartingAfter = (client: ZS3Client, key: string) => client.exec<ZS3Objects>(
  { method: "GET", bucket, prefix: "reports/", maxKeys: 50 },
  { query: { "start-after": key,  } }, // "max-keys": 50
);

// List object versions after enabling versioning on the bucket.
export const listObjectVersions = (client: ZS3Client, prefix: string) => client.exec(
  { method: "GET", bucket, prefix, key: "" },
  { query: { versions: "" } },
);

// Read or delete a specific version using its VersionId from ListVersionsResult.
export const getObjectVersion = (client: ZS3Client, key: string, versionId: string) => client.exec(
  { method: "GET", bucket, key }, // FIXME
  { query: { versionId } },
);
export const deleteObjectVersion = (client: ZS3Client, key: string, versionId: string) => client.exec(
  { method: "DELETE", bucket, key },
  { query: { versionId } },
);

// List object versions after enabling versioning on the bucket.
export const listObjectVersions = (client: ZS3Client, prefix: string) => client.exec(
  { method: "GET", bucket, prefix, key: "" },
  { query: { versions: "" } },
);

// Read or delete a specific version using its VersionId from ListVersionsResult.
export const getObjectVersion = (client: ZS3Client, key: string, versionId: string) => client.exec(
  { method: "GET", bucket, key }, // FIXME
  { query: { versionId } },
);
export const deleteObjectVersion = (client: ZS3Client, key: string, versionId: string) => client.exec(
  { method: "DELETE", bucket, key },
  { query: { versionId } },
);

// Single object: upload, download, inspect headers, and delete.
export const putObject = (client: ZS3Client, key: string, body: BodyInit) => client.exec(
  { method: "PUT", bucket, key, body },
  { headers: { "Content-Type": "application/octet-stream" }, meta: { source: "example", cacheControl: "private" } },
);
export const getObject = (client: ZS3Client, key: string) => client.exec({ method: "GET", bucket, key });
export const headObject = (client: ZS3Client, key: string) => client.exec({ method: "HEAD", bucket, key });
export const deleteObject = (client: ZS3Client, key: string) => client.exec({ method: "DELETE", bucket, key });

// Object ACL and tags are separate subresources. fetch-owner is not used for a single object.
export const getObjectAcl = (client: ZS3Client, key: string) => client.exec(
  { method: "GET", bucket, key }, { query: { acl: "" } },
);
export const putObjectAcl = (client: ZS3Client, key: string, xml: string) => client.exec(
  { method: "PUT", bucket, key, body: xml }, { query: { acl: "" }, headers: { "Content-Type": "application/xml" } },
);
export const getObjectTags = (client: ZS3Client, key: string) => client.exec(
  { method: "GET", bucket, key }, { query: { tagging: "" } },
);
export const putObjectTags = (client: ZS3Client, key: string, xml: string) => client.exec(
  { method: "PUT", bucket, key, body: xml }, { query: { tagging: "" }, headers: { "Content-Type": "application/xml" } },
);
export const deleteObjectTags = (client: ZS3Client, key: string) => client.exec(
  { method: "DELETE", bucket, key }, { query: { tagging: "" } },
);

// Replace metadata on an existing object by copying it with metadata-directive=REPLACE.
export const replaceObjectMetadata = (client: ZS3Client, key: string, copySource: string) => client.exec(
  { method: "PUT", bucket, key },
  {
    headers: {
      "x-amz-copy-source": copySource,
      "x-amz-metadata-directive": "REPLACE",
      "x-amz-meta-source": "updated",
    },
  },
);

export const getObjectAttributes = (client: ZS3Client, key: string) => client.exec(
  { method: "GET", bucket, key },
  { headers: { "x-amz-object-attributes": "ETag,Checksum,ObjectSize,StorageClass,ObjectParts" } },
);
export const restoreObject = (client: ZS3Client, key: string, xml: string) => client.exec(
  { method: "POST", bucket, key, body: xml }, { query: { restore: "" }, headers: { "Content-Type": "application/xml" } },
);
export const putObjectRetention = (client: ZS3Client, key: string, xml: string) => client.exec(
  { method: "PUT", bucket, key, body: xml }, { query: { retention: "" }, headers: { "Content-Type": "application/xml" } },
);
export const putObjectLegalHold = (client: ZS3Client, key: string, xml: string) => client.exec(
  { method: "PUT", bucket, key, body: xml }, { query: { legalHold: "" }, headers: { "Content-Type": "application/xml" } },
);
