/**
 * Monthly report in .docx built from `public/modelos/modelo-relatorio.docx`. The template already
 * holds the official layout, so this module fills it in place: the header rows are matched by
 * their labels, the indicator table by its row order, the REF section is rebuilt from the
 * activities of the chosen month, and evidence images are embedded as new JPEG parts.
 */

export const MONTHS_PT = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
] as const;

export type ReportActivity = {
  title: string;
  status: string;
  description: string | null;
  participants: string | null;
  objectives: string | null;
  expected_results: string | null;
  achieved_results: string | null;
  start_date: string | null;
  end_date: string | null;
  axis: string | null;
  indicators: string[];
  evidence: unknown;
};

export type ReportEvidence = { bytes: Uint8Array; caption: string; width: number; height: number };

export type IndicatorCount = { previous: number; current: number; refs: string };

export type ReportInput = {
  year: number;
  month: number;
  activities: ReportActivity[];
  codes: readonly string[];
  header: Record<string, string>;
  destaque: string;
  difficulties: string;
  evidence: readonly ReportEvidence[];
  indicatorValues?: Record<string, { previous?: string; current?: string }>;
  loadTemplate?: () => Promise<Uint8Array | ArrayBuffer>;
};

const IMAGE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const ROW_IDS = /\s+(?:w14:paraId|w14:textId|w:rsid[A-Za-z]*)="[^"]*"/g;

const HEADER_FIELDS: { key: string; prefix: string; test: RegExp }[] = [
  { key: "ari", prefix: "ARI", test: /^ARI:/ },
  { key: "gestorSebrae", prefix: "Gestor Sebrae", test: /^Gestor Sebrae:/ },
  { key: "gestorAgeuni", prefix: "Gestor AGEUNI", test: /^Gestor AGEUNI:/ },
  { key: "consultor", prefix: "Consultor Sênior/Orientador", test: /^Consultor Sênior/i },
  { key: "ecossistema", prefix: "Ecossistema", test: /^Ecossistema:/ },
  { key: "setores", prefix: "Setores Priorizados do Ecossistema", test: /^Setores Priorizados/i },
  { key: "gt", prefix: "GT do Ecossistema", test: /^GT do Ecossistema:/ },
  {
    key: "atores",
    prefix: "Número de Atores Engajados na Governança do Ecossistema",
    test: /^Número de Atores/i,
  },
  {
    key: "acoes",
    prefix: "Número de ações do Plano de Intervenção realizadas",
    test: /^Número de ações do Plano/i,
  },
  {
    key: "percentual",
    prefix: "% Ações Concluídas do Plano de Trabalho do Agente",
    test: /^% Ações Concluídas/i,
  },
];

type XmlEl = { s: string; start: number };
type MediaPart = { rId: string; path: string; target: string; data: Uint8Array };
type TemplateIds = { docPr: number; picId: number; ridBase: number };

const pad2 = (value: number): string => String(value).padStart(2, "0");

const esc = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const cleanIds = (value: string): string => value.replace(ROW_IDS, "");

const norm = (value: string): string => value.replace(/\s+/g, " ").trim();

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function brDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length >= 3 && parts[0] && parts[1] && parts[2])
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
}

/** Drops the " - dd/mm/yyyy" the editor appends to meeting titles, so the report line says it once. */
export function stripDateSuffix(title: string, br: string): string {
  if (!br || !title.endsWith(br)) return title;
  const core = title.slice(0, -br.length).replace(/[\s–—:-]+$/, "");
  return core || title;
}

