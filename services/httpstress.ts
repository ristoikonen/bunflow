

const TARGET_HOST = Bun.env.APP_HOST || "localhost";
const TARGET_PORT = parseInt(Bun.env.APP_PORT || "3000", 10);

const TOTAL_REQUESTS = 10;
const CONCURRENCY = 2; 


const baseRequestLine: string = "POST /upload HTTP/1.1";
const requestBody = "test-upload-file-content-or-json-data";
const bodyLength = Buffer.byteLength(requestBody).toString();

//Custom raw HTTP payload, need to add/shuffle headers!
const rawRequest = [
  "GET / HTTP/1.1",
  `Host: ${TARGET_HOST}:${TARGET_PORT}`,
  "Origin: https://trusted-origin.com",
  "Referer: https://trusted-origin.com",
  "Access-Control-Request-Method: GET",
  "X-Forwarded-For: 203.0.113.195", 
  "Cookie: session_token=stress-test-dummy-token-abc123", 
  "User-Agent: Bun-TCP-Stress-Tester",
  "Accept: */*",
  "Connection: keep-alive", 
  "", 
].join("\r\n");

let completedRequests = 0;
let failedRequests = 0;

async function sendRequest() {
  return new Promise<void>((resolve) => {
    Bun.connect({
      hostname: TARGET_HOST, 
      port: TARGET_PORT, 
      socket: {
        open(socket) {
          socket.write(rawRequest);
        },
        data(socket, data) {
          completedRequests++;
          socket.end();
        },
        close(socket) {
          resolve();
        },
        error(socket, error) {
          failedRequests++;
          resolve();
        },
      },
    }).catch(() => {
      failedRequests++;
      resolve();
    });
  });
}


// 2. Run the load test in concurrent chunks
async function runStressTest() {
  console.log(`Starting stress test against http://${TARGET_HOST}:${TARGET_PORT}`);
  console.log(`Sending ${TOTAL_REQUESTS} total requests with a concurrency of ${CONCURRENCY}...\n`);
  
  const startTime = performance.now();

  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY) {
    const batch = [];
    for (let j = 0; j < CONCURRENCY && (i + j) < TOTAL_REQUESTS; j++) {
      batch.push(sendRequest());
    }
    await Promise.all(batch);
    process.stdout.write(`Progress: ${i + batch.length}/${TOTAL_REQUESTS} requests fired...\r`);
  }

  const duration = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log("\n\n Test complete!");
  console.log(`Duration: ${duration} seconds`);
  console.log(`Successful responses caught: ${completedRequests}`);
  console.log(`Socket request errors/drops/failures: ${failedRequests}`);
  console.log(`Avg Throughput: ${(completedRequests / parseFloat(duration)).toFixed(2)} req/sec`);
}

runStressTest();
