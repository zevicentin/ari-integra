/**
 * Import of the activities report. The report arrives as Markdown following the
 * labels in `public/modelos/atividades.md`, and older ones as PDF. Every record
 * keeps its own fields (description, objectives, expected and achieved results)
 * instead of one merged description, so the review screen can show them apart.
 */
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let engine: Promise<typeof import("pdfjs-dist")> | null = null;
// The parser is ~580 kB, so it is only downloaded when the user opens the
// import screen instead of on every page of the application.
const pdfjs = () =>
  (engine ??= import("pdfjs-dist").then((module) => {
    module.GlobalWorkerOptions.workerSrc = workerUrl;
    return module;
  }));

const MONTHS: Record<string, number> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};

export const dayKey = (iso: string) => iso.split("-").reverse().join("/");

function monthOf(token: string | undefined): number {
  return (token ? MONTHS[token.toLowerCase().slice(0, 3)] : 0) || 0;
}

function makeDate(year: number, month: number, day: number): string {
  if (!(month >= 1 && month <= 12)) return "";
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= last
    ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    : "";
}

export type Dated = { iso: string; start: number; end: number };

/**
 * Every date on the line, in order of appearance. The records return more than
 * one when the heading writes a period such as "09/07/2025 a 11/07/2025", so
 * the conclusion day can be read from the same heading as the start day.
 */
function findDates(line: string, swap = false): Dated[] {
  const span = (r: RegExpMatchArray): { start: number; end: number } => {
    const start = r.index ?? 0;
    return { start, end: start + (r[0]?.length ?? 0) };
  };
  // The reports here are dd/mm/aaaa, so `swap` means the file writes mm/dd/aaaa.
  const numeric = /(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{2,4})/g;
  const named = new RegExp(
    `(\\d{1,2})\\s*(?:de\\s+)?(${Object.keys(MONTHS).join("|")})[a-zç]*\\s*(?:de\\s+)?(\\d{4})`,
    "gi",
  );
  const hits: Dated[] = [];
  for (const r of line.matchAll(numeric)) {
    let first = Number(r[1]);
    let second = Number(r[2]);
    let year = Number(r[3]);
    if (year < 100) year = year >= 70 ? 1900 + year : 2000 + year;
    if (swap) [first, second] = [second, first];
    let day = first;
    let month = second;
    // A month above 12 is impossible, so that order can only be mm/dd.
    if (month > 12 && day <= 12) [day, month] = [month, day];
    const iso = makeDate(year, month, day);
    if (iso) hits.push({ iso, ...span(r) });
  }
  for (const r of line.matchAll(named)) {
    const month = monthOf(r[2]);
    if (!month) continue;
    const iso = makeDate(Number(r[3]), month, Number(r[1]));
    if (iso) hits.push({ iso, ...span(r) });
  }
  return hits.sort((a, b) => a.start - b.start);
}

export function findDate(line: string, swap = false): Dated | null {
  return findDates(line, swap)[0] ?? null;
}

/** Month/year only: reports often summarise a period instead of a single day. */
function findPeriod(line: string): Dated | null {
  const r = new RegExp(
    `(${Object.keys(MONTHS).join("|")})[a-zç]*[\\s/-]+(?:de\\s+)?(\\d{4})`,
    "i",
  ).exec(line);
  if (!r) return null;
  const month = monthOf(r[1]);
  const year = Number(r[2]);
  if (!month || !Number.isInteger(year) || year < 1900 || year > 2100) return null;
  return {
    iso: `${year}-${String(month).padStart(2, "0")}-01`,
    start: r.index,
    end: r.index + (r[0]?.length ?? 0),
  };
}

/**
 * Punctuation stripped from both ends of a line. The hyphen has to stay last in
 * the class and the brackets have to be escaped: an unescaped `]` closes the
 * class early, and a `-` in the middle silently becomes a character range.
 * The trailing side is narrower than the leading one: a title may close a
 * parenthesis and a sentence may end in a period, and neither is noise.
 */
