import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Activity, CalendarDays, ChartNoAxesCombined, Check, ChevronLeft, ChevronRight, ClipboardList, Download, FileText, KeyRound, LayoutDashboard, LogOut, Menu, Plus, Search, Settings2, Trash2, Upload, Users, X, Building2, Paperclip, Pencil, Target, UserCheck } from "lucide-react";
import { importFiles, dedupeKey, type ImportRow } from "@/lib/pdfImport";
import { readStrategyPlanFiles, strategyKey, type StrategyPlanImportRow } from "@/lib/planImport";
import { MONTHS_PT, brDate, buildMonthlyReport, filterMonthActivities, formatPt, indicatorCounts, parsePt, stripDateSuffix, type ReportActivity, type ReportEvidence } from "@/lib/monthlyReport";
import ari from "@/assets/logo_ari-2.png.asset.json";
import uel from "@/assets/UEL-horizontal-abreviada-cor.png.asset.json";
import araucaria from "@/assets/logo_araucaria.png.asset.json";
import sebrae from "@/assets/logo_sebrae.png.asset.json";
import parana from "@/assets/logo_pr.png.asset.json";
import type { Database, Json } from "@/integrations/supabase/types";
import { changeOwnPassword, listAccountRequests, registerAccount, reviewAccount } from "@/lib/account.functions";

