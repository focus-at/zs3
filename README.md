# ZeroS3 (zs3)
![GitHub License](https://img.shields.io/github/license/focus-at/zs3)
![GitHub Stars](https://img.shields.io/github/stars/focus-at/zs3)

> ⚠️ **Status: WIP (Work in Progress)**
> This project is currently under active development (**WHIP**). The public API is highly experimental, subject to breaking changes, and the specification is still stabilizing.
> 
[cdn.jsdelivr](https://cdn.jsdelivr.net/npm/@focus-at/zs3@latest/+esm)

## Overview
**ZeroS3 (zs3)** is an ultra-lightweight (~3 KB), zero-dependency S3 client designed for performance-critical environments, edge workers, and client-side integration (**BYOS3** model). Built purely on modern Web Standards (`fetch`, `crypto.subtle`), it provides lightning-fast execution for AWS S3, MinIO, Cloudflare R2, and Backblaze B2.

## Features
- **Zero Dependencies:** Built entirely on native Web APIs (`fetch`, `crypto.subtle`).
- **Unified API:** One simple `execute()` method returning a native Web `Response`.
- **Drop-in Web Compatibility:** Seamlessly stream files straight into your web server responses or client-side components.

## Quick Start

```zsh
# Install
npm i @focus-at/zs3
```

```typescript
import type { S3Client } from '@focus-at/zs3';
import { zs3 } from '@focus-at/zs3';
```

<!-- DOC_INJECT: client-init -->

```typescript
/**
 * Initialize a new S3 client instance.
 * Accepts full S3-compatible API credentials and endpoints (e.g., AWS S3, MinIO, Yandex Cloud).
 */
const storage = zs3({
  endpoint,
  accessKeyId: "mock-access-key",
  secretAccessKey: "mock-secret-key",
  bucket: "test-bucket",
});
```
<!-- DOC_INJECT: stats-key -->

```typescript
/**
 * Retrieve metadata and headers for a specific object without downloading its content.
 * Useful for checking file existence, size, or content type efficiently.
 */
const response = await storage.execute({ method: "HEAD", key: "doc.pdf" });
```
<!-- DOC_INJECT: get-prefix -->

```typescript
/**
 * List objects within the bucket that match a specific key prefix.
 * Automatically parses the S3 XML response into a clean JSON structure.
 */
const response = await storage.execute({ method: "GET", prefix: "production/" });
const result = await response.json();
```
<!-- DOC_INJECT: get-key -->

```typescript
/**
 * Download a specific object from the S3 bucket by its key.
 * Returns a native Response object containing the file data stream or payload.
 */
const res = await storage.execute({ method: "GET", key: "file.txt" });
```
<!-- DOC_INJECT: instance-clone -->

```typescript
/**
 * Clone an existing S3 client instance to override specific configuration settings
 * such as the bucket, endpoint, or region while maintaining the original credentials.
 */
const dynamic = storage.clone({
  bucket: "dynamic-bucket",
  endpoint: "://zone.com",
  region: "eu-west-1"
});
```
<!-- DOC_INJECT: put-key -->

```typescript
/**
 * Upload a payload or file directly to the S3 bucket using the PUT method.
 * Supports string payloads, buffers, blobs, and streams.
 */
await dynamic.execute({ method: "PUT", key: "image.png", body: "payload" });
```
<!-- DOC_INJECT: delete-key -->

```typescript
/**
 * Permanently delete a specific object from the S3 bucket by its key.
 * This operation is irreversible and removes the target file immediately.
 */
const response = await storage.execute({ method: "DELETE", key: "stale-file.tmp" });
```
<!-- DOC_INJECT: sign-request -->

```typescript
/**
 * Generate a pre-signed URL for a specific S3 operation.
 * This allows temporary, secure access to a resource with dynamic parameters
 * without exposing permanent AWS credentials to the client.
 */
// Минимальный инстанс только со статичными ключами
const signer = zs3({
  endpoint: 'https://amazonaws.com',
  accessKeyId: 'YOUR_ACCESS_KEY_ID',
  secretAccessKey: 'YOUR_SECRET_ACCESS_KEY'
});

// Все динамические параметры передаем в сам запрос
const url = await signer.sign({
  method: 'GET',
  bucket: 'my-dynamic-bucket', // Указываем тут
  key: 'photo.jpg'
}, {
  query: { 'X-Amz-Region': 'eu-west-1' } // Если регион отличается от дефолтного
});
```
<!-- DOC_INJECT: add-user -->

```typescript
/**
 * Execute custom request using AWS4 signature without prepending a bucket name to the URI.
 */

const adminClient = zs3({
  endpoint: 'https://amazonaws.com',
  accessKeyId: 'ADMIN_ACCESS_KEY',
  secretAccessKey: 'ADMIN_SECRET_KEY'
});

const accessKey = "new-user-123";
const secretKey = "super-secret-password";
const body = JSON.stringify({ secretKey, status: 'enabled' });

const response = await adminClient.execute({
  method: 'PUT',
  key: 'admin/v3/add-user',
  body: body
}, {
  query: { accessKey },
  headers: { 'Content-Type': 'application/json' }
});
```
