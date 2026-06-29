import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { POSTS_BUCKET } from '../config';

const router = Router();
const TABLE = 'posts';

type PostAttachment = {
  id: string;
  name: string;
  storedFilename: string;
  size: number;
  mimeType: string;
};

const allowedMimes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (!allowedMimes.has(file.mimetype)) {
      return cb(new Error('Only PDF and Word documents are allowed'));
    }
    return cb(null, true);
  },
  limits: { fileSize: 25 * 1024 * 1024 },
});

function safeFilename(original: string): string {
  const base = path.basename(original);
  const replaced = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return replaced || `file-${Date.now()}`;
}

function ensureUniqueName(used: Set<string>, filename: string): string {
  let candidate = filename;
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  let counter = 1;
  while (used.has(candidate)) {
    candidate = `${name}-${counter}${ext}`;
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

function extractTextField(input: unknown): string {
  if (Array.isArray(input)) {
    const first = input[0];
    return typeof first === 'string' ? first : '';
  }
  return typeof input === 'string' ? input : '';
}

function storageKey(postId: string, storedFilename: string): string {
  return `${postId}/${storedFilename}`;
}

function toClient(row: any) {
  const attachments: PostAttachment[] = row.attachments || [];
  return {
    id: row.id,
    createdAtISO: row.created_at,
    title: row.title,
    content: row.content,
    attachments: attachments.map((attachment) => ({
      ...attachment,
      downloadUrl: `/api/posts/${row.id}/attachments/${attachment.id}/download`,
    })),
  };
}

router.get('/', requireAuth, async (_req, res) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).send(error.message);
  res.json((data || []).map(toClient));
});

router.post(
  '/',
  requireAdmin,
  (req, res, next) => {
    upload.array('attachments')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          return res.status(400).json({ error: err.message });
        }
        return res.status(400).json({ error: err?.message || 'Upload failed' });
      }
      return next();
    });
  },
  async (req, res) => {
    const now = new Date().toISOString();
    const postId = crypto.randomUUID();
    const title = extractTextField(req.body?.title).trim();
    const content = extractTextField(req.body?.content).trim();

    const files = (req.files as Express.Multer.File[] | undefined) || [];
    const attachments: PostAttachment[] = [];
    const usedNames = new Set<string>();

    for (const file of files) {
      const storedFilename = ensureUniqueName(usedNames, safeFilename(file.originalname));
      const { error: uploadError } = await supabase.storage
        .from(POSTS_BUCKET)
        .upload(storageKey(postId, storedFilename), file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });
      if (uploadError) return res.status(500).json({ error: uploadError.message });

      attachments.push({
        id: crypto.randomUUID(),
        name: file.originalname,
        storedFilename,
        size: file.size,
        mimeType: file.mimetype,
      });
    }

    const row = {
      id: postId,
      created_at: now,
      title,
      content,
      attachments,
    };

    const { error } = await supabase.from(TABLE).insert(row);
    if (error) return res.status(500).json({ error: error.message });

    res.json(toClient(row));
  }
);

router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data: post } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();

  const attachments: PostAttachment[] = post?.attachments || [];
  if (attachments.length > 0) {
    const keys = attachments.map((attachment) => storageKey(id, attachment.storedFilename));
    await supabase.storage.from(POSTS_BUCKET).remove(keys);
  }

  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.get('/:id/attachments/:attachmentId/download', requireAuth, async (req, res) => {
  const { id, attachmentId } = req.params;
  const { data: post } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const attachment: PostAttachment | undefined = (post.attachments || []).find(
    (a: PostAttachment) => a.id === attachmentId
  );
  if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

  const { data, error } = await supabase.storage
    .from(POSTS_BUCKET)
    .download(storageKey(id, attachment.storedFilename));
  if (error || !data) return res.status(404).json({ error: 'File not found' });

  const buffer = Buffer.from(await data.arrayBuffer());
  res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(attachment.name)}"`
  );
  res.send(buffer);
});

export default router;
