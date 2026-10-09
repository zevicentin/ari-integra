import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X, FileText } from "lucide-react";
import { accumulatedOf, brDate, buildMonthlyReport, indicatorCounts, MONTHS_PT, stripDateSuffix, type ReportActivity, filterMonthActivities, type ReportEvidence } from "@/lib/monthlyReport";
import type { Json } from "@/integrations/supabase/types";
import { field } from "@/components/field";
import { indicatorCatalog, indicatorLabel } from "@/lib/constants";
import type { ActivityRow } from "@/lib/types";

export const reportCodes = indicatorCatalog.map(item => item.code);

export const toReportActivity = (row: ActivityRow): ReportActivity => ({
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

export const reportMonth = (value: string): { year: number; month: number } | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match || !match[1] || !match[2]) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  return month >= 0 && month <= 11 ? { year, month } : null;
};

export const evidencePaths = (evidence: Json): string[] =>
  (Array.isArray(evidence) ? evidence : []).filter((path): path is string => typeof path === "string");

export async function downscaleImage(blob: Blob): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height, 1));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("este navegador não conseguiu desenhar a imagem");
    context.drawImage(bitmap, 0, 0, width, height);
    const jpeg = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!jpeg) throw new Error("este navegador não conseguiu converter a imagem para JPEG");
    return { bytes: new Uint8Array(await jpeg.arrayBuffer()), width, height };
  } finally {
    bitmap.close();
  }
}

