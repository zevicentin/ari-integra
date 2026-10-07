// Starts Vite with LOVABLE_PREVIEW_HOST available in the real process environment.
//
// vite.config.ts is evaluated before Vite injects .env into process.env, so the
// lovableAssetsProxyPlugin() reads the variable too early and silently no-ops.
// Without it, every /__l5e/assets-v1/* request 404s and the images break.
// A value already present in the environment wins, so Lovable Cloud and CI can
// override it without editing .env.
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const KEY = "LOVABLE_PREVIEW_HOST";

if (!process.env[KEY]) {
  const fromEnvFile = readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith(`${KEY}=`))
    ?.slice(KEY.length + 1)
    .trim()
    .replace(/^["']|["']$/g, "");

  if (fromEnvFile) {
    process.env[KEY] = fromEnvFile;
    console.log(`[dev] ${KEY} = ${fromEnvFile}`);
  } else {
    console.warn(`[dev] ${KEY} not found in .env; /__l5e/assets-v1/* images will 404`);
  }
}

// Run vite's entry through the current Node binary: spawning npx/vite directly
// fails with EINVAL on Windows, where .cmd shims need a shell.
const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));

if (!existsSync(viteBin)) {
  console.error(`[dev] vite not found at ${viteBin}; run npm install first`);
  process.exit(1);
}

const vite = spawn(process.execPath, [viteBin, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});

vite.on("error", (error) => {
  console.error(`[dev] failed to start vite: ${error.message}`);
  process.exit(1);
});

vite.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));