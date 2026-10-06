import type { BunRequest } from "bun";
import { createClient } from "@libsql/client";
import { generateIPHash } from "../utils/hash";

const db = createClient({
    url: Bun.env.TURSO_DATABASE_URL || "file:local.db",
    authToken: Bun.env.TURSO_AUTH_TOKEN,
});

export interface M2131LogRecord {
  timestamp: string; // AS ISO 8601 UTC millisecond precision: YYYY-MM-DDThh:mm:ss.mmmZ
  correlationId: string;
  method: string;
  path: string;
  clientIpHash: string;
  userAgent: string;
  statusCode?: number;
  durationMs: number;
}

/**
 * Saves a log record to the Turso SQLite m2131_logs table.
 */
async function saveLogToDb(record: M2131LogRecord): Promise<void> {
  try {
    await db.execute({
      sql: `
        INSERT INTO m2131_logs (
          timestamp, correlation_id, method, path, client_ip_hash, user_agent, status_code, duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        record.timestamp,
        record.correlationId,
        record.method,
        record.path,
        record.clientIpHash,
        record.userAgent,
        record.statusCode ?? null,
        record.durationMs,
      ],
    });
  } catch (dbError) {
    console.error("CRITICAL: Failed to write telemetry log to Turso database:", dbError);
  }
}

/**
 * Formats a log record according to M-21-31 telemetry and ACSC standards.
 */
export function formatM2131Log(record: M2131LogRecord): string {
  return JSON.stringify({
    schemaVersion: "M-21-31-ACSC-1.0",
    timestamp: record.timestamp,
    correlationId: record.correlationId,
    http: {
      method: record.method,
      path: record.path,
      statusCode: record.statusCode || 200,
      durationMs: record.durationMs,
    },
    security: {
      clientIpHash: record.clientIpHash,
      userAgent: record.userAgent,
    },
  });
}

/**
 * Middleware wrapper using BunRequest to capture request telemetry and save to Turso.
 */
export async function handleM2131Telemetry(
  req: BunRequest,
  next: (req: BunRequest) => Promise<Response>
): Promise<Response> {
  const start = performance.now();
  // Leverage Bun's native global crypto Web API for secure correlation tracking
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  
  // Extract dual IP source indicators securely
  const rawIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
  const clientIpHash = await generateIPHash(rawIp);
  const userAgent = req.headers.get("user-agent") || "unknown";

  const url = new URL(req.url);

  let response: Response;
  try {
    response = await next(req);
  } catch (error) {
    const durationMs = Math.round((performance.now() - start) * 1000) / 1000;
    const errorRecord: M2131LogRecord = {
      timestamp: new Date().toISOString(),
      correlationId,
      method: req.method,
      path: url.pathname,
      clientIpHash,
      userAgent,
      statusCode: 500,
      durationMs,
    };
    
    console.error(formatM2131Log(errorRecord));
    await saveLogToDb(errorRecord);
    
    throw error;
  }

  const durationMs = Math.round((performance.now() - start) * 1000) / 1000;
  const logRecord: M2131LogRecord = {
    timestamp: new Date().toISOString(),
    correlationId,
    method: req.method,
    path: url.pathname,
    clientIpHash,
    userAgent,
    statusCode: response.status,
    durationMs,
  };

  console.log('LOG:' + formatM2131Log(logRecord));
  await saveLogToDb(logRecord);

  const newHeaders = new Headers(response.headers);
  newHeaders.set("X-Correlation-ID", correlationId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}