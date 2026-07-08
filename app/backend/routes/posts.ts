import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import {
  contentDisposition,
  decodeUploadFilename,
  ensureUniqueFilename,
  toStoredBasename,
} from '../lib/filenames';
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

function extractTextField(input: unknown): string {
  if (Array.isArray(input)) {
    const first = input[0];
    return typeof first === 'string' ? first : '';
  }
  return typeof input === 'string' ? input : '';
}

function parseJsonStringArray(input: unknown): string[] {
  const raw = extractTextField(input);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

async function uploadAttachments(
  postId: string,
  files: Express.Multer.File[],
  existingAttachments: PostAttachment[]
): Promise<PostAttachment[]> {
  const attachments = [...existingAttachments];
  const usedDisplayNames = new Set(attachments.map((attachment) => attachment.name));
  const usedStorageNames = new Set(attachments.map((attachment) => attachment.storedFilename));

  for (const file of files) {
    const displayName = ensureUniqueFilename(
      usedDisplayNames,
      decodeUploadFilename(file.originalname)
    );
    const storedFilename = ensureUniqueFilename(
      usedStorageNames,
      toStoredBasename(displayName) || `file-${Date.now()}`
    );
    const { error: uploadError } = await supabase.storage
      .from(POSTS_BUCKET)
      .upload(storageKey(postId, storedFilename), file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });
    if (uploadError) throw new Error(uploadError.message);

    attachments.push({
      id: crypto.randomUUID(),
      name: displayName,
      storedFilename,
      size: file.size,
      mimeType: file.mimetype,
    });
  }

  return attachments;
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
    let attachments: PostAttachment[] = [];

    try {
      attachments = await uploadAttachments(postId, files, []);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Upload failed',
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

router.put(
  '/:id',
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
    const { id } = req.params;
    const { data: existing, error: selectError } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (selectError) return res.status(500).json({ error: selectError.message });
    if (!existing) return res.status(404).json({ error: 'Post not found' });

    const title = extractTextField(req.body?.title).trim();
    const content = extractTextField(req.body?.content).trim();
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const removedAttachmentIds = new Set(parseJsonStringArray(req.body?.removedAttachmentIds));
    const currentAttachments: PostAttachment[] = existing.attachments || [];
    const keptAttachments = currentAttachments.filter(
      (attachment) => !removedAttachmentIds.has(attachment.id)
    );
    const removedAttachments = currentAttachments.filter((attachment) =>
      removedAttachmentIds.has(attachment.id)
    );

    if (removedAttachments.length > 0) {
      const keys = removedAttachments.map((attachment) =>
        storageKey(id, attachment.storedFilename)
      );
      await supabase.storage.from(POSTS_BUCKET).remove(keys);
    }

    const files = (req.files as Express.Multer.File[] | undefined) || [];
    let attachments = keptAttachments;

    try {
      attachments = await uploadAttachments(id, files, keptAttachments);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    }

    const row = {
      ...existing,
      title,
      content,
      attachments,
    };

    const { error } = await supabase
      .from(TABLE)
      .update({ title, content, attachments })
      .eq('id', id);
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
  res.setHeader('Content-Disposition', contentDisposition('inline', attachment.name));
  res.send(buffer);
});

export default router;
