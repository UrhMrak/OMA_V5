import { Router } from 'express';
import crypto from 'crypto';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router = Router();
const TABLE = 'events';

function toClient(row: any) {
  return { id: row.id, ...(row.data || {}) };
}

router.get('/', requireAuth, async (_req, res) => {
  const { data, error } = await supabase.from(TABLE).select('*');
  if (error) return res.status(500).send(error.message);
  res.json((data || []).map(toClient));
});

router.post('/', requireAdmin, async (req, res) => {
  const id = crypto.randomUUID();
  const { id: _ignored, ...payload } = req.body || {};
  const { error } = await supabase.from(TABLE).insert({ id, data: payload });
  if (error) return res.status(500).send(error.message);
  res.json({ id, ...payload });
});

router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data: existing, error: selErr } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (selErr) return res.status(500).send(selErr.message);
  if (!existing) return res.status(404).send('Not found');

  const { id: _ignored, ...incoming } = req.body || {};
  const merged = { ...(existing.data || {}), ...incoming };
  const { error } = await supabase.from(TABLE).update({ data: merged }).eq('id', id);
  if (error) return res.status(500).send(error.message);
  res.json({ id, ...merged });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data: existing } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) return res.status(500).send(error.message);
  res.json(existing ? toClient(existing) : { id });
});

export default router;
