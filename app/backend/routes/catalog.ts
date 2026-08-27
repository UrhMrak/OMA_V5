import { Router } from 'express';
import crypto from 'crypto';
import { requireAdmin } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router = Router();
const WORKS_TABLE = 'catalog_works';
const HOLDINGS_TABLE = 'catalog_holdings';

// Supabase caps a single response (commonly at 1000 rows), so every full-table
// read pages through ordered ranges instead of trusting one select.
const PAGE_SIZE = 1000;
const INSERT_CHUNK_SIZE = 500;

const MATERIAL_TYPES = new Set(['owned', 'rental', 'borrowed', 'manuscript']);
const DEFAULT_MATERIAL_TYPE = 'owned';

type FieldType = 'text' | 'integer' | 'date' | 'duration';

const WORK_FIELDS: Record<string, FieldType> = {
  composer: 'text',
  title: 'text',
  subtitle: 'text',
  catalog_number: 'text',
  arranger: 'text',
  genre: 'text',
  instrumentation: 'text',
  duration_minutes: 'duration',
  movements: 'text',
  keywords: 'text',
  notes: 'text',
};

const HOLDING_FIELDS: Record<string, FieldType> = {
  accession_no: 'text',
  publisher: 'text',
  edition: 'text',
  location_cabinet: 'text',
  location_shelf: 'text',
  location_slot: 'text',
  parts_summary: 'text',
  score_count: 'integer',
  condition: 'text',
  acquired_on: 'date',
  rental_due_on: 'date',
  notes: 'text',
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function toInteger(value: unknown): number | null {
  const text = toText(value);
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

const DURATION_PATTERN = /^(\d{1,2}):(\d{2})$/;

function toDurationMinutes(value: unknown): number | null {
  const text = toText(value);
  if (!text) return null;

  const match = text.match(DURATION_PATTERN);
  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (minutes >= 60) return null;
    return hours * 60 + minutes;
  }

  if (!/^\d+$/.test(text)) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value: unknown): string | null {
  const text = toText(value);
  if (!text || !ISO_DATE_PATTERN.test(text)) return null;
  return text;
}

function coerce(value: unknown, type: FieldType): string | number | null {
  if (type === 'integer') return toInteger(value);
  if (type === 'duration') return toDurationMinutes(value);
  if (type === 'date') return toDate(value);
  return toText(value);
}

/** Keeps only known columns so client payloads can never write arbitrary fields. */
function pickFields(
  source: Record<string, unknown>,
  spec: Record<string, FieldType>
): Record<string, string | number | null> {
  const picked: Record<string, string | number | null> = {};
  for (const [field, type] of Object.entries(spec)) {
    if (!(field in source)) continue;
    picked[field] = coerce(source[field], type);
  }
  return picked;
}

function workPayload(source: Record<string, unknown>): Record<string, unknown> {
  const payload = pickFields(source, WORK_FIELDS);
  // composer/title are non-null in the schema and drive search, so they never go null.
  if ('composer' in payload) payload.composer = payload.composer ?? '';
  if ('title' in payload) payload.title = payload.title ?? '';
  return payload;
}

function holdingPayload(source: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = pickFields(source, HOLDING_FIELDS);
  if ('material_type' in source) {
    const materialType = toText(source.material_type)?.toLowerCase() || '';
    payload.material_type = MATERIAL_TYPES.has(materialType) ? materialType : DEFAULT_MATERIAL_TYPE;
  }
  return payload;
}

const LIST_SELECT =
  'id, composer, title, subtitle, catalog_number, arranger, genre, instrumentation, duration_minutes, movements, keywords, notes, created_at, updated_at, catalog_holdings(*)';
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const EXPORT_PAGE_SIZE = 1000;
const RESOLVE_IN_CHUNK = 200;

const WORK_SEARCH_COLUMNS = [
  'composer',
  'title',
  'subtitle',
  'catalog_number',
  'arranger',
  'genre',
  'instrumentation',
  'movements',
  'keywords',
  'notes',
] as const;

type CatalogSortKey = 'composer' | 'title' | 'instrumentation' | 'duration' | 'copies' | 'location';
type SortDirection = 'asc' | 'desc';

const SORT_COLUMNS: Record<CatalogSortKey, string> = {
  composer: 'composer',
  title: 'title',
  instrumentation: 'instrumentation',
  duration: 'duration_minutes',
  copies: 'holding_count',
  location: 'location_sort',
};

const FALLBACK_SORT_COLUMNS: Record<CatalogSortKey, string> = {
  composer: 'composer',
  title: 'title',
  instrumentation: 'instrumentation',
  duration: 'duration_minutes',
  copies: 'composer',
  location: 'composer',
};

type CatalogPageQuery = {
  q: string;
  sort: CatalogSortKey;
  dir: SortDirection;
  offset: number;
  limit: number;
};

function isCatalogSortKey(value: string): value is CatalogSortKey {
  return Object.prototype.hasOwnProperty.call(SORT_COLUMNS, value);
}

function escapeIlike(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function isMissingCacheColumnError(error: { message?: string; code?: string }): boolean {
  const message = (error.message || '').toLowerCase();
  return (
    error.code === '42703' ||
    message.includes('search_text') ||
    message.includes('holding_count') ||
    message.includes('location_sort') ||
    message.includes('work_key')
  );
}

function parseCatalogPageQuery(query: Record<string, unknown>): CatalogPageQuery {
  const q = String(query.q || '').trim();
  const sortRaw = String(query.sort || 'composer');
  const sort = isCatalogSortKey(sortRaw) ? sortRaw : 'composer';
  const dir = String(query.dir || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
  const offset = Math.max(0, Number.parseInt(String(query.offset || '0'), 10) || 0);
  const parsedLimit = Number.parseInt(String(query.limit || String(DEFAULT_LIST_LIMIT)), 10);
  const limit = Math.min(
    MAX_LIST_LIMIT,
    Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : DEFAULT_LIST_LIMIT)
  );
  return { q, sort, dir, offset, limit };
}

async function fetchAllRows<T>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchCatalogPage(
  params: CatalogPageQuery,
  options: { useSearchText?: boolean } = {}
): Promise<{ works: Record<string, unknown>[]; total: number }> {
  const useSearchText = options.useSearchText !== false;
  const sortColumn = (useSearchText ? SORT_COLUMNS : FALLBACK_SORT_COLUMNS)[params.sort];
  const ascending = params.dir === 'asc';

  let query = supabase.from(WORKS_TABLE).select(LIST_SELECT, { count: 'exact' });

  if (params.q) {
    const pattern = `%${escapeIlike(params.q)}%`;
    if (useSearchText) {
      query = query.ilike('search_text', pattern);
    } else {
      const filter = WORK_SEARCH_COLUMNS.map((column) => `${column}.ilike."${pattern}"`).join(',');
      query = query.or(filter);
    }
  }

  query = query.order(sortColumn, { ascending, nullsFirst: false });
  if (sortColumn !== 'composer') query = query.order('composer', { ascending: true });
  if (sortColumn !== 'title') query = query.order('title', { ascending: true });
  query = query.order('id', { ascending: true }).range(params.offset, params.offset + params.limit - 1);

  const { data, error, count } = await query;
  if (error) {
    if (useSearchText && isMissingCacheColumnError(error)) {
      return fetchCatalogPage(params, { useSearchText: false });
    }
    throw new Error(error.message);
  }

  return { works: (data || []) as Record<string, unknown>[], total: count ?? 0 };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/** Works are deduplicated on composer + title, ignoring case and spacing. */
function workKey(composer: unknown, title: unknown): string {
  const normalize = (value: unknown) =>
    String(value ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  const key = `${normalize(composer)}|${normalize(title)}`;
  return key === '|' ? '' : key;
}

const EXPORT_HEADERS = [
  'composer',
  'title',
  'subtitle',
  'catalog_number',
  'arranger',
  'genre',
  'instrumentation',
  'duration_minutes',
  'movements',
  'keywords',
  'notes',
  'accession_no',
  'material_type',
  'publisher',
  'edition',
  'location_cabinet',
  'location_shelf',
  'location_slot',
  'parts_summary',
  'score_count',
  'condition',
  'acquired_on',
  'rental_due_on',
  'holding_notes',
];

function formatDurationMinutes(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function escapeCsvCell(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function holdingCsvValue(holding: Record<string, unknown> | null, key: string): string {
  if (!holding) return '';
  const sourceKey = key === 'holding_notes' ? 'notes' : key;
  const value = holding[sourceKey];
  if (value === null || value === undefined) return '';
  return String(value);
}

function workCsvValue(work: Record<string, unknown>, key: string): string {
  if (key === 'duration_minutes') return formatDurationMinutes(work.duration_minutes);
  const value = work[key];
  if (value === null || value === undefined) return '';
  return String(value);
}

async function loadWorkIdsByKeys(keys: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(keys.filter(Boolean))];
  try {
    for (const batch of chunk(unique, INSERT_CHUNK_SIZE)) {
      const { data, error } = await supabase.from(WORKS_TABLE).select('id, work_key').in('work_key', batch);
      if (error) throw error;
      for (const row of (data || []) as { id: string; work_key: string | null }[]) {
        if (row.work_key && !map.has(row.work_key)) map.set(row.work_key, row.id);
      }
    }
    return map;
  } catch (error) {
    if (!isMissingCacheColumnError(error as { message?: string; code?: string })) throw error;
    const existing = await fetchAllRows<{ id: string; composer: string; title: string }>(
      WORKS_TABLE,
      'id, composer, title'
    );
    for (const work of existing) {
      const key = workKey(work.composer, work.title);
      if (key && !map.has(key)) map.set(key, work.id);
    }
    return map;
  }
}

async function loadHoldingIdsByAccession(accessions: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(accessions.filter(Boolean))];
  for (const batch of chunk(unique, INSERT_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from(HOLDINGS_TABLE)
      .select('id, accession_no')
      .in('accession_no', batch);
    if (error) throw new Error(error.message);
    for (const row of (data || []) as { id: string; accession_no: string | null }[]) {
      const accession = toText(row.accession_no);
      if (accession) map.set(accession.toLowerCase(), row.id);
    }
  }
  return map;
}

function toCsvRows(works: Record<string, unknown>[]): string[][] {
  const rows: string[][] = [];
  for (const work of works) {
    const holdings = Array.isArray(work.catalog_holdings)
      ? (work.catalog_holdings as Record<string, unknown>[])
      : [];
    const sources = holdings.length > 0 ? holdings : [null];
    for (const holding of sources) {
      rows.push(
        EXPORT_HEADERS.map((header) =>
          header === 'holding_notes' ||
          [
            'accession_no',
            'material_type',
            'publisher',
            'edition',
            'location_cabinet',
            'location_shelf',
            'location_slot',
            'parts_summary',
            'score_count',
            'condition',
            'acquired_on',
            'rental_due_on',
          ].includes(header)
            ? holdingCsvValue(holding, header)
            : workCsvValue(work, header)
        )
      );
    }
  }
  return rows;
}

router.get('/', requireAdmin, async (req, res) => {
  try {
    const parsed = parseCatalogPageQuery(req.query as Record<string, unknown>);
    const page = await fetchCatalogPage(parsed);
    res.json({
      works: page.works,
      total: page.total,
      offset: parsed.offset,
      limit: parsed.limit,
    });
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : 'Failed to load catalog');
  }
});

router.get('/export', requireAdmin, async (req, res) => {
  const parsed = parseCatalogPageQuery(req.query as Record<string, unknown>);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="music-catalog.csv"');
  res.write('\uFEFF');
  res.write(`${EXPORT_HEADERS.map(escapeCsvCell).join(',')}\n`);

  try {
    for (let offset = 0; ; offset += EXPORT_PAGE_SIZE) {
      const page = await fetchCatalogPage({
        ...parsed,
        offset,
        limit: EXPORT_PAGE_SIZE,
      });
      for (const row of toCsvRows(page.works)) {
        res.write(`${row.map(escapeCsvCell).join(',')}\n`);
      }
      if (page.works.length < EXPORT_PAGE_SIZE) break;
    }
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).send(error instanceof Error ? error.message : 'Failed to export catalog');
      return;
    }
    res.end();
  }
});

router.get('/works/:id', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from(WORKS_TABLE)
    .select(LIST_SELECT)
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) return res.status(500).send(error.message);
  if (!data) return res.status(404).send('Not found');
  res.json(data);
});

