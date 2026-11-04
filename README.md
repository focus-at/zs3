# ZeroS3 (zs3)

![GitHub License](https://img.shields.io/github/license/focus-at/zs3)
![GitHub Stars](https://img.shields.io/github/stars/focus-at/zs3)
![npm version](https://img.shields.io/npm/v/@focus-at/zs3)

> **Zero runtime dependencies · only ~3 KB minified · built on Web Platform APIs**
>
> ZeroS3 is under active development; the public API may evolve.

## Overview

**ZeroS3 (zs3)** is a lightweight S3-compatible client for JavaScript and TypeScript. At only **~3 KB minified**, it signs AWS Signature Version 4 requests and communicates with object storage through standard Web Platform APIs such as `fetch`, `Response`, `TextEncoder`, and `crypto.subtle`.

Use `execute()` to sign and send a request, or `sign()` to create a pre-signed URL and send it with regular `fetch()`. Native `Response` objects make it easy to stream downloads, inspect headers, and integrate with web frameworks.

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

For direct server-side requests, `execute()` signs and sends the request and returns a native `Response`:

```typescript
import { zs3 } from "@focus-at/zs3";
import type { ZS3Objects } from "@focus-at/zs3/types";

const client = zs3({
  endpoint: process.env.S3_ENDPOINT!,
  accessKeyId: process.env.S3_ACCESS_KEY_ID!,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  bucket: "my-bucket",
});

const response = await client.execute<ZS3Objects>({ method: "GET", prefix: "reports/" });
const page = await response.json();
console.log(page.Contents);
```

## Request model

`execute()` signs and sends a request, returning a native `Response`. `sign()` generates a URL for a specific operation; send it with the matching method, headers, and body using ordinary `fetch()`.

Pass query parameters and headers as the second argument:

```typescript
const response = await client.execute(
  { method: "GET", prefix: "reports/" },
  { query: { delimiter: "/", "max-keys": 100, "fetch-owner": true } },
);
```

For object listings, `fetch-owner` asks S3 to include owner information for listed objects. It is not a parameter for retrieving an individual object; use `HEAD` for object response headers or the object's `?acl` subresource for ACL information.

Object metadata and object tags are separate features. Set user metadata during upload with `x-amz-meta-*` headers and inspect it with `HEAD`. Tags use the `?tagging` subresource. Replacing metadata on an existing object typically uses a copy operation with metadata replacement.

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

Check that the TypeScript examples bundle without making network requests:

```sh
bun run check:examples
```

Examples use placeholder credentials and endpoints. Supply your own configuration when adapting them; avoid running destructive operations such as bucket or object deletion against production data.
