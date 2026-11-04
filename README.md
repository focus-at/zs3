# ZeroS3 (zs3)

![GitHub License](https://img.shields.io/github/license/focus-at/zs3)
![npm version](https://img.shields.io/npm/v/@focus-at/zs3)
![Minified bundle size](https://img.shields.io/bundlephobia/min/@focus-at/zs3)
![Tests](https://img.shields.io/github/actions/workflow/status/focus-at/zs3/main.yml?branch=main&label=tests)
![GitHub Stars](https://img.shields.io/github/stars/focus-at/zs3)

> **Zero runtime dependencies · only ~3 KB minified · built on Web Platform APIs**
>
> ZeroS3 is under active development; the public API may evolve.

## Overview

**ZeroS3 (zs3)** is a lightweight S3-compatible client for JavaScript and TypeScript. At only **~3 KB minified**, it signs AWS Signature Version 4 requests and communicates with object storage through standard Web Platform APIs such as `fetch`, `Response`, `TextEncoder`, and `crypto.subtle`.

Use `exec()` to sign and send a request, or `sign()` to create a pre-signed URL and send it with regular `fetch()`. Native `Response` objects make it easy to stream downloads, inspect headers, and integrate with web frameworks.

ZeroS3 targets **Node.js, Bun, browsers, and edge runtimes such as Cloudflare Workers**, wherever the required Web APIs are available.

## Features

Ordered from package footprint and platform foundation to S3 capabilities:

- **Only ~3 KB minified** — a compact client for performance-sensitive applications.
- **Zero dependencies** — built on native Web APIs, without an SDK dependency tree.
- **TypeScript** — typed configuration, request options, client methods, and S3 response shapes. Public types are available from `@focus-at/zs3/types`.
- **Web Platform APIs** — uses `fetch`, `Response`, `TextEncoder`, and `crypto.subtle`.
- **Node.js, Bun, browsers, and edge runtimes** — including Cloudflare Workers, where the required Web APIs are available.
- **S3-compatible API** — a consistent request model for bucket operations, object listing and pagination, object CRUD, metadata, tags, and S3 subresources.
- **AWS Signature Version 4** — sign direct requests or generate pre-signed URLs.

## Quick Start

```sh
npm install @focus-at/zs3
```

Generate a short-lived URL in a trusted server environment, then let the browser send the request with standard `fetch()`. Keep permanent credentials on the server; never expose the secret access key in browser code.

```typescript
// Server: create a pre-signed URL.
import { zs3 } from "@focus-at/zs3";

const signer = zs3({
  endpoint: process.env.S3_ENDPOINT!,
  accessKeyId: process.env.S3_ACCESS_KEY_ID!,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  region: "us-east-1",
});

const url = await signer.sign(
  { method: "GET", bucket: "my-bucket", key: "reports/annual.pdf" },
  { expiresIn: 300 },
);

// Browser: use the URL with the standard Fetch API.
const response = await fetch(url);
console.log(response.status, await response.blob());
```

For direct server-side requests, `exec()` signs and sends the request and returns a native `Response`:

```typescript
import { zs3 } from "@focus-at/zs3";
import type { ZS3Objects } from "@focus-at/zs3/types";

const client = zs3({
  endpoint: process.env.S3_ENDPOINT!,
  accessKeyId: process.env.S3_ACCESS_KEY_ID!,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  bucket: "my-bucket",
});

const response = await client.exec<ZS3Objects>({ method: "GET", prefix: "reports/" });
const page = await response.json();
console.log(page.Contents);
```

## Useful operation patterns

### List objects page by page

Use `fetch-owner` to include owner information in the listing. For the next page, pass `NextContinuationToken` as the `continuation-token` query parameter.

```typescript
import type { ZS3Objects } from "@focus-at/zs3/types";

const firstResponse = await client.exec<ZS3Objects>(
  { method: "GET", prefix: "reports/" },
  { query: { delimiter: "/", "max-keys": 100, "fetch-owner": true } },
);
const firstPage = await firstResponse.json();

if (firstPage.IsTruncated && firstPage.NextContinuationToken) {
  const nextResponse = await client.exec<ZS3Objects>(
    { method: "GET", prefix: "reports/" },
    {
      query: {
        delimiter: "/",
        "max-keys": 100,
        "fetch-owner": true,
        "continuation-token": firstPage.NextContinuationToken,
      },
    },
  );
  const nextPage = await nextResponse.json();
  console.log(nextPage.Contents);
}
```

### Work with object versions

Enable versioning for a bucket with the `versioning` subresource. Then list versions and use a returned `VersionId` to request a specific object version.

```typescript
await client.exec(
  { method: "PUT", bucket: "my-bucket", key: "" },
  {
    query: { versioning: "" },
    headers: { "Content-Type": "application/xml" },
    body: "<VersioningConfiguration><Status>Enabled</Status></VersioningConfiguration>",
  },
);

const versionsResponse = await client.exec(
  { method: "GET", bucket: "my-bucket", key: "" },
  { query: { versions: "", prefix: "reports/" } },
);
const versions = await versionsResponse.json();

// Use a VersionId returned by the version listing.
const objectVersion = await client.exec(
  { method: "GET", bucket: "my-bucket", key: "reports/annual.pdf" },
  { query: { versionId: "VERSION_ID" } },
);
```

### Set object metadata and tags

User metadata is sent during upload with `x-amz-meta-*` headers and can be inspected with `HEAD`. Tags are managed separately through the `tagging` subresource.

```typescript
await client.exec(
  { method: "PUT", key: "reports/annual.pdf", body: file },
  {
    headers: {
      "Content-Type": "application/pdf",
      "x-amz-meta-source": "finance",
    },
  },
);

const metadata = await client.exec({ method: "HEAD", key: "reports/annual.pdf" });
console.log(metadata.headers.get("x-amz-meta-source"));

await client.exec(
  { method: "PUT", key: "reports/annual.pdf", body: taggingXml },
  {
    query: { tagging: "" },
    headers: { "Content-Type": "application/xml" },
  },
);
```

To inspect or change an object's ACL, use the separate `acl` subresource:

```typescript
const acl = await client.exec(
  { method: "GET", key: "reports/annual.pdf" },
  { query: { acl: "" } },
);
```

### Send a custom request

Use a custom path with query parameters, headers, and a body—for example, to call an application-specific endpoint:

```typescript
const response = await adminClient.exec(
  {
    method: "PUT",
    key: "admin/v3/add-user",
    body: JSON.stringify({ accessKey, status: "enabled" }),
  },
  {
    query: { source: "dashboard" },
    headers: { "Content-Type": "application/json" },
  },
);
```

See [`examples/custom-request.ts`](examples/custom-request.ts) for the complete example.

### Upload a large object in parts

Multipart uploads are split into requests to initiate the upload, send each part, and complete it. Keep the `uploadId` and each uploaded part's ETag for the completion request.

```typescript
const initiated = await client.exec(
  { method: "POST", key: "archives/backup.zip" },
  { query: { uploads: "" } },
);
const { UploadId } = await initiated.json();

const partResponse = await client.exec(
  { method: "PUT", key: "archives/backup.zip", body: part },
  { query: { uploadId: UploadId, partNumber: 1 } },
);
const etag = partResponse.headers.get("etag");

const partsXml = `<CompleteMultipartUpload>
  <Part><PartNumber>1</PartNumber><ETag>${etag}</ETag></Part>
</CompleteMultipartUpload>`;

await client.exec(
  { method: "POST", key: "archives/backup.zip", body: partsXml },
  {
    query: { uploadId: UploadId },
    headers: { "Content-Type": "application/xml" },
  },
);
```

For listing parts and aborting an upload too, see [`examples/multipart.ts`](examples/multipart.ts).

## API coverage map

| Area | Covered scenarios |
| --- | --- |
| Signing | AWS4 signing, pre-signed URL, standard `fetch` after signing |
| Buckets | list/create/delete; ACL, versioning, lifecycle, policy, tags, CORS, encryption, website, notifications, logging, replication, public access block, object lock |
| Object lists | prefix, delimiter, max-keys, start-after, fetch-owner, continuation-token pagination |
| Objects | GET, PUT, HEAD, DELETE, ACL, tags, user metadata, attributes, restore, retention/legal hold |
| Multipart | initiate, upload part, list parts, complete, abort |
| Custom requests | custom path, query parameters, headers, body |
| Errors | status handling and parsed S3 XML error payloads |

## Examples

The `examples/` directory contains complete examples grouped by workflow:

- [`presigned-fetch.ts`](examples/presigned-fetch.ts) — create a pre-signed URL on the server and send the request with standard `fetch()`.
- [`custom-request.ts`](examples/custom-request.ts) — custom endpoint path with query parameters, headers, and a request body.
- [`buckets.ts`](examples/buckets.ts) — list, create, and delete buckets; ACL, versioning, lifecycle, policy, tags, CORS, encryption, website, notifications, logging, replication, public access, and object lock.
- [`objects.ts`](examples/objects.ts) — list and paginate objects; `prefix`, `delimiter`, `fetch-owner`, CRUD, ACL, tags, metadata, copy, attributes, restore, retention, and legal hold.
- [`multipart.ts`](examples/multipart.ts) — initiate, upload parts, list parts, complete, and abort multipart uploads.

Examples use placeholder credentials and endpoints. Supply your own configuration when adapting them; avoid running destructive operations such as bucket or object deletion against production data.
