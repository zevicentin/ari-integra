import { describe, expect, it } from "vitest";
import type { Json } from "@/integrations/supabase/types";
import type { PlanActivity, PlanTask } from "@/lib/plan";
import {
  completionOf,
  emptyPlanActivity,
  emptyPlanTask,
  normalizeActivities,
  normalizeOutcomes,
  normalizePlanTasks,
  normalizeResults,
  planProgressOf,
  storedActivities,
  storedTask,
  taskPeriod,
} from "@/lib/plan";

const activity = (over: Partial<PlanActivity> = {}): PlanActivity => ({
  ...emptyPlanActivity(),
  ...over,
});
const task = (over: Partial<PlanTask> = {}): PlanTask => ({ ...emptyPlanTask(), ...over });

describe("emptyPlanTask", () => {
  it("começa não iniciada e sem período", () => {
    expect(emptyPlanTask()).toEqual({
      description: "",
      status: "Não iniciada",
      start_date: "",
      end_date: "",
    });
    expect(emptyPlanActivity()).toEqual({ ...emptyPlanTask(), subtasks: [] });
  });
});

describe("completionOf", () => {
  it("mede uma atividade com subtasks pelas subtasks", () => {
    const done = completionOf(
      activity({
        status: "Não iniciada",
        subtasks: [
          task({ description: "a", status: "Concluída" }),
          task({ description: "b", status: "Concluída" }),
          task({ description: "c" }),
        ],
      }),
    );
    expect(done).toEqual({ share: 2 / 3, done: 2, total: 3, bySubtasks: true });
  });
  it("ignora subtasks sem descrição", () => {
    const done = completionOf(
      activity({
        subtasks: [task({ description: "a", status: "Concluída" }), task({ description: "   " })],
      }),
    );
    expect(done).toEqual({ share: 1, done: 1, total: 1, bySubtasks: true });
  });
  it("conta uma atividade sem subtasks como uma única tarefa", () => {
    expect(completionOf(activity({ status: "Concluída" }))).toEqual({
      share: 1,
      done: 1,
      total: 1,
      bySubtasks: false,
    });
    expect(completionOf(activity({ status: "Iniciada" }))).toEqual({
      share: 0,
      done: 0,
      total: 1,
      bySubtasks: false,
    });
  });
});

describe("taskPeriod", () => {
  it("descreve o período em português", () => {
    expect(taskPeriod(task({ start_date: "15/01/2024", end_date: "20/01/2024" }))).toBe(
      "15/01/2024 a 20/01/2024",
    );
    expect(taskPeriod(task({ start_date: "15/01/2024" }))).toBe("a partir de 15/01/2024");
    expect(taskPeriod(task({ end_date: "20/01/2024" }))).toBe("— a 20/01/2024");
    expect(taskPeriod(task())).toBe("");
  });
});

describe("normalizeResults", () => {
  it("lê a lista plana de resultados esperados", () => {
    expect(
      normalizeResults([{ description: "Primeiro" }, { description: "" }, "texto solto", null, 3]),
    ).toEqual([{ description: "Primeiro" }, { description: "" }]);
  });
  it("devolve lista vazia quando o valor não é lista", () => {
    expect(normalizeResults("fora de forma")).toEqual([]);
    expect(normalizeResults(null)).toEqual([]);
  });
});

describe("normalizePlanTasks", () => {
  it("preenche as lacunas e converte as datas para o formato brasileiro", () => {
    expect(
      normalizePlanTasks([
        { description: "Tarefa", start_date: "2024-01-15", end_date: "2024-02-01" },
        { description: "Só isso" },
        "lixo",
      ]),
    ).toEqual([
      {
        description: "Tarefa",
        status: "Não iniciada",
        start_date: "15/01/2024",
        end_date: "01/02/2024",
      },
      { description: "Só isso", status: "Não iniciada", start_date: "", end_date: "" },
    ]);
  });
});