export function parsePt(value: string): number {
  const parsed = Number(
    value
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, ""),
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatPt(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

const dateOf = (row: { start_date: string | null; end_date: string | null }): string | null =>
  row.start_date || row.end_date || null;

export function filterMonthActivities<
  T extends { title: string; start_date: string | null; end_date: string | null },
>(rows: readonly T[], year: number, month: number): T[] {
  const first = `${year}-${pad2(month + 1)}-01`;
  const last = `${year}-${pad2(month + 1)}-${pad2(new Date(year, month + 1, 0).getDate())}`;
  return rows
    .filter((row) => {
      const date = dateOf(row);
      return !!date && date >= first && date <= last;
    })
    .sort((a, b) => {
      const da = dateOf(a) || "";
      const db = dateOf(b) || "";
      if (da !== db) return da < db ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
}

export function indicatorCounts(
  all: readonly ReportActivity[],
  monthRows: readonly ReportActivity[],
  codes: readonly string[],
  year: number,
  month: number,
): Record<string, IndicatorCount> {
  const first = `${year}-${pad2(month + 1)}-01`;
  const out: Record<string, IndicatorCount> = {};
  for (const code of codes) {
    let previous = 0;
    let current = 0;
    for (const activity of all) {
      if (activity.status !== "Concluída" || !activity.indicators.includes(code)) continue;
      const date = dateOf(activity);
      if (date && date < first) previous++;
    }
    for (const activity of monthRows) {
      if (activity.status === "Concluída" && activity.indicators.includes(code)) current++;
    }
    const refs = monthRows
      .map((activity, index) =>
        activity.status === "Concluída" && activity.indicators.includes(code)
          ? String(index + 1)
          : "",
      )
      .filter(Boolean)
      .join(", ");
    out[code] = { previous, current, refs };
  }
  return out;
}

function findElements(source: string, tag: string): XmlEl[] {
  const out: XmlEl[] = [];
  const openRe = new RegExp(`<${tag}(?:\\s[^>]*)?>`, "g");
  const anyRe = new RegExp(`</?${tag}(?:\\s[^>]*)?>`, "g");
  let i = 0;
  while (i < source.length) {
    openRe.lastIndex = i;
    const open = openRe.exec(source);
    if (!open) break;
    if (source[open.index + open[0].length - 2] === "/") {
      i = open.index + open[0].length;
      continue;
    }
    anyRe.lastIndex = open.index;
    let depth = 0;
    let end = -1;
    let inner: RegExpExecArray | null;
    while ((inner = anyRe.exec(source))) {
      const token = inner[0];
      if (token.startsWith("</")) depth--;
      else if (!token.endsWith("/>")) depth++;
      if (depth === 0) {
        end = anyRe.lastIndex;
        break;
      }
    }
    if (end < 0) break;
    out.push({ s: source.slice(open.index, end), start: open.index });
    i = end;
  }
  return out;
}

function paraText(paragraph: string): string {
  let text = "";
  for (const match of paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) text += match[1];
  return text;
}

function extractTag(source: string, tag: string): string {
  const paired = new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>`).exec(source);
  if (paired) return paired[0];
  const selfClosing = new RegExp(`<${tag}(?:\\s[^>]*)?/>`).exec(source);
  return selfClosing ? selfClosing[0] : "";
}

function leadingTag(source: string, tag: string): string {
  const match = new RegExp(`^<${tag}(?:\\s[^>]*)?(?:>[\\s\\S]*?</${tag}>|/>)`).exec(source);
  return match ? match[0] : "";
}

function openTagBefore(source: string, position: number, tag: string): number {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>`, "g");
  let best = -1;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) && match.index < position) best = match.index;
  return best;
}

function splitCell(cell: string): { open: string; tcPr: string; rest: string } {
  const open = /^<w:tc(?:\s[^>]*)?>/.exec(cell)?.[0];
  if (!open) throw new Error("Célula inválida no modelo do relatório.");
  const inner = cell.slice(
    open.length,
    cell.endsWith("</w:tc>") ? cell.length - "</w:tc>".length : cell.length,
  );
  const tcPr = leadingTag(inner, "w:tcPr");
  return { open, tcPr, rest: inner.slice(tcPr.length) };
}

function setCellLines(cell: string, lines: readonly string[]): string {
  const { open, tcPr, rest } = splitCell(cell);
  const template = findElements(rest, "w:p")[0]?.s;
  const pPr = template ? extractTag(template, "w:pPr") : "";
  const run = template ? findElements(template, "w:r")[0]?.s : undefined;
  const rPr = run ? extractTag(run, "w:rPr") : "";
  const body = (lines.length ? [...lines] : [""])
    .map((line) =>
      line
        ? `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${esc(line)}</w:t></w:r></w:p>`
        : `<w:p>${pPr}</w:p>`,
    )
    .join("");
  return cleanIds(open + tcPr + body + "</w:tc>");
}

function rebuildRow(row: string, cells: readonly string[]): string {
  const open = /^<w:tr(?:\s[^>]*)?>/.exec(row)?.[0];
  if (!open) throw new Error("Linha inválida no modelo do relatório.");
  const inner = row.slice(open.length, row.length - "</w:tr>".length);
  const trPr = leadingTag(inner, "w:trPr");
  return cleanIds(open + trPr + cells.join("") + "</w:tr>");
}

function makeParagraphs(template: string, lines: readonly string[]): string {
  const pPr = extractTag(template, "w:pPr");
  const run = findElements(template, "w:r")[0]?.s;
  const rPr = run ? extractTag(run, "w:rPr") : "";
  const body = (lines.length ? [...lines] : [""])
    .map((line) =>
      line
        ? `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${esc(line)}</w:t></w:r></w:p>`
        : `<w:p>${pPr}</w:p>`,
    )
    .join("");
  return cleanIds(body);
}

function replaceFirstParagraph(
  doc: string,
  matches: (text: string) => boolean,
  lines: readonly string[],
  field: string,
): string {
  for (const paragraph of findElements(doc, "w:p")) {
    if (matches(norm(paraText(paragraph.s)))) {
      return doc.split(paragraph.s).join(makeParagraphs(paragraph.s, lines));
    }
  }
  throw new Error(
    `O modelo não tem o campo "${field}" do cabeçalho. Atualize public/modelos/modelo-relatorio.docx.`,
  );
}

function replaceDestaque(doc: string, text: string): string {
  const heading = findElements(doc, "w:p").find(
    (p) => norm(paraText(p.s)) === "ATIVIDADE DESTAQUE",
  );
  if (!heading) throw new Error('O modelo não tem a seção "ATIVIDADE DESTAQUE".');
  const after = doc.slice(heading.start + heading.s.length);
  const target = findElements(after, "w:p")[0];
  if (!target) throw new Error('O modelo não tem o texto de "ATIVIDADE DESTAQUE".');
  return doc.split(target.s).join(makeParagraphs(target.s, splitLines(text)));
}

function fillIndicators(
  doc: string,
  codes: readonly string[],
  counts: Record<string, IndicatorCount>,
  values: ReportInput["indicatorValues"],
): string {
  const heading = findElements(doc, "w:p").find((p) => norm(paraText(p.s)) === "INDICADORES SETI");
  if (!heading) throw new Error('O modelo não tem a seção "INDICADORES SETI".');
  const tableStart = openTagBefore(doc, heading.start, "w:tbl");
  if (tableStart < 0) throw new Error("O modelo não tem a tabela de indicadores.");
  const table = findElements(doc.slice(tableStart), "w:tbl")[0];
  if (!table) throw new Error("A tabela de indicadores do modelo está ilegível.");
  const rows = findElements(table.s, "w:tr");
  const dataRows = rows.slice(2);
  if (dataRows.length < codes.length) {
    throw new Error(
      `A tabela de indicadores do modelo tem ${dataRows.length} linhas e a lista tem ${codes.length} indicadores.`,
    );
  }
  let rebuilt = "";
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i] as string;
    const row = dataRows[i];
    if (!row) break;
    const cells = findElements(row.s, "w:tc");
    if (cells.length < 5)
      throw new Error(`A linha ${i + 1} da tabela de indicadores não tem 5 células.`);
    const label = norm(paraText(cells[0]?.s || ""))
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
    const expected = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (label !== expected) {
      throw new Error(
        `A linha ${i + 1} dos indicadores do modelo é "${label}", mas se esperava "${expected}".`,
      );
    }
    const count = counts[code] ?? { previous: 0, current: 0, refs: "" };
    const override = values?.[code];
    const previous = override?.previous ?? String(count.previous);
    const current = override?.current ?? String(count.current);
    rebuilt += rebuildRow(row.s, [
      cells[0]?.s || "",
      setCellLines(cells[1]?.s || "", [previous]),
      setCellLines(cells[2]?.s || "", [current]),
      setCellLines(cells[3]?.s || "", [formatPt(parsePt(previous) + parsePt(current))]),
      setCellLines(cells[4]?.s || "", [count.refs]),
    ]);
  }
  const leftover = rows
    .slice(2 + codes.length)
    .map((row) => row.s)
    .join("");
  const firstData = dataRows[0];
  const lastRow = rows[rows.length - 1];
  if (!firstData || !lastRow) throw new Error("A tabela de indicadores do modelo está vazia.");
  const start = table.s.indexOf(firstData.s);
  const end = table.s.indexOf(lastRow.s, start) + lastRow.s.length;
  if (start < 0 || end < lastRow.s.length)
    throw new Error("A tabela de indicadores do modelo está ilegível.");
  return doc.split(table.s).join(table.s.slice(0, start) + rebuilt + leftover + table.s.slice(end));
}