type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type Organization = Database["public"]["Tables"]["organizations"]["Row"];
type Actor = Database["public"]["Tables"]["actors"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type StrategyAction = Database["public"]["Tables"]["strategy_actions"]["Row"];
type CoordinationParticipant = Database["public"]["Functions"]["coordination_participants"]["Returns"][number];
type AgentChoice = Database["public"]["Functions"]["activity_agent_choices"]["Returns"][number];
type Section = "overview" | "activities" | "strategy" | "calendar" | "organizations" | "actors" | "agents" | "reports" | "approvals";
type ApprovalRequest = { id: string; full_name: string; email: string; requested_role: "agent" | "coordinator" | "admin" | "viewer" | null; approval_status: string; created_at: string };
const activityKinds = ["Atividade geral", "Evento como ouvinte", "Evento como organizador", "ReuniÃ£o de governanÃ§a", "ReuniÃ£o com a coordenaÃ§Ã£o", "Outras reuniÃµes"];
const axes = ["GovernanÃ§a do Ecossistema", "Programas e AÃ§Ãµes de InovaÃ§Ã£o", "Comunidade Empreendedora", "Ambiente de InovaÃ§Ã£o", "RelaÃ§Ã£o Academia/Empresa", "PolÃ­ticas PÃºblicas", "ComunicaÃ§Ã£o", "CaptaÃ§Ã£o de Recursos", "SensibilizaÃ§Ã£o de Atores", "Setorial"];
const statuses = ["NÃ£o iniciada", "Iniciada", "ConcluÃ­da"];
const indicatorCatalog = [
  { code: "OBR 01", label: "Contratos de InteraÃ§Ã£o e TransferÃªncia TecnolÃ³gica" },
  { code: "OBR 02", label: "NÃ­vel de maturidade do ecossistema" },
  { code: "OBR 03", label: "Mapeamento de Ativos e SoluÃ§Ãµes para o Desenvolvimento Regional" },
  { code: "OBR 04", label: "Eventos de DisseminaÃ§Ã£o de Conhecimento em InovaÃ§Ã£o e Empreendedorismo" },
  { code: "ADES-01", label: "CaptaÃ§Ã£o de Recursos para InovaÃ§Ã£o" },
  { code: "ADES-02", label: "PublicaÃ§Ãµes TÃ©cnico-CientÃ­ficas Aplicadas" },
  { code: "ADES-03", label: "ImplementaÃ§Ã£o de Tecnologias Verdes, SoluÃ§Ãµes ESG e InovaÃ§Ã£o Social" },
  { code: "ADES-04", label: "Empresas e demais entidades atendidas pelo programa" },
  { code: "ADES-05", label: "Rede de Parceiros Mobilizados" },
  { code: "ADES-06", label: "Produtos e ServiÃ§os com Selos de Origem/IG" },
  { code: "ADES-07", label: "Fortalecimento do Marco Legal e Institucional de InovaÃ§Ã£o" },
  { code: "ADES-08", label: "Apoio e Desenvolvimento em Ambientes de IncubaÃ§Ã£o" },
] as const;
const indicatorLabel = (code: string) => indicatorCatalog.find(i => i.code === code)?.label || code;
const stages = ["ProspecÃ§Ã£o", "DiagnÃ³stico", "Encaminhamento", "Acompanhamento"];
const nav: { id: Section; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "VisÃ£o geral", icon: LayoutDashboard }, { id: "activities", label: "Atividades", icon: ClipboardList },
  { id: "strategy", label: "Plano de estratÃ©gias", icon: Target },
  { id: "calendar", label: "Agenda", icon: CalendarDays }, { id: "organizations", label: "OrganizaÃ§Ãµes", icon: Building2 },
  { id: "actors", label: "Atores da governanÃ§a", icon: Users }, { id: "agents", label: "Agentes", icon: Activity },
  { id: "reports", label: "RelatÃ³rios", icon: ChartNoAxesCombined }, { id: "approvals", label: "Aprovar contas", icon: UserCheck },
];
const formatDate = (value?: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "â€”";
const monthLabel = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
const initials = (value: string) => value.split(" ").filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase() || "AR";
const digitsOnly = (value: string) => value.replace(/\D/g, "");
function phoneMask(value: string) {
  const d = digitsOnly(value);
  // So treat digits 12/13 as a country code when a "+" was actually typed, otherwise
  // "5543999990000" would be truncated as if 55 were the area code.
  const withCountry = /^\s*\+/.test(value) && d.length > 11;
  const countryCode = withCountry ? d.slice(0, 2) : "";
  const local = withCountry ? d.slice(2) : d;
  if (!local.length) return countryCode;
  const head = countryCode ? `+${countryCode} ` : "";
  if (local.length <= 2) return `${head}(${local}`;
  if (local.length <= 6) return `${head}(${local.slice(0, 2)}) ${local.slice(2)}`;
  if (local.length <= 10) return `${head}(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return `${head}(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7, 11)}`;
}
function documentMask(value: string) {
  const d = digitsOnly(value);
  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}
function dateMask(value: string) {
  const d = digitsOnly(value).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
const dateFieldKeys = ["start_date", "end_date", "birth_date"];
const dateLabels: Record<string, string> = { start_date: "InÃ­cio", end_date: "ConclusÃ£o", birth_date: "Data de nascimento" };
const isoToBrDate = (value: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
};
// The form holds dd/mm/aaaa; the database (date columns and the outcomes jsonb) keeps yyyy-mm-dd.
function toIsoDate(value: string, label: string) {
  const raw = (value || "").trim();
  if (!raw) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (!m) throw new Error(`${label}: informe a data completa no formato dd/mm/aaaa.`);
  const [, dd, mm, yyyy] = m;
  const parsed = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
  if (Number.isNaN(parsed.getTime()) || parsed.getMonth() + 1 !== Number(mm) || parsed.getDate() !== Number(dd)) throw new Error(`${label}: data invÃ¡lida (${raw}).`);
  return `${yyyy}-${mm}-${dd}`;
}
const isoDates = <T extends object>(item: T) => { const record = item as Record<string, unknown>; return Object.fromEntries(dateFieldKeys.filter(k => k in record).map(k => [k, toIsoDate(String(record[k] ?? ""), dateLabels[k] || k) || ""])); };
// Postgres reports no error when an UPDATE matches zero rows, so a write blocked by RLS
// or by a column grant looks exactly like a success. Every save below confirms the row
// came back instead of trusting the absence of an error.
function confirmed<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw result.error;
  if (result.data == null) throw new Error(`NÃ£o foi possÃ­vel salvar ${what}: nenhuma linha foi alterada. Sua conta pode nÃ£o ter permissÃ£o para esta alteraÃ§Ã£o.`);
  return result.data;
}
const field = (label: string, name: string, value: string, set: (name: string, value: string) => void, opts?: { type?: string; options?: (string | { value: string; label: string })[]; textarea?: boolean; required?: boolean; mask?: (value: string) => string }) => <label className="block min-w-0"><span className="app-label">{label}</span>{opts?.textarea ? <textarea className="app-field min-h-24 resize-y" value={value} onChange={e => set(name, e.target.value)} required={opts.required} /> : opts?.options ? <select className="app-field" value={value} onChange={e => set(name, e.target.value)}><option value="">Selecione</option>{opts.options.map(x => typeof x === "string" ? <option key={x} value={x}>{x}</option> : <option key={x.value} value={x.value}>{x.label}</option>)}</select> : <input className="app-field" type={opts?.type || "text"} value={value} onChange={e => set(name, opts?.mask ? opts.mask(e.target.value) : e.target.value)} required={opts?.required} inputMode={opts?.mask ? "numeric" : undefined} />}</label>;
const ariFallback = "/images/logo_ari-2.png";
const partners = [{ src: uel.url, fallback: "/images/UEL-horizontal-abreviada-cor.png", alt: "Universidade Estadual de Londrina" }, { src: araucaria.url, fallback: "/images/logo_araucaria.png", alt: "FundaÃ§Ã£o AraucÃ¡ria" }, { src: sebrae.url, fallback: "/images/logo_sebrae.png", alt: "Sebrae" }, { src: parana.url, fallback: "/images/logo_pr.png", alt: "Governo do Estado do ParanÃ¡" }];

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "ARI | GestÃ£o de Atividades" },
    { name: "description", content: "Planejamento, registro e acompanhamento das aÃ§Ãµes dos Agentes Regionais de InovaÃ§Ã£o vinculados Ã  UEL." },
    { property: "og:title", content: "ARI | GestÃ£o de Atividades" },
    { property: "og:description", content: "Sistema de atividades e indicadores dos Agentes Regionais de InovaÃ§Ã£o da UEL." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: Index,
});

function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); }); const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setReady(true); }); return () => subscription.unsubscribe(); }, []);
  if (!ready) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  return session ? <Workspace session={session} /> : <Login />;
}

function Footer() { return <footer className="border-t bg-card px-5 py-7 md:px-10"><div className="mx-auto max-w-7xl flex flex-col items-center justify-between gap-6 lg:flex-row"><p className="text-xs text-muted-foreground text-center lg:text-left">ARI Â· Agentes Regionais de InovaÃ§Ã£o<br />Universidade Estadual de Londrina</p><div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5">{partners.map(p => <img key={p.alt} src={p.src} alt={p.alt} className="h-9 max-w-32 object-contain md:h-11" onError={e => { const target = e.currentTarget; if (!target.src.endsWith(p.fallback)) { target.src = p.fallback; } }} />)}</div></div></footer>; }

function Login() {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<"agent" | "coordinator">("agent");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const register = useServerFn(registerAccount);
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setMessage("");
    try {
      if (mode === "reset") { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }); setMessage(error?.message || "Enviamos um link de recuperaÃ§Ã£o para seu e-mail."); }
      else if (mode === "register") { const result = await register({ data: { name, email, password, role: accountType } }); setMessage(result.requiresEmailConfirmation ? "Cadastro realizado. Confirme seu e-mail e aguarde a aprovaÃ§Ã£o do administrador." : "Cadastro realizado. Aguarde a aprovaÃ§Ã£o do administrador para acessar."); }
      else { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setMessage("NÃ£o foi possÃ­vel entrar. Confira e-mail e senha."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel concluir o cadastro."); }
    finally { setBusy(false); }
  }
  async function google() { setBusy(true); const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin }); if (result.error) { setMessage("NÃ£o foi possÃ­vel entrar com Google. Tente novamente."); setBusy(false); } }
  return <div className="min-h-screen flex flex-col"><div className="flex-1 grid lg:grid-cols-[1fr_1fr]"><div className="bg-sidebar text-primary-foreground flex flex-col justify-between p-8 lg:p-14 min-h-72"><img src={ari.url} alt="ARI â€” Agente Regional de InovaÃ§Ã£o" className="w-48 md:w-60 object-contain" onError={e => { const t = e.currentTarget; if (!t.src.endsWith(ariFallback)) { t.src = ariFallback; } }} /><div className="max-w-lg py-12"><p className="text-sm font-bold uppercase text-accent tracking-widest">Universidade Estadual de Londrina</p><h1 className="mt-5 text-4xl md:text-5xl font-bold leading-tight">InovaÃ§Ã£o comeÃ§a com conexÃµes.</h1><p className="mt-5 text-primary-foreground/75 text-lg leading-relaxed">Um espaÃ§o para organizar as aÃ§Ãµes, acompanhar resultados e fortalecer o ecossistema regional.</p></div><p className="text-sm text-primary-foreground/60">Plataforma de gestÃ£o Â· ARI</p></div><div className="flex items-center justify-center p-6 md:p-12"><div className="w-full max-w-sm"><p className="text-sm text-primary font-bold">BEM-VINDO AO ARI</p><h2 className="text-3xl font-bold mt-2">{mode === "login" ? "Acesse sua conta" : mode === "register" ? "Criar uma conta" : "Recuperar senha"}</h2><p className="text-muted-foreground text-sm mt-2 mb-8">{mode === "login" ? "Entre para acompanhar suas atividades e resultados." : mode === "register" ? "Preencha seus dados para comeÃ§ar." : "Enviaremos um link para o seu e-mail."}</p><form className="space-y-4" onSubmit={submit}>{mode === "register" && <>{field("Nome completo", "name", name, (_, v) => setName(v), { required: true })}{field("Tipo de usuÃ¡rio", "account_type", accountType, (_, v) => setAccountType(v === "coordinator" ? "coordinator" : "agent"), { options: [{ value: "agent", label: "Agente" }, { value: "coordinator", label: "CoordenaÃ§Ã£o" }], required: true })}</>}{field("E-mail", "email", email, (_, v) => setEmail(v), { type: "email", required: true })}{mode !== "reset" && field("Senha", "password", password, (_, v) => setPassword(v), { type: "password", required: true })}{message && <p role="status" className="text-sm text-primary bg-secondary p-3 rounded-md">{message}</p>}<Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "register" ? "Criar conta" : "Enviar link"}</Button></form>{mode === "login" && <><div className="relative my-6 text-center text-xs text-muted-foreground before:absolute before:top-1/2 before:left-0 before:w-2/5 before:border-t after:absolute after:top-1/2 after:right-0 after:w-2/5 after:border-t">ou</div><Button variant="outline" className="w-full" onClick={google} disabled={busy}>Continuar com Google</Button></>}<div className="mt-7 flex flex-wrap justify-between gap-3 text-sm"><Button variant="link" className="p-0" onClick={() => { setMessage(""); setMode(mode === "register" ? "login" : "register"); }}>{mode === "register" ? "JÃ¡ tenho uma conta" : "Criar conta"}</Button><Button variant="link" className="p-0" onClick={() => { setMessage(""); setMode(mode === "reset" ? "login" : "reset"); }}>{mode === "reset" ? "Voltar para entrar" : "Esqueci minha senha"}</Button></div></div></div></div><Footer /></div>;
}

function Workspace({ session }: { session: Session }) {
  const [section, setSection] = useState<Section>("overview"); const [mobileNav, setMobileNav] = useState(false);
  const [activities, setActivities] = useState<ActivityRow[]>([]); const [organizations, setOrganizations] = useState<Organization[]>([]); const [actors, setActors] = useState<Actor[]>([]); const [profiles, setProfiles] = useState<Profile[]>([]); const [strategyActions, setStrategyActions] = useState<StrategyAction[]>([]);
  const [role, setRole] = useState("agent"); const [approvalStatus, setApprovalStatus] = useState<string | null>(null); const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]); const [coordinationParticipants, setCoordinationParticipants] = useState<CoordinationParticipant[]>([]); const [agentChoices, setAgentChoices] = useState<AgentChoice[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [toast, setToast] = useState("");
  const [modal, setModal] = useState<"activity" | "strategy" | "organization" | "actor" | "profile" | "password" | "import" | "report" | null>(null); const [editing, setEditing] = useState<ActivityRow | StrategyAction | Organization | Actor | Profile | null>(null);
  const [strategyImport, setStrategyImport] = useState(false);
  const [query, setQuery] = useState(""); const [statusFilter, setStatusFilter] = useState(""); const [kindFilter, setKindFilter] = useState(""); const [axisFilter, setAxisFilter] = useState(""); const [month, setMonth] = useState(() => new Date());
  const listRequests = useServerFn(listAccountRequests); const review = useServerFn(reviewAccount);
  const isManager = role === "admin" || role === "coordinator"; const readOnly = role === "viewer" || role === "coordinator";
   async function load() { setLoading(true); setError(""); let { data: ownProfile, error: ownProfileError } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(); if (!ownProfile && !ownProfileError) { const created = await supabase.from("profiles").insert({ id: session.user.id, full_name: String(session.user.user_metadata?.["full_name"] || session.user.email?.split("@")[0] || "Agente"), requested_role: "agent", approval_status: "pending" }).select().single(); ownProfile = created.data; ownProfileError = created.error; } const r = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).limit(1); const nextRole = r.data?.[0]?.role || "agent"; setRole(nextRole); setApprovalStatus(ownProfile?.approval_status || null); if (ownProfile?.approval_status !== "approved") { setProfiles(ownProfile ? [ownProfile] : []); setError(ownProfileError?.message || r.error?.message || ""); setLoading(false); return; } const [a, o, t, p, participants, agentList, s] = await Promise.all([supabase.from("activities").select("*").order("created_at", { ascending: false }), supabase.from("organizations").select("*").order("created_at", { ascending: false }), supabase.from("actors").select("*").order("created_at", { ascending: false }), supabase.from("profiles").select("*").eq("approval_status", "approved"), supabase.rpc("coordination_participants"), supabase.rpc("activity_agent_choices"), supabase.from("strategy_actions").select("*").order("created_at", { ascending: false })]); setActivities(a.data || []); setOrganizations(o.data || []); setActors(t.data || []); setProfiles(p.data || []); setCoordinationParticipants(participants.data || []); setAgentChoices(agentList.data || []); setStrategyActions(s.data || []); if (nextRole === "admin") { try { setApprovalRequests(await listRequests()); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "NÃ£o foi possÃ­vel carregar as solicitaÃ§Ãµes."); } } setError(current => [current, a.error, o.error, t.error, p.error, participants.error, agentList.error, s.error].filter(Boolean).map(x => typeof x === "string" ? x : x?.message).join(" Â· ")); setLoading(false); }
  useEffect(() => { void load(); }, [session.user.id]);
  const myProfile = profiles.find(p => p.id === session.user.id);
  const displayName = myProfile?.full_name || session.user.user_metadata?.["full_name"] || session.user.email?.split("@")[0] || "Agente";
  const filtered = useMemo(() => activities.filter(a => (!query || `${a.title} ${a.description} ${a.kind}`.toLowerCase().includes(query.toLowerCase())) && (!statusFilter || a.status === statusFilter) && (!kindFilter || a.kind === kindFilter)), [activities, query, statusFilter, kindFilter]);
  const orderedOrganizations = useMemo(() => [...organizations].sort((a,b) => (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" })), [organizations]);
  const filteredStrategy = useMemo(() => strategyActions.filter(a => (!query || `${a.description} ${a.axis} ${a.problem} ${a.solution}`.toLowerCase().includes(query.toLowerCase())) && (!axisFilter || a.axis === axisFilter)), [strategyActions, query, axisFilter]);
  const orderedActors = useMemo(() => [...actors].sort((a,b) => (a.actor_name || "").localeCompare(b.actor_name || "", "pt-BR", { sensitivity: "base" })), [actors]);
  // The execution percentage walks the plan's own activities and never the activity page. An
  // activity that has subtasks adds the share of those concluded ones; an activity without subtasks
  // adds a single task judged by its own status. A plan without activities yet shows "--", so an
  // empty portfolio is not read as zero performance.
  const planProgress = useMemo(() => {
    const shares = strategyActions.flatMap(action => normalizeActivities(action.activities)).filter(activity => activity.description.trim()).map(activity => completionOf(activity).share);
    const total = shares.length;
    return { total, done: shares.filter(share => share === 1).length, percent: total ? Math.round(shares.reduce((sum, share) => sum + share, 0) / total * 100) : null };
  }, [strategyActions]);
  async function decideAccount(userId: string, decision: "approved" | "rejected") { try { await review({ data: { userId, decision } }); setToast(decision === "approved" ? "Conta aprovada e acesso liberado." : "Conta recusada e mantida bloqueada."); setApprovalRequests(await listRequests()); } catch (reviewError) { setToast(reviewError instanceof Error ? reviewError.message : "NÃ£o foi possÃ­vel analisar a conta."); } }
  function open(which: typeof modal, row: typeof editing = null) { if (readOnly && which !== "profile") return; setEditing(row); setModal(which); }
  function openPassword() { setEditing(null); setModal("password"); }
  async function remove(which: "activities" | "organizations" | "actors" | "strategy_actions", id: string) { if (!window.confirm("Excluir este registro? Esta aÃ§Ã£o nÃ£o pode ser desfeita.")) return; const { error } = await supabase.from(which).delete().eq("id", id); if (error) setToast(`NÃ£o foi possÃ­vel excluir: ${error.message}`); else { setToast("Registro excluÃ­do."); void load(); } }
  // A task written from the plan page only touches that action's own activity list: the action's
  // description, axis and status are left as they are, and the saved row is put back in place so the
  // execution percentage moves without reloading the page.
  async function saveTasks(action: StrategyAction, next: PlanActivity[]) {
    const saved = confirmed<StrategyAction>(await supabase.from("strategy_actions").update({ activities: storedActivities(next) as unknown as Json, updated_at: new Date().toISOString() }).eq("id", action.id).select().single(), "a atividade do plano de estratÃ©gias");
    setStrategyActions(current => current.map(item => item.id === saved.id ? saved : item));
    setToast("Atividade salva no plano de estratÃ©gias.");
  }
  function exportCSV() { const headers = ["TÃ­tulo", "Tipo", "Status", "InÃ­cio", "ConclusÃ£o", "OrganizaÃ§Ã£o", "ResponsÃ¡vel", "Participantes (agentes)", "Resultados alcanÃ§ados"]; const rows = filtered.map(a => [a.title, a.kind, a.status, formatDate(a.start_date), formatDate(a.end_date), organizations.find(o => o.id === a.organization_id)?.name || "", profiles.find(p => p.id === a.owner_id)?.full_name || "", (a.participant_agents || []).map(id => agentChoices.find(choice => choice.user_id === id)?.full_name || "").filter(Boolean).join(", "), a.achieved_results || ""]); const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\r\n"); const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "relatorio-ari.csv"; link.click(); URL.revokeObjectURL(url); }
  const heading = nav.find(x => x.id === section)?.label || "VisÃ£o geral";
  if (!loading && approvalStatus !== "approved") return <AccountBlocked status={approvalStatus} />;
  return <div className="min-h-screen flex flex-col lg:flex-row"><aside className={`no-print bg-sidebar text-primary-foreground lg:w-60 lg:shrink-0 lg:min-h-screen ${mobileNav ? "block" : "hidden lg:block"}`}><div className="lg:sticky lg:top-0 flex flex-col lg:h-screen"><div className="px-6 py-6 border-b border-primary-foreground/10"><img src={ari.url} alt="ARI" className="w-32 h-16 object-contain" onError={e => { const t = e.currentTarget; if (!t.src.endsWith(ariFallback)) { t.src = ariFallback; } }} /><p className="text-[11px] text-primary-foreground/60 mt-3 uppercase font-bold">GestÃ£o de atividades</p></div><nav className="flex-1 px-3 py-6 space-y-1">{nav.filter(item => item.id !== "approvals" || role === "admin").map(item => { const Icon = item.icon; return <Button key={item.id} variant="ghost" onClick={() => { setSection(item.id); setMobileNav(false); setQuery(""); }} className={`w-full justify-start h-10 px-3 text-sm ${section === item.id ? "bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground" : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"}`}><Icon className="mr-2" />{item.label}</Button>; })}</nav><div className="p-3 border-t border-primary-foreground/10">{!readOnly && <Button variant="ghost" className="w-full justify-start text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={() => open("profile", myProfile || null)}><Settings2 /> Meu perfil</Button>}<Button variant="ghost" className="w-full justify-start text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={openPassword}><KeyRound /> Trocar senha</Button><Button variant="ghost" className="w-full justify-start text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={() => supabase.auth.signOut()}><LogOut /> Sair</Button></div></div></aside><div className="min-w-0 flex-1 flex flex-col"><header className="no-print bg-card border-b px-5 md:px-9 h-18 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu" onClick={() => setMobileNav(!mobileNav)}><Menu /></Button><div><p className="text-xs text-muted-foreground">ARI / Plataforma de gestÃ£o</p><h1 className="font-bold text-lg">{heading}</h1></div></div><div className="flex items-center gap-3"><span className="hidden sm:block text-right"><span className="block text-sm font-bold">{displayName}</span><span className="block text-xs text-muted-foreground">{role === "admin" ? "Administrador" : isManager ? "CoordenaÃ§Ã£o" : readOnly ? "Visualizador" : "Agente regional"}</span></span><div className="w-9 h-9 rounded-full bg-accent text-accent-foreground grid place-items-center text-xs font-bold">{initials(displayName)}</div></div></header><main className="flex-1 p-5 md:p-9 max-w-[1600px] w-full mx-auto">{error && <p className="mb-5 p-3 rounded bg-secondary text-primary text-sm">NÃ£o foi possÃ­vel carregar alguns dados: {error}</p>}{toast && <div role="status" className="mb-5 p-3 flex justify-between gap-3 rounded bg-accent text-accent-foreground text-sm">{toast}<Button variant="ghost" size="icon" className="h-5 w-5" aria-label="Fechar mensagem" onClick={() => setToast("")}><X /></Button></div>}{loading ? <p className="text-muted-foreground">Carregando registros...</p> : <>
    {section === "overview" && <><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-primary">PAINEL DE ACOMPANHAMENTO</p><h2 className="text-2xl md:text-3xl font-bold mt-1">OlÃ¡, {displayName.split(" ")[0]}.</h2><p className="text-muted-foreground mt-2 text-sm">Acompanhe o trabalho realizado no ecossistema de inovaÃ§Ã£o.</p></div>{!readOnly && <Button onClick={() => open("activity")}><Plus /> Nova atividade</Button>}</div><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4"><Metric icon={ClipboardList} label="Atividades registradas" value={activities.length} note="Total de aÃ§Ãµes" /><Metric icon={Check} label="ConcluÃ­das" value={activities.filter(a => a.status === "ConcluÃ­da").length} note="AÃ§Ãµes finalizadas" /><Metric icon={Building2} label="OrganizaÃ§Ãµes" value={organizations.length} note="No ecossistema" /><Metric icon={Users} label="Atores cadastrados" value={actors.length} note="Na governanÃ§a" /></div><div className="app-panel p-5 mt-4"><div className="flex flex-wrap items-end justify-between gap-4"><div className="min-w-0"><p className="text-sm text-muted-foreground">ConclusÃ£o do plano de estratÃ©gias</p><p className="text-xs text-muted-foreground mt-1">Percentual de conclusÃ£o das atividades do plano; as que tÃªm subtarefas entram pela proporÃ§Ã£o de subtarefas concluÃ­das.</p></div><p className="text-4xl font-bold leading-none" aria-label={planProgress.percent === null ? "Sem percentual" : `${planProgress.percent} por cento`}>{planProgress.percent === null ? "â€”" : `${planProgress.percent}%`}</p></div><Progress className="mt-4 h-2.5" value={planProgress.percent ?? 0} aria-label="Percentual de conclusÃ£o das atividades do plano de estratÃ©gias" /><p className="text-xs text-muted-foreground mt-2">{planProgress.total === 0 ? "Nenhuma atividade registrada no plano." : `${planProgress.done} de ${planProgress.total} ${planProgress.total === 1 ? "atividade concluÃ­da" : "atividades concluÃ­das"}.`}</p></div><div className="grid xl:grid-cols-[1.6fr_1fr] gap-7 mt-9"><div><SectionTitle title="Atividades recentes" action="Ver todas" onAction={() => setSection("activities")} /><div className="app-panel overflow-x-auto"><ActivityTable rows={activities.slice(0, 6)} organizations={organizations} agentChoices={agentChoices} currentUserId={session.user.id} isAdmin={role === "admin"} onEdit={a => open("activity", a)} onDelete={a => remove("activities", a.id)} readOnly={readOnly} /></div></div><div><SectionTitle title="PrÃ³ximos compromissos" action="Ver agenda" onAction={() => setSection("calendar")} /><div className="app-panel p-5 space-y-4">{activities.filter(a => a.start_date && a.start_date >= new Date().toISOString().slice(0, 10) && a.status !== "ConcluÃ­da").sort((a,b) => (a.start_date || "").localeCompare(b.start_date || "")).slice(0, 4).map(a => <div key={a.id} className="flex gap-4 border-b last:border-0 pb-4 last:pb-0"><div className="text-center bg-secondary text-primary rounded p-2 min-w-12"><span className="block font-bold text-lg leading-none">{a.start_date?.slice(8,10)}</span><span className="text-[10px] uppercase">{new Date(`${a.start_date}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" })}</span></div><div><p className="text-sm font-bold">{a.title}</p><p className="text-xs text-muted-foreground mt-1">{a.kind}</p></div></div>)}{!activities.some(a => a.start_date && a.start_date >= new Date().toISOString().slice(0, 10) && a.status !== "ConcluÃ­da") && <Empty text="Nenhum compromisso futuro registrado." />}</div></div></div></>}
    {section === "activities" && <><Toolbar title="Atividades" subtitle="Registre e acompanhe as aÃ§Ãµes dos agentes regionais." action="Nova atividade" onAction={() => open("activity")} readOnly={readOnly} /><div className="flex flex-wrap gap-3 mb-5"><SearchBox value={query} onChange={setQuery} placeholder="Buscar atividades..." /><select className="app-field w-full sm:w-48" value={kindFilter} onChange={e => setKindFilter(e.target.value)}><option value="">Todos os tipos</option>{activityKinds.map(x => <option key={x}>{x}</option>)}</select><select className="app-field w-full sm:w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Todos os status</option>{statuses.map(x => <option key={x}>{x}</option>)}</select>{!readOnly && <Button variant="outline" className="ml-auto" onClick={() => open("import")}><Upload /> Importar relatÃ³rios em Markdown</Button>}</div><div className="app-panel overflow-x-auto"><ActivityTable rows={filtered} organizations={organizations} agentChoices={agentChoices} currentUserId={session.user.id} isAdmin={role === "admin"} onEdit={a => open("activity", a)} onDelete={a => remove("activities", a.id)} readOnly={readOnly} /></div></>}
    {section === "strategy" && <><Toolbar title="Plano de estratÃ©gias" subtitle="AÃ§Ãµes do plano e seus resultados esperados, organizados por eixo." action="Nova aÃ§Ã£o" onAction={() => open("strategy")} readOnly={readOnly} extra={!readOnly && <Button variant="outline" onClick={() => setStrategyImport(true)}><Upload /> Importar Markdown</Button>} /><div className="app-panel p-5 mb-5"><div className="flex flex-wrap items-end justify-between gap-4"><div className="min-w-0"><p className="text-sm text-muted-foreground">ConclusÃ£o das atividades do plano</p><p className="text-xs text-muted-foreground mt-1">Uma atividade sem subtarefas conta como tarefa Ãºnica; as demais entram pela proporÃ§Ã£o de subtarefas concluÃ­das.</p></div><p className="text-4xl font-bold leading-none" aria-label={planProgress.percent === null ? "Sem percentual" : `${planProgress.percent} por cento`}>{planProgress.percent === null ? "â€”" : `${planProgress.percent}%`}</p></div><Progress className="mt-4 h-2.5" value={planProgress.percent ?? 0} aria-label="Percentual de conclusÃ£o das atividades do plano de estratÃ©gias" /><p className="text-xs text-muted-foreground mt-2">{planProgress.total === 0 ? "Nenhuma atividade registrada no plano." : `${planProgress.done} de ${planProgress.total} ${planProgress.total === 1 ? "atividade concluÃ­da" : "atividades concluÃ­das"}.`}</p></div><div className="flex flex-wrap gap-3 mb-5"><SearchBox value={query} onChange={setQuery} placeholder="Buscar aÃ§Ã£o do plano..." /><select className="app-field w-full sm:w-64" value={axisFilter} onChange={e => setAxisFilter(e.target.value)}><option value="">Todos os eixos</option>{axes.map(x => <option key={x}>{x}</option>)}</select></div><div className="app-panel overflow-x-auto"><StrategyTable rows={filteredStrategy} profiles={profiles} onEdit={a => open("strategy", a)} onDelete={a => remove("strategy_actions", a.id)} onSaveTasks={(action, next) => { void saveTasks(action, next).catch(error => setToast(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel salvar a atividade.")); }} readOnly={readOnly} /></div></>}
    {section === "calendar" && <><Toolbar title="Agenda" subtitle="Visualize suas atividades e compromissos por data." action="Agendar atividade" onAction={() => open("activity")} readOnly={readOnly} /><div className="app-panel"><div className="p-5 border-b flex items-center justify-between"><h3 className="font-bold capitalize text-lg">{monthLabel(month)}</h3><div className="flex gap-1"><Button variant="outline" size="icon" aria-label="MÃªs anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()-1, 1))}><ChevronLeft /></Button><Button variant="outline" size="icon" aria-label="PrÃ³ximo mÃªs" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()+1, 1))}><ChevronRight /></Button></div></div><CalendarGrid date={month} rows={activities} onSelect={a => { if (!readOnly && (a.owner_id === session.user.id || role === "admin")) open("activity", a); }} /></div></>}
    {section === "organizations" && <><Toolbar title="OrganizaÃ§Ãµes atendidas" subtitle="Empresas, startups e instituiÃ§Ãµes do ecossistema." action="Nova organizaÃ§Ã£o" onAction={() => open("organization")} readOnly={readOnly} /><div className="mb-5"><SearchBox value={query} onChange={setQuery} placeholder="Buscar organizaÃ§Ã£o..." /></div><div className="app-panel overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-muted text-muted-foreground text-xs uppercase"><tr><th className="p-4">OrganizaÃ§Ã£o</th><th className="p-4">Tipo / setor</th><th className="p-4">RegiÃ£o</th><th className="p-4">Etapa</th><th className="p-4">Contato</th><th className="p-4 w-24">AÃ§Ãµes</th></tr></thead><tbody>{organizations.filter(o => `${o.name} ${o.sector} ${o.region}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" })).map(o => <tr key={o.id} className="border-t hover:bg-muted/40"><td className="p-4 font-bold">{o.name}<span className="block text-xs font-normal text-muted-foreground">{o.document}</span></td><td className="p-4">{o.kind}<span className="block text-xs text-muted-foreground">{o.sector}</span></td><td className="p-4">{o.region || "â€”"}</td><td className="p-4"><span className="rounded bg-secondary text-secondary-foreground px-2 py-1 text-xs">{o.stage}</span></td><td className="p-4">{o.contact || o.email || "â€”"}</td><td className="p-4"><RowActions edit={() => open("organization", o)} remove={() => remove("organizations", o.id)} readOnly={readOnly} /></td></tr>)}</tbody></table>{organizations.length === 0 && <Empty text="Nenhuma organizaÃ§Ã£o cadastrada." />}</div></>}
    {section === "actors" && <><Toolbar title="Atores da governanÃ§a" subtitle="Pessoas e instituiÃ§Ãµes que fazem parte da rede." action="Novo ator" onAction={() => open("actor")} readOnly={readOnly} /><div className="mb-5"><SearchBox value={query} onChange={setQuery} placeholder="Buscar ator ou instituiÃ§Ã£o..." /></div><div className="app-panel overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-muted text-muted-foreground text-xs uppercase"><tr><th className="p-4">Ator</th><th className="p-4">InstituiÃ§Ã£o</th><th className="p-4">Tipo</th><th className="p-4">Contato</th><th className="p-4 w-24">AÃ§Ãµes</th></tr></thead><tbody>{actors.filter(a => `${a.actor_name} ${a.institution_name}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => (a.actor_name || "").localeCompare(b.actor_name || "", "pt-BR", { sensitivity: "base" })).map(a => <tr key={a.id} className="border-t hover:bg-muted/40"><td className="p-4 font-bold">{a.actor_name}<span className="block text-xs font-normal text-muted-foreground">{a.position}</span></td><td className="p-4">{a.institution_name}</td><td className="p-4">{a.institution_type || "â€”"}</td><td className="p-4">{a.email || a.phone || "â€”"}</td><td className="p-4"><RowActions edit={() => open("actor", a)} remove={() => remove("actors", a.id)} readOnly={readOnly} /></td></tr>)}</tbody></table>{actors.length === 0 && <Empty text="Nenhum ator cadastrado." />}</div></>}
    {section === "agents" && <><Toolbar title="Agentes regionais" subtitle="Profissionais vinculados ao programa ARI." /><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{profiles.map(p => <div className="app-panel p-5 flex items-start gap-4" key={p.id}><div className="w-11 h-11 shrink-0 rounded-full bg-secondary text-primary grid place-items-center font-bold">{initials(p.full_name)}</div><div className="min-w-0"><h3 className="font-bold">{p.full_name || "Agente regional"}</h3><p className="text-sm text-muted-foreground mt-1">{p.region || "RegiÃ£o nÃ£o informada"}</p><p className="text-xs text-muted-foreground mt-2">{p.governance || "GovernanÃ§a nÃ£o informada"}</p>{p.phone && <p className="text-xs mt-2">{p.phone}</p>}</div></div>)}{profiles.length === 0 && <div className="app-panel p-5"><Empty text="Nenhum perfil de agente preenchido ainda. Atualize seu perfil para aparecer aqui." /></div>}</div></>}
    {section === "approvals" && role === "admin" && <><Toolbar title="AprovaÃ§Ã£o de contas" subtitle="Analise novas solicitaÃ§Ãµes de acesso ao sistema." /><div className="app-panel overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-muted text-muted-foreground text-xs uppercase"><tr><th className="p-4">UsuÃ¡rio</th><th className="p-4">Tipo solicitado</th><th className="p-4">SituaÃ§Ã£o</th><th className="p-4">Solicitado em</th><th className="p-4">AÃ§Ãµes</th></tr></thead><tbody>{approvalRequests.map(request => <tr key={request.id} className="border-t"><td className="p-4 font-bold">{request.full_name}<span className="block font-normal text-xs text-muted-foreground mt-1">{request.email}</span></td><td className="p-4">{request.requested_role === "coordinator" ? "CoordenaÃ§Ã£o" : "Agente"}</td><td className="p-4"><span className="rounded bg-secondary text-secondary-foreground px-2 py-1 text-xs">{request.approval_status === "rejected" ? "Recusada" : "Pendente"}</span></td><td className="p-4 whitespace-nowrap">{new Date(request.created_at).toLocaleDateString("pt-BR")}</td><td className="p-4"><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void decideAccount(request.id, "approved")}><Check /> Aprovar</Button><Button size="sm" variant="outline" onClick={() => void decideAccount(request.id, "rejected")}><X /> Recusar</Button></div></td></tr>)}</tbody></table>{approvalRequests.length === 0 && <Empty text="Nenhuma conta aguardando anÃ¡lise." />}</div></>}
    {section === "reports" && <><div className="flex flex-wrap justify-between gap-4 mb-7"><div><h2 className="text-2xl font-bold">RelatÃ³rios e indicadores</h2><p className="text-sm text-muted-foreground mt-1">Resultados consolidados das atividades cadastradas.</p></div><div className="flex gap-2 no-print"><Button variant="outline" onClick={() => setModal("report")}><FileText /> RelatÃ³rio mensal (.docx)</Button><Button variant="outline" onClick={() => window.print()}><Download /> Imprimir</Button><Button onClick={exportCSV}><Download /> Exportar CSV</Button></div></div><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8"><Metric icon={ClipboardList} label="Atividades" value={activities.length} note="Registradas" /><Metric icon={Check} label="ConcluÃ­das" value={activities.filter(a => a.status === "ConcluÃ­da").length} note="Finalizadas" /><Metric icon={Building2} label="OrganizaÃ§Ãµes" value={organizations.length} note="Cadastradas" /><Metric icon={Target} label="Taxa de conclusÃ£o" value={`${activities.length ? Math.round(activities.filter(a => a.status === "ConcluÃ­da").length / activities.length * 100) : 0}%`} note="Das aÃ§Ãµes registradas" /></div><div className="grid lg:grid-cols-2 gap-6"><div className="app-panel p-6"><h3 className="font-bold mb-6">Atividades por tipo</h3><div className="space-y-4">{activityKinds.map(kind => <Bar key={kind} label={kind} count={activities.filter(a => a.kind === kind).length} total={activities.length} />)}</div></div><div className="app-panel p-6"><h3 className="font-bold mb-6">SituaÃ§Ã£o das atividades</h3><div className="space-y-4">{statuses.map(status => <Bar key={status} label={status} count={activities.filter(a => a.status === status).length} total={activities.length} />)}</div><h3 className="font-bold mt-10 mb-5">Etapas de atendimento</h3><div className="space-y-4">{stages.map(stage => <Bar key={stage} label={stage} count={organizations.filter(o => o.stage === stage).length} total={organizations.length} />)}</div></div></div><div className="app-panel mt-6 overflow-x-auto"><ActivityTable rows={filtered} organizations={organizations} agentChoices={agentChoices} onEdit={a => open("activity", a)} onDelete={a => remove("activities", a.id)} readOnly /></div></>}
   </>}</main><Footer /></div>{modal && modal !== "import" && modal !== "report" && <Editor key={modal} kind={modal} row={editing} userId={session.user.id} userName={displayName} organizations={organizations} actors={orderedActors} coordinationParticipants={coordinationParticipants} agentChoices={agentChoices} onClose={() => setModal(null)} onChangePassword={openPassword} onSaved={message => { setModal(null); setToast(message || "Registro salvo com sucesso."); void load(); }} onError={setToast} />}{modal === "import" && <ImportModal userId={session.user.id} activities={activities} organizations={organizations} onClose={() => setModal(null)} onDone={message => { setToast(message); void load(); }} />}{modal === "report" && <ReportModal activities={activities} actorCount={actors.length} plan={planProgress} userName={displayName} onClose={() => setModal(null)} />}{strategyImport && <StrategyImportModal userId={session.user.id} actions={strategyActions} onClose={() => setStrategyImport(false)} onDone={message => { setStrategyImport(false); setToast(message); void load(); }} />}</div>;
}
function AccountBlocked({ status }: { status: string | null }) {
  const rejected = status === "rejected";
  return <div className="min-h-screen flex flex-col"><main className="flex-1 grid place-items-center p-6"><div className="w-full max-w-lg text-center"><img src={ari.url} alt="ARI â€” Agente Regional de InovaÃ§Ã£o" className="w-48 mx-auto object-contain" onError={e => { const t = e.currentTarget; if (!t.src.endsWith(ariFallback)) { t.src = ariFallback; } }} /><div className="app-panel p-7 mt-8"><div className="w-12 h-12 mx-auto rounded-full bg-secondary text-primary grid place-items-center"><UserCheck /></div><h1 className="text-2xl font-bold mt-5">{rejected ? "Acesso nÃ£o aprovado" : "Cadastro aguardando aprovaÃ§Ã£o"}</h1><p className="text-sm text-muted-foreground mt-3 leading-relaxed">{rejected ? "Sua solicitaÃ§Ã£o foi analisada e permanece sem acesso ao sistema. Entre em contato com o administrador para uma nova anÃ¡lise." : "Sua conta foi criada, mas o acesso aos dados serÃ¡ liberado somente apÃ³s a aprovaÃ§Ã£o do administrador."}</p><Button variant="outline" className="mt-6" onClick={() => supabase.auth.signOut()}><LogOut /> Sair</Button></div></div></main><Footer /></div>;
}
function Metric({ icon: Icon, label, value, note }: { icon: typeof Activity; label: string; value: string | number; note: string }) { return <div className="app-panel p-5"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span><div className="p-2 bg-secondary text-primary rounded"><Icon size={19} /></div></div><p className="text-3xl font-bold mt-4">{value}</p><p className="text-xs text-muted-foreground mt-1">{note}</p></div>; }
function SectionTitle({ title, action, onAction }: { title: string; action: string; onAction: () => void }) { return <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold">{title}</h3><Button variant="link" className="p-0 text-xs" onClick={onAction}>{action} <ChevronRight /></Button></div>; }
function Toolbar({ title, subtitle, action, onAction, readOnly, extra }: { title: string; subtitle: string; action?: string; onAction?: () => void; readOnly?: boolean; extra?: ReactNode }) { return <div className="flex flex-wrap items-end justify-between gap-4 mb-7"><div><h2 className="text-2xl font-bold">{title}</h2><p className="text-sm text-muted-foreground mt-1">{subtitle}</p></div><div className="flex flex-wrap gap-2">{action && !readOnly && <Button onClick={onAction}><Plus />{action}</Button>}{extra}</div></div>; }
function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) { return <div className="relative w-full sm:w-72"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><input className="app-field pl-9" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></div>; }
function Empty({ text }: { text: string }) { return <div className="py-12 text-center text-sm text-muted-foreground">{text}</div>; }
function RowActions({ edit, remove, readOnly }: { edit: () => void; remove: () => void; readOnly?: boolean | undefined }) { return readOnly ? null : <div className="flex gap-1"><Button variant="ghost" size="icon" title="Editar" aria-label="Editar" onClick={edit}><Pencil /></Button><Button variant="ghost" size="icon" title="Excluir" aria-label="Excluir" onClick={remove}><Trash2 /></Button></div>; }
function ActivityTable({ rows, organizations, agentChoices, currentUserId, isAdmin, onEdit, onDelete, readOnly }: { rows: ActivityRow[]; organizations: Organization[]; agentChoices: AgentChoice[]; currentUserId?: string; isAdmin?: boolean; onEdit: (a: ActivityRow) => void; onDelete: (a: ActivityRow) => void; readOnly?: boolean | undefined }) { const participantNames = (a: ActivityRow) => (a.participant_agents || []).map(id => agentChoices.find(choice => choice.user_id === id)?.full_name || "").filter(Boolean).join(", "); return <><table className="w-full text-sm text-left"><thead className="bg-muted text-muted-foreground text-xs uppercase"><tr><th className="p-4">Atividade</th><th className="p-4">Tipo</th><th className="p-4">OrganizaÃ§Ã£o</th><th className="p-4">Data</th><th className="p-4">Status</th>{!readOnly && <th className="p-4 w-24">AÃ§Ãµes</th>}</tr></thead><tbody>{rows.map(a => <tr key={a.id} className="border-t hover:bg-muted/40"><td className="p-4 font-bold min-w-48">{a.title}{participantNames(a) && <span className="mt-1 block text-[11px] font-normal text-muted-foreground">Participantes: {participantNames(a)}</span>}{a.indicators?.length ? <span className="mt-1.5 flex flex-wrap gap-1">{a.indicators.map(code => <span key={code} title={indicatorLabel(code)} className="rounded bg-accent/20 text-accent-foreground px-1.5 py-0.5 text-[10px] font-bold">{code}</span>)}</span> : null}</td><td className="p-4 text-muted-foreground min-w-36">{a.kind}</td><td className="p-4">{organizations.find(o => o.id === a.organization_id)?.name || "â€”"}</td><td className="p-4 whitespace-nowrap">{formatDate(a.start_date)}</td><td className="p-4 whitespace-nowrap"><span className={`text-xs px-2 py-1 rounded ${a.status === "ConcluÃ­da" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>{a.status}</span></td>{!readOnly && (a.owner_id === currentUserId || isAdmin) && <td className="p-4"><RowActions edit={() => onEdit(a)} remove={() => onDelete(a)} /></td>}</tr>)}</tbody></table>{rows.length === 0 && <Empty text="Nenhuma atividade encontrada. Cadastre uma para comeÃ§ar." />}</>; }
/**
 * One inline form for a plan task, whatever the level: an activity and a subtask are both a
 * description, a status and the period it runs over, so both share this form, this validation and
 * the draft it holds. `which` tells the caller whether a task is being added or replaces one.
 */
function useTaskEditor(save: (task: PlanTask, which: number | "new") => void) {
  const [open, setOpen] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<PlanTask>(emptyPlanTask());
  const [problem, setProblem] = useState("");
  const set = (name: string, value: string) => setDraft(current => ({ ...current, [name]: value }));
  const start = (which: number | "new", task?: PlanTask) => { setProblem(""); setDraft(task || emptyPlanTask()); setOpen(which); };
  const close = () => { setOpen(null); setDraft(emptyPlanTask()); setProblem(""); };
  function submit() {
    const description = draft.description.trim();
    if (!description) { setProblem("Informe a descriÃ§Ã£o da tarefa."); return; }
    let start_date = "";
    let end_date = "";
    try {
      start_date = toIsoDate(draft.start_date, dateLabels['start_date'] || "InÃ­cio") || "";
      end_date = toIsoDate(draft.end_date, dateLabels['end_date'] || "ConclusÃ£o") || "";
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Confira as datas informadas.");
      return;
    }
    if (start_date && end_date && end_date < start_date) { setProblem("A data de conclusÃ£o vem antes da data de inÃ­cio."); return; }
    save({ description, status: draft.status || statuses[0] || "", start_date: isoToBrDate(start_date), end_date: isoToBrDate(end_date) }, open ?? "new");
    close();
  }
  return { open, draft, set, problem, start, close, submit };
}
function TaskForm({ draft, set, problem }: { draft: PlanTask; set: (name: string, value: string) => void; problem: string }) {
  // The name given to field() is the key it writes to in the draft, so it has to be the very key the
  // task carries: with any other name the typing would land somewhere nothing reads.
  return <>{field("DescriÃ§Ã£o", "description", draft.description, set, { textarea: true, required: true })}{field("Status", "status", draft.status, set, { options: statuses, required: true })}<div className="grid sm:grid-cols-2 gap-3">{field("InÃ­cio", "start_date", draft.start_date, set, { mask: dateMask })}{field("ConclusÃ£o", "end_date", draft.end_date, set, { mask: dateMask })}</div>{problem && <p className="text-xs text-destructive">{problem}</p>}</>;
}
const taskPeriod = (task: PlanTask) => !task.start_date && !task.end_date ? "" : task.end_date ? `${formatDate(task.start_date)} a ${formatDate(task.end_date)}` : `a partir de ${formatDate(task.start_date)}`;
/**
 * The subtasks of one activity, listed and written straight from the plan page. They are where the
 * activity's own share of the execution percentage comes from, so each row says its status and the
 * list says how many of them are concluded.
 */
function SubtaskList({ activity, onChange, readOnly }: { activity: PlanActivity; onChange: (next: PlanActivity) => void; readOnly?: boolean | undefined }) {
  const subtasks = activity.subtasks;
  const { open, draft, set, problem, start, close, submit } = useTaskEditor((task, which) => onChange({ ...activity, subtasks: which === "new" ? [...subtasks, task] : subtasks.map((item, i) => i === which ? task : item) }));
  return <div className="mt-1.5">
    {subtasks.length > 0 && <ul className="space-y-1">{subtasks.map((task, i) => <li key={i} className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs break-words">{task.description}</p><p className="text-[11px] text-muted-foreground">{task.status}{taskPeriod(task) ? ` Â· ${taskPeriod(task)}` : ""}</p></div>{!readOnly && <div className="flex shrink-0"><Button type="button" variant="ghost" size="icon" title="Editar subtarefa" aria-label={`Editar subtarefa ${i + 1}`} onClick={() => start(i, task)}><Pencil /></Button><Button type="button" variant="ghost" size="icon" title="Remover subtarefa" aria-label={`Remover subtarefa ${i + 1}`} onClick={() => onChange({ ...activity, subtasks: subtasks.filter((_, index) => index !== i) })}><Trash2 /></Button></div>}</li>)}</ul>}
    {open !== null && <div className="mt-2 space-y-3 border border-border rounded p-3"><TaskForm draft={draft} set={set} problem={problem} /><div className="flex gap-2"><Button type="button" size="sm" onClick={submit}>Salvar</Button><Button type="button" size="sm" variant="outline" onClick={close}>Cancelar</Button></div></div>}
    {!readOnly && open === null && <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs mt-1" onClick={() => start("new")}><Plus /> Inserir subtarefa</Button>}
  </div>;
}
/**
 * The activities of one plan action, listed and written straight from the plan page. Each one says
 * how it is measured â€” by its subtasks when it has any, by its own status when it has none â€” so the
 * percentage on top can always be traced back to what is on screen.
 */
function PlanActivities({ activities, onChange, readOnly }: { activities: PlanActivity[]; onChange: (next: PlanActivity[]) => void; readOnly?: boolean | undefined }) {
  const { open, draft, set, problem, start, close, submit } = useTaskEditor((task, which) => onChange(which === "new"
    ? [...activities, { ...task, subtasks: [] }]
    // Editing an activity keeps the subtasks it already has: they are its children, not a field to rewrite.
    : activities.map((item, i) => i === which ? { ...item, ...task } : item)));
  const measure = (activity: PlanActivity) => {
    const { done, total, bySubtasks } = completionOf(activity);
    return bySubtasks ? `Subtarefas: ${done} de ${total} ${total === 1 ? "concluÃ­da" : "concluÃ­das"}` : "Sem subtarefas: conta como tarefa Ãºnica";
  };
  return <div className="min-w-64">
    {activities.length === 0 && <p className="text-xs text-muted-foreground">Sem atividades.</p>}
    {activities.map((activity, i) => <div key={i} className="border-l-2 border-primary pl-3 py-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-semibold break-words">{activity.description}</p><p className="text-[11px] text-muted-foreground">{activity.status}{taskPeriod(activity) ? ` Â· ${taskPeriod(activity)}` : ""}</p><p className="text-[11px] text-muted-foreground">{measure(activity)}</p></div>{!readOnly && <div className="flex shrink-0"><Button type="button" variant="ghost" size="icon" title="Editar atividade" aria-label={`Editar atividade ${i + 1}`} onClick={() => start(i, activity)}><Pencil /></Button><Button type="button" variant="ghost" size="icon" title="Remover atividade" aria-label={`Remover atividade ${i + 1}`} onClick={() => onChange(activities.filter((_, index) => index !== i))}><Trash2 /></Button></div>}</div><SubtaskList activity={activity} onChange={next => onChange(activities.map((item, k) => k === i ? next : item))} readOnly={readOnly} /></div>)}
    {open !== null && <div className="mt-2 space-y-3 border-t pt-3"><TaskForm draft={draft} set={set} problem={problem} /><div className="flex gap-2"><Button type="button" size="sm" onClick={submit}>Salvar</Button><Button type="button" size="sm" variant="outline" onClick={close}>Cancelar</Button></div></div>}
    {!readOnly && open === null && <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => start("new")}><Plus /> Inserir atividade</Button>}
  </div>;
}
function StrategyTable({ rows, profiles, onEdit, onDelete, onSaveTasks, readOnly }: { rows: StrategyAction[]; profiles: Profile[]; onEdit: (a: StrategyAction) => void; onDelete: (a: StrategyAction) => void; onSaveTasks: (action: StrategyAction, next: PlanActivity[]) => void; readOnly?: boolean | undefined }) { return <><table className="w-full text-sm text-left"><thead className="bg-muted text-muted-foreground text-xs uppercase"><tr><th className="p-4">AÃ§Ã£o do plano</th><th className="p-4">Eixo</th><th className="p-4">Status</th><th className="p-4">Problema</th><th className="p-4">Atividades</th><th className="p-4">ResponsÃ¡vel</th>{!readOnly && <th className="p-4 w-24">AÃ§Ãµes</th>}</tr></thead><tbody>{rows.map(a => <tr key={a.id} className="border-t hover:bg-muted/40"><td className="p-4 font-bold min-w-64">{a.description || "Sem descriÃ§Ã£o"}<span className="block text-xs font-normal text-muted-foreground mt-1">SoluÃ§Ã£o: {a.solution || "â€”"}</span></td><td className="p-4 text-muted-foreground min-w-40">{a.axis}</td><td className="p-4"><span className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground whitespace-nowrap">{a.status}</span></td><td className="p-4 min-w-48">{a.problem || "â€”"}</td><td className="p-4 min-w-64"><PlanActivities activities={normalizeActivities(a.activities)} onChange={next => onSaveTasks(a, next)} readOnly={readOnly} /></td><td className="p-4">{profiles.find(p => p.id === a.owner_id)?.full_name || "â€”"}</td>{!readOnly && <td className="p-4"><RowActions edit={() => onEdit(a)} remove={() => onDelete(a)} /></td>}</tr>)}</tbody></table>{rows.length === 0 && <Empty text="Nenhuma aÃ§Ã£o do plano de estratÃ©gias cadastrada." />}</>; }
function Bar({ label, count, total }: { label: string; count: number; total: number }) { return <div><div className="flex justify-between gap-3 text-xs mb-2"><span className="text-muted-foreground">{label}</span><b>{count}</b></div><div className="h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${total ? count / total * 100 : 0}%` }} /></div></div>; }
function CalendarGrid({ date, rows, onSelect }: { date: Date; rows: ActivityRow[]; onSelect: (a: ActivityRow) => void }) { const first = new Date(date.getFullYear(), date.getMonth(), 1).getDay(); const days = new Date(date.getFullYear(), date.getMonth()+1, 0).getDate(); const cells = Array.from({ length: first + days }, (_, i) => i - first + 1); return <div className="p-3 md:p-5"><div className="grid grid-cols-7 text-center text-xs font-bold text-muted-foreground mb-2">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "SÃ¡b"].map(x => <div key={x} className="py-2">{x}</div>)}</div><div className="grid grid-cols-7 border-t border-l">{cells.map((day, i) => { const key = day > 0 ? `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(day).padStart(2,"0")}` : ""; const daily = rows.filter(a => a.start_date === key); return <div key={i} className="min-h-20 md:min-h-28 border-r border-b p-1 md:p-2 overflow-hidden">{day > 0 && <><span className={`inline-grid place-items-center w-6 h-6 text-xs rounded-full ${key === new Date().toISOString().slice(0,10) ? "bg-primary text-primary-foreground" : ""}`}>{day}</span>{daily.slice(0, 2).map(a => <Button key={a.id} variant="ghost" onClick={() => onSelect(a)} title={a.title} className="block w-full h-auto min-h-5 p-1 mt-1 text-left text-[10px] md:text-xs bg-secondary text-secondary-foreground truncate rounded-sm justify-start">{a.title}</Button>)}{daily.length > 2 && <span className="text-[10px] text-muted-foreground">+{daily.length - 2}</span>}</>}</div>; })}</div></div>; }

type LinkedActivity = { description: string; status: string; start_date: string; end_date: string };
type Outcome = { title: string; status: string; start_date: string; end_date: string; activities: LinkedActivity[] };
// A plan task is what the execution percentage is measured in: a description, a status and the
// period it runs over. An activity of the plan is one of those tasks and may hold any number of
// subtasks of the very same shape, so both levels are written and read with one single set of rules.
type PlanTask = { description: string; status: string; start_date: string; end_date: string };
type PlanActivity = PlanTask & { subtasks: PlanTask[] };
const emptyPlanTask = (): PlanTask => ({ description: "", status: "NÃ£o iniciada", start_date: "", end_date: "" });
const emptyPlanActivity = (): PlanActivity => ({ ...emptyPlanTask(), subtasks: [] });
// An activity that has subtasks is measured by them, and one without subtasks counts as a single
// task judged by its own status: that is the share the activity adds to the plan's percentage.
const completionOf = (activity: PlanActivity) => {
  const subtasks = activity.subtasks.filter(task => task.description.trim());
  if (subtasks.length > 0) {
    const done = subtasks.filter(task => task.status === "ConcluÃ­da").length;
    return { share: done / subtasks.length, done, total: subtasks.length, bySubtasks: true };
  }
  const done = activity.status === "ConcluÃ­da" ? 1 : 0;
  return { share: done, done, total: 1, bySubtasks: false };
};
const emptyLinkedActivity = (): LinkedActivity => ({ description: "", status: "NÃ£o iniciada", start_date: "", end_date: "" });
const normalizeOutcomes = (value: Json): Outcome[] => Array.isArray(value) ? value.filter((item): item is Record<string, Json | undefined> => Boolean(item) && typeof item === "object" && !Array.isArray(item)).map(item => ({
  title: typeof item['title'] === "string" ? item['title'] : "",
  status: typeof item['status'] === "string" ? item['status'] : "NÃ£o iniciada",
  start_date: isoToBrDate(typeof item['start_date'] === "string" ? item['start_date'] : ""),
  end_date: isoToBrDate(typeof item['end_date'] === "string" ? item['end_date'] : ""),
  activities: Array.isArray(item['activities']) ? item['activities'].filter((activity): activity is Record<string, Json | undefined> => Boolean(activity) && typeof activity === "object" && !Array.isArray(activity)).map(activity => ({
    description: typeof activity['description'] === "string" ? activity['description'] : "",
    status: typeof activity['status'] === "string" ? activity['status'] : "NÃ£o iniciada",
    start_date: isoToBrDate(typeof activity['start_date'] === "string" ? activity['start_date'] : ""),
    end_date: isoToBrDate(typeof activity['end_date'] === "string" ? activity['end_date'] : ""),
  })) : typeof item['activities'] === "string" && item['activities'].trim() ? [{ ...emptyLinkedActivity(), description: item['activities'] }] : [],
})) : [];
const activityDefaults = { kind: "Atividade geral", title: "", description: "", status: "NÃ£o iniciada", start_date: "", end_date: "", organization_id: "", axis: "", problem: "", problem_description: "", solution: "", solution_description: "", objectives: "", expected_results: "", achieved_results: "", participants: "", agenda: "", referrals: "", work_done: "" };
const strategyDefaults = { axis: "", status: "NÃ£o iniciada", description: "", problem: "", problem_description: "", solution: "", solution_description: "" };

/** An expected result listed on a strategy-plan action: a description and nothing else. */
type PlanResultEntry = { description: string };

/**
 * A strategy-plan action carries two flat lists of its own. An expected result is only a
 * description, while an activity also has a status and a period, so the two are read by
 * separate helpers. The legacy activity rows keep their nested `outcomes` shape, read by
 * normalizeOutcomes above, so each shape is stored the way its editor reads it.
 */
const normalizeResults = (value: Json): PlanResultEntry[] => Array.isArray(value)
  ? value.filter((item): item is Record<string, Json | undefined> => Boolean(item) && typeof item === "object" && !Array.isArray(item)).map(item => ({
      description: typeof item['description'] === "string" ? item['description'] : "",
    }))
  : [];
const normalizePlanTasks = (value: Json): PlanTask[] => Array.isArray(value)
  ? value.filter((item): item is Record<string, Json | undefined> => Boolean(item) && typeof item === "object" && !Array.isArray(item)).map(item => ({
      description: typeof item['description'] === "string" ? item['description'] : "",
      status: typeof item['status'] === "string" ? item['status'] : "NÃ£o iniciada",
      start_date: isoToBrDate(typeof item['start_date'] === "string" ? item['start_date'] : ""),
      end_date: isoToBrDate(typeof item['end_date'] === "string" ? item['end_date'] : ""),
    }))
  : [];
// Activities written before subtasks existed, and by the Markdown reader, simply come back with an
// empty subtask list: an activity without subtasks is a valid activity, not a broken one.
const normalizeActivities = (value: Json): PlanActivity[] => Array.isArray(value)
  ? value.filter((item): item is Record<string, Json | undefined> => Boolean(item) && typeof item === "object" && !Array.isArray(item)).map(item => ({
      description: typeof item['description'] === "string" ? item['description'] : "",
      status: typeof item['status'] === "string" ? item['status'] : "NÃ£o iniciada",
      start_date: isoToBrDate(typeof item['start_date'] === "string" ? item['start_date'] : ""),
      end_date: isoToBrDate(typeof item['end_date'] === "string" ? item['end_date'] : ""),
      subtasks: normalizePlanTasks(item['subtasks'] ?? null),
    }))
  : [];
// What actually goes to the database: the whole task is kept and only its dates are converted to
// the ISO form, so editing one subtask never drops the status of its activity, nor its siblings.
const storedTask = (task: PlanTask) => ({ ...task, ...isoDates(task), description: task.description.trim() });
const storedActivities = (activities: PlanActivity[]) => activities
  .filter(activity => activity.description.trim())
  .map(activity => ({ ...activity, ...isoDates(activity), description: activity.description.trim(), subtasks: activity.subtasks.filter(task => task.description.trim()).map(storedTask) }));
const orgDefaults = { name: "", kind: "Empresa", document: "", sector: "", size: "", maturity: "", region: "", contact: "", email: "", phone: "", address: "", stage: "ProspecÃ§Ã£o", demand: "", referral: "", notes: "" };
const actorDefaults = { institution_type: "", document: "", institution_name: "", phone: "", address: "", actor_name: "", position: "", birth_date: "", email: "" };
function Editor({ kind, row, userId, userName, organizations, actors, coordinationParticipants, agentChoices, onClose, onChangePassword, onSaved, onError }: { kind: "activity" | "strategy" | "organization" | "actor" | "profile" | "password"; row: ActivityRow | StrategyAction | Organization | Actor | Profile | null; userId: string; userName: string; organizations: Organization[]; actors: Actor[]; coordinationParticipants: CoordinationParticipant[]; agentChoices: AgentChoice[]; onClose: () => void; onChangePassword: () => void; onSaved: (message?: string) => void; onError: (message: string) => void }) {
  const changePassword = useServerFn(changeOwnPassword);
  const initial = kind === "activity" ? activityDefaults : kind === "strategy" ? strategyDefaults : kind === "organization" ? orgDefaults : kind === "actor" ? actorDefaults : kind === "profile" ? { full_name: userName, phone: "", governance: "", region: "" } : { current_password: "", new_password: "", confirm_password: "" };
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initial).map(([k, v]) => { const raw = row && k in row ? String((row as unknown as Record<string, unknown>)[k] ?? "") : String(v); return [k, dateFieldKeys.includes(k) ? isoToBrDate(raw) : raw]; })));
  const [outcomes, setOutcomes] = useState<Outcome[]>(() => (kind === "activity" || kind === "strategy") && row && "outcomes" in row ? normalizeOutcomes(row.outcomes) : []);
  const [planResults, setPlanResults] = useState<PlanResultEntry[]>(() => kind === "strategy" && row && "expected_results" in row ? normalizeResults(row.expected_results) : []);
  const [planActivities, setPlanActivities] = useState<PlanActivity[]>(() => kind === "strategy" && row && "activities" in row ? normalizeActivities(row.activities) : []);
  const [files, setFiles] = useState<File[]>([]); const [savedEvidence, setSavedEvidence] = useState<string[]>(() => kind === "activity" && row && "evidence" in row && Array.isArray(row.evidence) ? row.evidence.filter((x): x is string => typeof x === "string") : []);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [indicators, setIndicators] = useState<string[]>(() => kind === "activity" && row && "indicators" in row && Array.isArray(row.indicators) ? row.indicators.filter((x): x is string => typeof x === "string") : []);
  const [participantAgents, setParticipantAgents] = useState<string[]>(() => kind === "activity" && row && "participant_agents" in row && Array.isArray(row.participant_agents) ? row.participant_agents.filter(id => agentChoices.some(choice => choice.user_id === id)) : []);
  // Which entry of the plan this row details. Kept apart from `values` because they are not free
  // text fields: they name an action and one of its activities, and the form refuses to save a
  // plan activity without both.
   const isConcluded = values['status'] === "ConcluÃ­da";
  const set = (key: string, value: string) => setValues(v => ({ ...v, [key]: value }));
  useEffect(() => { if (!savedEvidence.length) return; let cancelled = false; Promise.all(savedEvidence.map(async path => { const { data } = await supabase.storage.from("ari-evidence").createSignedUrl(path, 3600); return [path, data?.signedUrl || ""] as const; })).then(pairs => { if (!cancelled) setPreviewUrls(Object.fromEntries(pairs)); }); return () => { cancelled = true; }; }, [savedEvidence]);
  const isMeeting = values['kind']?.includes("Reuni") || values['kind']?.includes("reuni"); const isOrganizer = values['kind'] === "Evento como organizador";
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setMessage("");
    try {
      if (kind === "password") {
        const currentPassword = values['current_password'] || "";
        const newPassword = values['new_password'] || "";
        const confirmPassword = values['confirm_password'] || "";
        if (!currentPassword) throw new Error("Informe a senha atual.");
        if (newPassword.length < 6) throw new Error("A nova senha deve ter pelo menos 6 caracteres.");
        if (newPassword === currentPassword) throw new Error("A nova senha deve ser diferente da senha atual.");
        if (newPassword !== confirmPassword) throw new Error("A confirmaÃ§Ã£o nÃ£o corresponde Ã  nova senha.");
        await changePassword({ data: { currentPassword, newPassword } });
        setValues({ current_password: "", new_password: "", confirm_password: "" });
        onSaved("Senha alterada com sucesso. Use a nova senha no prÃ³ximo acesso.");
        return;
      }
      if (kind === "profile") { const { data, error } = await supabase.from("profiles").update({ full_name: (values['full_name'] || "").trim(), phone: values['phone'] || "", governance: values['governance'] || "", region: values['region'] || "" }).eq("id", userId).select().maybeSingle(); if (error) throw error; if (!data) throw new Error("NÃ£o foi possÃ­vel salvar o perfil: nenhuma linha foi alterada. Sua conta pode nÃ£o ter permissÃ£o para esta alteraÃ§Ã£o."); }
      if (kind === "organization") { const owner = row && "owner_id" in row ? row.owner_id : userId; confirmed(row ? await supabase.from("organizations").update({ ...orgDefaults, ...values }).eq("id", row.id).select().maybeSingle() : await supabase.from("organizations").insert({ ...orgDefaults, ...values, owner_id: owner }).select().single(), "a organizaÃ§Ã£o"); }
      if (kind === "actor") { const owner = row && "owner_id" in row ? row.owner_id : userId; const data = { ...actorDefaults, ...values, birth_date: toIsoDate(values['birth_date'] || "", dateLabels['birth_date'] || "Data de nascimento") }; confirmed(row ? await supabase.from("actors").update(data).eq("id", row.id).select().maybeSingle() : await supabase.from("actors").insert({ ...data, owner_id: owner }).select().single(), "o ator da governanÃ§a"); }
      if (kind === "activity") {
        const evidence = [...savedEvidence];
        for (const file of files) { const path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`; const { error } = await supabase.storage.from("ari-evidence").upload(path, file); if (error) throw error; evidence.push(path); }
         const startDate = toIsoDate(values['start_date'] || "", isMeeting ? "Data da reuniÃ£o" : "Data de inÃ­cio"); const endDate = toIsoDate(values['end_date'] || "", "Data de conclusÃ£o");
         const payload = { ...activityDefaults, ...values, title: values['kind'] === "ReuniÃ£o de governanÃ§a" || values['kind'] === "ReuniÃ£o com a coordenaÃ§Ã£o" ? `${values['kind']}${startDate ? ` - ${formatDate(startDate)}` : ""}` : values['title'] || "", start_date: startDate, end_date: endDate, organization_id: values['kind'] === "ReuniÃ£o de governanÃ§a" || values['kind'] === "ReuniÃ£o com a coordenaÃ§Ã£o" || values['kind'] === "Evento como ouvinte" ? null : values['organization_id'] || null, agenda: values['kind'] === "ReuniÃ£o de governanÃ§a" ? "" : values['agenda'] || "", axis: values['axis'] || "", owner_id: row && "owner_id" in row ? row.owner_id : userId, outcomes: outcomes.map(outcome => ({ ...outcome, ...isoDates(outcome), activities: outcome.activities.map(activity => isoDates(activity)) })) as unknown as Json, indicators, participant_agents: participantAgents, evidence: evidence as Json, updated_at: new Date().toISOString() };
        confirmed(row ? await supabase.from("activities").update(payload).eq("id", row.id).select().maybeSingle() : await supabase.from("activities").insert(payload).select().single(), "a atividade");
      }
      if (kind === "strategy") {
        // The axis is a NOT NULL column guarded by a catalog CHECK, and the select always
        // offers an empty option, so the empty case has to be refused before it reaches the
        // database with an error message nobody can act on.
        const axis = (values['axis'] || "").trim();
        if (!axis) throw new Error("Selecione o eixo da atividade.");
        if (!axes.includes(axis)) throw new Error("Eixo da atividade invÃ¡lido.");
        const payload = { ...strategyDefaults, ...values, axis, expected_results: planResults.filter(result => result.description.trim()).map(result => ({ description: result.description.trim() })) as unknown as Json, activities: storedActivities(planActivities) as unknown as Json, owner_id: row && "owner_id" in row ? row.owner_id : userId, updated_at: new Date().toISOString() };
        confirmed(row ? await supabase.from("strategy_actions").update(payload).eq("id", row.id).select().maybeSingle() : await supabase.from("strategy_actions").insert(payload).select().single(), "a aÃ§Ã£o do plano de estratÃ©gias");
      }
      onSaved();
    } catch (error) { const text = error instanceof Error ? error.message : "Erro ao salvar registro."; setMessage(text); onError(text); } finally { setBusy(false); }
  }
  const f = (label: string, name: string, opts?: { type?: string; options?: (string | { value: string; label: string })[]; textarea?: boolean; required?: boolean; mask?: (value: string) => string }) => field(label, name, values[name] || "", set, opts);
  const title = kind === "activity" ? "atividade" : kind === "strategy" ? "aÃ§Ã£o do plano" : kind === "organization" ? "organizaÃ§Ã£o" : kind === "actor" ? "ator da governanÃ§a" : kind === "profile" ? "perfil" : "senha";
  return <div className="fixed inset-0 z-50 bg-foreground/50 flex justify-end" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label={`${row ? "Editar" : "Novo"} ${title}`} className="bg-background w-full max-w-2xl h-full flex flex-col shadow-xl"><div className="bg-card border-b px-5 md:px-7 py-5 flex items-center justify-between"><div><h2 className="text-xl font-bold">{kind === "profile" ? "Meu perfil" : kind === "password" ? "Trocar senha" : `${row ? "Editar" : "Novo"} ${title}`}</h2><p className="text-xs text-muted-foreground mt-1">{kind === "activity" || kind === "strategy" ? "Preencha os detalhes e registre os resultados." : kind === "password" ? "Confirme sua senha atual para definir uma nova." : "Preencha as informaÃ§Ãµes abaixo."}</p></div><Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}><X /></Button></div><form id="editor-form" onSubmit={submit} className="flex-1 overflow-y-auto px-5 md:px-7 py-6 space-y-6">
  {kind === "profile" && <><div className="grid sm:grid-cols-2 gap-4">{f("Nome completo", "full_name", { required: true })}{f("Telefone", "phone", { type: "tel", mask: phoneMask })}{f("RegiÃ£o atendida", "region")}{f("GovernanÃ§a atendida", "governance")}</div><div className="border-t pt-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">SeguranÃ§a</h3><p className="text-xs text-muted-foreground mt-1">Atualize a senha usada para entrar no sistema.</p></div><Button type="button" variant="outline" onClick={onChangePassword}><KeyRound /> Trocar senha</Button></div></>}
  {kind === "password" && <><div className="app-panel p-4 flex gap-3"><KeyRound className="shrink-0 mt-0.5" size={18} /><p className="text-sm text-muted-foreground">Escolha uma senha de pelo menos 6 caracteres que vocÃª nÃ£o utilize em outros serviÃ§os.</p></div><div className="space-y-4">{f("Senha atual", "current_password", { type: "password", required: true })}{f("Nova senha", "new_password", { type: "password", required: true })}{f("Confirmar nova senha", "confirm_password", { type: "password", required: true })}</div></>}
  {kind === "organization" && <><div className="grid sm:grid-cols-2 gap-4">{f("Nome da organizaÃ§Ã£o", "name", { required: true })}{f("Tipo", "kind", { options: ["Empresa", "Startup", "Universidade", "ICT", "Entidade de apoio", "Poder pÃºblico", "Outro"] })}{f("CNPJ / CPF", "document", { mask: documentMask })}{f("Setor", "sector")}{f("Porte", "size", { options: ["Micro", "Pequeno", "MÃ©dio", "Grande", "NÃ£o se aplica"] })}{f("Maturidade em inovaÃ§Ã£o", "maturity", { options: ["Inicial", "Em desenvolvimento", "Consolidada"] })}{f("RegiÃ£o", "region")}{f("Etapa do atendimento", "stage", { options: stages })}{f("Pessoa de contato", "contact")}{f("E-mail", "email", { type: "email" })}{f("Telefone", "phone", { type: "tel", mask: phoneMask })}{f("EndereÃ§o", "address")}</div>{f("Demandas", "demand", { textarea: true })}{f("Encaminhamentos", "referral", { textarea: true })}{f("ObservaÃ§Ãµes / histÃ³rico", "notes", { textarea: true })}</>}
  {kind === "actor" && <><div className="grid sm:grid-cols-2 gap-4">{f("Tipo de instituiÃ§Ã£o", "institution_type", { options: ["Empresa", "Universidade", "Governo", "Entidade de apoio", "ICT", "Outro"] })}{f("CNPJ / CPF", "document", { mask: documentMask })}{f("Nome da instituiÃ§Ã£o", "institution_name", { required: true })}{f("Telefone", "phone", { type: "tel", mask: phoneMask })}{f("EndereÃ§o", "address")}{f("Nome do ator", "actor_name", { required: true })}{f("Cargo", "position")}{f("Data de nascimento", "birth_date", { mask: dateMask })}{f("E-mail", "email", { type: "email" })}</div></>}
  {kind === "strategy" && <><h3 className="font-bold border-b pb-2">Plano de estratÃ©gias</h3><div className="grid sm:grid-cols-2 gap-4">{f("Eixo da atividade", "axis", { options: axes, required: true })}{f("Status", "status", { options: statuses, required: true })}</div>{f("DescriÃ§Ã£o da atividade", "description", { textarea: true })}<div className="grid sm:grid-cols-2 gap-4">{f("Problema", "problem")}{f("SoluÃ§Ã£o", "solution")}</div>{f("DescriÃ§Ã£o do problema", "problem_description", { textarea: true })}{f("DescriÃ§Ã£o da soluÃ§Ã£o", "solution_description", { textarea: true })}<ResultsEditor results={planResults} onChange={setPlanResults} /><ActivitiesEditor activities={planActivities} onChange={setPlanActivities} /></>}
   {kind === "activity" && <><div className="grid sm:grid-cols-2 gap-4">{f("Tipo de atividade", "kind", { options: activityKinds })}{values['kind'] !== "ReuniÃ£o de governanÃ§a" && values['kind'] !== "ReuniÃ£o com a coordenaÃ§Ã£o" && values['kind'] !== "Evento como ouvinte" && f("Status", "status", { options: statuses })}{values['kind'] !== "ReuniÃ£o de governanÃ§a" && values['kind'] !== "ReuniÃ£o com a coordenaÃ§Ã£o" && f(isMeeting ? "TÃ­tulo da reuniÃ£o" : "TÃ­tulo da atividade", "title", { required: true })}{values['kind'] !== "ReuniÃ£o de governanÃ§a" && values['kind'] !== "ReuniÃ£o com a coordenaÃ§Ã£o" && values['kind'] !== "Evento como ouvinte" && f("OrganizaÃ§Ã£o vinculada", "organization_id", { options: organizations.map(o => ({ value: o.id, label: o.name })) })}</div><div className="grid sm:grid-cols-2 gap-4">{f(isMeeting ? "Data da reuniÃ£o" : "Data de inÃ­cio", "start_date", { mask: dateMask })}{!isMeeting && f("Data de conclusÃ£o", "end_date", { mask: dateMask })}</div>{isConcluded && <fieldset className="border-t pt-5"><legend className="text-sm font-bold">Indicadores relacionados</legend><p className="text-xs text-muted-foreground mt-1 mb-3">Marque todos os indicadores que esta atividade contribuiu para realizar.</p><div className="grid sm:grid-cols-2 gap-2">{indicatorCatalog.map(item => <label key={item.code} className="flex items-start gap-2.5 border rounded-md p-2.5 cursor-pointer hover:bg-muted/50"><Checkbox checked={indicators.includes(item.code)} onCheckedChange={checked => setIndicators(current => checked === true ? [...current, item.code] : current.filter(code => code !== item.code))} aria-label={item.code} /><span className="text-sm leading-snug min-w-0"><b>{item.code}</b><span className="block text-xs text-muted-foreground">{item.label}</span></span></label>)}</div></fieldset>}{!isMeeting && f("DescriÃ§Ã£o", "description", { textarea: true })}
     {isMeeting && <>{f("Objetivos da reuniÃ£o", "objectives", { textarea: true })}{values['kind'] !== "ReuniÃ£o de governanÃ§a" && f("Pauta debatida", "agenda", { textarea: true })}{values['kind'] === "ReuniÃ£o de governanÃ§a" ? <ParticipantSelector actors={actors} value={values['participants'] || ""} onChange={value => set("participants", value)} /> : values['kind'] === "ReuniÃ£o com a coordenaÃ§Ã£o" ? <CoordinationParticipantSelector users={coordinationParticipants} value={values['participants'] || ""} onChange={value => set("participants", value)} /> : f("Participantes", "participants", { textarea: true })}{values['kind'] === "ReuniÃ£o de governanÃ§a" && f("Atividades do plano de aÃ§Ãµes discutidas", "work_done", { textarea: true })}{f("Encaminhamentos", "referrals", { textarea: true })}</>}{!isMeeting && <>{isOrganizer && f("Atividades realizadas", "work_done", { textarea: true })}{f("Objetivos", "objectives", { textarea: true })}</>}{f("Resultados esperados", "expected_results", { textarea: true })}{f("Resultados alcanÃ§ados", "achieved_results", { textarea: true })}
    <fieldset className="border-t pt-5"><legend className="text-sm font-bold">Agentes participantes</legend><p className="text-xs text-muted-foreground mt-1 mb-3">Marque os agentes que tambÃ©m passam a ver esta atividade nos registros deles.</p><div className="max-h-56 overflow-y-auto rounded-md border bg-card p-2">{agentChoices.filter(choice => choice.user_id !== userId).length ? agentChoices.filter(choice => choice.user_id !== userId).map(agent => <label key={agent.user_id} className="flex cursor-pointer items-start gap-3 rounded px-3 py-2.5 hover:bg-muted"><input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={participantAgents.includes(agent.user_id)} onChange={() => setParticipantAgents(current => current.includes(agent.user_id) ? current.filter(id => id !== agent.user_id) : [...current, agent.user_id])} /><span className="min-w-0"><span className="block text-sm font-medium">{agent.full_name}</span></span></label>) : <p className="px-3 py-4 text-sm text-muted-foreground">Nenhum outro agente cadastrado.</p>}</div></fieldset><div className="border-t pt-5"><h3 className="font-bold">EvidÃªncias</h3><p className="text-xs text-muted-foreground mt-1 mb-3">AtÃ© trÃªs imagens, com no mÃ¡ximo 10 MB por arquivo.</p><label className="flex gap-2 items-center border border-dashed rounded-md p-4 text-sm cursor-pointer hover:bg-muted"><Paperclip size={17} /> Selecionar imagens<input type="file" accept="image/*" multiple className="sr-only" onChange={e => { const selected = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024); if (selected.length + savedEvidence.length > 3) setMessage("SÃ£o permitidas atÃ© trÃªs imagens por atividade."); else { setFiles(selected); setMessage(""); } }} /></label>{files.length > 0 && <div className="grid grid-cols-3 gap-3 mt-3">{files.map((file, i) => <div key={file.name} className="relative"><img src={URL.createObjectURL(file)} alt={file.name} className="w-full aspect-square rounded object-cover border" /><Button type="button" variant="destructive" size="icon" title="Remover imagem selecionada" className="absolute right-1 top-1 h-6 w-6" onClick={() => setFiles(files.filter((_, idx) => idx !== i))}><X /></Button><p className="truncate text-[11px] text-muted-foreground mt-1">{file.name}</p></div>)}</div>}{savedEvidence.length > 0 && <div className="grid grid-cols-3 gap-3 mt-3">{savedEvidence.map(path => <div key={path} className="relative">{previewUrls[path] ? <a href={previewUrls[path]} target="_blank" rel="noreferrer"><img src={previewUrls[path]} alt="EvidÃªncia da atividade" className="w-full aspect-square rounded object-cover border" /></a> : <div className="w-full aspect-square rounded border bg-muted animate-pulse flex items-center justify-center text-xs text-muted-foreground">Carregando...</div>}<Button type="button" variant="destructive" size="icon" title="Remover evidÃªncia" className="absolute right-1 top-1 h-6 w-6" onClick={() => setSavedEvidence(savedEvidence.filter(x => x !== path))}><X /></Button></div>)}</div>}</div></>}
  {message && <p role="alert" className="bg-secondary text-primary text-sm p-3 rounded">{message}</p>}
</form><div className="bg-card border-t p-4 md:px-7 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form="editor-form" disabled={busy}>{busy ? "Salvando..." : kind === "password" ? "Alterar senha" : "Salvar registro"}</Button></div></div></div>;
}

// The expected-results editor is shared by the strategy-plan actions and by the legacy plan
// activities, so both keep the same result / linked-activity structure and the same
// dd/mm/yyyy handling described in isoToBrDate.
function OutcomesEditor({ outcomes, onChange }: { outcomes: Outcome[]; onChange: (next: Outcome[]) => void }) {
  return <><div className="border-t pt-4 flex flex-wrap justify-between items-center gap-2"><h3 className="font-bold">Resultados esperados</h3><Button type="button" variant="outline" size="sm" onClick={() => onChange([...outcomes, { title: "", status: "NÃ£o iniciada", start_date: "", end_date: "", activities: [] }])}><Plus /> Inserir resultado</Button></div>{outcomes.map((outcome, i) => <div key={i} className="app-panel p-4 space-y-3"><div className="flex justify-between items-center"><b className="text-sm">Resultado {i + 1}</b><Button type="button" variant="ghost" size="icon" aria-label="Remover resultado" onClick={() => onChange(outcomes.filter((_, index) => index !== i))}><Trash2 /></Button></div>{field("Resultado esperado", "title", outcome.title, (_, v) => onChange(outcomes.map((x, j) => j === i ? { ...x, title: v } : x)))}<div className="grid sm:grid-cols-3 gap-3">{([ ["Status", "status", "select"], ["InÃ­cio", "start_date", "date"], ["ConclusÃ£o", "end_date", "date"] ] as const).map(([label, key, type]) => field(label, key, outcome[key], (_, v) => onChange(outcomes.map((x, j) => j === i ? { ...x, [key]: v } : x)), type === "select" ? { options: statuses } : { mask: dateMask }))}</div><div className="border-t pt-3 flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-bold">Atividades vinculadas</h4><Button type="button" variant="outline" size="sm" onClick={() => onChange(outcomes.map((x, j) => j === i ? { ...x, activities: [...x.activities, emptyLinkedActivity()] } : x))}><Plus /> Adicionar atividade</Button></div>{outcome.activities.map((activity, activityIndex) => <div key={activityIndex} className="border-l-2 border-primary bg-muted/40 p-3 space-y-3"><div className="flex items-center justify-between"><span className="text-xs font-bold text-muted-foreground">Atividade {activityIndex + 1}</span><Button type="button" variant="ghost" size="icon" aria-label={`Remover atividade ${activityIndex + 1}`} onClick={() => onChange(outcomes.map((x, j) => j === i ? { ...x, activities: x.activities.filter((_, k) => k !== activityIndex) } : x))}><Trash2 /></Button></div>{field("DescriÃ§Ã£o da atividade", "description", activity.description, (_, v) => onChange(outcomes.map((x, j) => j === i ? { ...x, activities: x.activities.map((a, k) => k === activityIndex ? { ...a, description: v } : a) } : x)), { textarea: true })}<div className="grid sm:grid-cols-3 gap-3">{([ ["Status", "status", "select"], ["Data de inÃ­cio", "start_date", "date"], ["Data de conclusÃ£o", "end_date", "date"] ] as const).map(([label, key, type]) => field(label, key, activity[key], (_, v) => onChange(outcomes.map((x, j) => j === i ? { ...x, activities: x.activities.map((a, k) => k === activityIndex ? { ...a, [key]: v } : a) } : x)), type === "select" ? { options: statuses } : { mask: dateMask }))}</div></div>)}</div>)}</>;
}

/**
 * The editor for the expected results of a strategy-plan action. An action holds more than one
 * and a result is only a description, so there is no status and no period to fill in here.
 */
function ResultsEditor({ results, onChange }: { results: PlanResultEntry[]; onChange: (next: PlanResultEntry[]) => void }) {
  const edit = (i: number, description: string) => onChange(results.map((item, index) => index === i ? { description } : item));
  return <><div className="border-t pt-4 flex flex-wrap justify-between items-center gap-2"><div><h3 className="font-bold">Resultados esperados</h3><p className="text-xs text-muted-foreground mt-1">Registre cada resultado esperado desta aÃ§Ã£o.</p></div><Button type="button" variant="outline" size="sm" onClick={() => onChange([...results, { description: "" }])}><Plus /> Inserir resultado</Button></div>{results.map((result, i) => <div key={i} className="app-panel p-4"><div className="flex justify-between items-start gap-3"><div className="min-w-0 flex-1"><span className="app-label">Resultado {i + 1}</span>{field("DescriÃ§Ã£o", `result-${i}`, result.description, (_, v) => edit(i, v), { textarea: true })}</div><Button type="button" variant="ghost" size="icon" aria-label={`Remover resultado ${i + 1}`} onClick={() => onChange(results.filter((_, index) => index !== i))}><Trash2 /></Button></div></div>)}</>;
}

/**
 * The editor for the activities of a strategy-plan action, inside the action's own modal. It is the
 * very same list the plan page writes inline â€” activity by activity, each one with its subtasks â€”
 * so a task entered here and one entered there end up in the same place and count the same way.
 */
function ActivitiesEditor({ activities, onChange }: { activities: PlanActivity[]; onChange: (next: PlanActivity[]) => void }) {
  return <><div className="border-t pt-4"><div className="flex flex-wrap justify-between items-center gap-2"><div><h3 className="font-bold">Atividades</h3><p className="text-xs text-muted-foreground mt-1">Registre as atividades que compÃµem esta aÃ§Ã£o e, se quiser, as subtarefas de cada uma.</p></div></div></div><PlanActivities activities={activities} onChange={onChange} /></>;
}

function ParticipantSelector({ actors, value, onChange }: { actors: Actor[]; value: string; onChange: (value: string) => void }) {
  const selected = value.split("\n").map(name => name.trim()).filter(Boolean);
  const toggle = (name: string) => onChange(selected.includes(name) ? selected.filter(item => item !== name).join("\n") : [...selected, name].join("\n"));
  return <fieldset className="min-w-0"><legend className="app-label">Participantes</legend><div className="max-h-56 overflow-y-auto rounded-md border bg-card p-2">{actors.length ? actors.map(actor => <label key={actor.id} className="flex cursor-pointer items-start gap-3 rounded px-3 py-2.5 hover:bg-muted"><input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={selected.includes(actor.actor_name)} onChange={() => toggle(actor.actor_name)} /><span className="min-w-0"><span className="block text-sm font-medium">{actor.actor_name}</span><span className="block truncate text-xs text-muted-foreground">{actor.institution_name}{actor.position ? ` Â· ${actor.position}` : ""}</span></span></label>) : <p className="px-3 py-4 text-sm text-muted-foreground">Nenhum ator da governanÃ§a cadastrado.</p>}</div></fieldset>;
}

function CoordinationParticipantSelector({ users, value, onChange }: { users: CoordinationParticipant[]; value: string; onChange: (value: string) => void }) {
  const selected = value.split("\n").map(name => name.trim()).filter(Boolean);
  const toggle = (name: string) => onChange(selected.includes(name) ? selected.filter(item => item !== name).join("\n") : [...selected, name].join("\n"));
  return <fieldset className="min-w-0"><legend className="app-label">Participantes</legend><div className="max-h-56 overflow-y-auto rounded-md border bg-card p-2">{users.length ? users.map(user => <label key={user.user_id} className="flex cursor-pointer items-center gap-3 rounded px-3 py-2.5 hover:bg-muted"><input type="checkbox" className="h-4 w-4 accent-primary" checked={selected.includes(user.full_name)} onChange={() => toggle(user.full_name)} /><span className="min-w-0 text-sm font-medium">{user.full_name}</span></label>) : <p className="px-3 py-4 text-sm text-muted-foreground">Nenhum usuÃ¡rio disponÃ­vel para seleÃ§Ã£o.</p>}</div></fieldset>;
}

const MAX_PDFS = 20;
const MAX_PDF_BYTES = 30 * 1024 * 1024;
const MAX_MD_BYTES = 512 * 1024;

/**
 * The title an imported row will end up with. The review list and the duplicate
 * check have to use the same rule as the insert, otherwise a generated title such
 * as "Plano de estratÃ©gias - Eixo ..." would hide the duplicate of the next import.
 */
function importedTitle(row: ImportRow): string {
  const isMeeting = row.kind.includes("Reuni");
  if (isMeeting && (!row.title || row.title === row.kind)) return `${row.kind}${row.startDate ? ` - ${row.startDate}` : ""}`;
  return row.title || row.kind;
}

function ImportModal({ onClose, userId, activities, organizations, onDone }: { onClose: () => void; userId: string; activities: ActivityRow[]; organizations: Organization[]; onDone: (message: string) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [swap, setSwap] = useState(false);
  const [summary, setSummary] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [text, setText] = useState("");
  const [orgPick, setOrgPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ ok: number; failed: { title: string; reason: string }[] } | null>(null);
  // PostgREST rejects with a plain object, not an Error, so the message has to be read out by hand.
  const reason = (value: unknown): string => value instanceof Error ? value.message : typeof value === "object" && value !== null && "message" in value ? String((value as { message: unknown }).message) : String(value);
  const known = useMemo(() => new Set(activities.map(a => dedupeKey(a.title, a.start_date ? isoToBrDate(a.start_date) : ""))), [activities]);
  const chosen = rows.filter(row => row.include);
  const patch = (id: string, part: Partial<ImportRow>) => setRows(rows.map(row => row.id === id ? { ...row, ...part } : row));
  const edit = (id: string) => (name: string, value: string) => patch(id, { [name]: value } as Partial<ImportRow>);
  const isDuplicate = (row: ImportRow) => row.duplicate || known.has(dedupeKey(importedTitle(row), row.startDate));

  const read = async () => {
    setBusy(true); setMessage(""); setResult(null); setSummary("");
    try {
      const out = await importFiles(files, swap, activityKinds, statuses);
      // A row that already exists in the database arrives unchecked, so re-importing
      // the same report cannot create duplicates by accident.
      const prepared = out.rows.map(row => (known.has(dedupeKey(importedTitle(row), row.startDate)) ? { ...row, include: false } : row));
      setRows(prepared); setOrgPick({}); setText(out.text);
      const parts = [`Li ${out.pages} pÃ¡gina(s) de ${out.files} arquivo(s) e encontrei ${out.rows.length} atividade(s).`];
      if (out.dropped.length) parts.push(`Ignorei ${out.dropped.length} tÃ­tulo(s)/seÃ§Ã£o(Ãµes) fora de um registro: ${out.dropped.slice(0, 5).map(item => `"${item.slice(0, 40)}"`).join(", ")}${out.dropped.length > 5 ? ", â€¦" : ""}.`);
      if (out.orphanBlocks) parts.push(`${out.orphanBlocks} trecho(s) sem data nÃ£o entraram na lista.`);
      setSummary(parts.join(" "));
      if (!out.rows.length) setMessage("NÃ£o encontrei nenhuma linha com data. Confira se o arquivo segue o modelo em public/modelos/atividades.md.");
    } catch (error) { setMessage(`NÃ£o consegui ler o arquivo: ${error instanceof Error ? error.message : "erro desconhecido"}`); }
    finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setMessage("");
    const failed: { title: string; reason: string }[] = [];
    let ok = 0;
    for (const row of chosen) {
      const isMeeting = row.kind.includes("Reuni");
      try {
        if (!activityKinds.includes(row.kind)) throw new Error("escolha um tipo de atividade na lista");
        if (!statuses.includes(row.status)) throw new Error("escolha um status na lista");
        const startDate = toIsoDate(row.startDate, "Data de inÃ­cio");
        const endDate = toIsoDate(row.endDate, "Data de conclusÃ£o");
        const title = importedTitle(row);
        confirmed(await supabase.from("activities").insert({
          ...activityDefaults,
          kind: row.kind,
          title,
          description: row.description,
          objectives: row.objectives,
          expected_results: row.expectedResults,
          achieved_results: row.achievedResults,
          status: row.status,
          axis: "",
          start_date: startDate,
          end_date: endDate,
          organization_id: isMeeting || row.kind === "Evento como ouvinte" ? null : orgPick[row.id] || null,
          owner_id: userId,
          outcomes: [] as unknown as Json,
          evidence: [] as unknown as Json,
          updated_at: new Date().toISOString(),
        }).select().single(), "a atividade importada");
        ok++;
      } catch (error) { failed.push({ title: row.title, reason: reason(error) }); }
    }
    setBusy(false);
    setResult({ ok, failed });
    if (ok) onDone(`${ok} atividade(s) importada(s).`);
  };

  return <div className="fixed inset-0 z-50 bg-foreground/50 flex justify-end" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label="Importar relatÃ³rios em Markdown" className="bg-background w-full max-w-4xl h-full flex flex-col shadow-xl"><div className="bg-card border-b px-5 md:px-7 py-5 flex items-center justify-between"><div><h2 className="text-xl font-bold">Importar relatÃ³rios em Markdown</h2><p className="text-xs text-muted-foreground mt-1">Cadastre atividades a partir de relatÃ³rios em Markdown. Nada Ã© gravado antes da sua conferÃªncia.</p></div><Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}><X /></Button></div>
  <div className="flex-1 overflow-y-auto px-5 md:px-7 py-6 space-y-5">
    <div className="app-panel p-4 space-y-3">
      <label className="flex gap-2 items-center border border-dashed rounded-md p-4 text-sm cursor-pointer hover:bg-muted"><Upload size={17} /> Selecionar relatÃ³rios em Markdown<input type="file" accept=".md,.markdown,text/markdown,text/plain" multiple className="sr-only" onChange={e => { const picked = Array.from(e.target.files || []); const bad = picked.filter(file => !/\.(md|markdown|txt)$/i.test(file.name) && file.type !== "text/markdown" && file.type !== "text/plain"); if (bad.length) setMessage(`"${bad[0]?.name ?? "arquivo"}" nÃ£o Ã© um arquivo Markdown ou texto.`); const good = picked.filter(file => !bad.includes(file) && file.size <= MAX_PDF_BYTES); if (picked.length - bad.length > MAX_PDFS) setMessage(`Selecione no mÃ¡ximo ${MAX_PDFS} arquivos por vez.`); setFiles(good.slice(0, MAX_PDFS)); setRows([]); setResult(null); }} /></label>
      {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} arquivo(s): {files.map(pdf => pdf.name).join(", ")}</p>}
      <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">OpÃ§Ãµes de leitura</summary><div className="mt-3 space-y-3">
        <label className="flex items-start gap-2.5"><input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={swap} onChange={e => setSwap(e.target.checked)} /><span className="text-sm">Datas no formato <b>mm/dd/aaaa</b><span className="block text-xs text-muted-foreground">Marque apenas se o relatÃ³rioexports o dia e o mÃªs invertidos. Datas impossÃ­veis sÃ£o corrigidas sozinhas.</span></span></label>
      </div></details>
      <Button disabled={!files.length || busy} onClick={read}><FileText /> {rows.length ? "Releer os arquivos" : "Extrair atividades"}</Button>
      {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
    </div>
    {rows.length > 0 && <>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm"><b>{rows.length}</b> atividade(s) encontradas, <b>{chosen.length}</b> marcada(s) para importar.</p><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setRows(rows.map(row => ({ ...row, include: !row.include })))}>Inverter seleÃ§Ã£o</Button><Button variant="outline" size="sm" onClick={() => setRows(rows.map(row => ({ ...row, include: !isDuplicate(row) })))}>Marcar nÃ£o duplicadas</Button></div></div>
      <div className="space-y-3">{rows.map(row => { const duplicate = isDuplicate(row); return <div key={row.id} className={`app-panel p-4 ${row.include ? "" : "opacity-60"}`}>
        <div className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary" aria-label={`Importar ${row.title}`} checked={row.include} onChange={e => patch(row.id, { include: e.target.checked })} /><div className="min-w-0 flex-1 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            {field("Data de inÃ­cio", "startDate", row.startDate, edit(row.id), { mask: dateMask })}
            {field("Data de conclusÃ£o", "endDate", row.endDate, edit(row.id), { mask: dateMask })}
            {field("TÃ­tulo", "title", row.title, edit(row.id))}
            {field("Tipo de Atividade", "kind", row.kind, edit(row.id), { options: activityKinds })}
            {field("Status", "status", row.status, edit(row.id), { options: statuses })}
            {field("OrganizaÃ§Ã£o vinculada", "organization_id", orgPick[row.id] || "", (name, value) => setOrgPick({ ...orgPick, [row.id]: value }), { options: [{ value: "", label: "Nenhuma" }, ...organizations.map(org => ({ value: org.id, label: org.name }))] })}
          </div>
          {field("DescriÃ§Ã£o da Atividade", "description", row.description, edit(row.id), { textarea: true })}
          {field("Objetivos", "objectives", row.objectives, edit(row.id), { textarea: true })}
          {field("Resultados Esperados", "expectedResults", row.expectedResults, edit(row.id), { textarea: true })}
          {field("Resultados AlcanÃ§ados", "achievedResults", row.achievedResults, edit(row.id), { textarea: true })}
          {duplicate && <p className="text-xs text-primary flex items-center gap-1.5"><Check size={13} /> JÃ¡ existe uma atividade com este tÃ­tulo e data â€” desmarcada para nÃ£o duplicar.</p>}
          {row.notes.length > 0 && <ul className="text-xs text-muted-foreground space-y-0.5">{row.notes.map(note => <li key={note}>â€¢ {note}</li>)}</ul>}
        </div><Button variant="ghost" size="icon" aria-label={`Descartar ${row.title}`} onClick={() => setRows(rows.filter(item => item.id !== row.id))}><Trash2 /></Button></div>
      </div>; })}</div>
    </>}
    {text && <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Texto bruto extraÃ­do dos arquivos</summary><pre className="mt-2 max-h-64 overflow-auto text-xs bg-muted/50 rounded p-3 whitespace-pre-wrap break-words">{text}</pre></details>}
    {result && <div className="app-panel p-4 space-y-2"><p className="text-sm"><b>{result.ok}</b> atividade(s) cadastrada(s).</p>{result.failed.length > 0 && <div><p className="text-sm text-primary"><b>{result.failed.length}</b> nÃ£o foram importadas:</p><ul className="text-xs text-muted-foreground mt-1 space-y-0.5">{result.failed.map((item, i) => <li key={i}>â€¢ {item.title}: {item.reason}</li>)}</ul></div>}</div>}
    {message && <p role="alert" className="bg-secondary text-primary text-sm p-3 rounded">{message}</p>}
  </div>
  <div className="bg-card border-t p-4 md:px-7 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Fechar</Button><Button disabled={!chosen.length || busy} onClick={save}>{busy && !rows.length ? "Extraindo..." : busy ? "Importando..." : `Importar ${chosen.length} atividade(s)`}</Button></div>
</div></div>;
}

/** Draft shape read from the Markdown plan, before the dates are stored as ISO. */
type ImportedPlanActivity = StrategyPlanImportRow["activities"][number];

function StrategyImportModal({ onClose, userId, actions, onDone }: { onClose: () => void; userId: string; actions: StrategyAction[]; onDone: (message: string) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<StrategyPlanImportRow[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ ok: number; failed: { title: string; reason: string }[] } | null>(null);
  const fallbackStatus = statuses[0] || "";
  // PostgREST rejects with a plain object, not an Error, so the message has to be read out by hand.
  const reason = (value: unknown): string => value instanceof Error ? value.message : typeof value === "object" && value !== null && "message" in value ? String((value as { message: unknown }).message) : String(value);
  const known = useMemo(() => new Set(actions.map(action => strategyKey(action.axis, action.description))), [actions]);
  const chosen = rows.filter(row => row.include);
  const isDuplicate = (row: StrategyPlanImportRow) => row.duplicate || known.has(strategyKey(row.axis || row.axisGuess, row.description));
  const patch = (id: string, part: Partial<StrategyPlanImportRow>) => setRows(rows.map(row => row.id === id ? { ...row, ...part } : row));
  const edit = (id: string) => (name: string, value: string) => patch(id, { [name]: value } as Partial<StrategyPlanImportRow>);
  const of = (id: string) => rows.find(row => row.id === id)!;
  const patchActivity = (id: string, ai: number, part: Partial<ImportedPlanActivity>) => patch(id, { activities: of(id).activities.map((activity, i) => i === ai ? { ...activity, ...part } : activity) });
  const addActivity = (id: string) => patch(id, { activities: [...of(id).activities, { description: "", status: fallbackStatus, startDate: "", endDate: "" }] });  const dropActivity = (id: string, ai: number) => patch(id, { activities: of(id).activities.filter((_, i) => i !== ai) });
  const patchResult = (id: string, ri: number, value: string) => patch(id, { expectedResults: of(id).expectedResults.map((result, i) => i === ri ? value : result) });
  const addResult = (id: string) => patch(id, { expectedResults: [...of(id).expectedResults, ""] });
  const dropResult = (id: string, ri: number) => patch(id, { expectedResults: of(id).expectedResults.filter((_, i) => i !== ri) });

  const read = async () => {
    setBusy(true); setMessage(""); setResult(null); setSummary("");
    try {
      const out = await readStrategyPlanFiles(files, axes, statuses, known);
      setRows(out.rows); setText(out.text);
      const parts = [`Li ${out.files} arquivo(s) e encontrei ${out.rows.length} aÃ§Ã£o(Ãµes) do plano.`];
      if (out.warnings.length) parts.push(...out.warnings);
      setSummary(parts.join(" "));
      if (!out.rows.length) setMessage("NÃ£o encontrei nenhum rÃ³tulo de eixo neste arquivo. Confira se ele segue o modelo em public/modelos/plano-estrategias.md.");
    } catch (error) { setMessage(`NÃ£o consegui ler o arquivo: ${reason(error)}`); }
    finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setMessage("");
    const failed: { title: string; reason: string }[] = [];
    let ok = 0;
    for (const row of chosen) {
      const label = row.description.slice(0, 60) || row.axisGuess || "aÃ§Ã£o sem descriÃ§Ã£o";
      try {
        if (!axes.includes(row.axis)) throw new Error("escolha um eixo na lista");
        const activities = row.activities
          .filter(activity => activity.description.trim())
          .map(activity => ({
            description: activity.description.trim(),
            status: statuses.includes(activity.status) ? activity.status : fallbackStatus,
            start_date: toIsoDate(activity.startDate, "Data de inÃ­cio"),
            end_date: toIsoDate(activity.endDate, "Data de conclusÃ£o"),
          }));
        // The document lists one expected result per item, and the action stores them all.
        const expectedResults = row.expectedResults.map(result => result.trim()).filter(Boolean);
        confirmed(await supabase.from("strategy_actions").insert({
          axis: row.axis,
          status: statuses.includes(row.status) ? row.status : fallbackStatus,
          description: row.description,
          problem: row.problem,
          problem_description: row.problemDescription,
          solution: row.solution,
          solution_description: row.solutionDescription,
          expected_results: expectedResults.map(description => ({ description })),
          activities: activities as unknown as Json,
          owner_id: userId,
          updated_at: new Date().toISOString(),
        }).select().single(), "a aÃ§Ã£o do plano importada");
        ok++;
      } catch (error) { failed.push({ title: label, reason: reason(error) }); }
    }
    setBusy(false);
    setResult({ ok, failed });
    if (ok) onDone(`${ok} aÃ§Ã£o(Ãµes) do plano importada(s).`);
  };

  return <div className="fixed inset-0 z-50 bg-foreground/50 flex justify-end" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label="Importar plano de estratÃ©gias em Markdown" className="bg-background w-full max-w-4xl h-full flex flex-col shadow-xl"><div className="bg-card border-b px-5 md:px-7 py-5 flex items-center justify-between"><div><h2 className="text-xl font-bold">Importar plano de estratÃ©gias em Markdown</h2><p className="text-xs text-muted-foreground mt-1">Cadastre as aÃ§Ãµes do plano a partir de um arquivo <b>.md</b> no modelo do sistema. Um mesmo eixo pode ter vÃ¡rias aÃ§Ãµes. Nada Ã© gravado antes da sua conferÃªncia.</p></div><Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}><X /></Button></div>
  <div className="flex-1 overflow-y-auto px-5 md:px-7 py-6 space-y-5">
    <div className="app-panel p-4 space-y-3">
      <label className="flex gap-2 items-center border border-dashed rounded-md p-4 text-sm cursor-pointer hover:bg-muted"><Upload size={17} /> Selecionar plano em Markdown<input type="file" accept=".md,.markdown,text/markdown,text/plain" multiple className="sr-only" onChange={e => { const picked = Array.from(e.target.files || []); const bad = picked.filter(file => !/\.(md|markdown)$/i.test(file.name)); if (bad.length) setMessage(`"${bad[0]?.name ?? "arquivo"}" nÃ£o Ã© um arquivo Markdown.`); const good = picked.filter(file => !bad.includes(file) && file.size <= MAX_MD_BYTES); if (good.length !== picked.length - bad.length) setMessage(`Arquivos de atÃ© ${Math.round(MAX_MD_BYTES / 1024)} KB por vez.`); if (picked.length - bad.length > MAX_PDFS) setMessage(`Selecione no mÃ¡ximo ${MAX_PDFS} arquivos por vez.`); setFiles(good.slice(0, MAX_PDFS)); setRows([]); setResult(null); }} /></label>
      {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} arquivo(s): {files.map(file => file.name).join(", ")}</p>}
      <p className="text-xs text-muted-foreground">Cada bloco do arquivo vira uma aÃ§Ã£o, lida pelos rÃ³tulos <b>Eixo da atividade</b>, <b>Status</b>, <b>DescriÃ§Ã£o</b>, <b>Problema</b>, <b>SoluÃ§Ã£o</b>, <b>Resultados esperados</b> e <b>Atividade</b>. O modelo estÃ¡ em <code className="text-foreground">public/modelos/plano-estrategias.md</code>.</p>
      <Button disabled={!files.length || busy} onClick={read}><FileText /> {rows.length ? "Releer o arquivo" : "Extrair aÃ§Ãµes"}</Button>
      {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
    </div>
    {rows.length > 0 && <>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm"><b>{rows.length}</b> aÃ§Ã£o(Ãµes) encontradas, <b>{chosen.length}</b> marcada(s) para importar.</p><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setRows(rows.map(row => ({ ...row, include: !row.include })))}>Inverter seleÃ§Ã£o</Button><Button variant="outline" size="sm" onClick={() => setRows(rows.map(row => ({ ...row, include: !isDuplicate(row) && Boolean(row.axis) })))}>Marcar nÃ£o duplicadas</Button></div></div>
      <div className="space-y-3">{rows.map((row, rowIndex) => { const duplicate = isDuplicate(row); return <div key={row.id} className={`app-panel p-4 ${row.include ? "" : "opacity-60"}`}>
        <div className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary" aria-label={`Importar ${row.description || `aÃ§Ã£o ${rowIndex + 1}`}`} checked={row.include} onChange={e => patch(row.id, { include: e.target.checked })} /><div className="min-w-0 flex-1 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            {field("Eixo da atividade", "axis", row.axis, edit(row.id), { options: axes })}
            {field("Status da aÃ§Ã£o", "status", row.status, edit(row.id), { options: statuses })}
            {field("Problema", "problem", row.problem, edit(row.id))}
            {field("SoluÃ§Ã£o", "solution", row.solution, edit(row.id))}
          </div>
          {field("DescriÃ§Ã£o da atividade", "description", row.description, edit(row.id), { textarea: true })}
          {field("DescriÃ§Ã£o do problema", "problemDescription", row.problemDescription, edit(row.id), { textarea: true })}
          {field("DescriÃ§Ã£o da soluÃ§Ã£o", "solutionDescription", row.solutionDescription, edit(row.id), { textarea: true })}
          <div className="border-t pt-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="app-label mb-0">Resultados esperados</span><Button type="button" variant="outline" size="sm" onClick={() => addResult(row.id)}><Plus /> Inserir resultado</Button></div>
            {row.expectedResults.length === 0 && <p className="text-xs text-muted-foreground">Nenhum resultado esperado lido neste bloco.</p>}
            {row.expectedResults.map((result, ri) => <div key={ri} className="flex items-start gap-2"><div className="min-w-0 flex-1"><input className="app-field" value={result} placeholder="Resultado esperado" onChange={e => patchResult(row.id, ri, e.target.value)} /></div><Button type="button" variant="ghost" size="icon" aria-label={`Descartar resultado ${ri + 1}`} onClick={() => dropResult(row.id, ri)}><Trash2 /></Button></div>)}
          </div>
          <div className="border-t pt-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="app-label mb-0">Atividades</span><Button type="button" variant="outline" size="sm" onClick={() => addActivity(row.id)}><Plus /> Inserir atividade</Button></div>
            {row.activities.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma atividade lida neste bloco.</p>}
            {row.activities.map((activity, ai) => <div key={ai} className="border rounded-md p-3 space-y-2 bg-muted/20">
              <div className="flex items-start gap-2"><div className="min-w-0 flex-1 grid sm:grid-cols-2 gap-2">
                <input className="app-field sm:col-span-2" value={activity.description} placeholder="DescriÃ§Ã£o da atividade" onChange={e => patchActivity(row.id, ai, { description: e.target.value })} />
                <select className="app-field" value={activity.status} onChange={e => patchActivity(row.id, ai, { status: e.target.value })}><option value="">Selecione</option>{statuses.map(status => <option key={status}>{status}</option>)}</select>
                <input className="app-field" value={activity.startDate} placeholder="InÃ­cio (dd/mm/aaaa)" inputMode="numeric" onChange={e => patchActivity(row.id, ai, { startDate: dateMask(e.target.value) })} />
                <input className="app-field" value={activity.endDate} placeholder="ConclusÃ£o (dd/mm/aaaa)" inputMode="numeric" onChange={e => patchActivity(row.id, ai, { endDate: dateMask(e.target.value) })} />
              </div><Button type="button" variant="ghost" size="icon" aria-label={`Descartar atividade ${ai + 1}`} onClick={() => dropActivity(row.id, ai)}><Trash2 /></Button></div>
            </div>)}
          </div>
          {duplicate && <p className="text-xs text-primary flex items-center gap-1.5"><Check size={13} /> JÃ¡ existe uma aÃ§Ã£o do plano com este eixo e descriÃ§Ã£o - desmarcada para nÃ£o duplicar.</p>}
          {row.notes.length > 0 && <ul className="text-xs text-muted-foreground space-y-0.5">{row.notes.map(note => <li key={note}>â€¢ {note}</li>)}</ul>}
          <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Bloco lido do arquivo</summary><p className="mt-1.5 break-words bg-muted/50 rounded p-2">{row.source}</p></details>
        </div><Button variant="ghost" size="icon" aria-label={`Descartar ${row.description || `aÃ§Ã£o ${rowIndex + 1}`}`} onClick={() => setRows(rows.filter(item => item.id !== row.id))}><Trash2 /></Button></div>
      </div>; })}</div>
    </>}
    {text && <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Arquivo lido</summary><pre className="mt-2 max-h-64 overflow-auto text-xs bg-muted/50 rounded p-3 whitespace-pre-wrap break-words">{text}</pre></details>}
    {result && <div className="app-panel p-4 space-y-2"><p className="text-sm"><b>{result.ok}</b> aÃ§Ã£o(Ãµes) do plano cadastrada(s).</p>{result.failed.length > 0 && <div><p className="text-sm text-primary"><b>{result.failed.length}</b> nÃ£o foram importadas:</p><ul className="text-xs text-muted-foreground mt-1 space-y-0.5">{result.failed.map((item, i) => <li key={i}>â€¢ {item.title}: {item.reason}</li>)}</ul></div>}</div>}
    {message && <p role="alert" className="bg-secondary text-primary text-sm p-3 rounded">{message}</p>}
  </div>
  <div className="bg-card border-t p-4 md:px-7 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Fechar</Button><Button disabled={!chosen.length || busy} onClick={save}>{busy && !rows.length ? "Extraindo..." : busy ? "Importando..." : `Importar ${chosen.length} aÃ§Ã£o(Ãµes)`}</Button></div>
</div></div>;
}

const reportCodes = indicatorCatalog.map(item => item.code);

const toReportActivity = (row: ActivityRow): ReportActivity => ({
  title: row.title,
  status: row.status,
  description: row.description,
  participants: row.participants,
  objectives: row.objectives,
  expected_results: row.expected_results,
  achieved_results: row.achieved_results,
  start_date: row.start_date,
  end_date: row.end_date,
  axis: row.axis,
  indicators: row.indicators || [],
  evidence: row.evidence,
});

const reportMonth = (value: string): { year: number; month: number } | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match || !match[1] || !match[2]) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  return month >= 0 && month <= 11 ? { year, month } : null;
};

const evidencePaths = (evidence: Json): string[] =>
  (Array.isArray(evidence) ? evidence : []).filter((path): path is string => typeof path === "string");

async function downscaleImage(blob: Blob): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height, 1));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("este navegador nÃ£o conseguiu desenhar a imagem");
    context.drawImage(bitmap, 0, 0, width, height);
    const jpeg = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!jpeg) throw new Error("este navegador nÃ£o conseguiu converter a imagem para JPEG");
    return { bytes: new Uint8Array(await jpeg.arrayBuffer()), width, height };
  } finally {
    bitmap.close();
  }
}

// The report fills the official Word template from public/modelos: the header fields are plain
// text, the twelve SETI indicators keep their computed counts but accept a typed override (a
// currency line, for instance), the REF rows come from the month's own activities, and the
// evidence images are re-encoded to JPEG before being embedded so any upload format fits the
// template's content types.
function ReportModal({ activities, actorCount, plan, userName, onClose }: {
  activities: ActivityRow[];
  actorCount: number;
  plan: { total: number; done: number; percent: number | null };
  userName: string;
  onClose: () => void;
}) {
  const [monthInput, setMonthInput] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [header, setHeader] = useState<Record<string, string>>(() => ({
    ari: userName,
    gestorSebrae: "HEVERSON FELICIANO",
    gestorAgeuni: "LUCIANO PANAGIO",
    consultor: "DANIELE MONTENEGRO CONTE",
    ecossistema: "ROLÃ‚NDIA/INOVALÃ‚NDIA",
    setores: "CADEIA DO AGRONEGÃ“CIO, FABRICAÃ‡ÃƒO ALIMENTÃCIA, ELETROMETALMECÃ‚NICO, TIC",
    gt: "GOVERNANÃ‡A DO ECOSSISTEMA DE INOVAÃ‡ÃƒO DE ROLÃ‚NDIA",
    atores: `em torno de ${actorCount} atores`,
    acoes: plan.total ? `${plan.done} de ${plan.total} aÃ§Ãµes priorizadas` : "â€”",
    percentual: plan.percent === null ? "â€”" : `${plan.percent}%`,
  }));
  const [indicatorValues, setIndicatorValues] = useState<Record<string, { previous: string; current: string }>>({});
  const [destaquePick, setDestaquePick] = useState("");
  const [destaque, setDestaque] = useState("");
  const [difficulties, setDifficulties] = useState("");
  const [withEvidence, setWithEvidence] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const parsed = reportMonth(monthInput);
  const monthRows = parsed ? filterMonthActivities(activities, parsed.year, parsed.month) : [];
  const counts = parsed ? indicatorCounts(activities, monthRows, reportCodes, parsed.year, parsed.month) : {};
  const evidenceCount = monthRows.reduce(
    (total, row) => total + Math.min(3, evidencePaths(row.evidence).length),
    0,
  );

  useEffect(() => {
    setIndicatorValues({});
    setDestaquePick("");
    setDestaque("");
  }, [monthInput]);

  const setHeaderField = (name: string, value: string) => setHeader(current => ({ ...current, [name]: value }));
  const shown = (code: string, key: "previous" | "current") =>
    indicatorValues[code]?.[key] ?? String(counts[code]?.[key] ?? 0);
  const setIndicator = (code: string, key: "previous" | "current", value: string) =>
    setIndicatorValues(all => {
      const current = all[code] ?? {
        previous: String(counts[code]?.previous ?? 0),
        current: String(counts[code]?.current ?? 0),
      };
      return {
        ...all,
        [code]: {
          previous: key === "previous" ? value : current.previous,
          current: key === "current" ? value : current.current,
        },
      };
    });

  const pickDestaque = (value: string) => {
    setDestaquePick(value);
    const row = monthRows[Number(value)];
    if (!row) {
      setDestaque("");
      return;
    }
    const iso = row.start_date || row.end_date;
    const br = iso ? brDate(iso) : "";
    const title = stripDateSuffix(row.title, br);
    const line = br ? `${title} (${br})` : title;
    const firstLine = row.description?.split(/\r?\n/).map(part => part.trim()).find(Boolean);
    setDestaque(firstLine ? `${line}: ${firstLine}` : line);
  };

  async function generate() {
    if (!parsed) {
      setMessage("Escolha um mÃªs no formato aaaa-mm.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const evidence: ReportEvidence[] = [];
      if (withEvidence) {
        for (const row of monthRows) {
          const paths = evidencePaths(row.evidence).slice(0, 3);
          const iso = row.start_date || row.end_date;
          const br = iso ? brDate(iso) : "";
          const title = stripDateSuffix(row.title, br);
          for (const path of paths) {
            const { data, error } = await supabase.storage.from("ari-evidence").createSignedUrl(path, 3600);
            if (error || !data?.signedUrl) {
              throw new Error(`NÃ£o foi possÃ­vel autorizar a imagem da atividade "${row.title}": ${error?.message ?? "URL nÃ£o gerada"}.`);
            }
            const response = await fetch(data.signedUrl);
            if (!response.ok) throw new Error(`NÃ£o foi possÃ­vel baixar a imagem da atividade "${row.title}" (HTTP ${response.status}).`);
            const image = await downscaleImage(await response.blob());
            evidence.push({ ...image, caption: br ? `${br} - ${title}` : title });
          }
        }
      }
      const blob = await buildMonthlyReport({
        year: parsed.year,
        month: parsed.month,
        activities: monthRows.map(toReportActivity),
        codes: reportCodes,
        header,
        destaque,
        difficulties,
        evidence,
        indicatorValues,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio-mensal-${String(parsed.month + 1).padStart(2, "0")}-${parsed.year}.docx`;
      link.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel gerar o relatÃ³rio mensal.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="fixed inset-0 z-50 bg-foreground/50 flex justify-end" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label="RelatÃ³rio mensal em Word" className="bg-background w-full max-w-4xl h-full flex flex-col shadow-xl"><div className="bg-card border-b px-5 md:px-7 py-5 flex items-center justify-between"><div><h2 className="text-xl font-bold">RelatÃ³rio mensal (.docx)</h2><p className="text-xs text-muted-foreground mt-1">Baixa o modelo oficial preenchido com as atividades do mÃªs, os indicadores e as evidÃªncias. Nada Ã© gravado no sistema.</p></div><Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}><X /></Button></div>
  <div className="flex-1 overflow-y-auto px-5 md:px-7 py-6 space-y-5">
    <div className="app-panel p-4 flex flex-wrap items-end gap-4">
      <label className="block min-w-0"><span className="app-label">MÃªs de referÃªncia</span><input className="app-field w-48" type="month" value={monthInput} onChange={e => setMonthInput(e.target.value)} /></label>
      <p className="text-sm text-muted-foreground pb-2">{parsed ? `${monthRows.length} atividade(s) em ${MONTHS_PT[parsed.month]}/${parsed.year}` : "Informe um mÃªs no formato aaaa-mm."}</p>
    </div>
    <div className="app-panel p-4 space-y-3">
      <h3 className="font-bold text-sm">CabeÃ§alho</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {field("ARI", "ari", header["ari"] ?? "", setHeaderField)}
        {field("Gestor Sebrae", "gestorSebrae", header["gestorSebrae"] ?? "", setHeaderField)}
        {field("Gestor AGEUNI", "gestorAgeuni", header["gestorAgeuni"] ?? "", setHeaderField)}
        {field("Consultor SÃªnior/Orientador", "consultor", header["consultor"] ?? "", setHeaderField)}
        {field("Ecossistema", "ecossistema", header["ecossistema"] ?? "", setHeaderField)}
        {field("Setores Priorizados do Ecossistema", "setores", header["setores"] ?? "", setHeaderField)}
        {field("GT do Ecossistema", "gt", header["gt"] ?? "", setHeaderField)}
        {field("NÃºmero de atores engajados", "atores", header["atores"] ?? "", setHeaderField)}
        {field("AÃ§Ãµes do plano realizadas", "acoes", header["acoes"] ?? "", setHeaderField)}
        {field("% de aÃ§Ãµes concluÃ­das", "percentual", header["percentual"] ?? "", setHeaderField)}
      </div>
    </div>
    <div className="app-panel p-4 space-y-3">
      <div><h3 className="font-bold text-sm">Indicadores</h3><p className="text-xs text-muted-foreground mt-1">O acumulado soma o resultado anterior com o do mÃªs. As referÃªncias apontam as linhas da seÃ§Ã£o REF concluÃ­das no mÃªs. Edite os dois campos quando a contagem nÃ£o for o nÃºmero oficial.</p></div>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-muted text-muted-foreground text-xs uppercase"><tr><th className="p-3">Indicador</th><th className="p-3">Resultado anterior</th><th className="p-3">Resultado no mÃªs</th><th className="p-3">Acumulado</th><th className="p-3">ReferÃªncias</th></tr></thead><tbody>{reportCodes.map(code => { const previous = shown(code, "previous"); const current = shown(code, "current"); return <tr key={code} className="border-t"><td className="p-3 font-bold whitespace-nowrap" title={indicatorLabel(code)}>{code}</td><td className="p-3"><input className="app-field w-28" inputMode="decimal" value={previous} aria-label={`Resultado anterior de ${code}`} onChange={e => setIndicator(code, "previous", e.target.value)} /></td><td className="p-3"><input className="app-field w-28" inputMode="decimal" value={current} aria-label={`Resultado no mÃªs de ${code}`} onChange={e => setIndicator(code, "current", e.target.value)} /></td><td className="p-3 whitespace-nowrap">{formatPt(parsePt(previous) + parsePt(current))}</td><td className="p-3 text-xs">{counts[code]?.refs || "â€”"}</td></tr>; })}</tbody></table></div>
    </div>
    <div className="app-panel p-4 space-y-3">
      <h3 className="font-bold text-sm">Atividade em destaque</h3>
      <div className="grid sm:grid-cols-2 gap-3">{field("Linha da seÃ§Ã£o REF", "destaquePick", destaquePick, (_, value) => pickDestaque(value), { options: monthRows.map((row, index) => ({ value: String(index), label: `${index + 1} - ${row.title}` })) })}</div>
      {field("Texto do destaque", "destaque", destaque, (_, value) => setDestaque(value), { textarea: true })}
      {field("Dificuldades encontradas no mÃªs", "difficulties", difficulties, (_, value) => setDifficulties(value), { textarea: true })}
    </div>
    <div className="app-panel p-4 space-y-3">
      <h3 className="font-bold text-sm">EvidÃªncias</h3>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={withEvidence} disabled={!evidenceCount} onChange={e => setWithEvidence(e.target.checked)} /> Incluir imagens de evidÃªncia ({evidenceCount} no mÃªs, atÃ© 3 por atividade)</label>
      <p className="text-xs text-muted-foreground">As imagens sÃ£o baixadas da pasta privada de evidÃªncias e embutidas no documento.</p>
    </div>
    {message && <p role="alert" className="bg-secondary text-primary text-sm p-3 rounded">{message}</p>}
  </div>
  <div className="bg-card border-t p-4 md:px-7 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Fechar</Button><Button disabled={busy || !parsed} onClick={() => void generate()}><FileText /> {busy ? "Gerando..." : "Gerar relatÃ³rio"}</Button></div>
</div></div>;
}
