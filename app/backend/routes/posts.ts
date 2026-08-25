import { Request, Response, Router } from 'express';
import multer from 'multer';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { contentDisposition, decodeUploadFilename } from '../lib/filenames';
import { POSTS_BUCKET } from '../config';
import {
  ALLOWED_POST_ATTACHMENT_MIMES,
  POSTS_TABLE,
  PostAttachment,
  PostFile,
  createPost,
  storageKey,
  toClient,
  uploadAttachments,
} from '../lib/postStore';
import { extractPostBody, ingestNewEmails, requireEmailIngestSecret } from '../lib/emailIngest';

const router = Router();

function toPublicPost(row: {
  id: string;
  created_at: string;
  title: string;
  content: string;
  attachments?: PostAttachment[];
  source_message_id?: string | null;
}) {
  const post = toClient(row);
  if (!row.source_message_id) return post;
  return { ...post, content: extractPostBody(post.content) };
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_POST_ATTACHMENT_MIMES.has(file.mimetype)) {
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

function uploadedFiles(files: Express.Multer.File[] | undefined): PostFile[] {
  return (files || []).map((file) => ({
    originalname: decodeUploadFilename(file.originalname),
    mimetype: file.mimetype,
    size: file.size,
    buffer: file.buffer,
  }));
}

router.get('/', requireAuth, async (_req, res) => {
  const { data, error } = await supabase
    .from(POSTS_TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).send(error.message);
  res.json((data || []).map(toPublicPost));
});

async function ingestEmailHandler(_req: Request, res: Response) {
  const result = await ingestNewEmails();
  if (!result.ok) {
    return res.status(result.error === 'Email ingest is not configured' ? 503 : 500).json(result);
  }
  return res.json(result);
}

router.get('/ingest-email', requireEmailIngestSecret, ingestEmailHandler);
router.post('/ingest-email', requireEmailIngestSecret, ingestEmailHandler);

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
    const title = extractTextField(req.body?.title).trim();
    const content = extractTextField(req.body?.content).trim();
    const result = await createPost({
      title,
      content,
      files: uploadedFiles(req.files as Express.Multer.File[] | undefined),
    });
    if (result.status !== 200) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result.post);
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
      .from(POSTS_TABLE)
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

    let attachments = keptAttachments;

    try {
      attachments = await uploadAttachments(
        id,
        uploadedFiles(req.files as Express.Multer.File[] | undefined),
        keptAttachments
      );
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
      .from(POSTS_TABLE)
      .update({ title, content, attachments })
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    res.json(toPublicPost(row));
  }
);

router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data: post } = await supabase.from(POSTS_TABLE).select('*').eq('id', id).maybeSingle();

  const attachments: PostAttachment[] = post?.attachments || [];
  if (attachments.length > 0) {
    const keys = attachments.map((attachment) => storageKey(id, attachment.storedFilename));
    await supabase.storage.from(POSTS_BUCKET).remove(keys);
  }

  const { error } = await supabase.from(POSTS_TABLE).delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.get('/:id/attachments/:attachmentId/download', requireAuth, async (req, res) => {
  const { id, attachmentId } = req.params;
  const { data: post } = await supabase.from(POSTS_TABLE).select('*').eq('id', id).maybeSingle();
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
