import { write } from "bun";

// USAGE:  Bun httpbunmixdrpboxtests.ts

interface LogEntry {
  timestamp: string;
  testName: string;
  url: string;
  status: number | string;
  contentType: string | null;
  payload?: any;
  error?: string;
}

const BASE_URL = 'https://httpbun.com';
const DROPBOX_TOKEN = Bun.env.DROPBOX_APP_KEY;

// Local and Remote Path configurations
const now = new Date(); 
const nowISOstring = now.toISOString()
const safeFileISODate = nowISOstring.replace(/:/g, '-'); 

const TIMESTAMP_STR = safeFileISODate + "_httpbuntest"; 
const LOCAL_LOG_FILE = `log_${TIMESTAMP_STR}.json`;
const DROPBOX_FOLDER_PATH = `/bun-app-logs/${TIMESTAMP_STR}`;
const DROPBOX_FILE_PATH = `${DROPBOX_FOLDER_PATH}/log.json`;

async function uploadToDropbox(fileContent: string) {

  if (!DROPBOX_TOKEN) {
    console.error(' Dropbox upload skipped: DROPBOX_ACCESS_TOKEN environment variable is not set.');
    return;
  }

  console.log(` Uploading log to Dropbox at: ${DROPBOX_FILE_PATH}...`);
  try {
    const response = await fetch('https://dropboxapi.com', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_TOKEN}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: DROPBOX_FILE_PATH,
          mode: 'overwrite',
          autorename: false,
          mute: false,
          strict_conflict: false
        }),
        'Content-Type': 'application/octet-stream'
      },
      body: fileContent
    });

    if (response.ok) {
      console.log(' Dropbox upload successful.');
    } else {
      const errText = await response.text();
      console.error(` Dropbox upload failed with status ${response.status}:`, errText);
    }
  } catch (error) {
    console.error(' Network error during Dropbox upload:', error);
  }
}

async function runHttpbunMixDropBoxTests() {
  console.log(' Starting httpbun /mix test suite with dual-logging...\n');
  const logs: LogEntry[] = [];

  // =========================================================================
  // Test 1: Simulating a 400 Bad Request with a custom JSON payload
  // =========================================================================
  console.log('🧪 Test 1: Simulating 400 Bad Request with custom content-type header...');
  const test1Url = `${BASE_URL}/mix/s=400/h=content-type:application%2Fjson/b64=eyJzdGF0dXMiOiJlcnJvciIsIm1lc3NhZ2UiOiJCYWQgUmVxdWVzdCB0cmFja2VkIn0=`;
  let entry1: LogEntry = { timestamp: new Date().toISOString(), testName: 'Test 1 - 400 Bad Request Mix', url: test1Url, status: 'Unknown', contentType: null };
  
  try {
    const response = await fetch(test1Url);
    entry1.status = response.status;
    entry1.contentType = response.headers.get('content-type');
    entry1.payload = await response.json();
    console.log(`Status: ${entry1.status} | Payload:`, entry1.payload);
  } catch (error: any) {
    entry1.error = error.message || String(error);
    console.error('Test 1 failed:', error);
  }
  logs.push(entry1);
  console.log('\n--------------------------------------------------\n');

  // =========================================================================
  // Test 2: Random status code cycle tracking resilience
  // =========================================================================
  console.log(' Test 2: Tracking random status codes (200, 400, or 500)...');
  const test2Url = `${BASE_URL}/mix/s=200,400,500`;
  
  for (let i = 1; i <= 3; i++) {
    let entry2: LogEntry = { timestamp: new Date().toISOString(), testName: `Test 2 - Random Mix Attempt #${i}`, url: test2Url, status: 'Unknown', contentType: null };
    try {
      const response = await fetch(test2Url);
      entry2.status = response.status;
      entry2.contentType = response.headers.get('content-type');
      console.log(`  [Attempt #${i}] Hit random mix -> Received Status: ${response.status}`);
    } catch (error: any) {
      entry2.error = error.message || String(error);
      console.error(`  [Attempt #${i}] Network Error:`, error);
    }
    logs.push(entry2);
  }
  console.log('\n--------------------------------------------------\n');

  // =========================================================================
  // Test 3: Standard multi-header mix test
  // =========================================================================
  console.log(' Test 3: Injecting custom tracking header...');
  const test3Url = `${BASE_URL}/mix/h=x-test-tracker:bun-app-mix-test/s=201`;
  let entry3: LogEntry = { timestamp: new Date().toISOString(), testName: 'Test 3 - Custom Tracking Header Mix', url: test3Url, status: 'Unknown', contentType: null };

  try {
    const response = await fetch(test3Url);
    entry3.status = response.status;
    entry3.contentType = response.headers.get('content-type');
    console.log(`Status: ${response.status} | X-Test-Tracker Header: ${response.headers.get('x-test-tracker')}`);
  } catch (error: any) {
    entry3.error = error.message || String(error);
    console.error('Test 3 failed:', error);
  }
  logs.push(entry3);
  console.log('\n--------------------------------------------------\n');

  // =========================================================================
  // Exporting Results
  // =========================================================================
  const jsonLogString = JSON.stringify(logs, null, 2);

  // 1. Export locally using Bun's native optimized file writer
  console.log(` Writing local log file to: ${LOCAL_LOG_FILE}...`);
  await write(LOCAL_LOG_FILE, jsonLogString);
  console.log(' Local file written successfully.');

  // 2. Export to Dropbox folder
  await uploadToDropbox(jsonLogString);

  console.log('\n All httpbun /mix tests and log export tasks completed.');
}

runHttpbunMixDropBoxTests();
