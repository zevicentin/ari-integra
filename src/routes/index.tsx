import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useMemo } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Users, Settings2, Upload, Download, LogOut, ChevronRight, Check, FileText, KeyRound, ClipboardList, ChevronLeft, Menu, X, Building2, Target, Plus } from "lucide-react";
import ari from "@/assets/logo_ari-2.png.asset.json";
import type { Json } from "@/integrations/supabase/types";
import { reviewAccount, listAccountRequests } from "@/lib/account.functions";
import { SearchBox, Empty, SectionTitle, RowActions, Toolbar, Footer, Bar, Metric, AccountBlocked } from "@/components/app-ui";
import { CalendarGrid, ActivityTable, StrategyTable } from "@/components/tables";
import { Editor } from "@/features/editor";
import { ImportModal } from "@/features/import-modal";
import { Login } from "@/features/login";
import { ReportModal } from "@/features/report-modal";
import { StrategyImportModal } from "@/features/strategy-import-modal";
import { ariFallback } from "@/lib/assets";
import { statuses, nav, stages, axes, activityKinds } from "@/lib/constants";
import { monthLabel, formatDate } from "@/lib/dates";
import { removeEvidence } from "@/lib/evidence";
import { initials, confirmed } from "@/lib/masks";
import { type PlanActivity, storedActivities, planProgressOf } from "@/lib/plan";
import type { CoordinationParticipant, ApprovalRequest, Organization, StrategyAction, Profile, AgentChoice, ActivityRow, Section, Actor } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "ARI | Gestão de Atividades" },
    { name: "description", content: "Planejamento, registro e acompanhamento das ações dos Agentes Regionais de Inovação vinculados à UEL." },
    { property: "og:title", content: "ARI | Gestão de Atividades" },
    { property: "og:description", content: "Sistema de atividades e indicadores dos Agentes Regionais de Inovação da UEL." },
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

// Sections the coordinator's agent selector narrows: the dashboard and the agents directory stay
// ecosystem-wide, so the overview is always one click away.
const AGENT_FILTER_SECTIONS: Section[] = [
  "activities",
  "strategy",
  "calendar",
  "organizations",
  "actors",
  "reports",
];

/** Everything the workspace pages read, loaded together so one query can replace it all. */
type WorkspaceData = {
  role: string;
  approvalStatus: string | null;
  profiles: Profile[];
  activities: ActivityRow[];
  organizations: Organization[];
  actors: Actor[];
  strategyActions: StrategyAction[];
  coordinationParticipants: CoordinationParticipant[];
  agentChoices: AgentChoice[];
  approvalRequests: ApprovalRequest[];
  error: string;
};