router.post('/resolve', requireAdmin, async (req, res) => {
  const ids = Array.isArray(req.body?.ids)
    ? [...new Set(req.body.ids.map((id: unknown) => String(id || '').trim()).filter(Boolean))]
    : [];
  const matches = Array.isArray(req.body?.matches) ? req.body.matches : [];

  try {
    const worksById: Record<string, unknown> = {};
    for (const batch of chunk(ids, RESOLVE_IN_CHUNK)) {
      const { data, error } = await supabase.from(WORKS_TABLE).select(LIST_SELECT).in('id', batch);
      if (error) return res.status(500).send(error.message);
      for (const work of data || []) {
        const row = work as { id: string };
        worksById[row.id] = work;
      }
    }

    const suggestionKeys = new Map<string, { composer: string; title: string }>();
    for (const raw of matches) {
      if (!raw || typeof raw !== 'object') continue;
      const source = raw as Record<string, unknown>;
      const key = workKey(source.composer, source.title);
      if (key && !suggestionKeys.has(key)) {
        suggestionKeys.set(key, {
          composer: String(source.composer || ''),
          title: String(source.title || ''),
        });
      }
    }

    const suggestions: Record<string, unknown> = {};
    const keys = [...suggestionKeys.keys()];
    for (const batch of chunk(keys, RESOLVE_IN_CHUNK)) {
      const { data, error } = await supabase.from(WORKS_TABLE).select(LIST_SELECT).in('work_key', batch);
      if (error) {
        if (!isMissingCacheColumnError(error)) return res.status(500).send(error.message);
        for (const key of batch) {
          const pair = suggestionKeys.get(key);
          if (!pair) continue;
          const { data: fallback, error: fallbackError } = await supabase
            .from(WORKS_TABLE)
            .select(LIST_SELECT)
            .ilike('composer', pair.composer.trim())
            .ilike('title', pair.title.trim())
            .limit(1);
          if (fallbackError) return res.status(500).send(fallbackError.message);
          if (fallback?.[0]) suggestions[key] = fallback[0];
        }
        continue;
      }
      for (const work of data || []) {
        const row = work as { composer?: string; title?: string };
        const key = workKey(row.composer, row.title);
        if (key && !suggestions[key]) suggestions[key] = work;
      }
    }

    res.json({ worksById, suggestions });
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : 'Failed to resolve catalog works');
  }
});