function makeRefRow(template: string, ref: number | null, activity: ReportActivity | null): string {
  const cells = findElements(template, "w:tc");
  if (cells.length < 4) throw new Error("A linha de exemplo da tabela REF não tem 4 células.");
  const dateIso = activity ? dateOf(activity) || "" : "";
  const br = dateIso ? brDate(dateIso) : "";
  const title = activity ? stripDateSuffix(activity.title, br) : "";
  const first = activity
    ? `${br ? `${br} - ` : ""}${
        activity.axis?.trim() ? `Estratégia: ${activity.axis.trim()} – Atividade: ${title}` : title
      }`
    : "";
  const detail: string[] = [];
  const results: string[] = [];
  if (activity) {
    if (activity.description?.trim()) detail.push(...splitLines(activity.description));
    if (activity.participants?.trim())
      detail.push(`Participantes: ${activity.participants.trim()}`);
    if (activity.objectives?.trim()) detail.push(`Objetivos: ${activity.objectives.trim()}`);
    if (activity.expected_results?.trim()) {
      results.push("Resultados esperados:", ...splitLines(activity.expected_results));
    }
    if (activity.achieved_results?.trim()) {
      results.push("Resultados alcançados:", ...splitLines(activity.achieved_results));
    }
  }
  const detailLines = detail.length
    ? detail
    : [activity ? "" : "Nenhuma atividade registrada neste mês."];
  return rebuildRow(template, [
    setCellLines(cells[0]?.s || "", [activity && ref !== null ? String(ref) : "—"]),
    setCellLines(cells[1]?.s || "", [first]),
    setCellLines(cells[2]?.s || "", detailLines),
    setCellLines(cells[3]?.s || "", results),
  ]);
}