// The report fills the official Word template from public/modelos: the header fields are plain
// text, the twelve SETI indicators keep their computed counts but accept a typed override (a
// currency line, for instance), the REF rows come from the month's own activities, and the
// evidence images are re-encoded to JPEG before being embedded so any upload format fits the
// template's content types. The typed indicator values are kept per account, so the next count
// starts from the accumulated result instead of an empty row: OBR 02 stores the annual maturity
// score that replaces the previous one, ADES-01 sums the month's money into the accumulated value.
export function ReportModal({ activities, actorCount, plan, userName, userId, onClose }: {
  activities: ActivityRow[];
  actorCount: number;
  plan: { total: number; done: number; percent: number | null };
  userName: string;
  userId: string;
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
    ecossistema: "ROLÂNDIA/INOVALÂNDIA",
    setores: "CADEIA DO AGRONEGÓCIO, FABRICAÇÃO ALIMENTÍCIA, ELETROMETALMECÂNICO, TIC",
    gt: "GOVERNANÇA DO ECOSSISTEMA DE INOVAÇÃO DE ROLÂNDIA",
    atores: `em torno de ${actorCount} atores`,
    acoes: plan.total ? `${plan.done} de ${plan.total} ações priorizadas` : "—",
    percentual: plan.percent === null ? "—" : `${plan.percent}%`,
  }));
  const [indicatorValues, setIndicatorValues] = useState<Record<string, { previous: string; current: string }>>({});
  const [savedValues, setSavedValues] = useState<Record<string, { previous: string; current: string; accumulated: string }>>({});
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

  // Pick up the values the account kept in previous reports: the accumulated result becomes the
  // next month's starting point, and OBR 02/ADES-01 also regain their typed month value so the row
  // reads the last known official number instead of an empty zero.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("indicator_values")
        .select("code, previous, current, accumulated")
        .eq("owner_id", userId);
      if (!cancelled && data) setSavedValues(Object.fromEntries(data.map(row => [row.code, row])));
    };
    void load();
    return () => { cancelled = true; };
  }, [userId]);

  const baselineOf = (code: string, key: "previous" | "current"): string => {
    const saved = savedValues[code];
    if (key === "previous") return saved?.accumulated?.trim() ? saved.accumulated : String(counts[code]?.previous ?? 0);
    // ADES-01 starts the month empty so a new award sum is typed without double-counting; OBR 02
    // keeps its annual score visible so it can be replaced.
    if (code === "ADES-01") return "";
    if (code === "OBR 02") return saved?.current?.trim() ? saved.current : String(counts[code]?.current ?? 0);
    return String(counts[code]?.current ?? 0);
  };

  const setHeaderField = (name: string, value: string) => setHeader(current => ({ ...current, [name]: value }));
  const shown = (code: string, key: "previous" | "current") =>
    indicatorValues[code]?.[key] ?? baselineOf(code, key);
  const setIndicator = (code: string, key: "previous" | "current", value: string) =>
    setIndicatorValues(all => {
      const current = all[code] ?? {
        previous: baselineOf(code, "previous"),
        current: baselineOf(code, "current"),
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
      setMessage("Escolha um mês no formato aaaa-mm.");
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
              throw new Error(`Não foi possível autorizar a imagem da atividade "${row.title}": ${error?.message ?? "URL não gerada"}.`);
            }
            const response = await fetch(data.signedUrl);
            if (!response.ok) throw new Error(`Não foi possível baixar a imagem da atividade "${row.title}" (HTTP ${response.status}).`);
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
      // Keep the handwritten values for the next count, best effort: a storage hiccup must not
      // block the report download. Only rows the user touched are written, each one replaced when
      // this account generates another report with the same code.
      const edited = Object.entries(indicatorValues);
      if (edited.length) {
        const rows = edited.map(([code, entry]) => ({
          owner_id: userId,
          code,
          previous: entry.previous,
          current: entry.current,
          accumulated: accumulatedOf(code, entry.previous, entry.current),
          updated_at: new Date().toISOString(),
        }));
        const { error: saveError } = await supabase
          .from("indicator_values")
          .upsert(rows, { onConflict: "owner_id,code" });
        if (saveError) console.warn("Valores dos indicadores não salvos:", saveError.message);
        else setSavedValues(current => ({ ...current, ...Object.fromEntries(rows.map(row => [row.code, row])) }));
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio-mensal-${String(parsed.month + 1).padStart(2, "0")}-${parsed.year}.docx`;
      link.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível gerar o relatório mensal.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="fixed inset-0 z-50 bg-foreground/50 flex justify-end" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label="Relatório mensal em Word" className="bg-background w-full max-w-4xl h-full flex flex-col shadow-xl"><div className="bg-card border-b px-5 md:px-7 py-5 flex items-center justify-between"><div><h2 className="text-xl font-bold">Relatório mensal (.docx)</h2><p className="text-xs text-muted-foreground mt-1">Baixa o modelo oficial preenchido com as atividades do mês, os indicadores e as evidências. Os indicadores digitados ficam salvos para a próxima contagem.</p></div><Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}><X /></Button></div>
  <div className="flex-1 overflow-y-auto px-5 md:px-7 py-6 space-y-5">
    <div className="app-panel p-4 flex flex-wrap items-end gap-4">
      <label className="block min-w-0"><span className="app-label">Mês de referência</span><input className="app-field w-48" type="month" value={monthInput} onChange={e => setMonthInput(e.target.value)} /></label>
      <p className="text-sm text-muted-foreground pb-2">{parsed ? `${monthRows.length} atividade(s) em ${MONTHS_PT[parsed.month]}/${parsed.year}` : "Informe um mês no formato aaaa-mm."}</p>
    </div>
    <div className="app-panel p-4 space-y-3">
      <h3 className="font-bold text-sm">Cabeçalho</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {field("ARI", "ari", header["ari"] ?? "", setHeaderField)}
        {field("Gestor Sebrae", "gestorSebrae", header["gestorSebrae"] ?? "", setHeaderField)}
        {field("Gestor AGEUNI", "gestorAgeuni", header["gestorAgeuni"] ?? "", setHeaderField)}
        {field("Consultor Sênior/Orientador", "consultor", header["consultor"] ?? "", setHeaderField)}
        {field("Ecossistema", "ecossistema", header["ecossistema"] ?? "", setHeaderField)}
        {field("Setores Priorizados do Ecossistema", "setores", header["setores"] ?? "", setHeaderField)}
        {field("GT do Ecossistema", "gt", header["gt"] ?? "", setHeaderField)}
        {field("Número de atores engajados", "atores", header["atores"] ?? "", setHeaderField)}
        {field("Ações do plano realizadas", "acoes", header["acoes"] ?? "", setHeaderField)}
        {field("% de ações concluídas", "percentual", header["percentual"] ?? "", setHeaderField)}
      </div>
    </div>
    <div className="app-panel p-4 space-y-3">
      <div><h3 className="font-bold text-sm">Indicadores</h3><p className="text-xs text-muted-foreground mt-1">O acumulado soma o resultado anterior com o do mês. As referências apontam as linhas da seção REF concluídas no mês. Edite os dois campos quando a contagem não for o número oficial. O que você digita fica salvo para a próxima contagem: o OBR 02 é a pontuação anual de maturidade e o novo valor substitui o anterior; no ADES-01 o valor do mês soma-se ao acumulado.</p></div>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-muted text-muted-foreground text-xs uppercase"><tr><th className="p-3">Indicador</th><th className="p-3">Resultado anterior</th><th className="p-3">Resultado no mês</th><th className="p-3">Acumulado</th><th className="p-3">Referências</th></tr></thead><tbody>{reportCodes.map(code => { const previous = shown(code, "previous"); const current = shown(code, "current"); return <tr key={code} className="border-t"><td className="p-3 font-bold whitespace-nowrap" title={indicatorLabel(code)}>{code}</td><td className="p-3"><input className="app-field w-28" inputMode="decimal" value={previous} aria-label={`Resultado anterior de ${code}`} onChange={e => setIndicator(code, "previous", e.target.value)} /></td><td className="p-3"><input className="app-field w-28" inputMode="decimal" value={current} aria-label={`Resultado no mês de ${code}`} onChange={e => setIndicator(code, "current", e.target.value)} /></td><td className="p-3 whitespace-nowrap">{accumulatedOf(code, previous, current)}</td><td className="p-3 text-xs">{counts[code]?.refs || "—"}</td></tr>; })}</tbody></table></div>
    </div>
    <div className="app-panel p-4 space-y-3">
      <h3 className="font-bold text-sm">Atividade em destaque</h3>
      <div className="grid sm:grid-cols-2 gap-3">{field("Linha da seção REF", "destaquePick", destaquePick, (_, value) => pickDestaque(value), { options: monthRows.map((row, index) => ({ value: String(index), label: `${index + 1} - ${row.title}` })) })}</div>
      {field("Texto do destaque", "destaque", destaque, (_, value) => setDestaque(value), { textarea: true })}
      {field("Dificuldades encontradas no mês", "difficulties", difficulties, (_, value) => setDifficulties(value), { textarea: true })}
    </div>
    <div className="app-panel p-4 space-y-3">
      <h3 className="font-bold text-sm">Evidências</h3>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={withEvidence} disabled={!evidenceCount} onChange={e => setWithEvidence(e.target.checked)} /> Incluir imagens de evidência ({evidenceCount} no mês, até 3 por atividade)</label>
      <p className="text-xs text-muted-foreground">As imagens são baixadas da pasta privada de evidências e embutidas no documento.</p>
    </div>
    {message && <p role="alert" className="bg-secondary text-primary text-sm p-3 rounded">{message}</p>}
  </div>
  <div className="bg-card border-t p-4 md:px-7 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Fechar</Button><Button disabled={busy || !parsed} onClick={() => void generate()}><FileText /> {busy ? "Gerando..." : "Gerar relatório"}</Button></div>
</div></div>;
}
