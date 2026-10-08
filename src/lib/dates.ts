import { dateLabels, dateFieldKeys } from "@/lib/constants";

export const formatDate = (value?: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—";

export const monthLabel = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

export const isoToBrDate = (value: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
};

// The form holds dd/mm/aaaa; the database (date columns and the outcomes jsonb) keeps yyyy-mm-dd.
export function toIsoDate(value: string, label: string) {
  const raw = (value || "").trim();
  if (!raw) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (!m) throw new Error(`${label}: informe a data completa no formato dd/mm/aaaa.`);
  const [, dd, mm, yyyy] = m;
  const parsed = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
  if (Number.isNaN(parsed.getTime()) || parsed.getMonth() + 1 !== Number(mm) || parsed.getDate() !== Number(dd)) throw new Error(`${label}: data inválida (${raw}).`);
  return `${yyyy}-${mm}-${dd}`;
}

export const isoDates = <T extends object>(item: T) => { const record = item as Record<string, unknown>; return Object.fromEntries(dateFieldKeys.filter(k => k in record).map(k => [k, toIsoDate(String(record[k] ?? ""), dateLabels[k] || k) || ""])); };
