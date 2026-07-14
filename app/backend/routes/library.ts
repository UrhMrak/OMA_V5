import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { contentDisposition, decodeUploadFilename, toStorageKey } from '../lib/filenames';
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
  mime_type?: string | null;
  created_at?: string;
};

const DEFAULT_FOLDERS = ['Music', 'Documents'];
const MAX_UPLOAD_FILE_SIZE_MB = 500;
const MAX_UPLOAD_FILE_SIZE_BYTES = MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024;

const INLINE_MIME_PREFIXES = ['image/'];
const INLINE_MIME_TYPES = new Set(['application/pdf']);

type LibraryNode = {
  name: string;
  type: 'folder' | 'file';
  path?: string;
  mimeType?: string;
  children?: LibraryNode[];
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_FILE_SIZE_BYTES },
});

function isInlineMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  if (INLINE_MIME_TYPES.has(mime)) return true;
  return INLINE_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

function encodePathSegment(segment: string): string {
  return segment.replace(/%/g, '%25').replace(/\//g, '%2F');
}

function decodePathSegment(segment: string): string {
  return segment.replace(/%2F/gi, '/').replace(/%25/g, '%');
}

function baseName(p: string): string {
  const parts = p.split('/');
  return decodePathSegment(parts[parts.length - 1] || p);
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

function normalizeRelativeUploadPath(name: string): string {
  return name.replace(/\\/g, '/').replace(/^\/+/, '').trim();
}

function isSafeRelativePath(p: string): boolean {
  if (!p) return false;
  const segments = p.split('/').filter(Boolean);
  if (segments.length === 0) return false;
  return segments.every((segment) => segment !== '.' && segment !== '..' && !segment.includes('\0'));
}

function resolveUploadTarget(
  folder: string,
  originalName: string
): { targetFolder: string; fileName: string } | null {
  const normalized = normalizeRelativeUploadPath(decodeUploadFilename(originalName));
  if (!normalized || !isSafeRelativePath(normalized)) return null;

  const segments = normalized.split('/').filter(Boolean);
  const fileName = segments.pop();
  if (!fileName) return null;

  const subPath = segments.join('/');
  const targetFolder = subPath ? `${folder}/${subPath}` : folder;
  if (!isSafePath(targetFolder)) return null;

  return { targetFolder, fileName };
}

function uniqueFileName(usedNames: Set<string>, fileName: string): string {
  let candidate = fileName;
  const dot = candidate.lastIndexOf('.');
  const stem = dot > 0 ? candidate.slice(0, dot) : candidate;
  const ext = dot > 0 ? candidate.slice(dot) : '';
  let counter = 1;
  while (usedNames.has(candidate)) {
    candidate = `${stem}-${counter}${ext}`;
    counter += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

function uniqueStorageKey(usedKeys: Set<string>, itemPath: string): string {
  let storageKeyValue = toStorageKey(itemPath);
  const keyDot = storageKeyValue.lastIndexOf('.');
  const keyStem = keyDot > 0 ? storageKeyValue.slice(0, keyDot) : storageKeyValue;
  const keyExt = keyDot > 0 ? storageKeyValue.slice(keyDot) : '';
  let keyCounter = 1;
  while (usedKeys.has(storageKeyValue)) {
    storageKeyValue = `${keyStem}-${keyCounter}${keyExt}`;
    keyCounter += 1;
  }
  usedKeys.add(storageKeyValue);
  return storageKeyValue;
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

// Seed the default top-level folders, but only when the library is empty so
// admin deletions/renames are never silently reverted.
async function ensureDefaultFolders() {
  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true });
  if (error || (count ?? 0) > 0) return;
  await supabase.from(TABLE).upsert(folderRows(DEFAULT_FOLDERS), {
    onConflict: 'path',
    ignoreDuplicates: true,
  });
}

function sortChildren(children: LibraryNode[]) {
  children.sort((a, b) => {
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
      parent.children.push({
        name: row.name,
        type: 'file',
        path: row.path,
        mimeType: row.mime_type || undefined,
      });
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
  await ensureDefaultFolders();
  const { data, error } = await supabase.from(TABLE).select('*');
  if (error) return res.status(500).send(error.message);
  res.json(buildTree((data || []) as LibraryRow[]));
});

router.post('/folder', requireAdmin, async (req, res) => {
  const parentPath = normalizePath(String(req.body.parentPath ?? req.body.parent ?? ''));
  const name = String(req.body.name ?? '').trim();
  let folder = '';

  if (name) {
    if (name.includes('..') || name.includes('\0')) {
      return res.status(400).send('Invalid name');
    }
    folder = parentPath ? `${parentPath}/${encodePathSegment(name)}` : encodePathSegment(name);
  } else {
    folder = normalizePath(String(req.body.folder || ''));
  }

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
            return res.status(400).json({
              error: `File too large. Maximum size is ${MAX_UPLOAD_FILE_SIZE_MB}MB.`,
            });
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

    const existingPrefix = `${folder}/`;
    const { data: existing } = await supabase
      .from(TABLE)
      .select('path, name, storage_key')
      .eq('type', 'file')
      .like('path', `${existingPrefix}%`);
    const usedNamesByFolder = new Map<string, Set<string>>();
    const usedKeys = new Set<string>();

    for (const row of (existing || []) as LibraryRow[]) {
      const parent = parentPath(row.path);
      if (!usedNamesByFolder.has(parent)) usedNamesByFolder.set(parent, new Set());
      usedNamesByFolder.get(parent)!.add(row.name);
      if (row.storage_key) usedKeys.add(row.storage_key);
    }

    const saved: Array<{ filename: string; size: number; path: string }> = [];
    const ensuredFolders = new Set<string>([folder]);

    for (const file of files) {
      const resolved = resolveUploadTarget(folder, file.originalname);
      if (!resolved) {
        return res.status(400).json({ error: 'Invalid file path in upload' });
      }

      const { targetFolder, fileName } = resolved;
      if (!ensuredFolders.has(targetFolder)) {
        await ensureFolders(targetFolder);
        ensuredFolders.add(targetFolder);
      }

      if (!usedNamesByFolder.has(targetFolder)) {
        usedNamesByFolder.set(targetFolder, new Set());
      }
      const usedNames = usedNamesByFolder.get(targetFolder)!;

      const mimeType = file.mimetype || 'application/octet-stream';
      const candidate = uniqueFileName(usedNames, fileName);
      const itemPath = `${targetFolder}/${candidate}`;
      const storageKeyValue = uniqueStorageKey(usedKeys, itemPath);

      const { error: uploadError } = await supabase.storage
        .from(LIBRARY_BUCKET)
        .upload(storageKeyValue, file.buffer, { contentType: mimeType, upsert: true });
      if (uploadError) return res.status(500).json({ error: uploadError.message });

      const { error: insertError } = await supabase.from(TABLE).insert({
        id: crypto.randomUUID(),
        path: itemPath,
        name: candidate,
        type: 'file',
        storage_key: storageKeyValue,
        size: file.size,
        mime_type: mimeType,
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

router.post('/rename', requireAdmin, async (req, res) => {
  const rel = normalizePath(String(req.body.path || ''));
  const newName = String(req.body.newName || '').trim();
  if (!rel) return res.status(400).send('path required');
  if (!isSafePath(rel)) return res.status(400).send('Invalid path');
  if (!newName) return res.status(400).send('newName required');
  if (newName.includes('..') || newName.includes('\0')) {
    return res.status(400).send('Invalid name');
  }

  const parent = parentPath(rel);
  const encodedName = encodePathSegment(newName);
  const newPath = parent ? `${parent}/${encodedName}` : encodedName;
  if (newPath === rel) return res.json({ ok: true });

  const { data: item } = await supabase.from(TABLE).select('*').eq('path', rel).maybeSingle();
  if (!item) return res.status(404).send('Not found');

  const { data: conflict } = await supabase
    .from(TABLE)
    .select('id')
    .eq('path', newPath)
    .maybeSingle();
  if (conflict) return res.status(409).send('An item with that name already exists');

  if (item.type === 'folder') {
    const { data: descendants } = await supabase
      .from(TABLE)
      .select('*')
      .like('path', `${rel}/%`);
    const rows = (descendants || []) as LibraryRow[];

    const { error: renameError } = await supabase
      .from(TABLE)
      .update({ path: newPath, name: newName })
      .eq('id', item.id);
    if (renameError) return res.status(500).send(renameError.message);

    for (const row of rows) {
      const updatedPath = `${newPath}${row.path.slice(rel.length)}`;
      const { error: childError } = await supabase
        .from(TABLE)
        .update({ path: updatedPath })
        .eq('id', row.id);
      if (childError) return res.status(500).send(childError.message);
    }
  } else {
    const { error } = await supabase
      .from(TABLE)
      .update({ path: newPath, name: newName })
      .eq('id', item.id);
    if (error) return res.status(500).send(error.message);
  }

  res.json({ ok: true, path: newPath });
});

function lastPathSegment(p: string): string {
  const parts = p.split('/');
  return parts[parts.length - 1] || p;
}

router.post('/move', requireAdmin, async (req, res) => {
  const rel = normalizePath(String(req.body.path || ''));
  const targetFolder = normalizePath(String(req.body.targetFolder ?? req.body.destination ?? ''));
  if (!rel) return res.status(400).send('path required');
  if (!isSafePath(rel)) return res.status(400).send('Invalid path');
  if (targetFolder && !isSafePath(targetFolder)) return res.status(400).send('Invalid target folder');

  const currentParent = parentPath(rel);
  if (currentParent === targetFolder) return res.json({ ok: true, path: rel });

  const { data: item } = await supabase.from(TABLE).select('*').eq('path', rel).maybeSingle();
  if (!item) return res.status(404).send('Not found');

  if (item.type === 'folder' && (targetFolder === rel || targetFolder.startsWith(`${rel}/`))) {
    return res.status(400).send('Cannot move folder into itself or a subfolder');
  }

  const segment = lastPathSegment(rel);
  const newPath = targetFolder ? `${targetFolder}/${segment}` : segment;
  if (newPath === rel) return res.json({ ok: true, path: rel });

  const { data: conflict } = await supabase
    .from(TABLE)
    .select('id')
    .eq('path', newPath)
    .maybeSingle();
  if (conflict) return res.status(409).send('An item with that name already exists in the destination folder');

  if (targetFolder) await ensureFolders(targetFolder);

  if (item.type === 'folder') {
    const { data: descendants } = await supabase
      .from(TABLE)
      .select('*')
      .like('path', `${rel}/%`);
    const rows = (descendants || []) as LibraryRow[];

    const { error: moveError } = await supabase
      .from(TABLE)
      .update({ path: newPath })
      .eq('id', item.id);
    if (moveError) return res.status(500).send(moveError.message);

    for (const row of rows) {
      const updatedPath = `${newPath}${row.path.slice(rel.length)}`;
      const { error: childError } = await supabase
        .from(TABLE)
        .update({ path: updatedPath })
        .eq('id', row.id);
      if (childError) return res.status(500).send(childError.message);
    }
  } else {
    const { error } = await supabase
      .from(TABLE)
      .update({ path: newPath })
      .eq('id', item.id);
    if (error) return res.status(500).send(error.message);
  }

  res.json({ ok: true, path: newPath });
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
  const mimeType = item.mime_type || 'application/octet-stream';
  const disposition = isInlineMime(mimeType) ? 'inline' : 'attachment';
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', contentDisposition(disposition, item.name));
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
