import { describe, expect, test } from "bun:test";
import { hash, chainHmac, toHex } from "../index.ts";

describe("cryptography", () => {
  test("computes a deterministic HMAC and hex representation", async () => {
    expect(await chainHmac("secret", "data")).toBe("1b2c16b75bd2a870c114153ccda5bcfca63314bc722fa160d690de133ccbb9db");
  });

  test("computes SHA-256", async () => {
    expect(await hash("hello zeros3")).toBe("dea9a435609aadbdaf641ddb2b0d1ad1d97263798769b6e43188d0ba57b79fad");
  });
});
