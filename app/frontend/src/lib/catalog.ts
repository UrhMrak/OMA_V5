import { CatalogHolding, CatalogMaterialType, CatalogWork, ProgramRow } from './types';

export const CATALOG_MATERIAL_TYPES: CatalogMaterialType[] = [
  'owned',
  'rental',
  'borrowed',
  'manuscript',
];

export const DEFAULT_MATERIAL_TYPE: CatalogMaterialType = 'owned';

const LOCATION_SEPARATOR = ' / ';

export type CatalogFieldSource = 'work' | 'holding';

export type CatalogField = {
  /** Column name used in CSV headers and in the import payload. */
  key: string;
  /** Property on the record, when it differs from the column name. */
  valueKey?: string;
  labelKey: string;
  source: CatalogFieldSource;
};

/**
 * Single source of truth for the flattened work + holding shape used by CSV
 * export, CSV import mapping and the import endpoint.
 */
export const CATALOG_FIELDS: CatalogField[] = [
  { key: 'composer', labelKey: 'catalog.field.composer', source: 'work' },
  { key: 'title', labelKey: 'catalog.field.title', source: 'work' },
  { key: 'subtitle', labelKey: 'catalog.field.subtitle', source: 'work' },
  { key: 'catalog_number', labelKey: 'catalog.field.catalogNumber', source: 'work' },
  { key: 'arranger', labelKey: 'catalog.field.arranger', source: 'work' },
  { key: 'genre', labelKey: 'catalog.field.genre', source: 'work' },
  { key: 'instrumentation', labelKey: 'catalog.field.instrumentation', source: 'work' },
  { key: 'duration_minutes', labelKey: 'catalog.field.duration', source: 'work' },
  { key: 'movements', labelKey: 'catalog.field.movements', source: 'work' },
  { key: 'keywords', labelKey: 'catalog.field.keywords', source: 'work' },
  { key: 'notes', labelKey: 'catalog.field.workNotes', source: 'work' },
  { key: 'accession_no', labelKey: 'catalog.field.accessionNo', source: 'holding' },
  { key: 'material_type', labelKey: 'catalog.field.materialType', source: 'holding' },
  { key: 'publisher', labelKey: 'catalog.field.publisher', source: 'holding' },
  { key: 'edition', labelKey: 'catalog.field.edition', source: 'holding' },
  { key: 'location_cabinet', labelKey: 'catalog.field.cabinet', source: 'holding' },
  { key: 'location_shelf', labelKey: 'catalog.field.shelf', source: 'holding' },
  { key: 'location_slot', labelKey: 'catalog.field.slot', source: 'holding' },
  { key: 'parts_summary', labelKey: 'catalog.field.partsSummary', source: 'holding' },
  { key: 'score_count', labelKey: 'catalog.field.scoreCount', source: 'holding' },
  { key: 'condition', labelKey: 'catalog.field.condition', source: 'holding' },
  { key: 'acquired_on', labelKey: 'catalog.field.acquiredOn', source: 'holding' },
  { key: 'rental_due_on', labelKey: 'catalog.field.rentalDueOn', source: 'holding' },
  {
    key: 'holding_notes',
    valueKey: 'notes',
    labelKey: 'catalog.field.holdingNotes',
    source: 'holding',
  },
];

export function getHoldings(work: CatalogWork): CatalogHolding[] {
  return work.catalog_holdings || [];
}

export function isMaterialType(value: string): value is CatalogMaterialType {
  return (CATALOG_MATERIAL_TYPES as string[]).includes(value);
}

/** Joins the populated location parts, e.g. `Cabinet 3 / Shelf B / 12`. */
export function formatLocation(holding: CatalogHolding): string {
  return [holding.location_cabinet, holding.location_shelf, holding.location_slot]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(LOCATION_SEPARATOR);
}

/** Prefers the accession number, which is what is actually written on the folder. */
export function formatHoldingLabel(holding: CatalogHolding): string {
  const location = formatLocation(holding);
  const accession = (holding.accession_no || '').trim();
  if (accession && location) return `${accession} - ${location}`;
  return accession || location;
}

export function formatWorkLocations(work: CatalogWork): string {
  return getHoldings(work).map(formatHoldingLabel).filter(Boolean).join('; ');
}

export function formatWorkTitle(work: CatalogWork): string {
  const subtitle = (work.subtitle || '').trim();
  return subtitle ? `${work.title} - ${subtitle}` : work.title;
}

