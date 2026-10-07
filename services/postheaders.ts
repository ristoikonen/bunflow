import bun, { connect } from "bun";

const TARGET_HOST = bun.env.APP_HOST || "localhost";
const TARGET_PORT = parseInt(bun.env.APP_PORT || "3000", 10); 

const LOG_HEADERS = true;

const REQUESTS_PER_SECOND = 50; 
const REQUEST_INTERVAL_MS = Math.floor(1000 / REQUESTS_PER_SECOND);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const baseRequestLine: string = "POST / HTTP/1.1";

//NOTE 203.0.113.195 is from test reserverd IP range - will not go though routers

// Comprehensive body payload variants for testing common backend parsers
const bodyPool: string[] = [
    JSON.stringify({ test: "data", active: true }), // Valid standard JSON format
    '{"malformed_json": ',                          // Mismatched structural payload syntax
    "A".repeat(5000),                               // Large structural payload stressor
    ""                                              // Completely empty POST content payload
];

type HeaderMap = Record<string, string>;
type HeaderPools = Record<string, string[]>;

const baseHeaders: HeaderMap = {
    "Host": `${TARGET_HOST}:${TARGET_PORT}`,
    "X-Forwarded-For": "203.0.113.195",
    "X-Real-IP": "203.0.113.195",
    "X-Forwarded-Proto": "http",
    "X-Forwarded-Scheme": "http",
    "User-Agent": "Bun-TCP-Stress-Tester",
    "Server": "nginx",
    "X-Powered-By": "Express",
    "Cookie": "session_token=stress-test-dummy-token-abc123",
    "Origin": "https://trusted-origin.com",
    "Access-Control-Allow-Origin": "*",
    "Referer": "https://trusted-origin.com",
    "X-HTTP-Method-Override": "POST",
    "Range": "bytes=0-1023",
    "Content-Type": "application/json",
    "Content-Length": "0", // Handled inside the main loop iteration engine
    "Transfer-Encoding": "chunked",
    "Accept": "*/*",
    "Connection": "keep-alive"
};

const headerPools: HeaderPools = {
    "Transfer-Encoding": ["chunked", ""],
    "Content-Length": ["0", "10", ""], // These manual mismatch states will trigger in turns
    "Origin": ["https://trusted-origin.com", "https://evil-origin.com", "null", ""],
    "Access-Control-Allow-Origin": ["*", "https://trusted-origin.com", "null"],
    "X-Forwarded-For": ["203.0.113.195", "127.0.0.1", "10.0.0.1, 192.168.1.1"],
    "X-Real-IP": ["203.0.113.195", "127.0.0.1"]
};

const totalIterations: number = Object.values(headerPools).reduce(
    (accumulator, pool) => accumulator * pool.length,
    1
) * bodyPool.length;

function* generateHeaderCombos(pools: HeaderPools): Generator<HeaderMap, void, unknown> {
    const keys: string[] = Object.keys(pools);
    const values: string[][] = Object.values(pools);

    function* cartesian(index: number, currentCombo: HeaderMap): Generator<HeaderMap, void, unknown> {
        if (index === keys.length) {
            yield currentCombo;
            return;
        }
        for (const val of values[index]) {
            yield* cartesian(index + 1, { ...currentCombo, [keys[index]]: val });
        }
    }
    yield* cartesian(0, {});
}

async function sendRawRequest(rawRequest: string) {
    try {
        await connect({
            hostname: TARGET_HOST,
            port: TARGET_PORT,
            socket: {
                open(socket) { socket.write(rawRequest); },
                data(socket, data) { socket.end(); },
                error(socket, error) { console.error("Socket error:", error); }
            }
        });
    } catch (err) {
        console.error("Connection failed:", err);
    }
}

async function runStressTest() {
    console.log(`[Config] Total unique combinations to test (Headers * Bodies): ${totalIterations}`);
    console.log(`[Config] Target rate: ~${REQUESTS_PER_SECOND} req/sec (${REQUEST_INTERVAL_MS}ms delay)...`);
    console.log("--------------------------------------------------");

    let count = 0;

    for (const comboHeaders of generateHeaderCombos(headerPools)) {
        for (const currentBody of bodyPool) {
            const mergedHeaders: HeaderMap = { ...baseHeaders, ...comboHeaders };

            // Dynamic assessment: calculates proper length unless overridden by fuzz rules
            if (!comboHeaders.hasOwnProperty("Content-Length")) {
                mergedHeaders["Content-Length"] = Buffer.byteLength(currentBody).toString();
            }

            const headerLines: string[] = Object.entries(mergedHeaders)
                .filter(([_, value]) => value !== "")
                .map(([key, value]) => `${key}: ${value}`);

            const rawRequest: string = [
                baseRequestLine,
                ...headerLines,
                "", 
                currentBody 
            ].join("\r\n");

            count++;
            console.log(`Sending request [${count}/${totalIterations}]...`);

            await sendRawRequest(rawRequest);

            if (LOG_HEADERS) {
                console.log(rawRequest);
                console.log("\n--------------------------------------------------");
            }

            if (REQUEST_INTERVAL_MS > 0) {
                await sleep(REQUEST_INTERVAL_MS);
            }
        }
    }
}

runStressTest();
