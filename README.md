# ZeroS3 (zs3)

![GitHub License](https://img.shields.io/github/license/focus-at/zs3)
![GitHub Stars](https://img.shields.io/github/stars/focus-at/zs3)

> ⚠️ **Status: WIP (Work in Progress)** — ZeroS3 is under active development. The public API may change as the project evolves.

[CDN package](https://cdn.jsdelivr.net/npm/@focus-at/zs3@latest/+esm)

## Overview

**ZeroS3 (zs3)** is a lightweight, zero-dependency S3-compatible client for JavaScript and TypeScript. It uses standard Web Platform APIs—including `fetch`, `Response`, and `crypto.subtle`—to sign requests and work with object storage across server, browser, and edge environments.

The API is designed around two focused operations: `execute()` signs and sends a request, while `sign()` creates a pre-signed URL that can be used with the platform's standard `fetch()`. Native `Response` objects make it straightforward to stream downloads, inspect headers, and integrate with web frameworks.

## Features

- **Zero runtime dependencies** — built on native Web APIs.
- **TypeScript-first and fully typed** — public configuration, request, response, and S3 XML data types are available from `@focus-at/zs3/types`.
- **AWS Signature Version 4** — sign direct requests or generate pre-signed URLs.
- **Native Fetch API** — `execute()` returns a web-standard `Response`; `sign()` works with ordinary `fetch()`.
- **S3-compatible operations** — use a consistent request model for buckets, object listings, objects, and subresources.
- **Portable by design** — suitable for modern Node.js, browsers, and edge runtimes with Web API support.
- **Small footprint** — designed as a lightweight client for performance-sensitive environments.

## Quick Start

```sh
npm install @focus-at/zs3
```

```typescript
import { zs3 } from "@focus-at/zs3";
import type { ZS3Objects } from "@focus-at/zs3/types";

const client = zs3({
  endpoint: process.env.S3_ENDPOINT!,
  accessKeyId: process.env.S3_ACCESS_KEY_ID!,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  bucket: "my-bucket",
});

const response = await client.execute<ZS3Objects>({
  method: "GET",
  prefix: "reports/",
});
const page = await response.json();
console.log(page.Contents);
```

Keep permanent credentials in a trusted environment. For browser access, create a short-lived pre-signed URL on the server and use standard `fetch()` from the client. See [`examples/presigned-fetch.ts`](examples/presigned-fetch.ts).

## Examples

The [`examples/`](examples/) directory contains complete, grouped scenarios:

- [`presigned-fetch.ts`](examples/presigned-fetch.ts) — create a pre-signed URL on the server and send the request with standard `fetch()`.
- [`custom-request.ts`](examples/custom-request.ts) — custom endpoint path with query parameters, headers, and a request body.
- [`buckets.ts`](examples/buckets.ts) — list, create, and delete buckets; ACL, versioning, lifecycle, policy, tags, CORS, encryption, website, notifications, logging, replication, public access, and object lock.
- [`objects.ts`](examples/objects.ts) — list and paginate objects; `prefix`, `delimiter`, `fetch-owner`, CRUD, ACL, tags, metadata, copy, attributes, restore, retention, and legal hold.
- [`multipart.ts`](examples/multipart.ts) — initiate, upload parts, list parts, complete, and abort multipart uploads.

Check that the TypeScript examples bundle without making network requests:

```sh
bun run check:examples
```

## Request model

`execute()` signs and sends a request, returning a native `Response`. `sign()` generates a URL for a specific operation; send it with the matching method, headers, and body using ordinary `fetch()`.

Request query parameters and headers are passed as the second argument:

```typescript
const response = await client.execute(
  { method: "GET", prefix: "reports/" },
  { query: { delimiter: "/", "max-keys": 100, "fetch-owner": true } },
);
```

For object listings, `fetch-owner` asks S3 to include owner information for listed objects. It is not a parameter for retrieving an individual object; use `HEAD` for object response headers or the object's `?acl` subresource for ACL information.

Object metadata and object tags are separate features. Set user metadata during upload with `x-amz-meta-*` headers and inspect it with `HEAD`. Tags use the `?tagging` subresource. Replacing metadata on an existing object typically uses a copy operation with metadata replacement.

## Example and test organization

Examples are grouped by user-facing workflows in `examples/`. Tests are grouped by behavior in `tests/`. Example checks are an explicit command; running the test suite does not rewrite this README.
