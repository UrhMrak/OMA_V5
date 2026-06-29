// One-time migration: local JSON data + uploaded PDFs -> Supabase.
//
// Usage (from app/backend):
//   1. Fill in app/backend/.env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
//   2. Run the schema in supabase/schema.sql first
//   3. node scripts/migrate.mjs
//
// Safe to re-run: rows are upserted by primary key / path and files use upsert.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, '..');
const APP_DIR = path.resolve(BACKEND_DIR, '..');

dotenv.config({ path: path.join(BACKEND_DIR, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LIBRARY_BUCKET = process.env.SUPABASE_LIBRARY_BUCKET || 'library';
const POSTS_BUCKET = process.env.SUPABASE_POSTS_BUCKET || 'posts';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in app/backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DATA_DIR = path.join(APP_DIR, 'data');
const UPLOADS_DIR = path.join(APP_DIR, 'uploads');
const POSTS_UPLOAD_DIR = path.join(UPLOADS_DIR, 'posts');

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function randomUUID() {
  return crypto.randomUUID();
}

// Supabase Storage object keys reject many non-ASCII characters.
function toStorageKey(p) {
  return p
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9/._ -]/g, '_');
}

async function migratePosts() {
  const posts = readJson(path.join(DATA_DIR, 'posts.json'), []);
  console.log(`Migrating ${posts.length} posts...`);

  for (const post of posts) {
    const attachments = post.attachments || [];
    for (const attachment of attachments) {
      const localPath = path.join(POSTS_UPLOAD_DIR, post.id, attachment.storedFilename);
      if (!fs.existsSync(localPath)) {
        console.warn(`  ! Missing post file: ${localPath}`);
        continue;
      }
      const buffer = fs.readFileSync(localPath);
      const key = `${post.id}/${attachment.storedFilename}`;
      const { error } = await supabase.storage
        .from(POSTS_BUCKET)
        .upload(key, buffer, { contentType: attachment.mimeType || 'application/pdf', upsert: true });
      if (error) console.error(`  ! Upload failed (${key}): ${error.message}`);
      else console.log(`  uploaded ${key}`);
    }

    const { error } = await supabase.from('posts').upsert(
      {
        id: post.id,
        created_at: post.createdAtISO,
        title: post.title || '',
        content: post.content || '',
        attachments,
      },
      { onConflict: 'id' }
    );
    if (error) console.error(`  ! Row failed (${post.id}): ${error.message}`);
  }
}

async function migrateEvents() {
  const events = readJson(path.join(DATA_DIR, 'events.json'), []);
  console.log(`Migrating ${events.length} events...`);

  for (const event of events) {
    const { id, ...data } = event;
    const eventId = id || randomUUID();
    const { error } = await supabase.from('events').upsert({ id: eventId, data }, { onConflict: 'id' });
    if (error) console.error(`  ! Event failed (${eventId}): ${error.message}`);
  }
}

function walkLibrary(dir, relParts, folders, files) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    // Skip post attachments and temp upload dirs at the library root.
    if (relParts.length === 0 && (entry.name === 'posts' || entry.name === 'temp')) continue;

    const childRel = [...relParts, entry.name];
    const childPath = path.join(dir, entry.name);
    const relPath = childRel.join('/');

    if (entry.isDirectory()) {
      folders.push(relPath);
      walkLibrary(childPath, childRel, folders, files);
    } else {
      files.push({ relPath, localPath: childPath, size: fs.statSync(childPath).size, name: entry.name });
    }
  }
}

async function migrateLibrary() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log('No uploads directory; skipping library.');
    return;
  }
  const folders = [];
  const files = [];
  walkLibrary(UPLOADS_DIR, [], folders, files);

  console.log(`Migrating ${folders.length} library folders and ${files.length} files...`);

  if (folders.length > 0) {
    const folderRows = folders.map((p) => ({
      id: randomUUID(),
      path: p,
      name: p.split('/').pop(),
      type: 'folder',
      storage_key: null,
      size: null,
    }));
    const { error } = await supabase
      .from('library_items')
      .upsert(folderRows, { onConflict: 'path', ignoreDuplicates: true });
    if (error) console.error(`  ! Folder rows failed: ${error.message}`);
  }

  for (const file of files) {
    const buffer = fs.readFileSync(file.localPath);
    const storageKeyValue = toStorageKey(file.relPath);
    const { error: uploadError } = await supabase.storage
      .from(LIBRARY_BUCKET)
      .upload(storageKeyValue, buffer, { contentType: 'application/pdf', upsert: true });
    if (uploadError) {
      console.error(`  ! Upload failed (${file.relPath}): ${uploadError.message}`);
      continue;
    }
    const { error } = await supabase.from('library_items').upsert(
      {
        id: randomUUID(),
        path: file.relPath,
        name: file.name,
        type: 'file',
        storage_key: storageKeyValue,
        size: file.size,
      },
      { onConflict: 'path' }
    );
    if (error) console.error(`  ! File row failed (${file.relPath}): ${error.message}`);
    else console.log(`  uploaded ${file.relPath}`);
  }
}

async function main() {
  await migratePosts();
  await migrateEvents();
  await migrateLibrary();
  console.log('Migration complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
