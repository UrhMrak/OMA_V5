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

router.get('/', requireAdmin, async (_req, res) => {
  try {
    const works = await fetchAllRows(WORKS_TABLE, '*, catalog_holdings(*)');
    res.json(works);
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : 'Failed to load catalog');
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
    const existingWorks = await fetchAllRows<{ id: string; composer: string; title: string }>(
      WORKS_TABLE,
      'id, composer, title'
    );
    const existingHoldings = await fetchAllRows<{ id: string; accession_no: string | null }>(
      HOLDINGS_TABLE,
      'id, accession_no'
    );

    const workIdByKey = new Map<string, string>();
    for (const work of existingWorks) {
      const key = workKey(work.composer, work.title);
      if (key && !workIdByKey.has(key)) workIdByKey.set(key, work.id);
    }

    const holdingIdByAccession = new Map<string, string>();
    for (const holding of existingHoldings) {
      const accession = toText(holding.accession_no);
      if (accession) holdingIdByAccession.set(accession.toLowerCase(), holding.id);
    }

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
