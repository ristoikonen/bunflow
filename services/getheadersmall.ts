import bun, { connect } from "bun";

const TARGET_HOST = "http//:localhost"; //|| bun.env.APP_HOST;
const TARGET_PORT = parseInt(bun.env.APP_PORT || "3000", 10); 

const LOG_HEADERS = true;

const REQUESTS_PER_SECOND = 1; 
const REQUEST_INTERVAL_MS = Math.floor(1000 / REQUESTS_PER_SECOND);

// Blind bombardment of HTTP requests!
// USAGE: Bun services/getheadersmall.ts


const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const baseRequestLine: string = "GET / HTTP/1.1";

//NOTE 203.0.113.195 is from test reserverd IP range - will not go though routers

// Payload variations pool for fuzzing unexpected bodies on GET requests
const bodyPool: string[] = [
    "",                                             // Standard Empty Body
    JSON.stringify({ test: "data", active: true }), // Unexpected JSON Body
    '{"malformed_json": ',                          // Broken structural syntax
    "A".repeat(5000)                                // Large payload buffer stressor
];

type HeaderMap = Record<string, string>;
type HeaderPools = Record<string, string[]>;

const baseHeaders: HeaderMap = {
    "Host": `${TARGET_HOST}:${TARGET_PORT}`,
    //"User-Agent": "Bun-TCP-Stress-Tester",
    //"Access-Control-Allow-Origin": "*",
    //"Accept": "*/*",
    //"Connection": "keep-alive"
};

const headerPools: HeaderPools = {
    "Transfer-Encoding": ["chunked", ""],
    "X-Real-IP": ["203.0.113.195", "127.0.0.1"]
};


// Calculate total combinations accounting for both headers and payload bodies
const totalIterations: number = Object.values(headerPools).reduce(
    (accumulator, pool) => accumulator * pool.length,
    1
) * bodyPool.length;

function* generateHeaderCombos(pools: HeaderPools): Generator<HeaderMap, void, unknown> {
    const entries = Object.entries(pools);

    function* cartesian(index: number, currentCombo: HeaderMap): Generator<HeaderMap, void, unknown> {
        if (index === entries.length) {
            yield currentCombo;
            return;
        }

        const entry = entries[index];
        if (!entry) throw new Error(`Missing header pool at index ${index}`);

        const [key, values] = entry;
        for (const val of values) {
            yield* cartesian(index + 1, { ...currentCombo, [key]: val });
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

            // Dynamically evaluate length if header variation loop did not explicitly inject a forced fuzz length
            if (!comboHeaders.hasOwnProperty("Content-Length")) {
                mergedHeaders["Content-Length"] = Buffer.byteLength(currentBody).toString();
            }

            // Remove content properties completely if there's no body and no fuzz rule override
            if (currentBody === "" && !comboHeaders.hasOwnProperty("Content-Length")) {
                delete mergedHeaders["Content-Length"];
                delete mergedHeaders["Content-Type"];
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
