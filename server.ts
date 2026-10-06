// @ts-ignore Bun provides this module at runtime; its types may not be installed in the editor.
import { serve, type BunRequest } from "bun";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { handleM2131Telemetry } from "./middleware/m2131Logger";
import { generateIPHash } from "./utils/hash";
import { jsonResponse, errorResponse } from "./utils/response";

const imageDir = "./images";


(async function main() {
  // inits here
  await mkdir(imageDir, { recursive: true });

  const port = Number(Bun.env.APP_PORT ?? 3000);
  const host = Bun.env.APP_HOST ?? "0.0.0.0";
  //const apiKey = Bun.env.GEMINI_API_KEY;
  //if (!apiKey) {
  //    throw new Error("Missing GEMINI_API_KEY environment variable.");
  //}
  //const ai = new GoogleGenAI();

  const server = serve({
    hostname: host,
    port: port,
    routes: {
      // Frontend UI at root and index.html are the same
      "/": () => {
        const file = Bun.file("./public/index.html");
        return file.exists().then((exists) =>
          exists
            ? new Response(file, { headers: { "Content-Type": "text/html; charset=utf-8" } })
            : errorResponse("Frontend UI index.html not found", 404)
        );
      },

    },

    // Global catch-all block
    async fetch(req: BunRequest) {
      return errorResponse("Not Found", 404, true);
    },
  });
 

})().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});

console.log(`BunFlow API running. http://localhost:3000`);
