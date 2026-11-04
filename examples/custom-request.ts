import { zs3 } from "../index.ts";

// Application-specific endpoint exposed by an S3-compatible gateway.
const adminClient = zs3({
  endpoint: process.env.S3_ADMIN_ENDPOINT!,
  accessKeyId: process.env.S3_ADMIN_ACCESS_KEY_ID!,
  secretAccessKey: process.env.S3_ADMIN_SECRET_ACCESS_KEY!,
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
