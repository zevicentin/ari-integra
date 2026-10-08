// Creates accounts that are already validated by the operator: node scripts/create-users.mjs <roster.json>
//
// The roster is a JSON list of { name, email, role: "agent" | "coordinator", region?, governance? }.
// For every entry it creates the auth user with a generated temporary password (email confirmed,
// so the person can sign in right away), writes an approved profile with region/governance and
// grants the role — exactly the state an administrator would leave after reviewing the request.
// Re-running is safe: an existing auth user keeps its password and only profile and role are
// refreshed from the roster.
//
// It reads SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY from .env and SUPABASE_SERVICE_ROLE_KEY from
// .env.local — keys are never printed. Generated passwords print once, to this console only, so
// the operator can hand them over; nothing is written to disk.
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function envValue(name) {
  if (process.env[name]) return process.env[name];
  for (const file of [".env", ".env.local"]) {
    const line = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
      .split(/\r?\n/)
      .find((row) => row.trim().startsWith(`${name}=`));
    if (line)
      return line
        .slice(name.length + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
  }
  return "";
}

const rosterPath = process.argv[2];
if (!rosterPath) {
  console.error("Uso: node scripts/create-users.mjs <roster.json>");
  process.exit(1);
}

const roster = JSON.parse(readFileSync(rosterPath, "utf8"));
if (!Array.isArray(roster) || !roster.length) {
  console.error("O roster precisa ser uma lista não vazia de contas.");
  process.exit(1);
}
for (const entry of roster) {
  if (!entry.name || !entry.email || !["agent", "coordinator"].includes(entry.role)) {
    console.error(`Entrada inválida no roster: ${JSON.stringify(entry)}`);
    process.exit(1);
  }
}

const url = envValue("SUPABASE_URL");
const serviceKey = envValue("SUPABASE_SERVICE_ROLE_KEY");
const publishableKey = envValue("SUPABASE_PUBLISHABLE_KEY");
if (!url || !serviceKey) {
  console.error("Faltam SUPABASE_URL (.env) ou SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Ambiguous glyphs (0/O/1/l/I) stay out so the password survives being read aloud.
function tempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(16);
  let out = "";
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

const existingByEmail = new Map();
for (let page = 1; ; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) {
    console.error(`Falha ao listar usuários: ${error.message}`);
    process.exit(1);
  }
  for (const user of data.users)
    if (user.email) existingByEmail.set(user.email.toLowerCase(), user.id);
  if (data.users.length < 1000) break;
}

const created = [];
const failed = [];
for (const entry of roster) {
  const email = entry.email.trim().toLowerCase();
  try {
    let userId = existingByEmail.get(email);
    let password = "";
    let action = "conta existente — senha mantida";
    if (!userId) {
      password = tempPassword();
      const { data: authData, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: entry.name },
      });
      if (createError || !authData.user)
        throw new Error(createError?.message || "auth createUser falhou");
      userId = authData.user.id;
      existingByEmail.set(email, userId);
      action = "conta criada";
    }
    const profileError = (
      await admin.from("profiles").upsert({
        id: userId,
        full_name: entry.name,
        requested_role: entry.role,
        approval_status: "approved",
        region: entry.region ?? null,
        governance: entry.governance ?? null,
      })
    ).error;
    if (profileError) throw new Error(`profiles: ${profileError.message}`);
    const { error: roleError } = await admin.from("user_roles").delete().eq("user_id", userId);
    if (roleError) throw new Error(`user_roles delete: ${roleError.message}`);
    const { error: grantError } = await admin
      .from("user_roles")
      .insert({ user_id: userId, role: entry.role });
    if (grantError) throw new Error(`user_roles insert: ${grantError.message}`);
    created.push({ name: entry.name, email, role: entry.role, password, action });
    console.log(`OK  ${email}  ${entry.role}  ${action}`);
  } catch (entryError) {
    failed.push({
      email,
      message: entryError instanceof Error ? entryError.message : String(entryError),
    });
    console.error(`ERRO ${email}: ${failed[failed.length - 1].message}`);
  }
}

// A sign-in proves the temporary password really opens the door before anyone hands it over.
if (publishableKey) {
  const viewer = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const entry of created.filter((row) => row.password)) {
    const { error: signInError } = await viewer.auth.signInWithPassword({
      email: entry.email,
      password: entry.password,
    });
    if (signInError) {
      console.error(`ERRO login ${entry.email}: ${signInError.message}`);
      failed.push(entry);
    } else console.log(`login OK  ${entry.email}`);
    await viewer.auth.signOut();
  }
}

console.log('\nCredenciais geradas (repassar em seguida; a pessoa troca em "Trocar senha"):');
for (const row of created.filter((entry) => entry.password))
  console.log(`  ${row.email}  ${row.password}`);
console.log(`\n${created.length} conta(s) tratada(s), ${failed.length} falha(s).`);
process.exit(failed.length ? 1 : 0);
