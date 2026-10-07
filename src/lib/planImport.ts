/**
 * Import of the strategy plan from Markdown. Unlike the activity import, this file is written by
 * hand with labels the team edits, so every field is read literally: a label owns its text until
 * the next label, and only the axis is matched against the catalog, because the documents spell it
 * in more than one way.
 */
import { matchAxis } from "@/lib/pdfImport";

export type PlanActivity = {
  description: string;
  status: string;
  startDate: string;
  endDate: string;
};

export type StrategyPlanImportRow = {
  id: string;
  include: boolean;
  axis: string;
  status: string;
  description: string;
  problem: string;
  problemDescription: string;
  solution: string;
  solutionDescription: string;
  expectedResults: string[];
  activities: PlanActivity[];
  axisGuess: string;
  source: string;
  notes: string[];
  duplicate: boolean;
};

const norm = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Case and accent insensitive, and kept short so a reworded description still matches the old one. */
export function strategyKey(axis: string, description: string): string {
  return `${norm(axis)}|${norm(description).slice(0, 60)}`;
}

const HEADING = /^#{1,6}\s+(.+?)\s*$/;
const RULE = /^\s*(?:---+|\*\*\*+|___+)\s*$/;
/** `* **Rótulo:** valor`, `- **Rótulo:**` and `1. **Rótulo:**` are all the same label. */
const LABEL = /^\s*(?:[-*+]|\d+[.)])\s*\*\*\s*(.+?)\s*:\s*\*\*\s*(.*)$/;
const LIST_ITEM = /^\s*(?:\d+[.)]|[-*+])\s+(.*)$/;

/**
 * Matched by whole label, so "Descrição" never swallows "Descrição do Problema" the way a prefix
 * match would.
 */
const FIELD: Record<string, string> = {
  "eixo da atividade": "axis",
  status: "status",
  descricao: "description",
  problema: "problem",
  "descricao do problema": "problemDescription",
  solucao: "solution",
  "descricao da solucao": "solutionDescription",
  "resultados esperados": "results",
  atividade: "activities",
};

type Action = {
  heading: string;
  axisGuess: string;
  statuses: string[][];
  values: Record<string, string[]>;
};

type Entry = { field: string; values: string[]; heading: string };

function tokens(source: string): { entries: Entry[] } {
  const entries: Entry[] = [];
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  let heading = "";
  for (const line of lines) {
    const title = line.match(HEADING);
    if (title) {
      heading = title[1] ?? "";
      continue;
    }
    if (RULE.test(line) || !line.trim()) continue;
    const label = line.match(LABEL);
    const last = entries[entries.length - 1];
    if (label) {
      const field = FIELD[norm(label[1] ?? "")];
      const inline = (label[2] ?? "").trim();
      if (field) {
        entries.push({ field, values: inline ? [inline] : [], heading });
        continue;
      }
      if (last) last.values.push((label[1] ?? "").trim());
      continue;
    }
    const item = line.match(LIST_ITEM);
    if (!last) continue;
    // A list item is a value of its own; a bare line continues the value above it.
    if (item) last.values.push((item[1] ?? "").trim());
    else if (last.values.length)
      last.values[last.values.length - 1] = `${last.values[last.values.length - 1]} ${line.trim()}`;
    else last.values.push(line.trim());
  }
  return { entries };
}

/**
 * The document writes one axis per block and repeats the axis label when a block carries several
 * actions, so a new action starts at every axis. That keeps a file without `###` headings
 * importable instead of collapsing it into a single action.
 */
function splitActions(entries: Entry[]): Action[] {
  const actions: Action[] = [];
  let current: Action | null = null;
  for (const entry of entries) {
    if (entry.field === "axis" || !current) {
      current = { heading: entry.heading, axisGuess: "", statuses: [], values: {} };
      actions.push(current);
    }
    if (entry.field === "status") current.statuses.push(entry.values);
    else if (entry.field === "axis") current.axisGuess = entry.values[0] ?? "";
    else current.values[entry.field] = entry.values;
  }
  return actions;
}

