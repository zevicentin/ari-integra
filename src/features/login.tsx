import { useServerFn } from "@tanstack/react-start";
import { type FormEvent, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import ari from "@/assets/logo_ari-2.png.asset.json";
import { registerAccount } from "@/lib/account.functions";
import { Footer } from "@/components/app-ui";
import { field } from "@/components/field";
import { ariFallback } from "@/lib/assets";

export function Login() {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<"agent" | "coordinator">("agent");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const register = useServerFn(registerAccount);
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setMessage("");
    try {
      if (mode === "reset") { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }); setMessage(error?.message || "Enviamos um link de recuperação para seu e-mail."); }
      else if (mode === "register") { const result = await register({ data: { name, email, password, role: accountType } }); setMessage(result.requiresEmailConfirmation ? "Cadastro realizado. Confirme seu e-mail e aguarde a aprovação do administrador." : "Cadastro realizado. Aguarde a aprovação do administrador para acessar."); }
      else { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setMessage("Não foi possível entrar. Confira e-mail e senha."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível concluir o cadastro."); }
    finally { setBusy(false); }
  }
  async function google() { setBusy(true); const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin }); if (result.error) { setMessage("Não foi possível entrar com Google. Tente novamente."); setBusy(false); } }
  return <div className="min-h-screen flex flex-col"><div className="flex-1 grid lg:grid-cols-[1fr_1fr]"><div className="bg-sidebar text-primary-foreground flex flex-col justify-between p-8 lg:p-14 min-h-72"><img src={ari.url} alt="ARI — Agente Regional de Inovação" className="w-48 md:w-60 object-contain" onError={e => { const t = e.currentTarget; if (!t.src.endsWith(ariFallback)) { t.src = ariFallback; } }} /><div className="max-w-lg py-12"><p className="text-sm font-bold uppercase text-accent tracking-widest">Universidade Estadual de Londrina</p><h1 className="mt-5 text-4xl md:text-5xl font-bold leading-tight">Inovação começa com conexões.</h1><p className="mt-5 text-primary-foreground/75 text-lg leading-relaxed">Um espaço para organizar as ações, acompanhar resultados e fortalecer o ecossistema regional.</p></div><p className="text-sm text-primary-foreground/60">Plataforma de gestão · ARI</p></div><div className="flex items-center justify-center p-6 md:p-12"><div className="w-full max-w-sm"><p className="text-sm text-primary font-bold">BEM-VINDO AO ARI</p><h2 className="text-3xl font-bold mt-2">{mode === "login" ? "Acesse sua conta" : mode === "register" ? "Criar uma conta" : "Recuperar senha"}</h2><p className="text-muted-foreground text-sm mt-2 mb-8">{mode === "login" ? "Entre para acompanhar suas atividades e resultados." : mode === "register" ? "Preencha seus dados para começar." : "Enviaremos um link para o seu e-mail."}</p><form className="space-y-4" onSubmit={submit}>{mode === "register" && <>{field("Nome completo", "name", name, (_, v) => setName(v), { required: true })}{field("Tipo de usuário", "account_type", accountType, (_, v) => setAccountType(v === "coordinator" ? "coordinator" : "agent"), { options: [{ value: "agent", label: "Agente" }, { value: "coordinator", label: "Coordenação" }], required: true })}</>}{field("E-mail", "email", email, (_, v) => setEmail(v), { type: "email", required: true })}{mode !== "reset" && field("Senha", "password", password, (_, v) => setPassword(v), { type: "password", required: true })}{message && <p role="status" className="text-sm text-primary bg-secondary p-3 rounded-md">{message}</p>}<Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "register" ? "Criar conta" : "Enviar link"}</Button></form>{mode === "login" && <><div className="relative my-6 text-center text-xs text-muted-foreground before:absolute before:top-1/2 before:left-0 before:w-2/5 before:border-t after:absolute after:top-1/2 after:right-0 after:w-2/5 after:border-t">ou</div><Button variant="outline" className="w-full" onClick={google} disabled={busy}>Continuar com Google</Button></>}<div className="mt-7 flex flex-wrap justify-between gap-3 text-sm"><Button variant="link" className="p-0" onClick={() => { setMessage(""); setMode(mode === "register" ? "login" : "register"); }}>{mode === "register" ? "Já tenho uma conta" : "Criar conta"}</Button><Button variant="link" className="p-0" onClick={() => { setMessage(""); setMode(mode === "reset" ? "login" : "reset"); }}>{mode === "reset" ? "Voltar para entrar" : "Esqueci minha senha"}</Button></div></div></div></div><Footer /></div>;
}
