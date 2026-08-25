import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { ImapFlow } from 'imapflow';
import { AddressObject, simpleParser } from 'mailparser';
import {
  EMAIL_ALLOWED_SENDERS,
  EMAIL_IMAP_HOST,
  EMAIL_IMAP_PASSWORD,
  EMAIL_IMAP_PORT,
  EMAIL_IMAP_USER,
  EMAIL_INGEST_SECRET,
} from '../config';
import { createPost, isAllowedPostAttachment, PostFile } from './postStore';

export type EmailIngestResult = {
  ok: boolean;
  created: number;
  skipped: number;
  processed: number;
  error?: string;
};

const EMPTY_SUBJECT_TITLE = '(No subject)';
const CONTENT_CUTOFF = /^[ \t]*---[ \t]*\r?$/m;

let ingestInFlight: Promise<EmailIngestResult> | null = null;

export function isEmailIngestConfigured(): boolean {
  return Boolean(EMAIL_IMAP_USER && EMAIL_IMAP_PASSWORD && EMAIL_ALLOWED_SENDERS.length > 0);
}

export function extractPostBody(text: string): string {
  const match = CONTENT_CUTOFF.exec(text);
  const body = match ? text.slice(0, match.index) : text;
  return body.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function requireEmailIngestSecret(req: Request, res: Response, next: NextFunction) {
  if (!EMAIL_INGEST_SECRET) {
    res.status(503).send('Email ingest is not configured');
    return;
  }

  const header = req.headers['x-email-ingest-secret'];
  const headerValue = typeof header === 'string' ? header : Array.isArray(header) ? header[0] : '';
  const authorization = req.headers.authorization || '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
  const provided = headerValue || bearer;

  if (!provided || !secretsEqual(provided, EMAIL_INGEST_SECRET)) {
    res.status(401).send('Unauthorized');
    return;
  }

  next();
}

export async function ingestNewEmails(): Promise<EmailIngestResult> {
  if (ingestInFlight) return ingestInFlight;
  ingestInFlight = runIngest().finally(() => {
    ingestInFlight = null;
  });
  return ingestInFlight;
}

async function runIngest(): Promise<EmailIngestResult> {
  if (!isEmailIngestConfigured()) {
    return {
      ok: false,
      created: 0,
      skipped: 0,
      processed: 0,
      error: 'Email ingest is not configured',
    };
  }

  const client = new ImapFlow({
    host: EMAIL_IMAP_HOST,
    port: EMAIL_IMAP_PORT,
    secure: true,
    logger: false,
    auth: {
      user: EMAIL_IMAP_USER,
      pass: EMAIL_IMAP_PASSWORD,
    },
  });

  let created = 0;
  let skipped = 0;
  let processed = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      for await (const message of client.fetch(
        { seen: false },
        { uid: true, source: true, envelope: true }
      )) {
        processed += 1;
        const uid = message.uid;
        try {
          const source = message.source ? Buffer.from(message.source) : undefined;
          const outcome = await processMessageSource(source);
          if (outcome === 'created') created += 1;
          else skipped += 1;
          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        } catch (error) {
          // Leave unseen so a later poll can retry a failed create.
          // eslint-disable-next-line no-console
          console.error('Email ingest failed for message', uid, error);
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (error) {
    try {
      await client.logout();
    } catch {
      // Ignore logout failures after a connect/fetch error.
    }
    return {
      ok: false,
      created,
      skipped,
      processed,
      error: error instanceof Error ? error.message : 'Email ingest failed',
    };
  }

  return { ok: true, created, skipped, processed };
}

async function processMessageSource(source: Buffer | undefined): Promise<'created' | 'skipped'> {
  if (!source) return 'skipped';

  const parsed = await simpleParser(source);
  const fromAddresses = collectAddresses(parsed.from);
  const allowed = fromAddresses.some((address) => EMAIL_ALLOWED_SENDERS.includes(address));
  if (!allowed) return 'skipped';

  const messageId =
    (parsed.messageId || '').trim() || `sha256:${crypto.createHash('sha256').update(source).digest('hex')}`;
  const title = (parsed.subject || '').trim() || EMPTY_SUBJECT_TITLE;
  const content = extractPostBody(emailPlainText(parsed.text, parsed.html));
  const files = toPostFiles(parsed.attachments || []);

  const result = await createPost({
    title,
    content,
    files,
    sourceMessageId: messageId,
  });

  if (result.status === 409) return 'skipped';
  if (result.status !== 200) {
    throw new Error(result.error);
  }
  return 'created';
}

function collectAddresses(value: AddressObject | AddressObject[] | undefined): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.flatMap((item) =>
    (item.value || [])
      .map((entry) => (entry.address || '').trim().toLowerCase())
      .filter(Boolean)
  );
}

function emailPlainText(text: string | false | undefined, html: string | false | undefined): string {
  if (typeof text === 'string' && text.trim()) return text;
  if (typeof html === 'string' && html.trim()) return htmlToText(html);
  return '';
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function toPostFiles(
  attachments: Array<{
    filename?: string;
    contentType?: string;
    size?: number;
    content?: Buffer;
    contentDisposition?: string | null;
  }>
): PostFile[] {
  const files: PostFile[] = [];
  for (const attachment of attachments) {
    const filename = (attachment.filename || '').trim();
    const mimeType = attachment.contentType || 'application/octet-stream';
    if (!filename || !attachment.content || !isAllowedPostAttachment(mimeType, filename)) {
      continue;
    }
    files.push({
      originalname: filename,
      mimetype: ALLOWED_MIME_BY_EXTENSION[pathExtension(filename)] || mimeType,
      size: attachment.size || attachment.content.length,
      buffer: attachment.content,
    });
  }
  return files;
}

const ALLOWED_MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function pathExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

function secretsEqual(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
