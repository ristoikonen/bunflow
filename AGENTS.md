# AI Agent Guide (AGENTS.md)


---

## 1. Project Identity & Purpose



### Core Objectives



---

## 2. Architecture & File Structure
Agents interacting with this workspace must adhere to the following file layout and responsibilities:

```text
bunbase/
├── server.ts                 # Main Bun.serve entry point and HTTP route handler
├── package.json              # Dependencies (bun, @google/genai, libsql, zod)
├── .env                      # Environment secrets (never commit plaintext credentials)
├── middleware/
│   └── m2131Logger.ts        # M-21-31 compliant telemetry & structured JSON logger
├── services/
│   ├── ask_gemini.ts         # Gemini API generation and streaming wrapper
│   └── dbratelimiter.ts      # Turso database connection and rate-limiting logic
└── utils/
    └── hash.ts               # SHA-256 salted IP anonymization utilities

```

## GitHub CoPilot

Work with main!

- Start a **new session** in the Copilot app.
- Select the **bunflow** project.
- Open the workspace type options and choose **Branch** instead of **Worktree**.
- Select **`main`** as the branch.
- Create the session.

## Development Commands

Always use `bun` as the package manager and runner instead of npm, yarn, or node.

* **Install Dependencies:** `bun install`
* **Run Development Server:** `bun --hot run server.ts`
* **Run Tests:** `bun test`
* **Run a Single Test File:** `bun test src/path/to/test.test.ts`


## Australian privacy and telemetry standards, auditing to cloud db.

1. **Request Tracking:** Every inbound request is assigned a unique correlation ID.
2. **Privacy Protection:** Client IP addresses are never stored in raw plaintext; they undergo salted SHA-256 hashing (`OPENSSL_HEX_SECRET_PEPPER`).
3. **Audit Trail:** Structured logs capture execution duration, HTTP status codes, user agents, and response metrics, persisting directly into Turso.