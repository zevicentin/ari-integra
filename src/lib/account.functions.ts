import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const registrationSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome completo."),
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
  role: z.enum(["agent", "coordinator"]),
});

export const registerAccount = createServerFn({ method: "POST" })
  .validator((data) => registrationSchema.parse(data))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !publishableKey) throw new Error("O cadastro está temporariamente indisponível.");

    const authClient = createClient<Database>(url, publishableKey, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: signUpError } = await authClient.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { full_name: data.name } },
    });
    if (signUpError) throw new Error(signUpError.message);
    if (!authData.user) throw new Error("Não foi possível criar a conta.");
    if (authData.user.identities?.length === 0) throw new Error("Este e-mail já está cadastrado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: authData.user.id,
      full_name: data.name,
      requested_role: data.role,
      approval_status: "pending",
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error("Não foi possível concluir o cadastro. Tente novamente.");
    }

    return { requiresEmailConfirmation: !authData.session };
  });

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual."),
  newPassword: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres."),
});

export const changeOwnPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => changePasswordSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (data.currentPassword === data.newPassword) throw new Error("A nova senha deve ser diferente da senha atual.");
    const url = process.env["SUPABASE_URL"];
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !publishableKey) throw new Error("A troca de senha está temporariamente indisponível.");

    const email = String(context.claims["email"] || "");
    if (!email) throw new Error("Não foi possível identificar o e-mail da conta.");

    const authClient = createClient<Database>(url, publishableKey, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await authClient.auth.signInWithPassword({ email, password: data.currentPassword });
    if (signInError) throw new Error("Senha atual incorreta.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(context.userId, { password: data.newPassword });
    if (updateError) throw new Error("Não foi possível alterar a senha. Tente novamente.");

    return { ok: true };
  });

const reviewSchema = z.object({
  userId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});

async function requireAdmin(context: { supabase: Parameters<typeof hasAdminRole>[0]; userId: string }) {
  const isAdmin = await hasAdminRole(context.supabase, context.userId);
  if (!isAdmin) throw new Error("Apenas administradores podem gerenciar aprovações.");
}

async function hasAdminRole(supabase: { rpc: (name: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null; error: unknown }> }, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Não foi possível validar a permissão administrativa.");
  return data === true;
}

export const listAccountRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, requested_role, approval_status, created_at")
      .neq("approval_status", "approved")
      .order("created_at", { ascending: true });
    if (error) throw new Error("Não foi possível carregar as solicitações.");
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) throw new Error("Não foi possível carregar os e-mails das solicitações.");
    const emails = new Map(users.users.map((user) => [user.id, user.email || ""]));
    return (profiles || []).map((profile) => ({ ...profile, email: emails.get(profile.id) || "" }));
  });

export const reviewAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => reviewSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    if (data.userId === context.userId) throw new Error("A conta administradora não pode revisar a si mesma.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // One SQL call replaces the three separate writes: review_account clears the old role,
    // grants the requested one and sets the approval status inside a single transaction, so
    // the database never keeps half of a decision. Its validations come back in Portuguese.
    const { error } = await supabaseAdmin.rpc("review_account", { _user_id: data.userId, _decision: data.decision });
    if (error) {
      const known = ["Solicitação não encontrada.", "Tipo de usuário inválido.", "Decisão inválida:"];
      throw new Error(known.some(text => error.message.includes(text)) ? error.message : "Não foi possível concluir a análise.");
    }
    return { ok: true };
  });