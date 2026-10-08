// Netlify: statics from ./dist and the SSR handler in the generated function. The nitro netlify
// preset does not write the _redirects rule on its own, so we do: static files are served from
// dist first and every other request (HTML routes, API, server functions) proxies to the function.
import { writeFileSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });
writeFileSync("dist/_redirects", "/* /.netlify/functions/server 200\n", "utf8");
console.log("Escrito dist/_redirects -> /* /.netlify/functions/server 200");