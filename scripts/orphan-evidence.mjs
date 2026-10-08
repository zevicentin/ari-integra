// Lists (and, with --delete, removes) evidence objects that no activity references anymore.
//
// The ari-evidence bucket is private and holds paths of the form <owner-id>/<file>. A path is
// written into activities.evidence only when the record saves, so a save that failed after the
// upload, a row deleted from the table, or an image swapped out in the editor used to leave its
// object behind with nobody pointing at it.
//
// It reads SUPABASE_URL from .env and SUPABASE_SERVICE_ROLE_KEY from .env.local — never printed.
// Dry-run by default; --delete really removes, --list prints every orphan with its size.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "ari-evidence";
const PAGE = 1000;

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

const url = envValue("SUPABASE_URL");
const serviceKey = envValue("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !serviceKey) {
  console.error("Faltam SUPABASE_URL (.env) ou SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const deleteNow = process.argv.includes("--delete");
const listEvery = process.argv.includes("--list");
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// 1. Every path the activities table still points at.
const referenced = new Set();
let from = 0;
for (;;) {
  const { data, error, count } = await supabase
    .from("activities")
    .select("evidence", { count: "exact" })
    .range(from, from + PAGE - 1);
  if (error) { console.error(`Falha ao ler activities: ${error.message}`); process.exit(1); }
  for (const row of data ?? []) {
    if (Array.isArray(row.evidence)) for (const path of row.evidence) if (typeof path === "string" && path) referenced.add(path);
  }
  from += PAGE;
  if (!data || data.length < PAGE || from >= (count ?? 0)) break;
}

// 2. Every object actually in the bucket. Storage answers folders with no metadata, so the walk
//    descends one owner folder at a time until it finds real files.
async function walk(prefix, depth) {
  const files = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) { console.warn(`Aviso: não listei ${prefix || "/"} (${error.message}).`); return files; }
    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.metadata) files.push({ path, size: Number(entry.metadata.size ?? 0) });
      else if (depth < 8) files.push(...await walk(path, depth + 1));
    }
    if (!data || data.length < PAGE) return files;
  }
}

const objects = await walk("", 0);
const orphans = objects.filter((file) => !referenced.has(file.path));

console.log(`Referenciados: ${referenced.size} caminhos em activities.evidence`);
console.log(`Bucket ${BUCKET}: ${objects.length} arquivos (${mb(objects.reduce((sum, f) => sum + f.size, 0))})`);
console.log(`Órfãos: ${orphans.length} arquivos (${mb(orphans.reduce((sum, f) => sum + f.size, 0))})`);
if (listEvery || (deleteNow && orphans.length)) for (const file of orphans) console.log(`  - ${file.path} (${mb(file.size)})`);
if (!orphans.length) process.exit(0);
if (!deleteNow) { console.log("Dry-run: rode novamente com --delete para apagar."); process.exit(0); }

// 3. Remove in batches; the storage API caps a single remove call.
let removed = 0;
for (let i = 0; i < orphans.length; i += 100) {
  const batch = orphans.slice(i, i + 100).map((file) => file.path);
  const { error } = await supabase.storage.from(BUCKET).remove(batch);
  if (error) { console.error(`Falha no lote a partir de ${i}: ${error.message}`); process.exit(1); }
  removed += batch.length;
}
console.log(`Apagados ${removed} arquivos.`);
