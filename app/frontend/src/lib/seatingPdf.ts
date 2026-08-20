import { SeatingChart, SeatingSection } from './types';
import {
  CUSTOM_INSTRUMENT,
  InstrumentSlot,
  getInstrumentLabelKey,
  getInstrumentSlot,
  isPlayerNamed,
  isSectionEmpty,
} from './seating';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 50;
const MARGIN_TOP = 52;
const MARGIN_BOTTOM = 48;
const COLUMN_GUTTER = 28;
const TITLE_SIZE = 18;
const TITLE_GAP = 10;
const CONDUCTOR_LABEL_SIZE = 9;
const CONDUCTOR_NAME_SIZE = 12;
const CONDUCTOR_BLOCK_GAP = 22;
const SECTION_SIZE = 12;
const SECTION_GAP = 5;
const NAME_SIZE = 10;
const NAME_LINE = 13;
const COVER_LABEL_SIZE = 9;
const COVER_LABEL_GAP = 4;
const SECTION_BLOCK_GAP = 12;

const LEFT_COLUMN_SLOTS: InstrumentSlot[] = [
  'flute',
  'oboe',
  'clarinet',
  'bassClarinet',
  'bassoon',
  'contrabassoon',
  'horn',
  'trumpet',
  'trombone',
  'bassTrombone',
  'tuba',
  'harp',
  'piano',
  'timpani',
  'percussion',
  'extras',
];

const RIGHT_COLUMN_SLOTS: InstrumentSlot[] = [
  'violin1',
  'violin2',
  'viola',
  'cello',
  'bass',
];

const WINANSI_PUNCTUATION: Record<number, number> = {
  0x0152: 0x8c,
  0x0153: 0x9c,
  0x0160: 0x8a,
  0x0161: 0x9a,
  0x0178: 0x9f,
  0x017d: 0x8e,
  0x017e: 0x9e,
  0x0192: 0x83,
  0x02c6: 0x88,
  0x02dc: 0x98,
  0x2013: 0x96,
  0x2014: 0x97,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201a: 0x82,
  0x201c: 0x93,
  0x201d: 0x94,
  0x201e: 0x84,
  0x2020: 0x86,
  0x2021: 0x87,
  0x2022: 0x95,
  0x2026: 0x85,
  0x2030: 0x89,
  0x2039: 0x8b,
  0x203a: 0x9b,
  0x20ac: 0x80,
  0x2122: 0x99,
};

type Translate = (key: string, params?: Record<string, string | number>) => string;

type PdfFont = 'regular' | 'bold' | 'oblique';

type PdfLine = {
  text: string;
  font: PdfFont;
  size: number;
  muted?: boolean;
  indent?: number;
  height: number;
};

type PdfBuilder = {
  addObject: (body: string) => number;
  replaceObject: (id: number, body: string) => void;
  build: (rootId: number, infoId: number) => Uint8Array;
};

export function downloadSeatingPdf({
  projectTitle,
  conductor,
  chart,
  t,
}: {
  projectTitle: string;
  conductor: string;
  chart: SeatingChart;
  t: Translate;
}): void {
  const title = projectTitle.trim() || t('stagePage.title');
  const bytes = buildSeatingPdf(title, conductor.trim(), chart, t);
  const pdfBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(pdfBuffer).set(bytes);
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${sanitizePdfFilename(title)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function buildSeatingPdf(
  title: string,
  conductor: string,
  chart: SeatingChart,
  t: Translate
): Uint8Array {
  const leftLines = linesForSlots(chart, LEFT_COLUMN_SLOTS, t);
  const rightLines = linesForSlots(chart, RIGHT_COLUMN_SLOTS, t);
  const headerHeight = measureHeaderHeight(conductor);
  const firstColumnHeight = PAGE_HEIGHT - MARGIN_TOP - headerHeight - MARGIN_BOTTOM;
  const laterColumnHeight = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;
  const leftPages = paginateLines(leftLines, firstColumnHeight, laterColumnHeight);
  const rightPages = paginateLines(rightLines, firstColumnHeight, laterColumnHeight);
  const pageCount = Math.max(leftPages.length, rightPages.length, 1);
  const columnWidth = (PAGE_WIDTH - MARGIN_X * 2 - COLUMN_GUTTER) / 2;
  const rightX = MARGIN_X + columnWidth + COLUMN_GUTTER;

  const pdf = createPdfBuilder();
  const fontRegular = pdf.addObject(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  );
  const fontBold = pdf.addObject(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  );
  const fontOblique = pdf.addObject(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>'
  );
  const fontIds: Record<PdfFont, number> = {
    regular: fontRegular,
    bold: fontBold,
    oblique: fontOblique,
  };

  const pageIds: number[] = [];
  const contentIds: number[] = [];
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    contentIds.push(0);
    pageIds.push(0);
  }

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const ops: string[] = [];
    let columnTop = MARGIN_TOP;
    if (pageIndex === 0) {
      drawHeader(ops, title, conductor, t);
      columnTop += headerHeight;
    }
    drawColumn(ops, leftPages[pageIndex] || [], MARGIN_X, columnTop);
    drawColumn(ops, rightPages[pageIndex] || [], rightX, columnTop);
    contentIds[pageIndex] = addStream(pdf, ops.join('\n'));
  }

  const pagesId = pdf.addObject('<< /Type /Pages /Kids [] /Count 0 >>');
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    pageIds[pageIndex] = pdf.addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 ${fontIds.regular} 0 R /F2 ${fontIds.bold} 0 R /F3 ${fontIds.oblique} 0 R >> >> ` +
        `/Contents ${contentIds[pageIndex]} 0 R >>`
    );
  }

  pdf.replaceObject(
    pagesId,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`
  );

  const catalogId = pdf.addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const infoId = pdf.addObject(
    `<< /Title ${pdfHexString(title)} /Producer ${pdfHexString('Orchestra Manager')} >>`
  );
  return pdf.build(catalogId, infoId);
}

