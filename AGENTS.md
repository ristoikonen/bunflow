# AI Agent Guide (AGENTS.md)


---

## 1. Project Identity & Purpose

Header tester, logging results.

### Core Instructions

Don’t expose cookie values in the echo route.

---

## 2. Architecture & File Structure
Agents interacting with this workspace must adhere to the following file layout and responsibilities if they are in use:

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

