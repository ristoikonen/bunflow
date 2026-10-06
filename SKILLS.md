---
name: bunflow-documentation
description: Generate comprehensive markdown documentation and SKILL.md for the BunBase application workspace. Use when exporting documentation, generating readmes, or packaging project assets.
---

# BunFlow Documentation Workflow

## Execution Steps
1. **Audit Workspace:** Scan `server.ts`, `package.json`, and middleware files for updated dependencies or route changes. Ensure .env const's are used, safely, instead of hard-coded strings.
2. **Generate README:** Compile technical specifications adhering to M-21-31 and Bun runtime standards.
3. **Export Asset:** Save output directly to the workspace or package assets for `ristoikonen.com`.