import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { LIBRARY_BUCKET } from '../config';

const router = Router();
const TABLE = 'library_items';

type LibraryRow = {
  id: string;
  path: string;
  name: string;
  type: 'folder' | 'file';
  storage_key: string | null;
  size: number | null;
  created_at?: string;
};

type LibraryNode = {
  name: string;
  type: 'folder' | 'file';
  path?: string;
  children?: LibraryNode[];
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDFs allowed'));
    cb(null, true);
  },
  limits: { fileSize: 25 * 1024 * 1024 },
});

function baseName(p: string): string {
  const parts = p.split('/');
  return parts[parts.length - 1] || p;
}

function parentPath(p: string): string {
  const parts = p.split('/');
  parts.pop();
  return parts.join('/');
}

function isSafePath(p: string): boolean {
  if (!p) return false;
  if (p.includes('..')) return false;
  if (p.startsWith('/')) return false;
  return true;
}

function normalizePath(p: string): string {
  return p.replace(/^\/+|\/+$/g, '').trim();
}

function folderRows(paths: string[]): LibraryRow[] {
  return paths.map((p) => ({
    id: crypto.randomUUID(),
    path: p,
    name: baseName(p),
    type: 'folder' as const,
    storage_key: null,
    size: null,
  }));
}

// Ensure a folder and all of its ancestors exist as rows. Duplicate paths are
// ignored thanks to the unique constraint on `path`.
async function ensureFolders(folderPath: string) {
  const normalized = normalizePath(folderPath);
  if (!normalized) return;
  const segments = normalized.split('/');
  const paths: string[] = [];
  let current = '';
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    paths.push(current);
  }
  await supabase.from(TABLE).upsert(folderRows(paths), { onConflict: 'path', ignoreDuplicates: true });
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getWeeksInYear(year: number): number {
  const dec31 = new Date(year, 11, 31);
  const weekNum = getWeekNumber(dec31);
  return weekNum === 1 ? 52 : weekNum;
}

async function ensureWeekFolders() {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const paths: string[] = [];
  for (const year of years) {
    paths.push(String(year));
    const weeks = getWeeksInYear(year);
    for (let week = 1; week <= weeks; week++) {
      paths.push(`${year}/week ${week}`);
    }
  }
  await supabase.from(TABLE).upsert(folderRows(paths), { onConflict: 'path', ignoreDuplicates: true });
}

function sortChildren(children: LibraryNode[]) {
  children.sort((a, b) => {
    const isYearA = a.type === 'folder' && /^\d{4}$/.test(a.name);
    const isYearB = b.type === 'folder' && /^\d{4}$/.test(b.name);
    const isWeekA = a.type === 'folder' && /^week \d+$/.test(a.name);
    const isWeekB = b.type === 'folder' && /^week \d+$/.test(b.name);

    if (isYearA && isYearB) return Number(a.name) - Number(b.name);
    if (isYearA) return -1;
    if (isYearB) return 1;

    if (isWeekA && isWeekB) {
      const numA = Number(a.name.match(/\d+$/)?.[0] || 0);
      const numB = Number(b.name.match(/\d+$/)?.[0] || 0);
      return numA - numB;
    }
    if (isWeekA) return -1;
    if (isWeekB) return 1;

    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function buildTree(rows: LibraryRow[]): LibraryNode {
  const root: LibraryNode = { name: 'uploads', type: 'folder', children: [] };
  const nodes = new Map<string, LibraryNode>();
  nodes.set('', root);

  function ensureFolderNode(p: string): LibraryNode {
    const existing = nodes.get(p);
    if (existing) return existing;
    const node: LibraryNode = { name: baseName(p), type: 'folder', path: p, children: [] };
    nodes.set(p, node);
    const parent = ensureFolderNode(parentPath(p));
    parent.children = parent.children || [];
    parent.children.push(node);
    return node;
  }

  // Create folder nodes first so files can attach to them.
  rows
    .filter((row) => row.type === 'folder')
    .forEach((row) => ensureFolderNode(row.path));

  rows
    .filter((row) => row.type === 'file')
    .forEach((row) => {
      const parent = ensureFolderNode(parentPath(row.path));
      parent.children = parent.children || [];
      parent.children.push({ name: row.name, type: 'file', path: row.path });
    });

  const sortRecursive = (node: LibraryNode) => {
    if (!node.children) return;
    sortChildren(node.children);
    node.children.forEach(sortRecursive);
  };
  sortRecursive(root);

  return root;
}

router.get('/tree', requireAuth, async (_req, res) => {
  await ensureWeekFolders();
  const { data, error } = await supabase.from(TABLE).select('*');
  if (error) return res.status(500).send(error.message);
  res.json(buildTree((data || []) as LibraryRow[]));
});

router.post('/folder', requireAdmin, async (req, res) => {
  const folder = normalizePath(String(req.body.folder || ''));
  if (!folder) return res.status(400).send('folder required');
  if (!isSafePath(folder)) return res.status(400).send('Invalid path');
  await ensureFolders(folder);
  res.json({ ok: true });
});

router.post(
  '/upload',
  requireAdmin,
  (req, res, next) => {
    upload.any()(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 25MB.' });
          }
          return res.status(400).json({ error: `Upload error: ${err.message}` });
        }
        return res.status(400).json({ error: err.message || 'Upload failed' });
      }
      next();
    });
  },
  async (req, res) => {
    let folder = '';
    if (req.body?.folder) {
      folder = String(Array.isArray(req.body.folder) ? req.body.folder[0] : req.body.folder);
    } else if (req.query?.folder) {
      folder = String(req.query.folder);
    }
    folder = normalizePath(folder);

    const files = (req.files as Express.Multer.File[] | undefined) || [];

    if (!folder) return res.status(400).json({ error: 'folder parameter required' });
    if (!isSafePath(folder)) return res.status(400).json({ error: 'Invalid path' });
    if (files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    await ensureFolders(folder);

    const { data: existing } = await supabase
      .from(TABLE)
      .select('name')
      .eq('type', 'file')
      .like('path', `${folder}/%`);
    const usedNames = new Set<string>((existing || []).map((row: any) => row.name));

    const saved: Array<{ filename: string; size: number; path: string }> = [];

    for (const file of files) {
      let candidate = file.originalname;
      const dot = candidate.lastIndexOf('.');
      const stem = dot > 0 ? candidate.slice(0, dot) : candidate;
      const ext = dot > 0 ? candidate.slice(dot) : '';
      let counter = 1;
      while (usedNames.has(candidate)) {
        candidate = `${stem}-${counter}${ext}`;
        counter += 1;
      }
      usedNames.add(candidate);

      const itemPath = `${folder}/${candidate}`;
      const { error: uploadError } = await supabase.storage
        .from(LIBRARY_BUCKET)
        .upload(itemPath, file.buffer, { contentType: 'application/pdf', upsert: true });
      if (uploadError) return res.status(500).json({ error: uploadError.message });

      const { error: insertError } = await supabase.from(TABLE).insert({
        id: crypto.randomUUID(),
        path: itemPath,
        name: candidate,
        type: 'file',
        storage_key: itemPath,
        size: file.size,
      });
      if (insertError) return res.status(500).json({ error: insertError.message });

      saved.push({ filename: candidate, size: file.size, path: itemPath });
    }

    res.json({ ok: true, folder, files: saved });
  }
);

