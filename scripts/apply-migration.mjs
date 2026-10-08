// Applies one SQL migration file to the database behind LOVABLE_DB_MIGRATION_URL.
//
// Migration files after 0006 were written by hand and are absent from drizzle's journal, so
// `drizzle-kit migrate` never sees them; they go through this script instead. The whole file
// runs inside one transaction, so a failure never leaves half a migration behind.
//
//   node scripts/apply-migration.mjs drizzle/migrations/<arquivo>.sql
import { readFileSync } from "node:fs";
import postgres from "postgres";

function envValue(name) {
  if (process.env[name]) return process.env[name];
  for (const file of [".env", ".env.local"]) {
    const line = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
      .split(/\r?\n/)
      .find((row) => row.trim().startsWith(`${name}=`));
    if (line) return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/apply-migration.mjs drizzle/migrations/<arquivo>.sql");
  process.exit(1);
}

const url = envValue("LOVABLE_DB_MIGRATION_URL");
if (!url) {
  console.error("Falta LOVABLE_DB_MIGRATION_URL (.env.local).");
  process.exit(1);
}

const body = readFileSync(file, "utf8");
const client = postgres(url, { max: 1, onnotice: () => {} });

try {
  await client.begin((tx) => tx.unsafe(body));
  console.log(`Aplicada: ${file}`);
} catch (error) {
  console.error(`Falha ao aplicar ${file}: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
