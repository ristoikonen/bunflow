// Usage: bun run services/httpheaders.ts [url] [--method GET] [--header "Name: value"]
// Example: bun run services/httpheaders.ts https://httpbin.org/headers --header "X-Test: bunflow"

function printUsage() {
  console.log(
    'Usage: bun run services/httpheaders.ts [url] [--method GET] [--header "Name: value"]'
  );
  console.log("Defaults to http://$APP_HOST:$APP_PORT/ (localhost:3000).");
}

function parseArgs(args: string[]) {
  let url: string | undefined;
  let method = "GET";
  const headers = new Headers({ "User-Agent": "BunFlow-Header-Tester" });

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;

    if (arg === "--help" || arg === "-h") {
      printUsage();
      return null;
    }

    if (arg === "--method" || arg === "-X") {
      const value = args[++i];
      if (!value) throw new Error(`Missing value for ${arg}`);
      method = value.toUpperCase();
      continue;
    }

    if (arg === "--header" || arg === "-H") {
      const value = args[++i];
      if (!value) throw new Error(`Missing value for ${arg}`);
      const separator = value.indexOf(":");
      if (separator <= 0) {
        throw new Error(`Invalid header ${JSON.stringify(value)}; expected "Name: value"`);
      }
      headers.set(value.slice(0, separator).trim(), value.slice(separator + 1).trim());
      continue;
    }

    if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    if (url) throw new Error(`Unexpected argument: ${arg}`);
    url = arg;
  }

  const host = Bun.env.APP_HOST || "localhost";
  const port = Bun.env.APP_PORT || "3000";
  return {
    url: new URL(url || `http://${host}:${port}/`),
    method,
    headers,
  };
}

async function run() {
  try {
    const options = parseArgs(Bun.argv.slice(2));
    if (!options) return;

    console.log(`Request: ${options.method} ${options.url}`);
    console.log("Request headers:");
    for (const [name, value] of options.headers) {
      console.log(`  ${name}: ${value}`);
    }

    const response = await fetch(options.url, {
      method: options.method,
      headers: options.headers,
    });

    console.log(`\nResponse: ${response.status} ${response.statusText}`);
    console.log("Response headers:");
    for (const [name, value] of response.headers) {
      console.log(`  ${name}: ${value}`);
    }

    const body = await response.text();
    if (body) console.log(`\nResponse body:\n${body}`);

    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printUsage();
    process.exitCode = 1;
  }
}

run();