function measureHeaderHeight(conductor: string): number {
  let height = TITLE_SIZE + TITLE_GAP;
  if (conductor) {
    height += CONDUCTOR_LABEL_SIZE + 4 + CONDUCTOR_NAME_SIZE + CONDUCTOR_BLOCK_GAP;
  } else {
    height += 12;
  }
  return height;
}

function drawHeader(ops: string[], title: string, conductor: string, t: Translate) {
  let y = MARGIN_TOP + TITLE_SIZE;
  drawText(ops, title, MARGIN_X, y, 'bold', TITLE_SIZE);
  y += TITLE_GAP + CONDUCTOR_LABEL_SIZE;
  if (!conductor) return;
  drawText(ops, t('stagePage.conductor'), MARGIN_X, y, 'oblique', CONDUCTOR_LABEL_SIZE, true);
  y += 4 + CONDUCTOR_NAME_SIZE;
  drawText(ops, conductor, MARGIN_X, y, 'regular', CONDUCTOR_NAME_SIZE);
}

function drawColumn(ops: string[], lines: PdfLine[], x: number, top: number) {
  let y = top;
  for (const line of lines) {
    y += line.size;
    drawText(ops, line.text, x + (line.indent || 0), y, line.font, line.size, line.muted);
    y += line.height - line.size;
  }
}

function drawText(
  ops: string[],
  text: string,
  x: number,
  yFromTop: number,
  font: PdfFont,
  size: number,
  muted = false
) {
  const fontName = font === 'bold' ? '/F2' : font === 'oblique' ? '/F3' : '/F1';
  const y = PAGE_HEIGHT - yFromTop;
  ops.push('BT');
  ops.push(muted ? '0.35 0.35 0.35 rg' : '0 0 0 rg');
  ops.push(`${fontName} ${size} Tf`);
  ops.push(`1 0 0 1 ${formatPdfNumber(x)} ${formatPdfNumber(y)} Tm`);
  ops.push(`${pdfHexString(text)} Tj`);
  ops.push('ET');
}

function linesForSlots(chart: SeatingChart, slots: InstrumentSlot[], t: Translate): PdfLine[] {
  const bySlot = new Map<InstrumentSlot, SeatingSection[]>();
  for (const section of chart.sections) {
    if (isSectionEmpty(section)) continue;
    const slot = getInstrumentSlot(section.instrument);
    const existing = bySlot.get(slot);
    if (existing) existing.push(section);
    else bySlot.set(slot, [section]);
  }

  const lines: PdfLine[] = [];
  for (const slot of slots) {
    for (const section of bySlot.get(slot) || []) {
      if (lines.length > 0) {
        lines.push({ text: '', font: 'regular', size: 0, height: SECTION_BLOCK_GAP });
      }
      lines.push({
        text: sectionLabel(section, t),
        font: 'bold',
        size: SECTION_SIZE,
        height: SECTION_SIZE + SECTION_GAP,
      });
      for (const player of section.players.filter(isPlayerNamed)) {
        lines.push({
          text: player.name.trim(),
          font: 'regular',
          size: NAME_SIZE,
          indent: 10,
          height: NAME_LINE,
        });
      }
      const covers = section.covers.filter(isPlayerNamed);
      if (covers.length === 0) continue;
      lines.push({
        text: t('stagePage.covers'),
        font: 'oblique',
        size: COVER_LABEL_SIZE,
        muted: true,
        indent: 10,
        height: COVER_LABEL_SIZE + COVER_LABEL_GAP,
      });
      for (const player of covers) {
        lines.push({
          text: player.name.trim(),
          font: 'regular',
          size: NAME_SIZE,
          indent: 10,
          height: NAME_LINE,
        });
      }
    }
  }
  return lines;
}

