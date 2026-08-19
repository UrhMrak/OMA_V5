import { EventItem, ProgramRow } from './types';
import { api } from './api';

export const PROGRAM_COLUMNS = ['composer', 'title', 'instrumentation', 'length'] as const;

export type ProgramColumn = (typeof PROGRAM_COLUMNS)[number];

let rowIdCounter = 0;

function createRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  rowIdCounter += 1;
  return `program-row-${Date.now()}-${rowIdCounter}`;
}

export function createEmptyProgramRow(): ProgramRow {
  return { id: createRowId(), composer: '', title: '', instrumentation: '', length: '' };
}

export function isProgramRowEmpty(row: ProgramRow): boolean {
  return PROGRAM_COLUMNS.every((column) => !(row[column] || '').trim());
}

function normalizeProgramRow(row: Partial<ProgramRow>): ProgramRow {
  return {
    id: row.id || createRowId(),
    composer: row.composer || '',
    title: row.title || '',
    instrumentation: row.instrumentation || '',
    length: row.length || '',
  };
}

export function normalizeProgramRows(rows: unknown): ProgramRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is Partial<ProgramRow> => !!row && typeof row === 'object')
    .map(normalizeProgramRow);
}

const LEADING_ROW_NUMBER = /^\d+\s*[.)]?\s*/;

function stripLeadingRowNumber(value: string): string {
  return value.replace(LEADING_ROW_NUMBER, '').trim();
}

/**
 * Migrates legacy free-text programs. They are tab separated as
 * `number, composer, title, length`, with the instrumentation carried on
 * following lines whose leading (number) field is blank.
 */
export function parseProgramText(text?: string): ProgramRow[] {
  const rows: ProgramRow[] = [];

  for (const line of (text || '').split('\n')) {
    if (!line.trim()) continue;

    const fields = line.split('\t');
    const isContinuation = fields.length > 1 && !fields[0].trim();

    if (isContinuation) {
      const instrumentation = fields.slice(1).join(' ').trim();
      const previousRow = rows[rows.length - 1];
      if (previousRow && instrumentation) {
        previousRow.instrumentation = previousRow.instrumentation
          ? `${previousRow.instrumentation}\n${instrumentation}`
          : instrumentation;
        continue;
      }
      if (!previousRow && instrumentation) {
        rows.push({ ...createEmptyProgramRow(), instrumentation });
      }
      continue;
    }

    const row = createEmptyProgramRow();
    if (fields.length >= 4) {
      row.composer = stripLeadingRowNumber(fields[1]);
      row.title = fields[2].trim();
      row.length = fields[3].trim();
    } else if (fields.length === 3) {
      row.composer = stripLeadingRowNumber(fields[0]);
      row.title = fields[1].trim();
      row.length = fields[2].trim();
    } else {
      row.title = stripLeadingRowNumber(line.replace(/\t/g, ' ').trim());
    }
    rows.push(row);
  }

  return rows;
}

export function getProgramRows(source?: Partial<EventItem> | null): ProgramRow[] {
  if (!source) return [];
  if (Array.isArray(source.programRows)) return normalizeProgramRows(source.programRows);
  return parseProgramText(source.program);
}

function hasStoredProgramRows(event: Partial<EventItem>): boolean {
  return Array.isArray(event.programRows) && event.programRows.length > 0;
}

/** Plain-text summary kept on `program` so stats, CSV and ICS exports stay readable. */
export function programRowsToText(rows: ProgramRow[]): string {
  return rows
    .filter((row) => !isProgramRowEmpty(row))
    .map((row) =>
      PROGRAM_COLUMNS.map((column) => (row[column] || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' - ')
    )
    .filter(Boolean)
    .join('\n');
}

export function getProjectEvents(events: EventItem[], projectId: string): EventItem[] {
  const normalized = projectId.trim();
  if (!normalized) return [];
  return events.filter((event) => (event.projectId || '').trim() === normalized);
}

/**
 * Programs are stored on every event of a project, so the newest event that
 * actually carries rows wins whenever events briefly disagree.
 */
export function findProgramForProject(events: EventItem[], projectId: string): ProgramRow[] {
  const projectEvents = getProjectEvents(events, projectId).sort((a, b) =>
    b.dateISO.localeCompare(a.dateISO)
  );
  if (projectEvents.length === 0) return [];

  const withRows = projectEvents.find(hasStoredProgramRows);
  if (withRows) return getProgramRows(withRows);

  const withText = projectEvents.find((event) => (event.program || '').trim());
  return withText ? getProgramRows(withText) : [];
}

export async function propagateProgramToProject(
  events: EventItem[],
  projectId: string,
  rows: ProgramRow[],
  excludeEventId?: string
): Promise<void> {
  const targets = getProjectEvents(events, projectId).filter((event) => event.id !== excludeEventId);
  if (targets.length === 0) return;

  const payload = { programRows: rows, program: programRowsToText(rows) };
  await Promise.all(targets.map((event) => api.put(`/api/events/${event.id}`, payload)));
}
