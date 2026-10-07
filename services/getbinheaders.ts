/* const bun = (globalThis as typeof globalThis & {
  Bun: {
    env: Record<string, string | undefined>;
    connect: (options: any) => Promise<any>;
  };
}).Bun; */

//TODO: To get serious; get httpbin locally, set TARGET_HOST = "localhost" and TARGET_PORT = 8080
// And run it in Docker: docker run -p 8080:80 kennethreitz/httpbin
// Pass local variables: $env:APP_HOST="localhost"; $env:APP_PORT="8080"; bun getbinheaders.ts

// Use public httpbin.org or switch to "localhost" if running via Docker like above
//const TARGET_BIN_PORT = parseInt(Bun.env.APP_PORT || "80", 10);

// TLS and 443 go hand in hand - TLS Client Hello to (HTTPS) port, then certificate matchings!


const TARGET_BIN_HOST = Bun.env.APP_HOST || "httpbin.org";
const TARGET_BIN_PORT = parseInt(Bun.env.APP_PORT || "443", 10)

const TOTAL_BIN_REQUESTS = 5; 
const BIN_CONCURRENCY = 1;   


const rawBinRequest = [
  "GET /headers HTTP/1.1",
  `Host: ${TARGET_BIN_HOST}`,
  "Origin: https://trusted-origin.com",
  "Referer: https://trusted-origin.com",
  "X-Forwarded-For: 203.0.113.195", 
  "Cookie: session_token=stress-test-dummy-token-abc123", 
  "User-Agent: Bun-TCP-Header-Tester",
  "Accept: */*",
  "Connection: close", 
  "", 
  "", 
].join("\r\n");

let completedBinRequests = 0;
let failedBinRequests = 0;

async function sendBinRequest() {
  return new Promise<void>((resolve) => {
    Bun.connect({
      hostname: TARGET_BIN_HOST, 
      port: TARGET_BIN_PORT, 
      //NOTE: Becomes => tls: true when port is 443 - and 8080 === 443 is false.
      tls: TARGET_BIN_PORT === 443, 
      /* More usage scenarios => tls: {
          // Provide your client identity certificates for mTLS testing
          //key: Bun.file("./client-key.pem"),
          //cert: Bun.file("./client-cert.pem"),
          
          // Explicitly trust a specific private root certificate authority
          //ca: Bun.file("./private-root-ca.pem"), 
          // force uri in Hello
          //servername: "httpbin.org", 
      }, */
      socket: {
        open(socket: any) {



          socket.write(rawBinRequest);
        },
        
        data(socket: any, data: Uint8Array) {
          completedBinRequests++;
          
          //if (completedBinRequests === 1) {
            console.log("\n---  Response  ---");
            console.log(new TextDecoder().decode(data));
            console.log("----------------------------------------\n");
          //}

          socket.end();
        },
        close(socket: any) {
          resolve();
        },
        error(socket: any, error: any) {
          failedBinRequests++;
          resolve();
        },
      },
    }).catch(() => {
      failedBinRequests++;
      resolve();
    });
  });
}

async function runBinHeaderTest() {
  console.log(`Starting header test against http://${TARGET_BIN_HOST}:${TARGET_BIN_PORT}`);
  console.log(`Sending ${TOTAL_BIN_REQUESTS} requests with a concurrency of ${BIN_CONCURRENCY}...\n`);
  
  const startTime = performance.now();

  for (let i = 0; i < TOTAL_BIN_REQUESTS; i += BIN_CONCURRENCY) {
    const batch = [];
    for (let j = 0; j < BIN_CONCURRENCY && (i + j) < TOTAL_BIN_REQUESTS; j++) {
      batch.push(sendBinRequest());
    }
    await Promise.all(batch);
    process.stdout.write(`Progress: ${i + batch.length}/${TOTAL_BIN_REQUESTS} requests sent...\r`);
  }

  const duration = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log("\n\nTest complete!");
  console.log(`Duration: ${duration} seconds`);
  console.log(`Successful responses caught: ${completedBinRequests}`);
  console.log(`Socket request errors/drops/failures: ${failedBinRequests}`);
}

runBinHeaderTest();