const EDGE = "[\\s.,;:!?/\\\\|()\\[\\]{}<>*#•_=ºª\"'–—-]";
const EDGE_TAIL = "[\\s*#•_=\"'|–—-]";
function clean(value: string): string {
  let out = value.trim();
  out = out.replace(new RegExp("^" + EDGE + "+"), "").trim();
  out = out.replace(new RegExp(EDGE_TAIL + "+$"), "").trim();
  return out.replace(/\s{2,}/g, " ").trim();
}

/**
 * A gap of more than 1.8 line heights means a new block. The line height comes
 * from the smallest gaps, because the median is polluted by the wider gaps that
 * separate one activity from the next.
 */
function lineHeight(gaps: number[]): number {
  const small = gaps.filter((gap) => gap > 0.5).sort((a, b) => a - b);
  const pick = small[Math.floor(small.length * 0.25)] ?? 14;
  return pick >= 4 && pick <= 40 ? pick : 14;
}

type TextLine = { str?: string; transform?: ArrayLike<number> };

function splitBlocks(items: readonly TextLine[]): string[][] {
  const points = items
    .map((item) => ({
      str: (item.str || "").trim(),
      y: item.transform?.[5] ?? Number.NaN,
      x: item.transform?.[4] ?? 0,
    }))
    .filter((point) => point.str && Number.isFinite(point.y))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const gaps: number[] = [];
  for (let i = 1; i < points.length; i++)
    gaps.push((points[i - 1] as { y: number }).y - (points[i] as { y: number }).y);
  const lh = lineHeight(gaps);
  const blocks: string[][] = [];
  let current: string[] = [];
  let previousY = Infinity;
  for (const point of points) {
    if (current.length && previousY - point.y > lh * 1.8) {
      blocks.push(current);
      current = [];
    }
    current.push(point.str);
    previousY = point.y;
  }
  if (current.length) blocks.push(current);
  return blocks;
}

/**
 * A page counter such as "13/15" is chrome: it changes on every page, so the repeat check in
 * dropChrome never catches it, and it is never part of a record. It also arrives glued in front of
 * the first line of the next page whenever the footer shares a baseline with the body text.
 */
const PAGE_COUNTER = /^\d{1,4}\s*\/\s*\d{1,4}$/;
const PAGE_COUNTER_PREFIX = /^\d{1,4}\s*\/\s*\d{1,4}\s+/;
function stripPageCounter(line: string): string {
  if (PAGE_COUNTER.test(line)) return "";
  return line.replace(PAGE_COUNTER_PREFIX, "");
}

const blockKey = (block: string[]) => block.join(" ").toLowerCase().replace(/\s+/g, " ").trim();

/** Letterhead and footer repeat on every page; they are never an activity. */
function dropChrome(pages: string[][][]): { blocks: string[][][]; dropped: string[] } {
  const at = (page: string[][], fromEnd: boolean, depth: number) => {
    const slice = fromEnd ? page.slice(-depth) : page.slice(0, depth);
    return slice.map(blockKey);
  };
  const starts = new Map<string, number>();
  const ends = new Map<string, number>();
  for (const page of pages) {
    for (const key of at(page, false, 3)) starts.set(key, (starts.get(key) || 0) + 1);
    for (const key of at(page, true, 2)) ends.set(key, (ends.get(key) || 0) + 1);
  }
  const dropped: string[] = [];
  const kept = pages.map((page) => {
    const removed = new Set<string>();
    const firstKeys = at(page, false, 3);
    const lastKeys = at(page, true, 2);
    page.forEach((block, index) => {
      const key = blockKey(block);
      const isEdge =
        (index < 3 && (starts.get(key) || 0) > 1) ||
        (index >= page.length - 2 && (ends.get(key) || 0) > 1);
      if (isEdge) removed.add(key);
    });
    return page.filter((block, index) => {
      const key = blockKey(block);
      // A page counter changes on every page, so it never repeats and never reaches the
      // check above.
      if (PAGE_COUNTER.test(key)) {
        if (!dropped.includes(key)) dropped.push(key);
        return false;
      }
      if (removed.has(key) && (firstKeys.includes(key) || lastKeys.includes(key))) {
        if (!dropped.includes(key)) dropped.push(key);
        return false;
      }
      return true;
    });
  });
  return { blocks: kept, dropped };
}

