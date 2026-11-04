import type { ZS3Client } from "../types.ts";

const bucket = "demo-bucket";

export async function listBuckets(client: ZS3Client) {
  return client.execute({ method: "GET" });
}

export async function createBucket(client: ZS3Client) {
  return client.execute({ method: "PUT", bucket, key: "" });
}

export async function deleteBucket(client: ZS3Client) {
  // S3 requires a bucket to be empty before deletion.
  return client.execute({ method: "DELETE", bucket, key: "" } as never);
}

async function bucketSubresource(
  client: ZS3Client,
  method: "GET" | "PUT" | "DELETE",
  subresource: string,
  body?: string,
) {
  return client.execute(
    { method, bucket, key: "", ...(body === undefined ? {} : { body }) } as never,
    {
      query: { [subresource]: "" },
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/xml" } }),
    },
  );
}

// Bucket ACL
export const getBucketAcl = (client: ZS3Client) => bucketSubresource(client, "GET", "acl");
export const putBucketAcl = (client: ZS3Client, xml: string) => bucketSubresource(client, "PUT", "acl", xml);

// Bucket versioning
export const getBucketVersioning = (client: ZS3Client) => bucketSubresource(client, "GET", "versioning");
export const putBucketVersioning = (client: ZS3Client, xml: string) => bucketSubresource(client, "PUT", "versioning", xml);

// Lifecycle configuration
export const getBucketLifecycle = (client: ZS3Client) => bucketSubresource(client, "GET", "lifecycle");
export const putBucketLifecycle = (client: ZS3Client, xml: string) => bucketSubresource(client, "PUT", "lifecycle", xml);
export const deleteBucketLifecycle = (client: ZS3Client) => bucketSubresource(client, "DELETE", "lifecycle");

// Bucket policy
export const getBucketPolicy = (client: ZS3Client) => bucketSubresource(client, "GET", "policy");
export const putBucketPolicy = (client: ZS3Client, json: string) => client.execute(
  { method: "PUT", bucket, key: "", body: json } as never,
  { query: { policy: "" }, headers: { "Content-Type": "application/json" } },
);
export const deleteBucketPolicy = (client: ZS3Client) => bucketSubresource(client, "DELETE", "policy");

// Bucket tags
export const getBucketTags = (client: ZS3Client) => bucketSubresource(client, "GET", "tagging");
export const putBucketTags = (client: ZS3Client, xml: string) => bucketSubresource(client, "PUT", "tagging", xml);
export const deleteBucketTags = (client: ZS3Client) => bucketSubresource(client, "DELETE", "tagging");

// Additional bucket configuration subresources
export const getBucketCors = (client: ZS3Client) => bucketSubresource(client, "GET", "cors");
export const putBucketCors = (client: ZS3Client, xml: string) => bucketSubresource(client, "PUT", "cors", xml);
export const deleteBucketCors = (client: ZS3Client) => bucketSubresource(client, "DELETE", "cors");
export const getBucketEncryption = (client: ZS3Client) => bucketSubresource(client, "GET", "encryption");
export const putBucketEncryption = (client: ZS3Client, xml: string) => bucketSubresource(client, "PUT", "encryption", xml);
export const deleteBucketEncryption = (client: ZS3Client) => bucketSubresource(client, "DELETE", "encryption");
export const getBucketWebsite = (client: ZS3Client) => bucketSubresource(client, "GET", "website");
export const putBucketWebsite = (client: ZS3Client, xml: string) => bucketSubresource(client, "PUT", "website", xml);
export const deleteBucketWebsite = (client: ZS3Client) => bucketSubresource(client, "DELETE", "website");
export const getBucketNotification = (client: ZS3Client) => bucketSubresource(client, "GET", "notification");
export const putBucketNotification = (client: ZS3Client, xml: string) => bucketSubresource(client, "PUT", "notification", xml);
export const getBucketLogging = (client: ZS3Client) => bucketSubresource(client, "GET", "logging");
export const putBucketLogging = (client: ZS3Client, xml: string) => bucketSubresource(client, "PUT", "logging", xml);
export const getBucketReplication = (client: ZS3Client) => bucketSubresource(client, "GET", "replication");
export const putBucketReplication = (client: ZS3Client, xml: string) => bucketSubresource(client, "PUT", "replication", xml);
export const deleteBucketReplication = (client: ZS3Client) => bucketSubresource(client, "DELETE", "replication");
export const getPublicAccessBlock = (client: ZS3Client) => bucketSubresource(client, "GET", "public-access-block");
export const putPublicAccessBlock = (client: ZS3Client, xml: string) => bucketSubresource(client, "PUT", "public-access-block", xml);
export const deletePublicAccessBlock = (client: ZS3Client) => bucketSubresource(client, "DELETE", "public-access-block");
export const getObjectLockConfiguration = (client: ZS3Client) => bucketSubresource(client, "GET", "object-lock", "");
export const putObjectLockConfiguration = (client: ZS3Client, xml: string) => bucketSubresource(client, "PUT", "object-lock", xml);
