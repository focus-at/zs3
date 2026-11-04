import { zs3 } from "../index.ts";

// Run the signer in a trusted server environment; keep the secret key private.
const signer = zs3({
  endpoint: process.env.S3_ENDPOINT!,
  accessKeyId: process.env.S3_ACCESS_KEY_ID!,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  region: "us-east-1",
});

// Server route: sign a single operation with a short expiry.
export async function createDownloadUrl(key: string) {
  return signer.sign(
    { method: "GET", bucket: "private-documents", key },
    { expiresIn: 300 },
  );
}

// Browser: use the URL with the standard Fetch API. Credentials stay on the server.
export async function downloadWithFetch(url: string) {
  return fetch(url, { method: "GET" });
}