export async function extractPdfBlocks(
  file: File,
): Promise<{ pages: number; blocks: string[][][]; dropped: string[] }> {
  const lib = await pdfjs();
  const buffer = await file.arrayBuffer();
  const doc = await lib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[][][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    pages.push(splitBlocks(content.items as TextLine[]));
  }
  await doc.destroy();
  const { blocks, dropped } = dropChrome(pages);
  return { pages: doc.numPages, blocks, dropped };
}

/**
 * Labels recognised at the start of a line. Everything else is a title or part
 * of the description, which is why they are anchored with `^`: an unanchored
 * match would swallow the sentence that merely mentions the label.
 * The Markdown model writes long labels ("Tipo de Atividade", "Objetivos
 * (Detalhamento/Justificativa)"), so each key accepts its parenthesised suffix
 * before the colon, and the result labels come before "resultado" itself or a
 * "Resultados Esperados" line would be read as the status field.
 */
const LABELS: { key: string; re: RegExp }[] = [
  { key: "kind", re: /^(tipo de atividade|tipo|modalidade|categoria)\s*[:\-–]\s*/i },
  {
    key: "desc",
    re: /^(descri[çc][ãa]o da atividade(\s*\([^)]*\))?|descri[çc][ãa]o|detalhamento|relato|resumo)\s*[:\-–]\s*/i,
  },
  { key: "expected", re: /^(resultados? esperados?)\s*[:\-–]\s*/i },
  { key: "achieved", re: /^(resultados? (alcan[çc]ados|obtidos|realizados))\s*[:\-–]\s*/i },
  { key: "objectives", re: /^(objetivos?(\s*\([^)]*\))?)\s*[:\-–]\s*/i },
  { key: "title", re: /^(t[íi]tulo|evento|atividade|a[çc][ãa]o)\s*[:\-–]\s*/i },
  { key: "done", re: /^(resultado|status|situa[çc][ãa]o|work done|andamento)\s*[:\-–]\s*/i },
  { key: "participants", re: /^(participantes|presentes|p[úu]blico)\s*[:\-–]\s*/i },
  { key: "agenda", re: /^(pauta|assuntos?)\s*[:\-–]\s*/i },
  {
    key: "org",
    re: /^(organiza[çc][ãa]o|org[ãa]o|institui[çc][ãa]o|empresa|universidade|entidade)\s*[:\-–]\s*/i,
  },
  { key: "axis", re: /^(eixo|objetivo estrat[ée]gico)\s*[:\-–]\s*/i },
  {
    key: "referrals",
    re: /^(encaminhamento|refer[êe]ncia|demanda|articula[çc][ãa]o)\s*[:\-–]\s*/i,
  },
];

function guessKind(text: string): string {
  const t = text.toLowerCase();
  if (/reuni[ãa]o\s+de\s+governan/.test(t)) return "Reunião de governança";
  if (/reuni[ãa]o\s+com\s+a\s+coordena/.test(t)) return "Reunião com a coordenação";
  if (/evento\s+como\s+ouvinte/.test(t)) return "Evento como ouvinte";
  if (/evento\s+como\s+organizador/.test(t)) return "Evento como organizador";
  if (/plano\s+de\s+estrat[ée]gias/.test(t)) return "Plano de estratégias";
  return "Atividade geral";
}

const norm = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The label in the report rarely matches the label in the system: the report says
 * "Plano de estratégias" where the app offers "Atividade do plano de estratégias".
 */
function matchKind(guess: string, kinds: string[]): string {
  if (kinds.includes(guess)) return guess;
  const flat = (value: string) => norm(value);
  const target = flat(guess);
  const loose = kinds.find((kind) => {
    const option = flat(kind);
    return option.includes(target) || target.includes(option);
  });
  return loose ?? guess;
}

export function dedupeKey(title: string, startDate: string): string {
  return `${norm(title).slice(0, 40)}|${startDate}`;
}

/** One activity of the report, ready for the review screen. */
export type ImportRow = {
  id: string;
  include: boolean;
  kind: string;
  title: string;
  description: string;
  objectives: string;
  expectedResults: string;
  achievedResults: string;
  status: string;
  startDate: string;
  endDate: string;
  notes: string[];
  duplicate: boolean;
};