function Workspace({ session }: { session: Session }) {
  const [section, setSection] = useState<Section>("overview"); const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<"activity" | "strategy" | "organization" | "actor" | "profile" | "password" | "import" | "report" | null>(null); const [editing, setEditing] = useState<ActivityRow | StrategyAction | Organization | Actor | Profile | null>(null);
  const [strategyImport, setStrategyImport] = useState(false);
  const [query, setQuery] = useState(""); const [statusFilter, setStatusFilter] = useState(""); const [kindFilter, setKindFilter] = useState(""); const [axisFilter, setAxisFilter] = useState(""); const [month, setMonth] = useState(() => new Date()); const [agentFilter, setAgentFilter] = useState("");
  const listRequests = useServerFn(listAccountRequests); const review = useServerFn(reviewAccount);
  const workspaceKey = ["workspace", session.user.id] as const;
  // The whole workspace comes from one query: the profile gate, the role and every list the pages
  // read. What load() used to write into separate states is returned here instead, so a save only
  // refetches the same key and the pages keep rendering with the data they already have.
  async function fetchWorkspace(): Promise<WorkspaceData> {
    const base: WorkspaceData = { role: "agent", approvalStatus: null, profiles: [], activities: [], organizations: [], actors: [], strategyActions: [], coordinationParticipants: [], agentChoices: [], approvalRequests: [], error: "" };
    let { data: ownProfile, error: ownProfileError } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (!ownProfile && !ownProfileError) {
      const created = await supabase.from("profiles").insert({ id: session.user.id, full_name: String(session.user.user_metadata?.["full_name"] || session.user.email?.split("@")[0] || "Agente"), requested_role: "agent", approval_status: "pending" }).select().single();
      ownProfile = created.data; ownProfileError = created.error;
    }
    const r = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).limit(1);
    const role = r.data?.[0]?.role || "agent";
    const approvalStatus = ownProfile?.approval_status || null;
    if (approvalStatus !== "approved") return { ...base, role, approvalStatus, profiles: ownProfile ? [ownProfile] : [], error: ownProfileError?.message || r.error?.message || "" };
    const [a, o, t, p, participants, agentList, s] = await Promise.all([supabase.from("activities").select("*").order("created_at", { ascending: false }), supabase.from("organizations").select("*").order("created_at", { ascending: false }), supabase.from("actors").select("*").order("created_at", { ascending: false }), supabase.from("profiles").select("*").eq("approval_status", "approved"), supabase.rpc("coordination_participants"), supabase.rpc("activity_agent_choices"), supabase.from("strategy_actions").select("*").order("created_at", { ascending: false })]);
    let error = [a.error, o.error, t.error, p.error, participants.error, agentList.error, s.error].filter(Boolean).map(x => typeof x === "string" ? x : x?.message).join(" · ");
    let approvalRequests: ApprovalRequest[] = [];
    if (role === "admin") {
      try { approvalRequests = await listRequests(); } catch (requestError) { error = [error, requestError instanceof Error ? requestError.message : "Não foi possível carregar as solicitações."].filter(Boolean).join(" · "); }
    }
    return { role, approvalStatus, profiles: p.data || [], activities: a.data || [], organizations: o.data || [], actors: t.data || [], strategyActions: s.data || [], coordinationParticipants: participants.data || [], agentChoices: agentList.data || [], approvalRequests, error };
  }
  const workspace = useQuery({ queryKey: workspaceKey, queryFn: fetchWorkspace, retry: false, refetchOnWindowFocus: false });
  const queryClient = useQueryClient();
  const loaded = workspace.data;
  const loading = workspace.isPending;
  const role = loaded?.role ?? "agent";
  const approvalStatus = loaded?.approvalStatus ?? null;
  const error = loaded?.error ?? "";
  // The lists come out of one memo so each keeps a stable identity between renders: the pages
  // feed them to useMemo, and a fresh array every render would recompute them for nothing.
  const { approvalRequests, activities, organizations, actors, profiles, strategyActions, coordinationParticipants, agentChoices } = useMemo(() => ({ approvalRequests: loaded?.approvalRequests ?? [], activities: loaded?.activities ?? [], organizations: loaded?.organizations ?? [], actors: loaded?.actors ?? [], profiles: loaded?.profiles ?? [], strategyActions: loaded?.strategyActions ?? [], coordinationParticipants: loaded?.coordinationParticipants ?? [], agentChoices: loaded?.agentChoices ?? [] }), [loaded]);
  const isManager = role === "admin" || role === "coordinator"; const readOnly = role === "viewer" || role === "coordinator";
  const myProfile = profiles.find(p => p.id === session.user.id);
  const displayName = myProfile?.full_name || session.user.user_metadata?.["full_name"] || session.user.email?.split("@")[0] || "Agente";
  // The coordinator reads every record but drills into one agent at a time: the selector narrows
  // each cadastro to that agent's own rows — and to the joint activities they take part in — while
  // the dashboard keeps the ecosystem-wide overview on the unfiltered lists.
  const visibleActivities = useMemo(
    () =>
      !agentFilter
        ? activities
        : activities.filter(
            (a) => a.owner_id === agentFilter || (a.participant_agents || []).includes(agentFilter),
          ),
    [activities, agentFilter],
  );
  const visibleOrganizations = useMemo(
    () => (!agentFilter ? organizations : organizations.filter((o) => o.owner_id === agentFilter)),
    [organizations, agentFilter],
  );
  const visibleActors = useMemo(
    () => (!agentFilter ? actors : actors.filter((a) => a.owner_id === agentFilter)),
    [actors, agentFilter],
  );
  const visibleStrategy = useMemo(
    () =>
      !agentFilter ? strategyActions : strategyActions.filter((s) => s.owner_id === agentFilter),
    [strategyActions, agentFilter],
  );
  const filtered = useMemo(
    () =>
      visibleActivities.filter(
        (a) =>
          (!query ||
            `${a.title} ${a.description} ${a.kind}`.toLowerCase().includes(query.toLowerCase())) &&
          (!statusFilter || a.status === statusFilter) &&
          (!kindFilter || a.kind === kindFilter),
      ),
    [visibleActivities, query, statusFilter, kindFilter],
  );
  const orderedOrganizations = useMemo(
    () =>
      [...organizations].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" }),
      ),
    [organizations],
  );
  const filteredStrategy = useMemo(
    () =>
      visibleStrategy.filter(
        (a) =>
          (!query ||
            `${a.description} ${a.axis} ${a.problem} ${a.solution}`
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (!axisFilter || a.axis === axisFilter),
      ),
    [visibleStrategy, query, axisFilter],
  );
  const orderedActors = useMemo(
    () =>
      [...actors].sort((a, b) =>
        (a.actor_name || "").localeCompare(b.actor_name || "", "pt-BR", { sensitivity: "base" }),
      ),
    [actors],
  );
  // The execution percentage walks the plan's own activities and never the activity page — see
  // planProgressOf in lib/plan. The dashboard keeps every action's numbers; the plan page follows
  // the selected agent, so a coordinator reads that agent's own share of the plan.
  const planProgress = useMemo(() => planProgressOf(strategyActions), [strategyActions]);
  const visiblePlanProgress = useMemo(() => planProgressOf(visibleStrategy), [visibleStrategy]);
  async function decideAccount(userId: string, decision: "approved" | "rejected") {
    try {
      await review({ data: { userId, decision } });
      setToast(
        decision === "approved"
          ? "Conta aprovada e acesso liberado."
          : "Conta recusada e mantida bloqueada.",
      );
      const requests = await listRequests();
      queryClient.setQueryData<WorkspaceData>(workspaceKey, (current) =>
        current ? { ...current, approvalRequests: requests } : current,
      );
    } catch (reviewError) {
      setToast(
        reviewError instanceof Error ? reviewError.message : "Não foi possível analisar a conta.",
      );
    }
  }
  function open(which: typeof modal, row: typeof editing = null) { if (readOnly && which !== "profile") return; setEditing(row); setModal(which); }
  function openPassword() { setEditing(null); setModal("password"); }
  // The row goes first: only after it is gone do its evidence objects lose the record that
  // pointed at them, and the bucket cleanup is best effort so a storage hiccup never keeps
  // the record alive.
  async function remove(which: "activities" | "organizations" | "actors" | "strategy_actions", id: string) { if (!window.confirm("Excluir este registro? Esta ação não pode ser desfeita.")) return; const found = which === "activities" ? (await supabase.from("activities").select("evidence").eq("id", id).maybeSingle()).data?.evidence : null; const paths = Array.isArray(found) ? found : []; const { error } = await supabase.from(which).delete().eq("id", id); if (error) setToast(`Não foi possível excluir: ${error.message}`); else { setToast("Registro excluído."); await removeEvidence(paths); void workspace.refetch(); } }
  // A task written from the plan page only touches that action's own activity list: the action's
  // description, axis and status are left as they are, and the saved row is put back in place so the
  // execution percentage moves without reloading the page.
  async function saveTasks(action: StrategyAction, next: PlanActivity[]) {
    const saved = confirmed<StrategyAction>(await supabase.from("strategy_actions").update({ activities: storedActivities(next) as unknown as Json, updated_at: new Date().toISOString() }).eq("id", action.id).select().single(), "a atividade do plano de estratégias");
    queryClient.setQueryData<WorkspaceData>(workspaceKey, current => current ? { ...current, strategyActions: current.strategyActions.map(item => item.id === saved.id ? saved : item) } : current);
    setToast("Atividade salva no plano de estratégias.");
  }
  function exportCSV() { const headers = ["Título", "Tipo", "Status", "Início", "Conclusão", "Organização", "Responsável", "Participantes (agentes)", "Resultados alcançados"]; const rows = filtered.map(a => [a.title, a.kind, a.status, formatDate(a.start_date), formatDate(a.end_date), organizations.find(o => o.id === a.organization_id)?.name || "", profiles.find(p => p.id === a.owner_id)?.full_name || "", (a.participant_agents || []).map(id => agentChoices.find(choice => choice.user_id === id)?.full_name || "").filter(Boolean).join(", "), a.achieved_results || ""]); const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\r\n"); const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "relatorio-ari.csv"; link.click(); URL.revokeObjectURL(url); }
  const heading = nav.find(x => x.id === section)?.label || "Visão geral";
  if (!loading && approvalStatus !== "approved") return <AccountBlocked status={approvalStatus} />;
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <aside
        className={`no-print bg-sidebar text-primary-foreground lg:w-60 lg:shrink-0 lg:min-h-screen ${mobileNav ? "block" : "hidden lg:block"}`}
      >
        <div className="lg:sticky lg:top-0 flex flex-col lg:h-screen">
          <div className="px-6 py-6 border-b border-primary-foreground/10">
            <img
              src={ari.url}
              alt="ARI"
              className="w-32 h-16 object-contain"
              onError={(e) => {
                const t = e.currentTarget;
                if (!t.src.endsWith(ariFallback)) {
                  t.src = ariFallback;
                }
              }}
            />
            <p className="text-[11px] text-primary-foreground/60 mt-3 uppercase font-bold">
              Gestão de atividades
            </p>
          </div>
          <nav className="flex-1 px-3 py-6 space-y-1">
            {nav
              .filter((item) => item.id !== "approvals" || role === "admin")
              .map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    onClick={() => {
                      setSection(item.id);
                      setMobileNav(false);
                      setQuery("");
                    }}
                    className={`w-full justify-start h-10 px-3 text-sm ${section === item.id ? "bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground" : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"}`}
                  >
                    <Icon className="mr-2" />
                    {item.label}
                  </Button>
                );
              })}
          </nav>
          <div className="p-3 border-t border-primary-foreground/10">
            {!readOnly && (
              <Button
                variant="ghost"
                className="w-full justify-start text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => open("profile", myProfile || null)}
              >
                <Settings2 /> Meu perfil
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={openPassword}
            >
              <KeyRound /> Trocar senha
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut /> Sair
            </Button>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1 flex flex-col">
        <header className="no-print bg-card border-b px-5 md:px-9 h-18 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Abrir menu"
              onClick={() => setMobileNav(!mobileNav)}
            >
              <Menu />
            </Button>
            <div>
              <p className="text-xs text-muted-foreground">ARI / Plataforma de gestão</p>
              <h1 className="font-bold text-lg">{heading}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-right">
              <span className="block text-sm font-bold">{displayName}</span>
              <span className="block text-xs text-muted-foreground">
                {role === "admin"
                  ? "Administrador"
                  : isManager
                    ? "Coordenação"
                    : readOnly
                      ? "Visualizador"
                      : "Agente regional"}
              </span>
            </span>
            <div className="w-9 h-9 rounded-full bg-accent text-accent-foreground grid place-items-center text-xs font-bold">
              {initials(displayName)}
            </div>
          </div>
        </header>
        <main className="flex-1 p-5 md:p-9 max-w-[1600px] w-full mx-auto">
          {error && (
            <p className="mb-5 p-3 rounded bg-secondary text-primary text-sm">
              Não foi possível carregar alguns dados: {error}
            </p>
          )}
          {toast && (
            <div
              role="status"
              className="mb-5 p-3 flex justify-between gap-3 rounded bg-accent text-accent-foreground text-sm"
            >
              {toast}
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                aria-label="Fechar mensagem"
                onClick={() => setToast("")}
              >
                <X />
              </Button>
            </div>
          )}
          {role === "coordinator" && !loading && AGENT_FILTER_SECTIONS.includes(section) && (
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <label htmlFor="agent-filter" className="text-sm font-semibold">
                Agente
              </label>
              <select
                id="agent-filter"
                className="app-field w-full sm:w-64"
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
              >
                <option value="">Todos os agentes — visão geral</option>
                {agentChoices.map((choice) => (
                  <option key={choice.user_id} value={choice.user_id}>
                    {choice.full_name}
                  </option>
                ))}
              </select>
              {agentFilter && (
                <Button variant="outline" size="sm" onClick={() => setAgentFilter("")}>
                  Limpar
                </Button>
              )}
            </div>
          )}
          {loading ? (
            <p className="text-muted-foreground">Carregando registros...</p>
          ) : (
            <>
              {section === "overview" && (
                <>
                  <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-primary">PAINEL DE ACOMPANHAMENTO</p>
                      <h2 className="text-2xl md:text-3xl font-bold mt-1">
                        Olá, {displayName.split(" ")[0]}.
                      </h2>
                      <p className="text-muted-foreground mt-2 text-sm">
                        Acompanhe o trabalho realizado no ecossistema de inovação.
                      </p>
                    </div>
                    {!readOnly && (
                      <Button onClick={() => open("activity")}>
                        <Plus /> Nova atividade
                      </Button>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <Metric
                      icon={ClipboardList}
                      label="Atividades registradas"
                      value={activities.length}
                      note="Total de ações"
                    />
                    <Metric
                      icon={Check}
                      label="Concluídas"
                      value={activities.filter((a) => a.status === "Concluída").length}
                      note="Ações finalizadas"
                    />
                    <Metric
                      icon={Building2}
                      label="Organizações"
                      value={organizations.length}
                      note="No ecossistema"
                    />
                    <Metric
                      icon={Users}
                      label="Atores cadastrados"
                      value={actors.length}
                      note="Na governança"
                    />
                  </div>
                  <div className="app-panel p-5 mt-4">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">
                          Conclusão do plano de estratégias
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Percentual de conclusão das atividades do plano; as que têm subtarefas
                          entram pela proporção de subtarefas concluídas.
                        </p>
                      </div>
                      <p
                        className="text-4xl font-bold leading-none"
                        aria-label={
                          planProgress.percent === null
                            ? "Sem percentual"
                            : `${planProgress.percent} por cento`
                        }
                      >
                        {planProgress.percent === null ? "—" : `${planProgress.percent}%`}
                      </p>
                    </div>
                    <Progress
                      className="mt-4 h-2.5"
                      value={planProgress.percent ?? 0}
                      aria-label="Percentual de conclusão das atividades do plano de estratégias"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {planProgress.total === 0
                        ? "Nenhuma atividade registrada no plano."
                        : `${planProgress.done} de ${planProgress.total} ${planProgress.total === 1 ? "atividade concluída" : "atividades concluídas"}.`}
                    </p>
                  </div>
                  <div className="grid xl:grid-cols-[1.6fr_1fr] gap-7 mt-9">
                    <div>
                      <SectionTitle
                        title="Atividades recentes"
                        action="Ver todas"
                        onAction={() => setSection("activities")}
                      />
                      <div className="app-panel overflow-x-auto">
                        <ActivityTable
                          rows={activities.slice(0, 6)}
                          organizations={organizations}
                          agentChoices={agentChoices}
                          currentUserId={session.user.id}
                          isAdmin={role === "admin"}
                          onEdit={(a) => open("activity", a)}
                          onDelete={(a) => remove("activities", a.id)}
                          readOnly={readOnly}
                        />
                      </div>
                    </div>
                    <div>
                      <SectionTitle
                        title="Próximos compromissos"
                        action="Ver agenda"
                        onAction={() => setSection("calendar")}
                      />
                      <div className="app-panel p-5 space-y-4">
                        {activities
                          .filter(
                            (a) =>
                              a.start_date &&
                              a.start_date >= new Date().toISOString().slice(0, 10) &&
                              a.status !== "Concluída",
                          )
                          .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""))
                          .slice(0, 4)
                          .map((a) => (
                            <div
                              key={a.id}
                              className="flex gap-4 border-b last:border-0 pb-4 last:pb-0"
                            >
                              <div className="text-center bg-secondary text-primary rounded p-2 min-w-12">
                                <span className="block font-bold text-lg leading-none">
                                  {a.start_date?.slice(8, 10)}
                                </span>
                                <span className="text-[10px] uppercase">
                                  {new Date(`${a.start_date}T12:00:00`).toLocaleDateString(
                                    "pt-BR",
                                    { month: "short" },
                                  )}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-bold">{a.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">{a.kind}</p>
                              </div>
                            </div>
                          ))}
                        {!activities.some(
                          (a) =>
                            a.start_date &&
                            a.start_date >= new Date().toISOString().slice(0, 10) &&
                            a.status !== "Concluída",
                        ) && <Empty text="Nenhum compromisso futuro registrado." />}
                      </div>
                    </div>
                  </div>
                </>
              )}
              {section === "activities" && (
                <>
                  <Toolbar
                    title="Atividades"
                    subtitle="Registre e acompanhe as ações dos agentes regionais."
                    action="Nova atividade"
                    onAction={() => open("activity")}
                    readOnly={readOnly}
                  />
                  <div className="flex flex-wrap gap-3 mb-5">
                    <SearchBox
                      value={query}
                      onChange={setQuery}
                      placeholder="Buscar atividades..."
                    />
                    <select
                      className="app-field w-full sm:w-48"
                      value={kindFilter}
                      onChange={(e) => setKindFilter(e.target.value)}
                    >
                      <option value="">Todos os tipos</option>
                      {activityKinds.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                    <select
                      className="app-field w-full sm:w-44"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="">Todos os status</option>
                      {statuses.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                    {!readOnly && (
                      <Button variant="outline" className="ml-auto" onClick={() => open("import")}>
                        <Upload /> Importar relatórios em Markdown
                      </Button>
                    )}
                  </div>
                  <div className="app-panel overflow-x-auto">
                    <ActivityTable
                      rows={filtered}
                      organizations={organizations}
                      agentChoices={agentChoices}
                      currentUserId={session.user.id}
                      isAdmin={role === "admin"}
                      onEdit={(a) => open("activity", a)}
                      onDelete={(a) => remove("activities", a.id)}
                      readOnly={readOnly}
                    />
                  </div>
                </>
              )}
              {section === "strategy" && (
                <>
                  <Toolbar
                    title="Plano de estratégias"
                    subtitle="Ações do plano e seus resultados esperados, organizados por eixo."
                    action="Nova ação"
                    onAction={() => open("strategy")}
                    readOnly={readOnly}
                    extra={
                      !readOnly && (
                        <Button variant="outline" onClick={() => setStrategyImport(true)}>
                          <Upload /> Importar Markdown
                        </Button>
                      )
                    }
                  />
                  <div className="app-panel p-5 mb-5">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">
                          Conclusão das atividades do plano
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Uma atividade sem subtarefas conta como tarefa única; as demais entram
                          pela proporção de subtarefas concluídas.
                        </p>
                      </div>
                      <p
                        className="text-4xl font-bold leading-none"
                        aria-label={
                          visiblePlanProgress.percent === null
                            ? "Sem percentual"
                            : `${visiblePlanProgress.percent} por cento`
                        }
                      >
                        {visiblePlanProgress.percent === null
                          ? "—"
                          : `${visiblePlanProgress.percent}%`}
                      </p>
                    </div>
                    <Progress
                      className="mt-4 h-2.5"
                      value={visiblePlanProgress.percent ?? 0}
                      aria-label="Percentual de conclusão das atividades do plano de estratégias"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {visiblePlanProgress.total === 0
                        ? "Nenhuma atividade registrada no plano."
                        : `${visiblePlanProgress.done} de ${visiblePlanProgress.total} ${visiblePlanProgress.total === 1 ? "atividade concluída" : "atividades concluídas"}.`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 mb-5">
                    <SearchBox
                      value={query}
                      onChange={setQuery}
                      placeholder="Buscar ação do plano..."
                    />
                    <select
                      className="app-field w-full sm:w-64"
                      value={axisFilter}
                      onChange={(e) => setAxisFilter(e.target.value)}
                    >
                      <option value="">Todos os eixos</option>
                      {axes.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </div>
                  <div className="app-panel overflow-x-auto">
                    <StrategyTable
                      rows={filteredStrategy}
                      profiles={profiles}
                      onEdit={(a) => open("strategy", a)}
                      onDelete={(a) => remove("strategy_actions", a.id)}
                      onSaveTasks={(action, next) => {
                        void saveTasks(action, next).catch((error) =>
                          setToast(
                            error instanceof Error
                              ? error.message
                              : "Não foi possível salvar a atividade.",
                          ),
                        );
                      }}
                      readOnly={readOnly}
                    />
                  </div>
                </>
              )}
              {section === "calendar" && (
                <>
                  <Toolbar
                    title="Agenda"
                    subtitle="Visualize suas atividades e compromissos por data."
                    action="Agendar atividade"
                    onAction={() => open("activity")}
                    readOnly={readOnly}
                  />
                  <div className="app-panel">
                    <div className="p-5 border-b flex items-center justify-between">
                      <h3 className="font-bold capitalize text-lg">{monthLabel(month)}</h3>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Mês anterior"
                          onClick={() =>
                            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
                          }
                        >
                          <ChevronLeft />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Próximo mês"
                          onClick={() =>
                            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
                          }
                        >
                          <ChevronRight />
                        </Button>
                      </div>
                    </div>
                    <CalendarGrid
                      date={month}
                      rows={visibleActivities}
                      onSelect={(a) => {
                        if (
                          !readOnly &&
                          (a.owner_id === session.user.id ||
                            role === "admin" ||
                            (a.participant_agents || []).includes(session.user.id))
                        )
                          open("activity", a);
                      }}
                    />
                  </div>
                </>
              )}
              {section === "organizations" && (
                <>
                  <Toolbar
                    title="Organizações atendidas"
                    subtitle="Empresas, startups e instituições do ecossistema."
                    action="Nova organização"
                    onAction={() => open("organization")}
                    readOnly={readOnly}
                  />
                  <div className="mb-5">
                    <SearchBox
                      value={query}
                      onChange={setQuery}
                      placeholder="Buscar organização..."
                    />
                  </div>
                  <div className="app-panel overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted text-muted-foreground text-xs uppercase">
                        <tr>
                          <th className="p-4">Organização</th>
                          <th className="p-4">Tipo / setor</th>
                          <th className="p-4">Região</th>
                          <th className="p-4">Etapa</th>
                          <th className="p-4">Contato</th>
                          <th className="p-4 w-24">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleOrganizations
                          .filter((o) =>
                            `${o.name} ${o.sector} ${o.region}`
                              .toLowerCase()
                              .includes(query.toLowerCase()),
                          )
                          .sort((a, b) =>
                            (a.name || "").localeCompare(b.name || "", "pt-BR", {
                              sensitivity: "base",
                            }),
                          )
                          .map((o) => (
                            <tr key={o.id} className="border-t hover:bg-muted/40">
                              <td className="p-4 font-bold">
                                {o.name}
                                <span className="block text-xs font-normal text-muted-foreground">
                                  {o.document}
                                </span>
                              </td>
                              <td className="p-4">
                                {o.kind}
                                <span className="block text-xs text-muted-foreground">
                                  {o.sector}
                                </span>
                              </td>
                              <td className="p-4">{o.region || "—"}</td>
                              <td className="p-4">
                                <span className="rounded bg-secondary text-secondary-foreground px-2 py-1 text-xs">
                                  {o.stage}
                                </span>
                              </td>
                              <td className="p-4">{o.contact || o.email || "—"}</td>
                              <td className="p-4">
                                <RowActions
                                  edit={() => open("organization", o)}
                                  remove={() => remove("organizations", o.id)}
                                  readOnly={readOnly}
                                />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {visibleOrganizations.length === 0 && (
                      <Empty text="Nenhuma organização cadastrada." />
                    )}
                  </div>
                </>
              )}
              {section === "actors" && (
                <>
                  <Toolbar
                    title="Atores da governança"
                    subtitle="Pessoas e instituições que fazem parte da rede."
                    action="Novo ator"
                    onAction={() => open("actor")}
                    readOnly={readOnly}
                  />
                  <div className="mb-5">
                    <SearchBox
                      value={query}
                      onChange={setQuery}
                      placeholder="Buscar ator ou instituição..."
                    />
                  </div>
                  <div className="app-panel overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted text-muted-foreground text-xs uppercase">
                        <tr>
                          <th className="p-4">Ator</th>
                          <th className="p-4">Instituição</th>
                          <th className="p-4">Tipo</th>
                          <th className="p-4">Contato</th>
                          <th className="p-4 w-24">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleActors
                          .filter((a) =>
                            `${a.actor_name} ${a.institution_name}`
                              .toLowerCase()
                              .includes(query.toLowerCase()),
                          )
                          .sort((a, b) =>
                            (a.actor_name || "").localeCompare(b.actor_name || "", "pt-BR", {
                              sensitivity: "base",
                            }),
                          )
                          .map((a) => (
                            <tr key={a.id} className="border-t hover:bg-muted/40">
                              <td className="p-4 font-bold">
                                {a.actor_name}
                                <span className="block text-xs font-normal text-muted-foreground">
                                  {a.position}
                                </span>
                              </td>
                              <td className="p-4">{a.institution_name}</td>
                              <td className="p-4">{a.institution_type || "—"}</td>
                              <td className="p-4">{a.email || a.phone || "—"}</td>
                              <td className="p-4">
                                <RowActions
                                  edit={() => open("actor", a)}
                                  remove={() => remove("actors", a.id)}
                                  readOnly={readOnly}
                                />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {visibleActors.length === 0 && <Empty text="Nenhum ator cadastrado." />}
                  </div>
                </>
              )}
              {section === "agents" && (
                <>
                  <Toolbar
                    title="Agentes regionais"
                    subtitle="Profissionais vinculados ao programa ARI."
                  />
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {profiles.map((p) => (
                      <div className="app-panel p-5 flex items-start gap-4" key={p.id}>
                        <div className="w-11 h-11 shrink-0 rounded-full bg-secondary text-primary grid place-items-center font-bold">
                          {initials(p.full_name)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold">{p.full_name || "Agente regional"}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {p.region || "Região não informada"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {p.governance || "Governança não informada"}
                          </p>
                          {p.phone && <p className="text-xs mt-2">{p.phone}</p>}
                        </div>
                      </div>
                    ))}
                    {profiles.length === 0 && (
                      <div className="app-panel p-5">
                        <Empty text="Nenhum perfil de agente preenchido ainda. Atualize seu perfil para aparecer aqui." />
                      </div>
                    )}
                  </div>
                </>
              )}
              {section === "approvals" && role === "admin" && (
                <>
                  <Toolbar
                    title="Aprovação de contas"
                    subtitle="Analise novas solicitações de acesso ao sistema."
                  />
                  <div className="app-panel overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted text-muted-foreground text-xs uppercase">
                        <tr>
                          <th className="p-4">Usuário</th>
                          <th className="p-4">Tipo solicitado</th>
                          <th className="p-4">Situação</th>
                          <th className="p-4">Solicitado em</th>
                          <th className="p-4">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {approvalRequests.map((request) => (
                          <tr key={request.id} className="border-t">
                            <td className="p-4 font-bold">
                              {request.full_name}
                              <span className="block font-normal text-xs text-muted-foreground mt-1">
                                {request.email}
                              </span>
                            </td>
                            <td className="p-4">
                              {request.requested_role === "coordinator" ? "Coordenação" : "Agente"}
                            </td>
                            <td className="p-4">
                              <span className="rounded bg-secondary text-secondary-foreground px-2 py-1 text-xs">
                                {request.approval_status === "rejected" ? "Recusada" : "Pendente"}
                              </span>
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              {new Date(request.created_at).toLocaleDateString("pt-BR")}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => void decideAccount(request.id, "approved")}
                                >
                                  <Check /> Aprovar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void decideAccount(request.id, "rejected")}
                                >
                                  <X /> Recusar
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {approvalRequests.length === 0 && (
                      <Empty text="Nenhuma conta aguardando análise." />
                    )}
                  </div>
                </>
              )}
              {section === "reports" && (
                <>
                  <div className="flex flex-wrap justify-between gap-4 mb-7">
                    <div>
                      <h2 className="text-2xl font-bold">Relatórios e indicadores</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Resultados consolidados das atividades cadastradas.
                      </p>
                    </div>
                    <div className="flex gap-2 no-print">
                      <Button variant="outline" onClick={() => setModal("report")}>
                        <FileText /> Relatório mensal (.docx)
                      </Button>
                      <Button variant="outline" onClick={() => window.print()}>
                        <Download /> Imprimir
                      </Button>
                      <Button onClick={exportCSV}>
                        <Download /> Exportar CSV
                      </Button>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                    <Metric
                      icon={ClipboardList}
                      label="Atividades"
                      value={visibleActivities.length}
                      note="Registradas"
                    />
                    <Metric
                      icon={Check}
                      label="Concluídas"
                      value={visibleActivities.filter((a) => a.status === "Concluída").length}
                      note="Finalizadas"
                    />
                    <Metric
                      icon={Building2}
                      label="Organizações"
                      value={visibleOrganizations.length}
                      note="Cadastradas"
                    />
                    <Metric
                      icon={Target}
                      label="Taxa de conclusão"
                      value={`${visibleActivities.length ? Math.round((visibleActivities.filter((a) => a.status === "Concluída").length / visibleActivities.length) * 100) : 0}%`}
                      note="Das ações registradas"
                    />
                  </div>
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div className="app-panel p-6">
                      <h3 className="font-bold mb-6">Atividades por tipo</h3>
                      <div className="space-y-4">
                        {activityKinds.map((kind) => (
                          <Bar
                            key={kind}
                            label={kind}
                            count={visibleActivities.filter((a) => a.kind === kind).length}
                            total={visibleActivities.length}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="app-panel p-6">
                      <h3 className="font-bold mb-6">Situação das atividades</h3>
                      <div className="space-y-4">
                        {statuses.map((status) => (
                          <Bar
                            key={status}
                            label={status}
                            count={visibleActivities.filter((a) => a.status === status).length}
                            total={visibleActivities.length}
                          />
                        ))}
                      </div>
                      <h3 className="font-bold mt-10 mb-5">Etapas de atendimento</h3>
                      <div className="space-y-4">
                        {stages.map((stage) => (
                          <Bar
                            key={stage}
                            label={stage}
                            count={visibleOrganizations.filter((o) => o.stage === stage).length}
                            total={visibleOrganizations.length}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="app-panel mt-6 overflow-x-auto">
                    <ActivityTable
                      rows={filtered}
                      organizations={organizations}
                      agentChoices={agentChoices}
                      onEdit={(a) => open("activity", a)}
                      onDelete={(a) => remove("activities", a.id)}
                      readOnly
                    />
                  </div>
                </>
              )}
            </>
          )}
        </main>
        <Footer />
      </div>
      {modal && modal !== "import" && modal !== "report" && (
        <Editor
          key={modal}
          kind={modal}
          row={editing}
          userId={session.user.id}
          userName={displayName}
          organizations={organizations}
          actors={orderedActors}
          coordinationParticipants={coordinationParticipants}
          agentChoices={agentChoices}
          onClose={() => setModal(null)}
          onChangePassword={openPassword}
          onSaved={(message) => {
            setModal(null);
            setToast(message || "Registro salvo com sucesso.");
            void workspace.refetch();
          }}
          onError={setToast}
        />
      )}
      {modal === "import" && (
        <ImportModal
          userId={session.user.id}
          activities={activities}
          organizations={organizations}
          onClose={() => setModal(null)}
          onDone={(message) => {
            setToast(message);
            void workspace.refetch();
          }}
        />
      )}
      {modal === "report" && (
        <ReportModal
          activities={visibleActivities}
          actorCount={visibleActors.length}
          plan={visiblePlanProgress}
          userName={displayName}
          userId={session.user.id}
          onClose={() => setModal(null)}
        />
      )}
      {strategyImport && (
        <StrategyImportModal
          userId={session.user.id}
          actions={strategyActions}
          onClose={() => setStrategyImport(false)}
          onDone={(message) => {
            setStrategyImport(false);
            setToast(message);
            void workspace.refetch();
          }}
        />
      )}
    </div>
  );
}
