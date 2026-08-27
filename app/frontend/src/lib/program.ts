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

const PROGRAM_LENGTH_PATTERN = /^(\d{1,2}):(\d{2})$/;

/** Parses a program length string (`HH:MM`) into total minutes. */
export function parseProgramLength(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(PROGRAM_LENGTH_PATTERN);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes >= 60) return null;

  return hours * 60 + minutes;
}

/**
 * Parses a duration for catalog fields: `HH:MM`, or a whole number of minutes
 * so older minute-only values still import and save.
 */
export function parseDurationMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const asLength = parseProgramLength(trimmed);
  if (asLength !== null) return asLength;
  if (!/^\d+$/.test(trimmed)) return null;

  const minutes = Number.parseInt(trimmed, 10);
  return Number.isFinite(minutes) ? minutes : null;
}

/** Formats total minutes as `HH:MM`. */
export function formatProgramLength(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Sums every parseable length in the program rows, or `null` when none are valid. */
export function sumProgramLengths(rows: ProgramRow[]): string | null {
  let totalMinutes = 0;
  let hasValidLength = false;

  for (const row of rows) {
    const minutes = parseProgramLength(row.length);
    if (minutes === null) continue;
    totalMinutes += minutes;
    hasValidLength = true;
  }

  if (!hasValidLength) return null;
  return formatProgramLength(totalMinutes);
}

function normalizeProgramRow(row: Partial<ProgramRow>): ProgramRow {
  const normalized: ProgramRow = {
    id: row.id || createRowId(),
    composer: row.composer || '',
    title: row.title || '',
    instrumentation: row.instrumentation || '',
    length: row.length || '',
  };
  if (row.catalogWorkId) normalized.catalogWorkId = row.catalogWorkId;
  return normalized;
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

export type ProgramSearchHit = {
  projectId: string;
  projectTitle: string;
  rowNumber: number;
  row: ProgramRow;
};

type ProjectProgramMeta = {
  projectId: string;
  title: string;
  latestDateISO: string;
};

export function searchAllPrograms(
  events: EventItem[],
  projects: ProjectProgramMeta[],
  query: string
): ProgramSearchHit[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  const hits: ProgramSearchHit[] = [];

  for (const project of projects) {
    const rows = findProgramForProject(events, project.projectId);
    rows.forEach((row, index) => {
      if (isProgramRowEmpty(row)) return;
      const haystack = PROGRAM_COLUMNS.map((column) => row[column] || '')
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(term)) return;
      hits.push({
        projectId: project.projectId,
        projectTitle: project.title,
        rowNumber: index + 1,
        row,
      });
    });
  }

  const latestByProject = new Map(
    projects.map((project) => [project.projectId, project.latestDateISO])
  );

  hits.sort((a, b) => {
    const dateCmp = (latestByProject.get(b.projectId) || '').localeCompare(
      latestByProject.get(a.projectId) || ''
    );
    if (dateCmp !== 0) return dateCmp;
    const titleCmp =
      (a.projectTitle || a.projectId).localeCompare(b.projectTitle || b.projectId) ||
      a.projectId.localeCompare(b.projectId);
    if (titleCmp !== 0) return titleCmp;
    return a.rowNumber - b.rowNumber;
  });

  return hits;
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