export function parseBlocks(
  blocks: string[][][],
  kinds: string[],
  statuses: string[],
  swap = false,
): { rows: ImportRow[]; orphanBlocks: number } {
  const records: string[][] = [];
  let orphanBlocks = 0;
  for (const page of blocks) {
    for (const block of page) {
      const lines = block.map(clean).filter(Boolean);
      if (!lines.length) continue;
      if (lines.some((line) => findDate(line, swap) || findPeriod(line))) records.push(lines);
      else if (records.length) records[records.length - 1]!.push(...lines);
      else orphanBlocks++;
    }
  }

  const rows: ImportRow[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const fields: Record<string, string> = {};
    const free: string[] = [];
    let startDate = "";
    let endDate = "";
    record.forEach((line, index) => {
      const dates = findDates(line, swap);
      const date = dates[0] ?? null;
      const period = date ? null : findPeriod(line);
      const hit = date || period;
      let body = line;
      if (hit) {
        if (!startDate) startDate = hit.iso;
        // A heading such as "09/07/2025 a 11/07/2025 — Título" carries the conclusion day
        // too, and only the record's first line can be such a heading.
        const spanning = Boolean(date) && index === 0 && dates.length > 1;
        const last = spanning ? dates[dates.length - 1] : undefined;
        if (last && last.iso > startDate) endDate = last.iso;
        const head = spanning && date ? date : hit;
        const tail = spanning && last ? last : hit;
        const before = clean(line.slice(0, head.start));
        const after = clean(line.slice(tail.end));
        if (!date && before.split(/\s+/).length <= 3) free.push(before);
        body = [before, after].filter(Boolean).join(" ");
      }
      body = clean(body);
      if (!body) return;
      const label = LABELS.find((item) => item.re.test(body));
      if (label) {
        const value = clean(body.replace(label.re, ""));
        fields[label.key] = fields[label.key] ? `${fields[label.key]} ${value}` : value;
      } else free.push(body);
    });

    const title = clean(fields["title"] || free[0] || "").slice(0, 200);
    if (!title) continue;

    const kindRaw = `${fields["kind"] || ""} ${title}`.trim();
    const guess = guessKind(kindRaw);
    const kind = fields["kind"] ? matchKind(clean(fields["kind"]), kinds) : matchKind(guess, kinds);
    const notes: string[] = [];
    if (!kinds.includes(kind))
      notes.push(
        `O tipo lido ("${kind}") não está na lista de tipos do sistema. Escolha o tipo correto antes de importar.`,
      );
    else if (!fields["kind"]) {
      if (kind !== guess)
        notes.push(`O relatório diz "${guess}" e o sistema chama de "${kind}". Confira.`);
      else if (kind !== "Atividade geral")
        notes.push(`Tipo identificado como "${kind}". Confira se está certo.`);
    }

    // The report is a record of work already done, so every row arrives concluded
    // and the reviewer changes the ones that are not.
    const status = statuses.find((value) => norm(value) === "concluida") || statuses[0] || "";
    const extras = ["participants", "agenda", "referrals"]
      .map((key) => fields[key] || "")
      .filter(Boolean)
      .join(" ");
    const description = [fields["desc"] || "", free.slice(1).join(" "), extras]
      .filter(Boolean)
      .join(" · ");

    const key = dedupeKey(title, startDate);
    const duplicate = seen.has(key);
    seen.add(key);
    rows.push({
      id: crypto.randomUUID(),
      include: !duplicate,
      kind,
      title,
      description: description.slice(0, 2000),
      objectives: (fields["objectives"] || "").slice(0, 2000),
      expectedResults: (fields["expected"] || "").slice(0, 2000),
      achievedResults: (fields["achieved"] || "").slice(0, 2000),
      status,
      startDate,
      endDate: endDate || startDate,
      notes: duplicate
        ? [...notes, "Repetido dentro do próprio arquivo; deixei desmarcado."]
        : notes,
      duplicate,
    });
  }
  return { rows, orphanBlocks };
}

function splitTextLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").split("\n");
}

/**
 * The Markdown model puts one activity under a "#### dd/mm/aaaa — Título"
 * heading: a heading that carries a day opens a record, every other heading and
 * everything before the first record is chrome, and the bullets that follow
 * belong to the record just opened. Bold markers and bullet dashes are removed
 * so the labels look the same as in a PDF.
 */