function holdingHaystack(holding: CatalogHolding): string[] {
  return [
    holding.accession_no,
    holding.material_type,
    holding.publisher,
    holding.edition,
    holding.location_cabinet,
    holding.location_shelf,
    holding.location_slot,
    holding.parts_summary,
    holding.condition,
    holding.notes,
  ].map((value) => value || '');
}

function workHaystack(work: CatalogWork): string {
  const own = [
    work.composer,
    work.title,
    work.subtitle,
    work.catalog_number,
    work.arranger,
    work.genre,
    work.instrumentation,
    work.movements,
    work.keywords,
    work.notes,
  ].map((value) => value || '');
  const holdings = getHoldings(work).flatMap(holdingHaystack);
  return [...own, ...holdings].join(' ').toLowerCase();
}

export function sortWorks(works: CatalogWork[]): CatalogWork[] {
  return [...works].sort(
    (a, b) => a.composer.localeCompare(b.composer) || a.title.localeCompare(b.title)
  );
}

export type CatalogSortKey =
  | 'composer'
  | 'title'
  | 'instrumentation'
  | 'duration'
  | 'copies'
  | 'location';

export type SortDirection = 'asc' | 'desc';

function sortValue(work: CatalogWork, key: CatalogSortKey): string | number {
  if (key === 'composer') return work.composer.toLowerCase();
  if (key === 'title') return work.title.toLowerCase();
  if (key === 'instrumentation') return (work.instrumentation || '').toLowerCase();
  if (key === 'duration') return work.duration_minutes ?? Number.NEGATIVE_INFINITY;
  if (key === 'copies') return getHoldings(work).length;
  return formatWorkLocations(work).toLowerCase();
}

export function sortCatalog(
  works: CatalogWork[],
  key: CatalogSortKey,
  direction: SortDirection
): CatalogWork[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...works].sort((a, b) => {
    const left = sortValue(a, key);
    const right = sortValue(b, key);
    if (typeof left === 'number' && typeof right === 'number') {
      if (left !== right) return (left - right) * factor;
    } else if (left !== right) {
      return String(left).localeCompare(String(right)) * factor;
    }
    // Composer + title keeps the order stable when the sorted column ties.
    return a.composer.localeCompare(b.composer) || a.title.localeCompare(b.title);
  });
}

export function searchCatalog(works: CatalogWork[], query: string): CatalogWork[] {
  const term = query.trim().toLowerCase();
  if (!term) return works;
  return works.filter((work) => workHaystack(work).includes(term));
}

/** Normalizes for matching: case, spacing and surrounding punctuation are ignored. */
export function normalizeMatchKey(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,;:-]+|[\s.,;:-]+$/g, '')
    .toLowerCase();
}

function matchKey(composer: string, title: string): string {
  const key = `${normalizeMatchKey(composer)}|${normalizeMatchKey(title)}`;
  return key === '|' ? '' : key;
}

export function buildWorkMatchIndex(works: CatalogWork[]): Map<string, CatalogWork> {
  const index = new Map<string, CatalogWork>();
  for (const work of works) {
    const key = matchKey(work.composer, work.title);
    if (key && !index.has(key)) index.set(key, work);
  }
  return index;
}

/**
 * Suggests a catalog work for an unlinked program row. Matching is exact on the
 * normalized composer + title so a wrong suggestion is unlikely; anything
 * fuzzier is left to the admin picking manually.
 */
export function matchProgramRow(
  row: ProgramRow,
  index: Map<string, CatalogWork>
): CatalogWork | null {
  const key = matchKey(row.composer, row.title);
  if (!key) return null;
  return index.get(key) || null;
}

export function findWorkById(works: CatalogWork[], workId: string): CatalogWork | undefined {
  return works.find((work) => work.id === workId);
}

function fieldValue(work: CatalogWork, holding: CatalogHolding | null, field: CatalogField): string {
  const source: Record<string, unknown> | null =
    field.source === 'work'
      ? (work as unknown as Record<string, unknown>)
      : (holding as unknown as Record<string, unknown> | null);
  const value = source ? source[field.valueKey || field.key] : null;
  if (value === null || value === undefined) return '';
  return String(value);
}

/** One CSV row per holding, plus a row for works that have no holding yet. */
export function toCsvRows(works: CatalogWork[]): string[][] {
  const rows: string[][] = [];
  for (const work of works) {
    const holdings = getHoldings(work);
    if (holdings.length === 0) {
      rows.push(CATALOG_FIELDS.map((field) => fieldValue(work, null, field)));
      continue;
    }
    for (const holding of holdings) {
      rows.push(CATALOG_FIELDS.map((field) => fieldValue(work, holding, field)));
    }
  }
  return rows;
}
