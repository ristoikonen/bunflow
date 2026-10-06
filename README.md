# BunFlow



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