async function extractMarkdownBlocks(
  file: File,
  swap = false,
): Promise<{ pages: number; blocks: string[][][]; dropped: string[] }> {
  const text = await file.text();
  const records: string[][] = [];
  const dropped: string[] = [];
  const note = (line: string) => {
    if (dropped.length < 40) dropped.push(line.slice(0, 60));
  };
  let current: string[] | null = null;
  for (const raw of splitTextLines(text)) {
    const heading = /^#{1,6}\s/.test(raw);
    const line = clean(raw.replace(/^\s*[-*+]\s+/, "").replace(/\*\*([^*]+)\*\*/g, "$1"));
    if (!line) continue;
    if (heading) {
      if (findDate(line, swap)) {
        current = [line];
        records.push(current);
      } else {
        current = null;
        note(line);
      }
      continue;
    }
    if (!current) {
      if (findDate(line, swap)) {
        current = [line];
        records.push(current);
      } else note(line);
      continue;
    }
    current.push(line);
  }
  return { pages: 1, blocks: [records], dropped };
}

export async function importFiles(
  files: File[],
  swap: boolean,
  kinds: string[],
  statuses: string[],
) {
  let pages = 0;
  const all: string[][][] = [];
  const dropped: string[] = [];
  for (const file of files) {
    const isText = /\.(md|markdown|txt)$/i.test(file.name) || /^text\//.test(file.type || "");
    const out = isText ? await extractMarkdownBlocks(file, swap) : await extractPdfBlocks(file);
    pages += out.pages;
    all.push(...out.blocks);
    for (const key of out.dropped) if (!dropped.includes(key)) dropped.push(key);
  }
  const { rows, orphanBlocks } = parseBlocks(all, kinds, statuses, swap);
  const text = all.flat(2).join("\n");
  return {
    rows: rows.map((row) => ({
      ...row,
      startDate: dayKey(row.startDate),
      endDate: dayKey(row.endDate),
    })),
    files: files.length,
    pages,
    text,
    dropped,
    orphanBlocks,
  };
}

/* ---------------------------------------------------------------------------
 * Axis catalog.
 *
 * How the axis is spelled varies between documents, so the loose match lives here
 * and is shared: the activity parser uses it for the report header and the plan
 * parser in planImport.ts uses it for the axis label. The rest of this file reads
 * reports only.
 * ------------------------------------------------------------------------- */
/** Axes as the report writes them, folded to match against the system's spelling. */
const looseAxes: { key: string; re: RegExp }[] = [
  { key: "Governança do Ecossistema", re: /governan[çc]a\s+d[oe]\s+ecossistema/ },
  {
    key: "Programas e Ações de Inovação",
    re: /programas?\s+e\s+a[çc][õo]?es\s+d[ae]\s+inova[çc][ãa]o/,
  },
  { key: "Comunidade Empreendedora", re: /comunidade\s+empreendedora/ },
  { key: "Ambiente de Inovação", re: /ambientes?\s+d[ae]\s+inova[çc][ãa]o/ },
  { key: "Relação Academia/Empresa", re: /rela[çc][ãa]o\s+academia\s*\/?\s*empresa/ },
  { key: "Políticas Públicas", re: /pol[íi]ticas?\s+p[úu]blicas?/ },
  { key: "Comunicação", re: /comunica[çc][ãa]o/ },
  { key: "Captação de Recursos", re: /capta[çc][ãa]o\s+d[ee]\s+recursos?/ },
  { key: "Sensibilização de Atores", re: /sensibiliza[çc][ãa]o\s+d[ee]\s+atores?/ },
  { key: "Setorial", re: /\bsetorial\b/ },
];

export function matchAxis(text: string, axes: string[]): string {
  const flat = (value: string) => norm(value);
  const folded = flat(text);
  for (const axis of axes) if (flat(axis) === folded) return axis;
  for (const candidate of looseAxes) {
    if (!candidate.re.test(folded)) continue;
    const loose = axes.find((axis) => {
      const option = flat(axis);
      return option.includes(folded) || folded.includes(option);
    });
    if (loose) return loose;
  }
  return "";
}