function paginateLines(
  lines: PdfLine[],
  firstPageHeight: number,
  laterPageHeight: number
): PdfLine[][] {
  if (lines.length === 0) return [[]];
  const pages: PdfLine[][] = [];
  let current: PdfLine[] = [];
  let used = 0;
  let pageIndex = 0;

  function pageHeight(): number {
    return pageIndex === 0 ? firstPageHeight : laterPageHeight;
  }

  for (const line of lines) {
    const height = Math.max(line.height, 0);
    const isSpacer = !line.text && line.size === 0;
    if (isSpacer && current.length === 0) continue;
    if (current.length > 0 && used + height > pageHeight()) {
      pages.push(current);
      current = [];
      used = 0;
      pageIndex += 1;
      if (isSpacer) continue;
    }
    current.push(line);
    used += height;
  }

  if (current.length > 0 || pages.length === 0) pages.push(current);
  return pages;
}

function sectionLabel(section: SeatingSection, t: Translate): string {
  if (section.instrument === CUSTOM_INSTRUMENT || section.customLabel) {
    return (section.customLabel || '').trim() || t('stage.instruments.custom');
  }
  return t(getInstrumentLabelKey(section.instrument));
}

function createPdfBuilder(): PdfBuilder {
  const objects: string[] = [''];

  function addObject(body: string): number {
    objects.push(body);
    return objects.length - 1;
  }

  return {
    addObject,
    replaceObject(id: number, body: string) {
      objects[id] = body;
    },
    build(rootId: number, infoId: number): Uint8Array {
      const encoder = new TextEncoder();
      const parts: Uint8Array[] = [encoder.encode('%PDF-1.4\n')];
      const offsets = [0];
      let offset = parts[0].length;

      for (let id = 1; id < objects.length; id++) {
        offsets[id] = offset;
        const bytes = encoder.encode(`${id} 0 obj\n${objects[id]}\nendobj\n`);
        parts.push(bytes);
        offset += bytes.length;
      }

      const xrefStart = offset;
      const count = objects.length;
      let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
      for (let id = 1; id < count; id++) {
        xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
      }
      xref +=
        `trailer\n<< /Size ${count} /Root ${rootId} 0 R /Info ${infoId} 0 R >>\n` +
        `startxref\n${xrefStart}\n%%EOF\n`;
      parts.push(encoder.encode(xref));
      return concatBytes(parts);
    },
  };
}

function addStream(pdf: PdfBuilder, content: string): number {
  const encoder = new TextEncoder();
  const length = encoder.encode(content).length;
  return pdf.addObject(`<< /Length ${length} >>\nstream\n${content}\nendstream`);
}

function pdfHexString(text: string): string {
  const hex = toWinAnsiBytes(text)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `<${hex}>`;
}

function toWinAnsiBytes(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    if (code === 0x09 || code === 0x0a || code === 0x0d) {
      bytes.push(0x20);
      continue;
    }
    if (code >= 32 && code <= 126) {
      bytes.push(code);
      continue;
    }
    if (code >= 160 && code <= 255) {
      bytes.push(code);
      continue;
    }
    const mapped = WINANSI_PUNCTUATION[code];
    if (mapped !== undefined) {
      bytes.push(mapped);
      continue;
    }
    const folded = char.normalize('NFD').replace(/\p{M}/gu, '');
    if (folded && folded !== char) {
      bytes.push(...toWinAnsiBytes(folded));
      continue;
    }
    bytes.push(0x3f);
  }
  return bytes;
}

function formatPdfNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function sanitizePdfFilename(title: string): string {
  const ascii = title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || 'stage';
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}
