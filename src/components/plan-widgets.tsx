import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Pencil } from "lucide-react";
import { field } from "@/components/field";
import { dateLabels, statuses } from "@/lib/constants";
import { toIsoDate, isoToBrDate } from "@/lib/dates";
import { dateMask } from "@/lib/masks";
import { emptyPlanTask, completionOf, type PlanActivity, taskPeriod, type PlanTask } from "@/lib/plan";

/**
 * One inline form for a plan task, whatever the level: an activity and a subtask are both a
 * description, a status and the period it runs over, so both share this form, this validation and
 * the draft it holds. `which` tells the caller whether a task is being added or replaces one.
 */
export function useTaskEditor(save: (task: PlanTask, which: number | "new") => void) {
  const [open, setOpen] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<PlanTask>(emptyPlanTask());
  const [problem, setProblem] = useState("");
  const set = (name: string, value: string) => setDraft(current => ({ ...current, [name]: value }));
  const start = (which: number | "new", task?: PlanTask) => { setProblem(""); setDraft(task || emptyPlanTask()); setOpen(which); };
  const close = () => { setOpen(null); setDraft(emptyPlanTask()); setProblem(""); };
  function submit() {
    const description = draft.description.trim();
    if (!description) { setProblem("Informe a descrição da tarefa."); return; }
    let start_date = "";
    let end_date = "";
    try {
      start_date = toIsoDate(draft.start_date, dateLabels['start_date'] || "Início") || "";
      end_date = toIsoDate(draft.end_date, dateLabels['end_date'] || "Conclusão") || "";
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Confira as datas informadas.");
      return;
    }
    if (start_date && end_date && end_date < start_date) { setProblem("A data de conclusão vem antes da data de início."); return; }
    save({ description, status: draft.status || statuses[0] || "", start_date: isoToBrDate(start_date), end_date: isoToBrDate(end_date) }, open ?? "new");
    close();
  }
  return { open, draft, set, problem, start, close, submit };
}

export function TaskForm({ draft, set, problem }: { draft: PlanTask; set: (name: string, value: string) => void; problem: string }) {
  // The name given to field() is the key it writes to in the draft, so it has to be the very key the
  // task carries: with any other name the typing would land somewhere nothing reads.
  return <>{field("Descrição", "description", draft.description, set, { textarea: true, required: true })}{field("Status", "status", draft.status, set, { options: statuses, required: true })}<div className="grid sm:grid-cols-2 gap-3">{field("Início", "start_date", draft.start_date, set, { mask: dateMask })}{field("Conclusão", "end_date", draft.end_date, set, { mask: dateMask })}</div>{problem && <p className="text-xs text-destructive">{problem}</p>}</>;
}

/**
 * The subtasks of one activity, listed and written straight from the plan page. They are where the
 * activity's own share of the execution percentage comes from, so each row says its status and the
 * list says how many of them are concluded.
 */
export function SubtaskList({ activity, onChange, readOnly }: { activity: PlanActivity; onChange: (next: PlanActivity) => void; readOnly?: boolean | undefined }) {
  const subtasks = activity.subtasks;
  const { open, draft, set, problem, start, close, submit } = useTaskEditor((task, which) => onChange({ ...activity, subtasks: which === "new" ? [...subtasks, task] : subtasks.map((item, i) => i === which ? task : item) }));
  return <div className="mt-1.5">
    {subtasks.length > 0 && <ul className="space-y-1">{subtasks.map((task, i) => <li key={i} className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs break-words">{task.description}</p><p className="text-[11px] text-muted-foreground">{task.status}{taskPeriod(task) ? ` · ${taskPeriod(task)}` : ""}</p></div>{!readOnly && <div className="flex shrink-0"><Button type="button" variant="ghost" size="icon" title="Editar subtarefa" aria-label={`Editar subtarefa ${i + 1}`} onClick={() => start(i, task)}><Pencil /></Button><Button type="button" variant="ghost" size="icon" title="Remover subtarefa" aria-label={`Remover subtarefa ${i + 1}`} onClick={() => onChange({ ...activity, subtasks: subtasks.filter((_, index) => index !== i) })}><Trash2 /></Button></div>}</li>)}</ul>}
    {open !== null && <div className="mt-2 space-y-3 border border-border rounded p-3"><TaskForm draft={draft} set={set} problem={problem} /><div className="flex gap-2"><Button type="button" size="sm" onClick={submit}>Salvar</Button><Button type="button" size="sm" variant="outline" onClick={close}>Cancelar</Button></div></div>}
    {!readOnly && open === null && <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs mt-1" onClick={() => start("new")}><Plus /> Inserir subtarefa</Button>}
  </div>;
}

/**
 * The activities of one plan action, listed and written straight from the plan page. Each one says
 * how it is measured — by its subtasks when it has any, by its own status when it has none — so the
 * percentage on top can always be traced back to what is on screen.
 */
export function PlanActivities({ activities, onChange, readOnly }: { activities: PlanActivity[]; onChange: (next: PlanActivity[]) => void; readOnly?: boolean | undefined }) {
  const { open, draft, set, problem, start, close, submit } = useTaskEditor((task, which) => onChange(which === "new"
    ? [...activities, { ...task, subtasks: [] }]
    // Editing an activity keeps the subtasks it already has: they are its children, not a field to rewrite.
    : activities.map((item, i) => i === which ? { ...item, ...task } : item)));
  const measure = (activity: PlanActivity) => {
    const { done, total, bySubtasks } = completionOf(activity);
    return bySubtasks ? `Subtarefas: ${done} de ${total} ${total === 1 ? "concluída" : "concluídas"}` : "Sem subtarefas: conta como tarefa única";
  };
  return <div className="min-w-64">
    {activities.length === 0 && <p className="text-xs text-muted-foreground">Sem atividades.</p>}
    {activities.map((activity, i) => <div key={i} className="border-l-2 border-primary pl-3 py-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-semibold break-words">{activity.description}</p><p className="text-[11px] text-muted-foreground">{activity.status}{taskPeriod(activity) ? ` · ${taskPeriod(activity)}` : ""}</p><p className="text-[11px] text-muted-foreground">{measure(activity)}</p></div>{!readOnly && <div className="flex shrink-0"><Button type="button" variant="ghost" size="icon" title="Editar atividade" aria-label={`Editar atividade ${i + 1}`} onClick={() => start(i, activity)}><Pencil /></Button><Button type="button" variant="ghost" size="icon" title="Remover atividade" aria-label={`Remover atividade ${i + 1}`} onClick={() => onChange(activities.filter((_, index) => index !== i))}><Trash2 /></Button></div>}</div><SubtaskList activity={activity} onChange={next => onChange(activities.map((item, k) => k === i ? next : item))} readOnly={readOnly} /></div>)}
    {open !== null && <div className="mt-2 space-y-3 border-t pt-3"><TaskForm draft={draft} set={set} problem={problem} /><div className="flex gap-2"><Button type="button" size="sm" onClick={submit}>Salvar</Button><Button type="button" size="sm" variant="outline" onClick={close}>Cancelar</Button></div></div>}
    {!readOnly && open === null && <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => start("new")}><Plus /> Inserir atividade</Button>}
  </div>;
}