function fillRefTable(doc: string, monthRows: readonly ReportActivity[]): string {
  const header = findElements(doc, "w:tr").find((row) => {
    const cells = findElements(row.s, "w:tc");
    return cells.length === 4 && norm(paraText(cells[0]?.s || "")) === "REF";
  });
  if (!header) throw new Error('O modelo não tem a tabela "REF".');
  const headerEnd = header.start + header.s.length;
  const template = findElements(doc.slice(headerEnd), "w:tr")[0];
  if (!template || findElements(template.s, "w:tc").length < 4) {
    throw new Error("A linha de exemplo da tabela REF mudou no modelo.");
  }
  const tableEnd = doc.indexOf("</w:tbl>", headerEnd);
  if (tableEnd < 0) throw new Error("A tabela REF do modelo não foi fechada.");
  const rows = monthRows.length
    ? monthRows.map((activity, index) => makeRefRow(template.s, index + 1, activity)).join("")
    : makeRefRow(template.s, null, null);
  return doc.slice(0, headerEnd) + rows + doc.slice(tableEnd);
}

function fillDifficulties(doc: string, text: string): string {
  const target = findElements(doc, "w:p").find((p) =>
    norm(paraText(p.s)).startsWith("Para evolução"),
  );
  if (!target) throw new Error('O modelo não tem o texto da seção 3 "Dificuldades".');
  const cellStart = openTagBefore(doc, target.start, "w:tc");
  if (cellStart < 0) throw new Error('O modelo não tem a seção 3 "Dificuldades".');
  const cell = findElements(doc.slice(cellStart), "w:tc")[0];
  if (!cell) throw new Error('A seção 3 "Dificuldades" do modelo está ilegível.');
  return doc.split(cell.s).join(setCellLines(cell.s, splitLines(text)));
}