router.post('/works', requireAdmin, async (req, res) => {
  const id = crypto.randomUUID();
  const payload = workPayload(req.body || {});
  const { data, error } = await supabase
    .from(WORKS_TABLE)
    .insert({ id, composer: '', title: '', ...payload })
    .select('*, catalog_holdings(*)')
    .single();
  if (error) return res.status(500).send(error.message);
  res.json(data);
});

router.put('/works/:id', requireAdmin, async (req, res) => {
  const payload = workPayload(req.body || {});
  const { data, error } = await supabase
    .from(WORKS_TABLE)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select('*, catalog_holdings(*)')
    .maybeSingle();
  if (error) return res.status(500).send(error.message);
  if (!data) return res.status(404).send('Not found');
  res.json(data);
});

// Holdings cascade with the work, so no separate cleanup is needed here.
router.delete('/works/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase.from(WORKS_TABLE).delete().eq('id', req.params.id);
  if (error) return res.status(500).send(error.message);
  res.json({ ok: true });
});

router.post('/holdings', requireAdmin, async (req, res) => {
  const workId = toText(req.body?.work_id);
  if (!workId) return res.status(400).send('work_id required');

  const id = crypto.randomUUID();
  const payload = holdingPayload(req.body || {});
  const { data, error } = await supabase
    .from(HOLDINGS_TABLE)
    .insert({ id, work_id: workId, material_type: DEFAULT_MATERIAL_TYPE, ...payload })
    .select('*')
    .single();
  if (error) return res.status(500).send(error.message);
  res.json(data);
});

