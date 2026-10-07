import { mkdir } from "node:fs/promises";

const host = Bun.env.APP_HOST || "httpbin.org";
const port = Number(Bun.env.APP_PORT || "443");
const path = "/headers";
const requestTimeoutMs = 5000;
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
  testCase: string,
  rawRequest: string,
  requestHeaders: Record<string, string>,
  outcome: Outcome,
) {
  const record = {
    runId,
    timestamp: new Date().toISOString(),
    target,
    testIndex,
    features: { method: "GET", path, testCase, requestHeaders, rawRequest },
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
  
  //"Connection": "keep-alive",
  //"Server": "nginx",
  //"Content-Type": "application/json",
  //"Content-Length": "0",


const headerPools = {
  Origin: ["https://trusted-origin.com", "https://evil-origin.com", "null"],
  "X-Forwarded-For": ["203.0.113.195", "127.0.0.1"],    
  "X-Real-IP": ["203.0.113.195", "127.0.0.1"],
  "X-Arbitrary-Id": ["header-test-001"],
  "X-Forwarded-Scheme": ["http", "https"],
};

  //Origin: ["https://trusted-origin.com", "https://evil-origin.com", "null"],

  //  "Referer": "https://trusted-origin.com",
  //"X-Powered-By": "Express",
  //"X-HTTP-Method-Override": "GET",
  //"Access-Control-Allow-Credentials": ["true"],
  //"Range": "bytes=0-1023",
  //"Transfer-Encoding": "chunked",


const wireCases = [
  {
    name: "malformed-request-line",
    request: `GET ${path} HTTP/1.1 EXTRA\r\nHost: ${host}\r\nConnection: close\r\n\r\n`,
  },
  {
    name: "dummy-cookie-token",
    request: `GET ${path} HTTP/1.1\r\nHost: ${host}\r\nCookie: session_token=dummy-cookie-token\r\nConnection: close\r\n\r\n`,
  },
  {
    name: "lf-only-line-endings",
    request: `GET ${path} HTTP/1.1\nHost: ${host}\nConnection: close\n\n`,
  },
  {
    name: "crlf-line-endings",
    request: `GET ${path} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`,
  },
  {
    name: "repeated-origin-header",
    request: `GET ${path} HTTP/1.1\r\nHost: ${host}\r\nOrigin: https://trusted-origin.com\r\nOrigin: https://evil-origin.com\r\nConnection: close\r\n\r\n`,
  },
  {
    name: "conflicting-content-length",
    request: `GET ${path} HTTP/1.1\r\nHost: ${host}\r\nContent-Length: 0\r\nContent-Length: 5\r\nConnection: close\r\n\r\nabcde`,
  },
  {
    name: "content-length-with-transfer-encoding",
    request: `GET ${path} HTTP/1.1\r\nHost: ${host}\r\nContent-Length: 5\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n0\r\n\r\n`,
  },
];

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
  const requestHost = port === 80 || port === 443 ? host : `${host}:${port}`;
  return { Host: requestHost, ...baseHeaders, ...headers };
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
  const echoedHeaders = bodyHeaders && Object.keys(testedHeaders).length > 0
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

async function send(
  testIndex: number,
  testCase: string,
  request: string,
  requestHeaders: Record<string, string>,
  testedHeaders: Record<string, string>,
) {
  const responseChunks: Uint8Array[] = [];
  const startedAt = performance.now();

  return new Promise<void>((resolve) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (outcome: Outcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      logRecord(testIndex, testCase, request, requestHeaders, outcome);
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
          timeout = setTimeout(() => {
            finish({
              statusCode: null,
              statusText: "",
              responseHeaders: {},
              body: null,
              echoedHeaders: null,
              echoTestPassed: null,
              error: `Request timed out after ${requestTimeoutMs} ms`,
              latencyMs: performance.now() - startedAt,
            });
            socket.end();
          }, requestTimeoutMs);
          socket.write(request);
        },
        data(_socket, data: Uint8Array) {
          responseChunks.push(data);
        },
        close() {
          finish(parseResponse(
            responseChunks,
            performance.now() - startedAt,
            testedHeaders,
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
  const requestHeaders = getRequestHeaders(headers);
  const request = [
    `GET ${path} HTTP/1.1`,
    ...Object.entries(requestHeaders).map(([name, value]) => `${name}: ${value}`),
    "",
    "",
  ].join("\r\n");
  await send(testIndex, "mixed-headers", request, requestHeaders, headers);
}

if (Bun.env.ALLOW_UNSAFE_HTTP_TESTS === "true" && Bun.env.APP_HOST) {
  const firstWireTestIndex = Object.values(headerPools).reduce(
    (count, values) => count * values.length,
    1,
  ) + 1;

  for (const [index, test] of wireCases.entries()) {
    await send(
      firstWireTestIndex + index,
      test.name,
      test.request,
      {},
      {},
    );
  }
} else {
  console.error(
    "Skipping raw malformed/framing tests. Set APP_HOST to an authorized test server and ALLOW_UNSAFE_HTTP_TESTS=true to enable.",
  );
}

output.write("\n]\n");
output.end();
