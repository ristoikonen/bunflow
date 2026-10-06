import { z } from "zod";
import { createClient } from "@libsql/client";

const db = createClient({
    url: Bun.env.TURSO_DATABASE_URL || "file:local.db",
    authToken: Bun.env.TURSO_AUTH_TOKEN,
});



const ipSchema = z.string().min(1, "IP cannot be empty");


export async function generateIPHash(ip: string): Promise<string> {
  const pepper = Bun.env.OPENSSL_HEX_SECRET_PEPPER;
  
  if (!pepper) {
    throw new Error("CRITICAL: OPENSSL_HEX_SECRET_PEPPER is missing from environment variables!");
  }

  const rawData = `${ip}:${pepper}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(rawData);

  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  return `anon_${hashHex.substring(0, 24)}`;
}
