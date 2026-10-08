import { describe, expect, it } from "vitest";
import { formatDate, isoDates, isoToBrDate, monthLabel, toIsoDate } from "@/lib/dates";

describe("formatDate", () => {
  it("formata uma data ISO no padrão brasileiro", () => {
    expect(formatDate("2024-01-15")).toBe("15/01/2024");
  });
  it("mostra traço quando não há data", () => {
    expect(formatDate("")).toBe("—");
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });
});

describe("monthLabel", () => {
  it("escreve o mês por extenso com o ano", () => {
    expect(monthLabel(new Date(2024, 0, 15))).toBe("janeiro de 2024");
    expect(monthLabel(new Date(2023, 11, 1))).toBe("dezembro de 2023");
  });
});

describe("isoToBrDate", () => {
  it("converte yyyy-mm-dd para dd/mm/aaaa", () => {
    expect(isoToBrDate("2024-01-15")).toBe("15/01/2024");
  });
  it("devolve o valor intacto quando não é data ISO", () => {
    expect(isoToBrDate("")).toBe("");
    expect(isoToBrDate("15/01/2024")).toBe("15/01/2024");
    expect(isoToBrDate("2024-01")).toBe("2024-01");
  });
});

describe("toIsoDate", () => {
  it("converte dd/mm/aaaa para yyyy-mm-dd", () => {
    expect(toIsoDate("15/01/2024", "Início")).toBe("2024-01-15");
    expect(toIsoDate(" 15/01/2024 ", "Início")).toBe("2024-01-15");
  });
  it("considera vazio como ausência de data", () => {
    expect(toIsoDate("", "Início")).toBeNull();
    expect(toIsoDate("   ", "Início")).toBeNull();
  });
  it("exige o formato completo com o rótulo do campo", () => {
    expect(() => toIsoDate("15/1/2024", "Início")).toThrow(
      /Início: informe a data completa no formato dd\/mm\/aaaa/,
    );
    expect(() => toIsoDate("15012024", "Conclusão")).toThrow(/Conclusão/);
  });
  it("rejeita datas que não existem no calendário", () => {
    expect(() => toIsoDate("31/02/2024", "Início")).toThrow(/data inválida \(31\/02\/2024\)/);
    expect(() => toIsoDate("32/01/2024", "Início")).toThrow(/data inválida/);
    expect(() => toIsoDate("15/13/2024", "Início")).toThrow(/data inválida/);
  });
});

describe("isoDates", () => {
  it("converte só as colunas de data presentes no registro", () => {
    expect(isoDates({ start_date: "15/01/2024", end_date: "20/01/2024" })).toEqual({
      start_date: "2024-01-15",
      end_date: "2024-01-20",
    });
  });
  it("ignora as colunas que o registro não traz", () => {
    expect(isoDates({ birth_date: "01/06/1990" })).toEqual({ birth_date: "1990-06-01" });
    expect(isoDates({ name: "Ari" })).toEqual({});
  });
});
