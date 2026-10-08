import { ChartNoAxesCombined, ClipboardList, Users, Building2, UserCheck, CalendarDays, LayoutDashboard, Activity, Target } from "lucide-react";
import type { Section } from "@/lib/types";

export const activityKinds = ["Atividade geral", "Evento como ouvinte", "Evento como organizador", "Reunião de governança", "Reunião com a coordenação", "Outras reuniões"];

export const axes = ["Governança do Ecossistema", "Programas e Ações de Inovação", "Comunidade Empreendedora", "Ambiente de Inovação", "Relação Academia/Empresa", "Políticas Públicas", "Comunicação", "Captação de Recursos", "Sensibilização de Atores", "Setorial"];

export const statuses = ["Não iniciada", "Iniciada", "Concluída"];

export const indicatorCatalog = [
  { code: "OBR 01", label: "Contratos de Interação e Transferência Tecnológica" },
  { code: "OBR 02", label: "Nível de maturidade do ecossistema" },
  { code: "OBR 03", label: "Mapeamento de Ativos e Soluções para o Desenvolvimento Regional" },
  { code: "OBR 04", label: "Eventos de Disseminação de Conhecimento em Inovação e Empreendedorismo" },
  { code: "ADES-01", label: "Captação de Recursos para Inovação" },
  { code: "ADES-02", label: "Publicações Técnico-Científicas Aplicadas" },
  { code: "ADES-03", label: "Implementação de Tecnologias Verdes, Soluções ESG e Inovação Social" },
  { code: "ADES-04", label: "Empresas e demais entidades atendidas pelo programa" },
  { code: "ADES-05", label: "Rede de Parceiros Mobilizados" },
  { code: "ADES-06", label: "Produtos e Serviços com Selos de Origem/IG" },
  { code: "ADES-07", label: "Fortalecimento do Marco Legal e Institucional de Inovação" },
  { code: "ADES-08", label: "Apoio e Desenvolvimento em Ambientes de Incubação" },
] as const;

export const indicatorLabel = (code: string) => indicatorCatalog.find(i => i.code === code)?.label || code;

export const stages = ["Prospecção", "Diagnóstico", "Encaminhamento", "Acompanhamento"];

export const nav: { id: Section; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard }, { id: "activities", label: "Atividades", icon: ClipboardList },
  { id: "strategy", label: "Plano de estratégias", icon: Target },
  { id: "calendar", label: "Agenda", icon: CalendarDays }, { id: "organizations", label: "Organizações", icon: Building2 },
  { id: "actors", label: "Atores da governança", icon: Users }, { id: "agents", label: "Agentes", icon: Activity },
  { id: "reports", label: "Relatórios", icon: ChartNoAxesCombined }, { id: "approvals", label: "Aprovar contas", icon: UserCheck },
];

export const dateFieldKeys = ["start_date", "end_date", "birth_date"];

export const dateLabels: Record<string, string> = { start_date: "Início", end_date: "Conclusão", birth_date: "Data de nascimento" };

export const activityDefaults = { kind: "Atividade geral", title: "", description: "", status: "Não iniciada", start_date: "", end_date: "", organization_id: "", axis: "", problem: "", problem_description: "", solution: "", solution_description: "", objectives: "", expected_results: "", achieved_results: "", participants: "", agenda: "", referrals: "", work_done: "" };

export const strategyDefaults = { axis: "", status: "Não iniciada", description: "", problem: "", problem_description: "", solution: "", solution_description: "" };

export const orgDefaults = { name: "", kind: "Empresa", document: "", sector: "", size: "", maturity: "", region: "", contact: "", email: "", phone: "", address: "", stage: "Prospecção", demand: "", referral: "", notes: "" };

export const actorDefaults = { institution_type: "", document: "", institution_name: "", phone: "", address: "", actor_name: "", position: "", birth_date: "", email: "" };

export const MAX_PDFS = 20;

export const MAX_PDF_BYTES = 30 * 1024 * 1024;

export const MAX_MD_BYTES = 512 * 1024;
