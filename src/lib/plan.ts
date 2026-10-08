import type { Json } from "@/integrations/supabase/types";
import { isoToBrDate, isoDates } from "@/lib/dates";

// A plan task lives in dd/mm/aaaa from the editor on, so the period is written straight from the
// task: formatDate only reads yyyy-mm-dd and would print "Invalid Date" here.
export const taskPeriod = (task: PlanTask) => !task.start_date && !task.end_date ? "" : task.end_date ? `${task.start_date || "—"} a ${task.end_date}` : `a partir de ${task.start_date}`;

export type LinkedActivity = { description: string; status: string; start_date: string; end_date: string };

export type Outcome = { title: string; status: string; start_date: string; end_date: string; activities: LinkedActivity[] };

// A plan task is what the execution percentage is measured in: a description, a status and the
// period it runs over. An activity of the plan is one of those tasks and may hold any number of
// subtasks of the very same shape, so both levels are written and read with one single set of rules.
export type PlanTask = { description: string; status: string; start_date: string; end_date: string };

export type PlanActivity = PlanTask & { subtasks: PlanTask[] };

export const emptyPlanTask = (): PlanTask => ({ description: "", status: "Não iniciada", start_date: "", end_date: "" });

export const emptyPlanActivity = (): PlanActivity => ({ ...emptyPlanTask(), subtasks: [] });

// An activity that has subtasks is measured by them, and one without subtasks counts as a single
// task judged by its own status: that is the share the activity adds to the plan's percentage.
export const completionOf = (activity: PlanActivity) => {
  const subtasks = activity.subtasks.filter(task => task.description.trim());
  if (subtasks.length > 0) {
    const done = subtasks.filter(task => task.status === "Concluída").length;
    return { share: done / subtasks.length, done, total: subtasks.length, bySubtasks: true };
  }
  const done = activity.status === "Concluída" ? 1 : 0;
  return { share: done, done, total: 1, bySubtasks: false };
};

export const emptyLinkedActivity = (): LinkedActivity => ({ description: "", status: "Não iniciada", start_date: "", end_date: "" });

export const normalizeOutcomes = (value: Json): Outcome[] => Array.isArray(value) ? value.filter((item): item is Record<string, Json | undefined> => Boolean(item) && typeof item === "object" && !Array.isArray(item)).map(item => ({
  title: typeof item['title'] === "string" ? item['title'] : "",
  status: typeof item['status'] === "string" ? item['status'] : "Não iniciada",
  start_date: isoToBrDate(typeof item['start_date'] === "string" ? item['start_date'] : ""),
  end_date: isoToBrDate(typeof item['end_date'] === "string" ? item['end_date'] : ""),
  activities: Array.isArray(item['activities']) ? item['activities'].filter((activity): activity is Record<string, Json | undefined> => Boolean(activity) && typeof activity === "object" && !Array.isArray(activity)).map(activity => ({
    description: typeof activity['description'] === "string" ? activity['description'] : "",
    status: typeof activity['status'] === "string" ? activity['status'] : "Não iniciada",
    start_date: isoToBrDate(typeof activity['start_date'] === "string" ? activity['start_date'] : ""),
    end_date: isoToBrDate(typeof activity['end_date'] === "string" ? activity['end_date'] : ""),
  })) : typeof item['activities'] === "string" && item['activities'].trim() ? [{ ...emptyLinkedActivity(), description: item['activities'] }] : [],
})) : [];

/** An expected result listed on a strategy-plan action: a description and nothing else. */
export type PlanResultEntry = { description: string };

/**
 * A strategy-plan action carries two flat lists of its own. An expected result is only a
 * description, while an activity also has a status and a period, so the two are read by
 * separate helpers. The legacy activity rows keep their nested `outcomes` shape, read by
 * normalizeOutcomes above, so each shape is stored the way its editor reads it.
 */
export const normalizeResults = (value: Json): PlanResultEntry[] => Array.isArray(value)
  ? value.filter((item): item is Record<string, Json | undefined> => Boolean(item) && typeof item === "object" && !Array.isArray(item)).map(item => ({
      description: typeof item['description'] === "string" ? item['description'] : "",
    }))
  : [];

export const normalizePlanTasks = (value: Json): PlanTask[] => Array.isArray(value)
  ? value.filter((item): item is Record<string, Json | undefined> => Boolean(item) && typeof item === "object" && !Array.isArray(item)).map(item => ({
      description: typeof item['description'] === "string" ? item['description'] : "",
      status: typeof item['status'] === "string" ? item['status'] : "Não iniciada",
      start_date: isoToBrDate(typeof item['start_date'] === "string" ? item['start_date'] : ""),
      end_date: isoToBrDate(typeof item['end_date'] === "string" ? item['end_date'] : ""),
    }))
  : [];

// Activities written before subtasks existed, and by the Markdown reader, simply come back with an
// empty subtask list: an activity without subtasks is a valid activity, not a broken one.
export const normalizeActivities = (value: Json): PlanActivity[] => Array.isArray(value)
  ? value.filter((item): item is Record<string, Json | undefined> => Boolean(item) && typeof item === "object" && !Array.isArray(item)).map(item => ({
      description: typeof item['description'] === "string" ? item['description'] : "",
      status: typeof item['status'] === "string" ? item['status'] : "Não iniciada",
      start_date: isoToBrDate(typeof item['start_date'] === "string" ? item['start_date'] : ""),
      end_date: isoToBrDate(typeof item['end_date'] === "string" ? item['end_date'] : ""),
      subtasks: normalizePlanTasks(item['subtasks'] ?? null),
    }))
  : [];

// What actually goes to the database: the whole task is kept and only its dates are converted to
// the ISO form, so editing one subtask never drops the status of its activity, nor its siblings.
export const storedTask = (task: PlanTask) => ({ ...task, ...isoDates(task), description: task.description.trim() });

export const storedActivities = (activities: PlanActivity[]) => activities
  .filter(activity => activity.description.trim())
  .map(activity => ({ ...activity, ...isoDates(activity), description: activity.description.trim(), subtasks: activity.subtasks.filter(task => task.description.trim()).map(storedTask) }));
