import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const registrationSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome completo."),
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
  role: z.enum(["agent", "coordinator"]),
});

export const registerAccount = createServerFn({ method: "POST" })
  .inputValidator((data) => registrationSchema.parse(data))
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: authData.user.id,
      role: data.role,
    });
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: authData.user.id,
      full_name: data.name,
    });

    if (roleError || profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error("Não foi possível concluir o cadastro. Tente novamente.");
    }

    return { requiresEmailConfirmation: !authData.session };
  });