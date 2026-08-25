import crypto from 'crypto';
import path from 'path';
import { supabase } from './supabase';
import { ensureUniqueFilename, toStoredBasename } from './filenames';
import { POSTS_BUCKET } from '../config';

export const POSTS_TABLE = 'posts';

export type PostAttachment = {
  id: string;
  name: string;
  storedFilename: string;
  size: number;
  mimeType: string;
};

export type PostFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export const ALLOWED_POST_ATTACHMENT_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_POST_ATTACHMENT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);

export function isAllowedPostAttachment(mimeType: string, filename: string): boolean {
  if (ALLOWED_POST_ATTACHMENT_MIMES.has(mimeType)) return true;
  return ALLOWED_POST_ATTACHMENT_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

export function storageKey(postId: string, storedFilename: string): string {
  return `${postId}/${storedFilename}`;
}

export async function uploadAttachments(
  postId: string,
  files: PostFile[],
  existingAttachments: PostAttachment[]
): Promise<PostAttachment[]> {
  const attachments = [...existingAttachments];
  const usedDisplayNames = new Set(attachments.map((attachment) => attachment.name));
  const usedStorageNames = new Set(attachments.map((attachment) => attachment.storedFilename));

  for (const file of files) {
    const displayName = ensureUniqueFilename(usedDisplayNames, file.originalname);
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

export function toClient(row: {
  id: string;
  created_at: string;
  title: string;
  content: string;
  attachments?: PostAttachment[];
}) {
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

export async function createPost(input: {
  title: string;
  content: string;
  files?: PostFile[];
  sourceMessageId?: string | null;
}) {
  const now = new Date().toISOString();
  const postId = crypto.randomUUID();
  let attachments: PostAttachment[] = [];

  try {
    attachments = await uploadAttachments(postId, input.files || [], []);
  } catch (error) {
    return {
      status: 500 as const,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }

  const row: {
    id: string;
    created_at: string;
    title: string;
    content: string;
    attachments: PostAttachment[];
    source_message_id?: string;
  } = {
    id: postId,
    created_at: now,
    title: input.title,
    content: input.content,
    attachments,
  };

  if (input.sourceMessageId) {
    row.source_message_id = input.sourceMessageId;
  }

  const { error } = await supabase.from(POSTS_TABLE).insert(row);
  if (error) {
    if (error.code === '23505') {
      return { status: 409 as const, error: 'Duplicate email' };
    }
    return { status: 500 as const, error: error.message };
  }

  return { status: 200 as const, post: toClient(row) };
}
