import { mkdir } from "node:fs/promises";

const host = Bun.env.APP_HOST || "httpbin.org";
const port = Number(Bun.env.APP_PORT || "443");
const path = "/headers";
const runId = crypto.randomUUID();
const target = `${port === 443 ? "https" : "http"}://${host}:${port}${path}`;
const runTimestamp = new Date().toISOString();
const filenameTimestamp = runTimestamp.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
await mkdir("logs", { recursive: true });
const output = Bun.file(`logs/header-test-results-${filenameTimestamp}.json`).writer();
let firstRecord = true;
output.write("[\n");

type Outcome = {
  statusCode: number | null;
  statusText: string;
  responseHeaders: Record<string, string>;
  body: unknown;
  echoedHeaders: Record<string, boolean> | null;
  echoTestPassed: boolean | null;
  error: string | null;
  latencyMs: number;
};

function logRecord(
  testIndex: number,
  requestHeaders: Record<string, string>,
  outcome: Outcome,
) {
  const record = {
    runId,
    timestamp: new Date().toISOString(),
    target,
    testIndex,
    features: { method: "GET", path, requestHeaders },
    outcome,
  };
  const line = JSON.stringify(record);
  console.log(line);
  output.write(`${firstRecord ? "" : ",\n"}${line}`);
  firstRecord = false;
  output.flush();
}

const baseHeaders = {
  Accept: "*/*",
  "User-Agent": "Bun-Header-Tester",
  "Connection": "close",
};

const headerPools = {
  Origin: ["https://trusted-origin.com", "https://evil-origin.com", "null"],
  "X-Forwarded-For": ["203.0.113.195", "127.0.0.1"],
  "X-Real-IP": ["203.0.113.195", "127.0.0.1"],
};

function* mixedHeaders(index = 0, headers: Record<string, string> = {}): Generator<Record<string, string>> {
  const names = Object.keys(headerPools) as (keyof typeof headerPools)[];
  if (index === names.length) {
    yield headers;
    return;
  }

  const name = names[index];
  if (name === undefined) return;

  for (const value of headerPools[name]) {
    yield* mixedHeaders(index + 1, { ...headers, [name]: value });
  }
}

function getRequestHeaders(headers: Record<string, string>) {
  return { Host: host, ...baseHeaders, ...headers };
}

function parseResponse(
  responseChunks: Uint8Array[],
  latencyMs: number,
  testedHeaders: Record<string, string>,
): Outcome {
  const rawResponse = Buffer.concat(responseChunks).toString();
  const [statusLine = "", ...responseLines] = rawResponse.split("\r\n");
  const separator = responseLines.indexOf("");
  const headerLines =
    separator < 0 ? responseLines : responseLines.slice(0, separator);
  const bodyText =
    separator < 0 ? "" : responseLines.slice(separator + 1).join("\r\n");
  const [, statusCode, statusText = ""] =
    statusLine.match(/^HTTP\/\S+\s+(\d{3})(?:\s+(.*))?$/) ?? [];
  const responseHeaders = Object.fromEntries(
    headerLines
      .filter((line) => line.includes(":"))
      .map((line) => {
        const colon = line.indexOf(":");
        return [
          line.slice(0, colon).trim().toLowerCase(),
          line.slice(colon + 1).trim(),
        ];
      }),
  );
  let body: unknown = bodyText || null;
  try {
    if (bodyText) body = JSON.parse(bodyText);
  } catch {
    // Keep non-JSON bodies as text.
  }

  const bodyHeaders =
    body !== null &&
    typeof body === "object" &&
    "headers" in body &&
    body.headers !== null &&
    typeof body.headers === "object"
      ? body.headers as Record<string, unknown>
      : null;
  const echoedHeaders = bodyHeaders
    ? Object.fromEntries(
        Object.entries(testedHeaders).map(([name, value]) => {
          const echoedValue = Object.entries(bodyHeaders).find(
            ([echoedName]) => echoedName.toLowerCase() === name.toLowerCase(),
          )?.[1];
          return [name, echoedValue === value];
        }),
      )
    : null;

  return {
    statusCode: statusCode ? Number(statusCode) : null,
    statusText,
    responseHeaders,
    body,
    echoedHeaders,
    echoTestPassed: echoedHeaders
      ? Object.values(echoedHeaders).every(Boolean)
      : null,
    error: statusCode ? null : "Invalid or empty HTTP response",
    latencyMs,
  };
}

async function send(testIndex: number, headers: Record<string, string>) {
  const requestHeaders = getRequestHeaders(headers);
  const responseChunks: Uint8Array[] = [];
  const startedAt = performance.now();
  const request = [
    `GET ${path} HTTP/1.1`,
    ...Object.entries(requestHeaders).map(([name, value]) => `${name}: ${value}`),
    "",
    "",
  ].join("\r\n");

  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = (outcome: Outcome) => {
      if (settled) return;
      settled = true;
      logRecord(testIndex, requestHeaders, outcome);
      resolve();
    };
    const failed = (error: unknown) => ({
      statusCode: null,
      statusText: "",
      responseHeaders: {},
      body: null,
      echoedHeaders: null,
      echoTestPassed: null,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: performance.now() - startedAt,
    });

    Bun.connect({
      hostname: host,
      port,
      tls: port === 443,
      socket: {
        open(socket) {
          socket.write(request);
        },
        data(_socket, data: Uint8Array) {
          responseChunks.push(data);
        },
        close() {
          finish(parseResponse(
            responseChunks,
            performance.now() - startedAt,
            headers,
          ));
        },
        error(_socket, error) {
          finish(failed(error));
        },
      },
    }).catch((error) => finish(failed(error)));
  });
}

for (const [index, headers] of [...mixedHeaders()].entries()) {
  const testIndex = index + 1;
  await send(testIndex, headers);
}

output.write("\n]\n");
output.end();
