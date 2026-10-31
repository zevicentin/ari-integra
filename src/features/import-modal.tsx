import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X, Upload, Trash2, Check, FileText } from "lucide-react";
import { importFiles, dedupeKey, type ImportRow } from "@/lib/pdfImport";
import type { Json } from "@/integrations/supabase/types";
import { field } from "@/components/field";
import { MAX_PDF_BYTES, statuses, MAX_PDFS, activityDefaults, activityKinds } from "@/lib/constants";
import { toIsoDate, isoToBrDate } from "@/lib/dates";
import { confirmed, dateMask } from "@/lib/masks";
import type { ActivityRow, Organization } from "@/lib/types";

/**
 * The title an imported row will end up with. The review list and the duplicate
 * check have to use the same rule as the insert, otherwise a generated title such
 * as "Plano de estratégias - Eixo ..." would hide the duplicate of the next import.
 */
export function importedTitle(row: ImportRow): string {
  const isMeeting = row.kind.includes("Reuni");
  if (isMeeting && (!row.title || row.title === row.kind)) return `${row.kind}${row.startDate ? ` - ${row.startDate}` : ""}`;
  return row.title || row.kind;
}

export function ImportModal({ onClose, userId, activities, organizations, onDone }: { onClose: () => void; userId: string; activities: ActivityRow[]; organizations: Organization[]; onDone: (message: string) => void }) {
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
  const edit = (id: string) => (name: string, value: string) => patch(id, name === "kind" && value === "Reunião de governança" ? { kind: value, status: "Concluída" } : { [name]: value } as Partial<ImportRow>);
  const isDuplicate = (row: ImportRow) => row.duplicate || known.has(dedupeKey(importedTitle(row), row.startDate));

  const read = async () => {
    setBusy(true); setMessage(""); setResult(null); setSummary("");
    try {
      const out = await importFiles(files, swap, activityKinds, statuses);
      // A row that already exists in the database arrives unchecked, so re-importing
      // the same report cannot create duplicates by accident.
      const prepared = out.rows.map(row => (known.has(dedupeKey(importedTitle(row), row.startDate)) ? { ...row, include: false } : row));
      setRows(prepared); setOrgPick({}); setText(out.text);
      const parts = [`Li ${out.pages} página(s) de ${out.files} arquivo(s) e encontrei ${out.rows.length} atividade(s).`];
      if (out.dropped.length) parts.push(`Ignorei ${out.dropped.length} título(s)/seção(ões) fora de um registro: ${out.dropped.slice(0, 5).map(item => `"${item.slice(0, 40)}"`).join(", ")}${out.dropped.length > 5 ? ", …" : ""}.`);
      if (out.orphanBlocks) parts.push(`${out.orphanBlocks} trecho(s) sem data não entraram na lista.`);
      setSummary(parts.join(" "));
      if (!out.rows.length) setMessage("Não encontrei nenhuma linha com data. Confira se o arquivo segue o modelo em public/modelos/atividades.md.");
    } catch (error) { setMessage(`Não consegui ler o arquivo: ${error instanceof Error ? error.message : "erro desconhecido"}`); }
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
        const startDate = toIsoDate(row.startDate, "Data de início");
        const endDate = toIsoDate(row.endDate, "Data de conclusão");
        const title = importedTitle(row);
        confirmed(await supabase.from("activities").insert({
          ...activityDefaults,
          kind: row.kind,
          title,
          description: row.description,
          objectives: row.objectives,
          expected_results: row.expectedResults,
          achieved_results: row.achievedResults,
          status: row.kind === "Reunião de governança" ? "Concluída" : row.status,
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

  return <div className="fixed inset-0 z-50 bg-foreground/50 flex justify-end" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label="Importar relatórios em Markdown" className="bg-background w-full max-w-4xl h-full flex flex-col shadow-xl"><div className="bg-card border-b px-5 md:px-7 py-5 flex items-center justify-between"><div><h2 className="text-xl font-bold">Importar relatórios em Markdown</h2><p className="text-xs text-muted-foreground mt-1">Cadastre atividades a partir de relatórios em Markdown. Nada é gravado antes da sua conferência.</p></div><Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}><X /></Button></div>
  <div className="flex-1 overflow-y-auto px-5 md:px-7 py-6 space-y-5">
    <div className="app-panel p-4 space-y-3">
      <label className="flex gap-2 items-center border border-dashed rounded-md p-4 text-sm cursor-pointer hover:bg-muted"><Upload size={17} /> Selecionar relatórios em Markdown<input type="file" accept=".md,.markdown,text/markdown,text/plain" multiple className="sr-only" onChange={e => { const picked = Array.from(e.target.files || []); const bad = picked.filter(file => !/\.(md|markdown|txt)$/i.test(file.name) && file.type !== "text/markdown" && file.type !== "text/plain"); if (bad.length) setMessage(`"${bad[0]?.name ?? "arquivo"}" não é um arquivo Markdown ou texto.`); const good = picked.filter(file => !bad.includes(file) && file.size <= MAX_PDF_BYTES); if (picked.length - bad.length > MAX_PDFS) setMessage(`Selecione no máximo ${MAX_PDFS} arquivos por vez.`); setFiles(good.slice(0, MAX_PDFS)); setRows([]); setResult(null); }} /></label>
      {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} arquivo(s): {files.map(pdf => pdf.name).join(", ")}</p>}
      <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Opções de leitura</summary><div className="mt-3 space-y-3">
        <label className="flex items-start gap-2.5"><input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={swap} onChange={e => setSwap(e.target.checked)} /><span className="text-sm">Datas no formato <b>mm/dd/aaaa</b><span className="block text-xs text-muted-foreground">Marque apenas se o relatórioexports o dia e o mês invertidos. Datas impossíveis são corrigidas sozinhas.</span></span></label>
      </div></details>
      <Button disabled={!files.length || busy} onClick={read}><FileText /> {rows.length ? "Releer os arquivos" : "Extrair atividades"}</Button>
      {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
    </div>
    {rows.length > 0 && <>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm"><b>{rows.length}</b> atividade(s) encontradas, <b>{chosen.length}</b> marcada(s) para importar.</p><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setRows(rows.map(row => ({ ...row, include: !row.include })))}>Inverter seleção</Button><Button variant="outline" size="sm" onClick={() => setRows(rows.map(row => ({ ...row, include: !isDuplicate(row) })))}>Marcar não duplicadas</Button></div></div>
      <div className="space-y-3">{rows.map(row => { const duplicate = isDuplicate(row); return <div key={row.id} className={`app-panel p-4 ${row.include ? "" : "opacity-60"}`}>
        <div className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary" aria-label={`Importar ${row.title}`} checked={row.include} onChange={e => patch(row.id, { include: e.target.checked })} /><div className="min-w-0 flex-1 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            {field("Data de início", "startDate", row.startDate, edit(row.id), { mask: dateMask })}
            {field("Data de conclusão", "endDate", row.endDate, edit(row.id), { mask: dateMask })}
            {field("Título", "title", row.title, edit(row.id))}
            {field("Tipo de Atividade", "kind", row.kind, edit(row.id), { options: activityKinds })}
            {field("Status", "status", row.status, edit(row.id), { options: statuses })}
            {field("Organização vinculada", "organization_id", orgPick[row.id] || "", (name, value) => setOrgPick({ ...orgPick, [row.id]: value }), { options: [{ value: "", label: "Nenhuma" }, ...organizations.map(org => ({ value: org.id, label: org.name }))] })}
          </div>
          {field("Descrição da Atividade", "description", row.description, edit(row.id), { textarea: true })}
          {field("Objetivos", "objectives", row.objectives, edit(row.id), { textarea: true })}
          {field("Resultados Esperados", "expectedResults", row.expectedResults, edit(row.id), { textarea: true })}
          {field("Resultados Alcançados", "achievedResults", row.achievedResults, edit(row.id), { textarea: true })}
          {duplicate && <p className="text-xs text-primary flex items-center gap-1.5"><Check size={13} /> Já existe uma atividade com este título e data — desmarcada para não duplicar.</p>}
          {row.notes.length > 0 && <ul className="text-xs text-muted-foreground space-y-0.5">{row.notes.map(note => <li key={note}>• {note}</li>)}</ul>}
        </div><Button variant="ghost" size="icon" aria-label={`Descartar ${row.title}`} onClick={() => setRows(rows.filter(item => item.id !== row.id))}><Trash2 /></Button></div>
      </div>; })}</div>
    </>}
    {text && <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Texto bruto extraído dos arquivos</summary><pre className="mt-2 max-h-64 overflow-auto text-xs bg-muted/50 rounded p-3 whitespace-pre-wrap break-words">{text}</pre></details>}
    {result && <div className="app-panel p-4 space-y-2"><p className="text-sm"><b>{result.ok}</b> atividade(s) cadastrada(s).</p>{result.failed.length > 0 && <div><p className="text-sm text-primary"><b>{result.failed.length}</b> não foram importadas:</p><ul className="text-xs text-muted-foreground mt-1 space-y-0.5">{result.failed.map((item, i) => <li key={i}>• {item.title}: {item.reason}</li>)}</ul></div>}</div>}
    {message && <p role="alert" className="bg-secondary text-primary text-sm p-3 rounded">{message}</p>}
  </div>
  <div className="bg-card border-t p-4 md:px-7 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Fechar</Button><Button disabled={!chosen.length || busy} onClick={save}>{busy && !rows.length ? "Extraindo..." : busy ? "Importando..." : `Importar ${chosen.length} atividade(s)`}</Button></div>
</div></div>;
}
