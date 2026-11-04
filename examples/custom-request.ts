import { zs3 } from "../index.ts";

// Application-specific endpoint exposed by an S3-compatible gateway.
const adminClient = zs3({
  endpoint: process.env.S3_ADMIN_ENDPOINT ?? "https://s3-admin.example.test",
  accessKeyId: process.env.S3_ADMIN_ACCESS_KEY_ID ?? "admin-key",
  secretAccessKey: process.env.S3_ADMIN_SECRET_ACCESS_KEY ?? "key",
});

export async function addUser(accessKey: string, secretKey: string) {
  return adminClient.exec(
    {
      method: "PUT",
      key: "admin/v3/add-user",
      body: JSON.stringify({ secretKey, status: "enabled" }),
    },
    {
      query: { accessKey },
      headers: { "Content-Type": "application/json" },
    },
  );
}
