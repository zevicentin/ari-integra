import type { Database } from "@/integrations/supabase/types";

export type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];

export type Actor = Database["public"]["Tables"]["actors"]["Row"];

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type StrategyAction = Database["public"]["Tables"]["strategy_actions"]["Row"];

export type CoordinationParticipant = Database["public"]["Functions"]["coordination_participants"]["Returns"][number];

export type AgentChoice = Database["public"]["Functions"]["activity_agent_choices"]["Returns"][number];

export type Section = "overview" | "activities" | "strategy" | "calendar" | "organizations" | "actors" | "agents" | "reports" | "approvals";

export type ApprovalRequest = { id: string; full_name: string; email: string; requested_role: "agent" | "coordinator" | "admin" | "viewer" | null; approval_status: string; created_at: string };