router.delete('/item', requireAdmin, async (req, res) => {
  const rel = normalizePath(String(req.query.path || ''));
  if (!rel) return res.status(400).send('path required');
  if (!isSafePath(rel)) return res.status(400).send('Invalid path');

  const { data: item } = await supabase.from(TABLE).select('*').eq('path', rel).maybeSingle();
  if (!item) return res.status(404).send('Not found');

  if (item.type === 'folder') {
    // Gather this folder plus everything underneath it.
    const { data: descendants } = await supabase
      .from(TABLE)
      .select('*')
      .or(`path.eq.${rel},path.like.${rel}/%`);
    const rows = (descendants || []) as LibraryRow[];
    const fileKeys = rows
      .filter((row) => row.type === 'file' && row.storage_key)
      .map((row) => row.storage_key as string);
    if (fileKeys.length > 0) {
      await supabase.storage.from(LIBRARY_BUCKET).remove(fileKeys);
    }
    const { error } = await supabase.from(TABLE).delete().or(`path.eq.${rel},path.like.${rel}/%`);
    if (error) return res.status(500).send(error.message);
  } else {
    if (item.storage_key) {
      await supabase.storage.from(LIBRARY_BUCKET).remove([item.storage_key]);
    }
    const { error } = await supabase.from(TABLE).delete().eq('path', rel);
    if (error) return res.status(500).send(error.message);
  }

  res.json({ ok: true });
});

router.get('/download', requireAuth, async (req, res) => {
  const rel = normalizePath(String(req.query.path || ''));
  if (!rel || !isSafePath(rel)) return res.status(400).send('Invalid path');

  const { data: item } = await supabase
    .from(TABLE)
    .select('*')
    .eq('path', rel)
    .eq('type', 'file')
    .maybeSingle();
  if (!item || !item.storage_key) return res.status(404).send('Not found');

  const { data, error } = await supabase.storage.from(LIBRARY_BUCKET).download(item.storage_key);
  if (error || !data) return res.status(404).send('Not found');

  const buffer = Buffer.from(await data.arrayBuffer());
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(item.name)}"`);
  res.send(buffer);
});

router.get('/list', requireAuth, async (req, res) => {
  const rel = normalizePath(String(req.query.path || ''));
  if (rel && !isSafePath(rel)) return res.status(400).send('Invalid path');

  const { data, error } = await supabase.from(TABLE).select('*');
  if (error) return res.status(500).send(error.message);

  const items = ((data || []) as LibraryRow[])
    .filter((row) => parentPath(row.path) === rel)
    .map((row) => ({ name: row.name, type: row.type }));
  res.json({ path: rel, items });
});

export default router;