router.put('/holdings/:id', requireAdmin, async (req, res) => {
  const payload = holdingPayload(req.body || {});
  const { data, error } = await supabase
    .from(HOLDINGS_TABLE)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select('*')
    .maybeSingle();
  if (error) return res.status(500).send(error.message);
  if (!data) return res.status(404).send('Not found');
  res.json(data);
});

router.delete('/holdings/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase.from(HOLDINGS_TABLE).delete().eq('id', req.params.id);
  if (error) return res.status(500).send(error.message);
  res.json({ ok: true });
});

type ImportSummary = {
  worksCreated: number;
  holdingsCreated: number;
  holdingsUpdated: number;
  skipped: number;
};

/**
 * Bulk import of flattened rows carrying both work and holding columns.
 * Rows match an existing holding by `accession_no` and an existing work by
 * composer + title, so re-importing a corrected spreadsheet updates in place
 * rather than duplicating the shelf.
 */
router.post('/import', requireAdmin, async (req, res) => {
  const rows: unknown = req.body?.rows;
  if (!Array.isArray(rows)) return res.status(400).send('rows array required');

  const summary: ImportSummary = {
    worksCreated: 0,
    holdingsCreated: 0,
    holdingsUpdated: 0,
    skipped: 0,
  };

  try {
    const incomingKeys: string[] = [];
    const incomingAccessions: string[] = [];
    for (const raw of rows) {
      if (!raw || typeof raw !== 'object') continue;
      const source = raw as Record<string, unknown>;
      const key = workKey(source.composer, source.title);
      if (key) incomingKeys.push(key);
      const accession = toText(source.accession_no);
      if (accession) incomingAccessions.push(accession);
    }

    const workIdByKey = await loadWorkIdsByKeys(incomingKeys);
    const holdingIdByAccession = await loadHoldingIdsByAccession(incomingAccessions);

    const newWorks: Record<string, unknown>[] = [];
    const newHoldings: Record<string, unknown>[] = [];
    const holdingUpdates: Array<{ id: string; payload: Record<string, unknown> }> = [];

    for (const raw of rows) {
      if (!raw || typeof raw !== 'object') {
        summary.skipped += 1;
        continue;
      }
      const source = raw as Record<string, unknown>;
      const key = workKey(source.composer, source.title);
      if (!key) {
        summary.skipped += 1;
        continue;
      }

      let workId = workIdByKey.get(key);
      if (!workId) {
        workId = crypto.randomUUID();
        workIdByKey.set(key, workId);
        newWorks.push({ id: workId, composer: '', title: '', ...workPayload(source) });
        summary.worksCreated += 1;
      }

      // A flat row has one `notes` column, which belongs to the work; the
      // holding's own notes travel in `holding_notes`.
      const holdingSource: Record<string, unknown> = { ...source };
      delete holdingSource.notes;
      if ('holding_notes' in source) holdingSource.notes = source.holding_notes;

      const payload = holdingPayload(holdingSource);
      const accession = toText(source.accession_no);
      const existingHoldingId = accession
        ? holdingIdByAccession.get(accession.toLowerCase())
        : undefined;

      if (existingHoldingId) {
        holdingUpdates.push({ id: existingHoldingId, payload: { ...payload, work_id: workId } });
        summary.holdingsUpdated += 1;
        continue;
      }

      const holdingId = crypto.randomUUID();
      if (accession) holdingIdByAccession.set(accession.toLowerCase(), holdingId);
      newHoldings.push({
        id: holdingId,
        work_id: workId,
        material_type: DEFAULT_MATERIAL_TYPE,
        ...payload,
      });
      summary.holdingsCreated += 1;
    }

    for (const batch of chunk(newWorks, INSERT_CHUNK_SIZE)) {
      const { error } = await supabase.from(WORKS_TABLE).insert(batch);
      if (error) return res.status(500).send(error.message);
    }

    for (const batch of chunk(newHoldings, INSERT_CHUNK_SIZE)) {
      const { error } = await supabase.from(HOLDINGS_TABLE).insert(batch);
      if (error) return res.status(500).send(error.message);
    }

    const updatedAt = new Date().toISOString();
    for (const update of holdingUpdates) {
      const { error } = await supabase
        .from(HOLDINGS_TABLE)
        .update({ ...update.payload, updated_at: updatedAt })
        .eq('id', update.id);
      if (error) return res.status(500).send(error.message);
    }

    res.json(summary);
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : 'Import failed');
  }
});

export default router;