function join(values: string[]): string {
  return values
    .map((value) => value.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * A status may carry the day it started, as in "Iniciada em: 30/08/2025". The action has no date
 * column, so the date is handed back for the reviewer instead of being dropped or forced onto an
 * activity. The word before it still has to be a status on its own, otherwise "Realizar visitas
 * técnicas" would pass as a concluded activity.
 */
function readStatus(
  value: string,
  statuses: string[],
  fallback: string,
): { status: string; date: string; matched: boolean } {
  const text = value.replace(/\s+/g, " ").trim();
  const dated = text.match(/^(.*?)\s+em:?\s*(\d{1,2}\s*[/\-.]\s*\d{1,2}\s*[/\-.]\s*\d{2,4})\s*$/);
  const word = (dated?.[1] ?? text).replace(/[.,;]+$/, "").trim();
  const status = statuses.find((item) => norm(item) === norm(word));
  return {
    status: status ?? fallback,
    date: dated?.[2]?.replace(/\s+/g, "") ?? "",
    matched: Boolean(status),
  };
}

export function parseStrategyPlanMarkdown(
  source: string,
  axes: string[],
  statuses: string[],
): { rows: StrategyPlanImportRow[]; warnings: string[] } {
  const fallback = statuses[0] || "";
  const { entries } = tokens(source);
  const actions = splitActions(entries);
  const warnings: string[] = [];
  const rows: StrategyPlanImportRow[] = actions.map((action, index) => {
    const notes: string[] = [];
    const axis = matchAxis(action.axisGuess, axes);
    if (!axis)
      notes.push(`Eixo "${action.axisGuess}" não está na lista: escolha um eixo para esta ação.`);
    const [actionStatus, activityStatus = []] = action.statuses;
    const started = readStatus(actionStatus?.join(" ") || "", statuses, fallback);
    if (started.date)
      notes.push(
        `O documento registra a ação como iniciada em ${started.date}; a ação não tem campo de data, então confirme e anote na atividade.`,
      );
    if (actionStatus?.length && !started.matched)
      notes.push(`Status da ação não reconhecido: "${actionStatus.join(" ")}".`);
    const text = (field: string) => join(action.values[field] ?? []);
    const descriptions = (action.values["activities"] ?? []).filter(Boolean);
    const states = activityStatus.filter(Boolean);
    if (descriptions.length && !states.length)
      notes.push("O bloco não traz o status das atividades: confira cada uma.");
    if (states.length && states.length !== descriptions.length)
      notes.push(
        `O bloco lista ${descriptions.length} atividade(s) e ${states.length} status; a diferença precisa ser conferida.`,
      );
    const activities = descriptions.map((description, position) => {
      const state = readStatus(states[position] ?? "", statuses, fallback);
      if (states[position] && !state.matched)
        notes.push(`Status de atividade não reconhecido: "${states[position]}".`);
      return { description, status: state.status || fallback, startDate: "", endDate: "" };
    });
    const title = action.heading.trim();
    return {
      id: `plan-${index}-${norm(action.axisGuess).slice(0, 12)}`,
      include: Boolean(axis),
      axis,
      status: started.status,
      description: text("description"),
      problem: text("problem"),
      problemDescription: text("problemDescription"),
      solution: text("solution"),
      solutionDescription: text("solutionDescription"),
      expectedResults: (action.values["results"] ?? []).filter(Boolean),
      activities,
      axisGuess: action.axisGuess,
      source: title || `Bloco ${index + 1}`,
      notes,
      duplicate: false,
    };
  });
  if (!rows.length)
    warnings.push(
      "Nenhum rótulo de eixo ou de ação encontrado. O arquivo precisa seguir o modelo em public/modelos/plano-estrategias.md.",
    );
  const unknown = rows.filter((row) => !row.axis).length;
  if (unknown)
    warnings.push(
      `${unknown} ação(ões) ficaram sem eixo reconhecido: escolha o eixo antes de importar.`,
    );
  return { rows, warnings };
}

export async function readStrategyPlanFiles(
  files: File[],
  axes: string[],
  statuses: string[],
  known: Set<string>,
): Promise<{ rows: StrategyPlanImportRow[]; text: string; files: number; warnings: string[] }> {
  const rows: StrategyPlanImportRow[] = [];
  const warnings: string[] = [];
  const chunks: string[] = [];
  for (const file of files) {
    const raw = await file.text();
    chunks.push(`# ${file.name}\n\n${raw}`);
    const parsed = parseStrategyPlanMarkdown(raw, axes, statuses);
    rows.push(...parsed.rows);
    for (const warning of parsed.warnings) warnings.push(`${file.name}: ${warning}`);
  }
  for (const row of rows) {
    const key = strategyKey(row.axis || row.axisGuess, row.description);
    row.duplicate = known.has(key);
    if (row.duplicate) row.include = false;
  }
  return { rows, text: chunks.join("\n\n"), files: files.length, warnings };
}
