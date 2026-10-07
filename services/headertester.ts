import { mkdir } from "node:fs/promises";

const host = Bun.env.APP_HOST || "httpbin.org";
const port = Number(Bun.env.APP_PORT || "443");
const path = "/headers";
const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
await mkdir("logs", { recursive: true });
const output = Bun.file(`logs/header-test-results-${timestamp}.json`).writer();
let firstRecord = true;
output.write("[\n");

function logRecord(record: object) {
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

function logResult(
  testIndex: number,
  requestHeaders: Record<string, string>,
  responseChunks: Uint8Array[],
) {
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

  logRecord({
    testIndex,
    features: { method: "GET", path, requestHeaders },
    outcome: {
      statusCode: statusCode ? Number(statusCode) : null,
      statusText,
      responseHeaders,
      body,
      error: null,
    },
  });
}

async function send(testIndex: number, headers: Record<string, string>) {
  const requestHeaders = getRequestHeaders(headers);
  const responseChunks: Uint8Array[] = [];
  const request = [
    `GET ${path} HTTP/1.1`,
    ...Object.entries(requestHeaders).map(([name, value]) => `${name}: ${value}`),
    "",
    "",
  ].join("\r\n");

  return new Promise<void>((resolve, reject) => {
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
          logResult(testIndex, requestHeaders, responseChunks);
          resolve();
        },
        error(_socket, error) {
          reject(error);
        },
      },
    }).catch(reject);
  });
}

for (const [index, headers] of [...mixedHeaders()].entries()) {
  const testIndex = index + 1;
  try {
    await send(testIndex, headers);
  } catch (error) {
    logRecord({
      testIndex,
      features: {
        method: "GET",
        path,
        requestHeaders: getRequestHeaders(headers),
      },
      outcome: {
        statusCode: null,
        statusText: "",
        responseHeaders: {},
        body: null,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

output.write("\n]\n");
output.end();
