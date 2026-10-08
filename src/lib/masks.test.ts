import { describe, expect, it } from "vitest";
import { confirmed, dateMask, digitsOnly, documentMask, initials, phoneMask } from "@/lib/masks";

describe("initials", () => {
  it("usa as duas primeiras letras do nome", () => {
    expect(initials("Ana Clara Silva")).toBe("AC");
  });
  it("usa a única palavra quando o nome é curto", () => {
    expect(initials("Ana")).toBe("A");
  });
  it("ignora espaços sobrando", () => {
    expect(initials("  joão  silva ")).toBe("JS");
  });
  it("cai em AR quando não há nome", () => {
    expect(initials("")).toBe("AR");
    expect(initials("   ")).toBe("AR");
  });
});

describe("digitsOnly", () => {
  it("mantém só os dígitos", () => {
    expect(digitsOnly("abc-123 (45)")).toBe("12345");
    expect(digitsOnly("")).toBe("");
  });
});

describe("phoneMask", () => {
  it("formata o DDD e o número local", () => {
    expect(phoneMask("43999990000")).toBe("(43) 99999-0000");
  });
  it("monta o formato aos poucos", () => {
    expect(phoneMask("")).toBe("");
    expect(phoneMask("4")).toBe("(4");
    expect(phoneMask("4399")).toBe("(43) 99");
    expect(phoneMask("43999990")).toBe("(43) 9999-90");
  });
  it("trata 12/13 dígitos como país só com o sinal de +", () => {
    expect(phoneMask("+5543999990000")).toBe("+55 (43) 99999-0000");
    expect(phoneMask("5543999990000")).toBe("(55) 43999-9900");
  });
  it("não considera +55 país quando o número é curto", () => {
    expect(phoneMask("+55")).toBe("(55");
  });
});

describe("documentMask", () => {
  it("formata CPF", () => {
    expect(documentMask("123")).toBe("123");
    expect(documentMask("1234")).toBe("123.4");
    expect(documentMask("123456")).toBe("123.456");
    expect(documentMask("123456789")).toBe("123.456.789");
    expect(documentMask("12345678901")).toBe("123.456.789-01");
  });
  it("formata CNPJ a partir do 12º dígito", () => {
    expect(documentMask("123456789012")).toBe("12.345.678/9012");
    expect(documentMask("12345678901234")).toBe("12.345.678/9012-34");
  });
});

describe("dateMask", () => {
  it("formata a data aos poucos e limita em 8 dígitos", () => {
    expect(dateMask("3")).toBe("3");
    expect(dateMask("31")).toBe("31");
    expect(dateMask("311")).toBe("31/1");
    expect(dateMask("3112")).toBe("31/12");
    expect(dateMask("31122024")).toBe("31/12/2024");
    expect(dateMask("311220249999")).toBe("31/12/2024");
  });
});

describe("confirmed", () => {
  it("devolve os dados quando a linha veio de volta", () => {
    expect(confirmed({ data: [{ id: 1 }], error: null }, "a atividade")).toEqual([{ id: 1 }]);
  });
  it("lança o próprio erro do banco", () => {
    const error = { message: "permission denied" };
    expect(() => confirmed({ data: null, error }, "a atividade")).toThrow(error);
  });
  it("não confia em UPDATE que não mudou nenhuma linha", () => {
    expect(() => confirmed({ data: null, error: null }, "a atividade")).toThrow(
      /nenhuma linha foi alterada/,
    );
    expect(() => confirmed({ data: null, error: null }, "o agente")).toThrow(/o agente/);
  });
});
