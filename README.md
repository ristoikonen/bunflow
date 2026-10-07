# BunFlow


## Headers tester route

Optional local testing aid.

Tester sends GET /headers
        │
        ▼
Bun receives request
        │
        ▼
Bun matches "/headers" in server.ts routes - see section for mapped header list!
        │
        ▼
Route reads selected request headers
        │
        ▼
Route returns JSON containing those headers
        │
        ▼
Tester receives response and can inspect the echoed values


## Installation


To install dependencies:

```bash
bun install
```

To run my dev script of tsconfig with hot HTTP server reloading( --hot server.ts):

```bash

bun run dev
```
Not so hot..

```bash

bun run start
```

Clone the repository

```bash
   git clone https://github.com/ristoikonen/bunflow.git
   cd bunbase
```

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Image ordering

The `GET /api/images` endpoint returns supported image filenames in ascending, case-insensitive natural order. Numeric portions are compared by value, so `image2.jpg` appears before `image10.jpg`. The slideshow displays images in the order returned by this endpoint.
