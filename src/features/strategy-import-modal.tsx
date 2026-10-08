import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X, Upload, Trash2, Check, Plus, FileText } from "lucide-react";
import { readStrategyPlanFiles, type StrategyPlanImportRow, strategyKey } from "@/lib/planImport";
import type { Json } from "@/integrations/supabase/types";
import { field } from "@/components/field";
import { statuses, MAX_PDFS, axes, MAX_MD_BYTES } from "@/lib/constants";
import { toIsoDate } from "@/lib/dates";
import { confirmed, dateMask } from "@/lib/masks";
import type { StrategyAction } from "@/lib/types";

/** Draft shape read from the Markdown plan, before the dates are stored as ISO. */
export type ImportedPlanActivity = StrategyPlanImportRow["activities"][number];

export function StrategyImportModal({ onClose, userId, actions, onDone }: { onClose: () => void; userId: string; actions: StrategyAction[]; onDone: (message: string) => void }) {
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
      const parts = [`Li ${out.files} arquivo(s) e encontrei ${out.rows.length} ação(ões) do plano.`];
      if (out.warnings.length) parts.push(...out.warnings);
      setSummary(parts.join(" "));
      if (!out.rows.length) setMessage("Não encontrei nenhum rótulo de eixo neste arquivo. Confira se ele segue o modelo em public/modelos/plano-estrategias.md.");
    } catch (error) { setMessage(`Não consegui ler o arquivo: ${reason(error)}`); }
    finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setMessage("");
    const failed: { title: string; reason: string }[] = [];
    let ok = 0;
    for (const row of chosen) {
      const label = row.description.slice(0, 60) || row.axisGuess || "ação sem descrição";
      try {
        if (!axes.includes(row.axis)) throw new Error("escolha um eixo na lista");
        const activities = row.activities
          .filter(activity => activity.description.trim())
          .map(activity => ({
            description: activity.description.trim(),
            status: statuses.includes(activity.status) ? activity.status : fallbackStatus,
            start_date: toIsoDate(activity.startDate, "Data de início"),
            end_date: toIsoDate(activity.endDate, "Data de conclusão"),
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
        }).select().single(), "a ação do plano importada");
        ok++;
      } catch (error) { failed.push({ title: label, reason: reason(error) }); }
    }
    setBusy(false);
    setResult({ ok, failed });
    if (ok) onDone(`${ok} ação(ões) do plano importada(s).`);
  };

  return <div className="fixed inset-0 z-50 bg-foreground/50 flex justify-end" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label="Importar plano de estratégias em Markdown" className="bg-background w-full max-w-4xl h-full flex flex-col shadow-xl"><div className="bg-card border-b px-5 md:px-7 py-5 flex items-center justify-between"><div><h2 className="text-xl font-bold">Importar plano de estratégias em Markdown</h2><p className="text-xs text-muted-foreground mt-1">Cadastre as ações do plano a partir de um arquivo <b>.md</b> no modelo do sistema. Um mesmo eixo pode ter várias ações. Nada é gravado antes da sua conferência.</p></div><Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}><X /></Button></div>
  <div className="flex-1 overflow-y-auto px-5 md:px-7 py-6 space-y-5">
    <div className="app-panel p-4 space-y-3">
      <label className="flex gap-2 items-center border border-dashed rounded-md p-4 text-sm cursor-pointer hover:bg-muted"><Upload size={17} /> Selecionar plano em Markdown<input type="file" accept=".md,.markdown,text/markdown,text/plain" multiple className="sr-only" onChange={e => { const picked = Array.from(e.target.files || []); const bad = picked.filter(file => !/\.(md|markdown)$/i.test(file.name)); if (bad.length) setMessage(`"${bad[0]?.name ?? "arquivo"}" não é um arquivo Markdown.`); const good = picked.filter(file => !bad.includes(file) && file.size <= MAX_MD_BYTES); if (good.length !== picked.length - bad.length) setMessage(`Arquivos de até ${Math.round(MAX_MD_BYTES / 1024)} KB por vez.`); if (picked.length - bad.length > MAX_PDFS) setMessage(`Selecione no máximo ${MAX_PDFS} arquivos por vez.`); setFiles(good.slice(0, MAX_PDFS)); setRows([]); setResult(null); }} /></label>
      {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} arquivo(s): {files.map(file => file.name).join(", ")}</p>}
      <p className="text-xs text-muted-foreground">Cada bloco do arquivo vira uma ação, lida pelos rótulos <b>Eixo da atividade</b>, <b>Status</b>, <b>Descrição</b>, <b>Problema</b>, <b>Solução</b>, <b>Resultados esperados</b> e <b>Atividade</b>. O modelo está em <code className="text-foreground">public/modelos/plano-estrategias.md</code>.</p>
      <Button disabled={!files.length || busy} onClick={read}><FileText /> {rows.length ? "Releer o arquivo" : "Extrair ações"}</Button>
      {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
    </div>
    {rows.length > 0 && <>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm"><b>{rows.length}</b> ação(ões) encontradas, <b>{chosen.length}</b> marcada(s) para importar.</p><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setRows(rows.map(row => ({ ...row, include: !row.include })))}>Inverter seleção</Button><Button variant="outline" size="sm" onClick={() => setRows(rows.map(row => ({ ...row, include: !isDuplicate(row) && Boolean(row.axis) })))}>Marcar não duplicadas</Button></div></div>
      <div className="space-y-3">{rows.map((row, rowIndex) => { const duplicate = isDuplicate(row); return <div key={row.id} className={`app-panel p-4 ${row.include ? "" : "opacity-60"}`}>
        <div className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary" aria-label={`Importar ${row.description || `ação ${rowIndex + 1}`}`} checked={row.include} onChange={e => patch(row.id, { include: e.target.checked })} /><div className="min-w-0 flex-1 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            {field("Eixo da atividade", "axis", row.axis, edit(row.id), { options: axes })}
            {field("Status da ação", "status", row.status, edit(row.id), { options: statuses })}
            {field("Problema", "problem", row.problem, edit(row.id))}
            {field("Solução", "solution", row.solution, edit(row.id))}
          </div>
          {field("Descrição da atividade", "description", row.description, edit(row.id), { textarea: true })}
          {field("Descrição do problema", "problemDescription", row.problemDescription, edit(row.id), { textarea: true })}
          {field("Descrição da solução", "solutionDescription", row.solutionDescription, edit(row.id), { textarea: true })}
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
                <input className="app-field sm:col-span-2" value={activity.description} placeholder="Descrição da atividade" onChange={e => patchActivity(row.id, ai, { description: e.target.value })} />
                <select className="app-field" value={activity.status} onChange={e => patchActivity(row.id, ai, { status: e.target.value })}><option value="">Selecione</option>{statuses.map(status => <option key={status}>{status}</option>)}</select>
                <input className="app-field" value={activity.startDate} placeholder="Início (dd/mm/aaaa)" inputMode="numeric" onChange={e => patchActivity(row.id, ai, { startDate: dateMask(e.target.value) })} />
                <input className="app-field" value={activity.endDate} placeholder="Conclusão (dd/mm/aaaa)" inputMode="numeric" onChange={e => patchActivity(row.id, ai, { endDate: dateMask(e.target.value) })} />
              </div><Button type="button" variant="ghost" size="icon" aria-label={`Descartar atividade ${ai + 1}`} onClick={() => dropActivity(row.id, ai)}><Trash2 /></Button></div>
            </div>)}
          </div>
          {duplicate && <p className="text-xs text-primary flex items-center gap-1.5"><Check size={13} /> Já existe uma ação do plano com este eixo e descrição - desmarcada para não duplicar.</p>}
          {row.notes.length > 0 && <ul className="text-xs text-muted-foreground space-y-0.5">{row.notes.map(note => <li key={note}>• {note}</li>)}</ul>}
          <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Bloco lido do arquivo</summary><p className="mt-1.5 break-words bg-muted/50 rounded p-2">{row.source}</p></details>
        </div><Button variant="ghost" size="icon" aria-label={`Descartar ${row.description || `ação ${rowIndex + 1}`}`} onClick={() => setRows(rows.filter(item => item.id !== row.id))}><Trash2 /></Button></div>
      </div>; })}</div>
    </>}
    {text && <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Arquivo lido</summary><pre className="mt-2 max-h-64 overflow-auto text-xs bg-muted/50 rounded p-3 whitespace-pre-wrap break-words">{text}</pre></details>}
    {result && <div className="app-panel p-4 space-y-2"><p className="text-sm"><b>{result.ok}</b> ação(ões) do plano cadastrada(s).</p>{result.failed.length > 0 && <div><p className="text-sm text-primary"><b>{result.failed.length}</b> não foram importadas:</p><ul className="text-xs text-muted-foreground mt-1 space-y-0.5">{result.failed.map((item, i) => <li key={i}>• {item.title}: {item.reason}</li>)}</ul></div>}</div>}
    {message && <p role="alert" className="bg-secondary text-primary text-sm p-3 rounded">{message}</p>}
  </div>
  <div className="bg-card border-t p-4 md:px-7 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Fechar</Button><Button disabled={!chosen.length || busy} onClick={save}>{busy && !rows.length ? "Extraindo..." : busy ? "Importando..." : `Importar ${chosen.length} ação(ões)`}</Button></div>
</div></div>;
}