describe("normalizeActivities", () => {
  it("traz subtasks vazias para as atividades antigas", () => {
    expect(normalizeActivities([{ description: "Antiga", status: "Concluída" }])).toEqual([
      { description: "Antiga", status: "Concluída", start_date: "", end_date: "", subtasks: [] },
    ]);
  });
  it("normaliza as subtasks junto com a atividade", () => {
    expect(
      normalizeActivities([
        { description: "A", subtasks: [{ description: "S", start_date: "2024-03-01" }] },
      ]),
    ).toEqual([
      {
        description: "A",
        status: "Não iniciada",
        start_date: "",
        end_date: "",
        subtasks: [
          { description: "S", status: "Não iniciada", start_date: "01/03/2024", end_date: "" },
        ],
      },
    ]);
  });
  it("devolve lista vazia para valor que não é lista", () => {
    expect(normalizeActivities(7)).toEqual([]);
  });
});

describe("normalizeOutcomes", () => {
  it("lê o formato legado com resultados aninhados", () => {
    expect(
      normalizeOutcomes([
        {
          title: "Resultado",
          status: "Concluída",
          start_date: "2024-01-15",
          end_date: "2024-02-01",
          activities: [
            { description: "Visitas", status: "Iniciada", start_date: "2024-01-16", end_date: "" },
          ],
        },
        { title: "Só o título", activities: "Texto corrido" },
      ]),
    ).toEqual([
      {
        title: "Resultado",
        status: "Concluída",
        start_date: "15/01/2024",
        end_date: "01/02/2024",
        activities: [
          { description: "Visitas", status: "Iniciada", start_date: "16/01/2024", end_date: "" },
        ],
      },
      {
        title: "Só o título",
        status: "Não iniciada",
        start_date: "",
        end_date: "",
        activities: [
          { description: "Texto corrido", status: "Não iniciada", start_date: "", end_date: "" },
        ],
      },
    ]);
  });
  it("devolve lista vazia para valor que não é lista", () => {
    expect(normalizeOutcomes(null)).toEqual([]);
  });
});

describe("storedTask", () => {
  it("aplica as datas ISO e aperta a descrição", () => {
    expect(
      storedTask(
        task({ description: "  Audiência  ", start_date: "15/01/2024", end_date: "20/01/2024" }),
      ),
    ).toEqual({
      description: "Audiência",
      status: "Não iniciada",
      start_date: "2024-01-15",
      end_date: "2024-01-20",
    });
  });
});

describe("storedActivities", () => {
  it("apaga atividades e subtasks vazias e grava tudo em ISO", () => {
    expect(
      storedActivities([
        activity({
          description: " Principal ",
          start_date: "15/01/2024",
          subtasks: [task({ description: " Filha ", end_date: "20/01/2024" }), task()],
        }),
        activity({ description: "   " }),
      ]),
    ).toEqual([
      {
        description: "Principal",
        status: "Não iniciada",
        start_date: "2024-01-15",
        end_date: "",
        subtasks: [
          { description: "Filha", status: "Não iniciada", start_date: "", end_date: "2024-01-20" },
        ],
      },
    ]);
  });
});

describe("planProgressOf", () => {
  it("não tem percentual sem ações", () => {
    expect(planProgressOf([])).toEqual({ total: 0, done: 0, percent: null });
  });

  it("soma tarefas únicas e subtasks de cada ação", () => {
    const actions = [
      {
        activities: [
          {
            description: "Concluída",
            status: "Concluída",
            start_date: "",
            end_date: "",
            subtasks: [],
          },
        ],
      },
      {
        activities: [
          {
            description: "Parcial",
            status: "Não iniciada",
            start_date: "",
            end_date: "",
            subtasks: [
              {
                description: "Filha 1",
                status: "Concluída",
                start_date: "",
                end_date: "",
              },
              {
                description: "Filha 2",
                status: "Em andamento",
                start_date: "",
                end_date: "",
              },
            ],
          },
        ],
      },
    ] as unknown as { activities: Json }[];
    expect(planProgressOf(actions)).toEqual({ total: 2, done: 1, percent: 75 });
  });

  it("ignora atividades sem descrição", () => {
    const actions = [
      {
        activities: [
          {
            description: "   ",
            status: "Concluída",
            start_date: "",
            end_date: "",
            subtasks: [],
          },
        ],
      },
    ] as unknown as { activities: Json }[];
    expect(planProgressOf(actions)).toEqual({ total: 0, done: 0, percent: null });
  });
});