function drawingRun(cell: string): string | null {
  const drawing = /<w:drawing>/.exec(cell);
  if (!drawing) return null;
  const openRe = /<w:r(?:\s[^>]*)?>/g;
  let start = -1;
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(cell)) && match.index < drawing.index) start = match.index;
  if (start < 0) return null;
  const drawingEnd = cell.indexOf("</w:drawing>", drawing.index);
  if (drawingEnd < 0) return null;
  const runEnd = cell.indexOf("</w:r>", drawingEnd);
  if (runEnd < 0) return null;
  return cell.slice(start, runEnd + "</w:r>".length);
}

function fitExtent(width: number, height: number): { cx: number; cy: number } {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const scale = Math.min(1, 6300000 / (safeWidth * 9525), 4572000 / (safeHeight * 9525));
  return { cx: Math.round(safeWidth * 9525 * scale), cy: Math.round(safeHeight * 9525 * scale) };
}

function randomHex(): string {
  let out = "";
  for (let i = 0; i < 8; i++)
    out += Math.floor(Math.random() * 16)
      .toString(16)
      .toUpperCase();
  return out;
}

function fillEvidence(
  doc: string,
  items: readonly ReportEvidence[],
  ids: TemplateIds,
): { doc: string; media: MediaPart[] } {
  const drawing = /<w:drawing>/.exec(doc);
  if (!drawing)
    throw new Error("O modelo não tem a seção 4 de evidências. Atualize o modelo do relatório.");
  const cellStart = openTagBefore(doc, drawing.index, "w:tc");
  if (cellStart < 0) throw new Error("O modelo não tem a seção 4 de evidências.");
  const cell = findElements(doc.slice(cellStart), "w:tc")[0];
  if (!cell) throw new Error("A seção 4 de evidências do modelo está ilegível.");
  const templateRun = drawingRun(cell.s);
  if (!templateRun) throw new Error("A seção 4 de evidências do modelo está ilegível.");
  const paragraphs = findElements(cell.s, "w:p");
  const imageParagraph = paragraphs.find((p) => p.s.includes("<w:drawing>"));
  const captionParagraph = paragraphs.find(
    (p) => !p.s.includes("<w:drawing>") && norm(paraText(p.s)) !== "",
  );
  const spacerParagraph = paragraphs.find(
    (p) => !p.s.includes("<w:drawing>") && norm(paraText(p.s)) === "",
  );
  if (!imageParagraph || !captionParagraph)
    throw new Error("As legendas de evidência mudaram no modelo.");
  const { open, tcPr } = splitCell(cell.s);
  const imagePPtr = extractTag(imageParagraph.s, "w:pPr");
  const captionPPtr = extractTag(captionParagraph.s, "w:pPr");
  const spacer = spacerParagraph ? cleanIds(spacerParagraph.s) : "<w:p/>";
  let body = spacer + spacer;
  const media: MediaPart[] = [];
  items.forEach((item, index) => {
    const number = index + 1;
    const rId = `rId${ids.ridBase + index}`;
    const extent = fitExtent(item.width, item.height);
    const run = templateRun
      .replace(/<w:lastRenderedPageBreak\/>/g, "")
      .replace(/<a:srcRect[^>]*\/>/g, "")
      .replace(
        /<wp:extent cx="\d+" cy="\d+"\/>/,
        `<wp:extent cx="${extent.cx}" cy="${extent.cy}"/>`,
      )
      .replace(/<a:ext cx="\d+" cy="\d+"\/>/, `<a:ext cx="${extent.cx}" cy="${extent.cy}"/>`)
      .replace(
        /(<wp:docPr id=")\d+(" name=")[^"]*(")/,
        `$1${ids.docPr + index}$2Imagem ${number}$3`,
      )
      .replace(
        /(<pic:cNvPr id=")\d+(" name=")[^"]*(")/,
        `$1${ids.picId + index}$2Picture ${number}$3`,
      )
      .replace(/r:embed="rId\d+"/, `r:embed="${rId}"`)
      .replace(/wp14:anchorId="[0-9A-Fa-f]+"/, `wp14:anchorId="${randomHex()}"`)
      .replace(/wp14:editId="[0-9A-Fa-f]+"/, `wp14:editId="${randomHex()}"`);
    const image = cleanIds(`<w:p>${imagePPtr}${run}</w:p>`);
    const caption = cleanIds(
      `<w:p>${captionPPtr}<w:r><w:t xml:space="preserve">${esc(item.caption)}</w:t></w:r></w:p>`,
    );
    body += image + caption + spacer + spacer;
    media.push({
      rId,
      path: `word/media/rel-${ids.ridBase + index}.jpeg`,
      target: `media/rel-${ids.ridBase + index}.jpeg`,
      data: item.bytes,
    });
  });
  const newCell = cleanIds(open + tcPr + body + "</w:tc>");
  return { doc: doc.split(cell.s).join(newCell), media };
}

function maxMatch(source: string, pattern: RegExp): number {
  let max = 0;
  for (const match of source.matchAll(pattern)) {
    const value = Number(match[1] ?? 0);
    if (value > max) max = value;
  }
  return max;
}

async function fetchTemplate(): Promise<Uint8Array> {
  const response = await fetch("/modelos/modelo-relatorio.docx");
  if (!response.ok) {
    throw new Error(`Não consegui baixar o modelo do relatório (HTTP ${response.status}).`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function buildMonthlyReport(input: ReportInput): Promise<Blob> {
  const template = await (input.loadTemplate ?? fetchTemplate)();
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(template);
  const documentFile = zip.file("word/document.xml");
  const relsFile = zip.file("word/_rels/document.xml.rels");
  if (!documentFile || !relsFile) throw new Error("O modelo do relatório está incompleto.");
  let doc = await documentFile.async("string");
  const rels = await relsFile.async("string");

  const monthRows = filterMonthActivities(input.activities, input.year, input.month);
  const counts = indicatorCounts(input.activities, monthRows, input.codes, input.year, input.month);

  for (const field of HEADER_FIELDS) {
    const value = input.header[field.key] ?? "";
    doc = replaceFirstParagraph(
      doc,
      (text) => field.test.test(text),
      [`${field.prefix}: ${value}`],
      field.key,
    );
  }
  doc = replaceFirstParagraph(
    doc,
    (text) => /^Mês\/Ano:/.test(text),
    [`Mês/Ano: ${MONTHS_PT[input.month] ?? ""}/${input.year}`],
    "mês/ano",
  );
  doc = replaceDestaque(doc, input.destaque);
  doc = fillIndicators(doc, input.codes, counts, input.indicatorValues);
  doc = fillRefTable(doc, monthRows);
  doc = fillDifficulties(doc, input.difficulties);
  const evidence = fillEvidence(doc, input.evidence, {
    docPr: maxMatch(doc, /<wp:docPr id="(\d+)"/g) + 1,
    picId: maxMatch(doc, /<pic:cNvPr id="(\d+)"/g) + 1,
    ridBase: maxMatch(rels, /Id="rId(\d+)"/g) + 1,
  });
  doc = evidence.doc;

  zip.file("word/document.xml", doc);
  if (evidence.media.length) {
    if (!rels.includes("</Relationships>"))
      throw new Error("Não consegui anexar as imagens ao modelo.");
    const relationships = evidence.media
      .map((part) => `<Relationship Id="${part.rId}" Type="${IMAGE_REL}" Target="${part.target}"/>`)
      .join("");
    zip.file(
      "word/_rels/document.xml.rels",
      rels.replace("</Relationships>", `${relationships}</Relationships>`),
    );
    for (const part of evidence.media) zip.file(part.path, part.data);
  }
  const output = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return new Blob([new Uint8Array(output)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
