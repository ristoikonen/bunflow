//TODO: To get serious; get httpbunn locally, set TARGET_HOST = "localhost" and TARGET_PORT = 8080
// And run it in Docker, pass local variables: $env:APP_HOST="localhost"; $env:APP_PORT="8080"; bun getbinheaders.ts
// Use public httpbin.org or switch to "localhost" if running via Docker like above


const TARGET_BIN_HOST = Bun.env.APP_HOST || "httpbin.org";
const TARGET_BIN_PORT = parseInt(Bun.env.APP_PORT || "443", 10)

const TOTAL_BIN_REQUESTS = 1; 
const BIN_CONCURRENCY = 1;   


export class HttpBunClient {
  private baseUrl = "https://httpbun.com";
  

  /**
   * 1. Test and inspect outgoing headers (User-Agent, Custom headers, etc.)
   */
  async testHeaders(customHeaders: Record<string, string>): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/headers`, {
        headers: {
          "User-Agent": "BunApp-IGlowPortal/1.0",
          ...customHeaders,
        },
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data.headers;
    } catch (error) {
      console.error("Error in testHeaders:", error);
      throw error;
    }
  }

  /**
   * 2. Test query string parameters and URL encoding (e.g., locale presets like Crace, Gung)
   */
  async testQueryParams(params: Record<string, string>): Promise<any> {
    try {
      const query = new URLSearchParams(params).toString();
      const response = await fetch(`${this.baseUrl}/get?${query}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data.args;
    } catch (error) {
      console.error("Error in testQueryParams:", error);
      throw error;
    }
  }

  /**
   * 3. Test POST requests and JSON payload echoing (useful for form submissions)
   */
  async testPostPayload(payload: object): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return {
        jsonReceived: data.json,
        headersReceived: data.headers,
      };
    } catch (error) {
      console.error("Error in testPostPayload:", error);
      throw error;
    }
  }

  /**
   * 4. High-concurrency stress test method (ideal for httpstress.ts)
   */
  async runLoadTest(concurrency: number = 20): Promise<{ successCount: number; totalTimeMs: number }> {
    const startTime = performance.now();
    
    // Fire concurrent requests using Bun's fast fetch
    const requests = Array.from({ length: concurrency }, () =>
      fetch(`${this.baseUrl}/status/200`).then((res) => res.ok).catch(() => false)
    );

    const results = await Promise.all(requests);
    const successCount = results.filter(Boolean).length;
    const totalTimeMs = performance.now() - startTime;

    return { successCount, totalTimeMs };
  }
}

// --- Example Usage ---
const client = new HttpBunClient();

// Test headers
const echoedHeaders = await client.testHeaders({ "X-Portal-Source": "glow2" });
console.log("Echoed Headers:", echoedHeaders);

// Test query params
const echoedArgs = await client.testQueryParams({ locale: "Crace", mode: "live" });
console.log("Echoed Query Args:", echoedArgs);

// Test POST payload
const postResult = await client.testPostPayload({ action: "Submit", timestamp: new Date().toISOString() });
console.log("POST Reflection:", postResult);

// Run load test
const loadTestStats = await client.runLoadTest(10);
console.log(`Load Test: ${loadTestStats.successCount} requests succeeded in ${loadTestStats.totalTimeMs.toFixed(2)}ms`);
