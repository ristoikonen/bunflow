//import { Client } from 'bun';


// USAGE: Bun services/httpbunmixtests.ts

/**
 * Executes a series of HTTP tests using httpbun.com and its flexible `/mix` endpoint.
 * Demonstrates basic mixing, error state randomness, and custom base64 payloads.
 */
async function runHttpbunMixTests() {
  const BASE_URL = 'https://httpbun.com';

  console.log(' Starting httpbun /mix test suite...\n');

  // Test 1: Simulating a 400 Bad Request with a custom JSON payload or header
  console.log('Test 1: Simulating 400 Bad Request with custom content-type header...');
  try {
    const url = `${BASE_URL}/mix/s=400/h=content-type:application%2Fjson/b64=eyJzdGF0dXMiOiJlcnJvciIsIm1lc3NhZ2UiOiJCYWQgUmVxdWVzdCB0cmFja2VkIn0=`;
    const response = await fetch(url);
    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    const data = await response.json();
    console.log('Payload:', data);
  } catch (error) {
    console.error('Test 1 failed:', error);
  }
  console.log('\n--------------------------------------------------\n');

  // Test 2: Random status code cycle tracking resilience
  console.log('Test 2: Tracking random status codes (200, 400, or 500)...');
  for (let i = 1; i <= 3; i++) {
    try {
      const url = `${BASE_URL}/mix/s=200,400,500`;
      const response = await fetch(url);
      console.log(`  [Attempt #${i}] Hit random mix -> Received Status: ${response.status}`);
    } catch (error) {
      console.error(`  [Attempt #${i}] Network Error:`, error);
    }
  }
  console.log('\n--------------------------------------------------\n');

  // Test 3: Standard multi-header mix test
  console.log('Test 3: Injecting custom custom tracking header...');
  try {
    const url = `${BASE_URL}/mix/h=x-test-tracker:bun-app-mix-test/s=201`;
    const response = await fetch(url);
    console.log(`Status: ${response.status}`);
    console.log(`X-Test-Tracker Header: ${response.headers.get('x-test-tracker')}`);
  } catch (error) {
    console.error('Test 3 failed:', error);
  }

  console.log('\n All httpbun /mix tests completed.');
}

// Execute the test script
runHttpbunMixTests();
