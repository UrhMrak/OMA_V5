// Destructive reset: wipes the entire library (all rows + stored files) and
// seeds only the default "Music" and "Documents" folders.
//
// Usage (from app/backend):
//   1. Ensure app/backend/.env has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
//   2. node scripts/reset-library.mjs
//
// WARNING: This permanently deletes every library file and folder. There is no
// undo. Run only when you intend to start the library from a clean slate.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(BACKEND_DIR, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LIBRARY_BUCKET = process.env.SUPABASE_LIBRARY_BUCKET || 'library';
const DEFAULT_FOLDERS = ['Music', 'Documents'];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in app/backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function collectStorageKeys() {
  const { data, error } = await supabase
    .from('library_items')
    .select('storage_key')
    .eq('type', 'file');
  if (error) throw new Error(`Failed to read library rows: ${error.message}`);
  return (data || []).map((row) => row.storage_key).filter(Boolean);
}

async function removeStorageObjects(keys) {
  if (keys.length === 0) return;
  // Supabase remove() handles a reasonable batch; chunk to stay safe.
  const CHUNK = 100;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const batch = keys.slice(i, i + CHUNK);
    const { error } = await supabase.storage.from(LIBRARY_BUCKET).remove(batch);
    if (error) console.error(`  ! Storage remove failed: ${error.message}`);
    else console.log(`  removed ${batch.length} stored file(s)`);
  }
}

async function deleteAllRows() {
  // Delete every row (path is never empty, so this matches all).
  const { error } = await supabase.from('library_items').delete().neq('path', '');
  if (error) throw new Error(`Failed to delete library rows: ${error.message}`);
}

async function seedDefaults() {
  const rows = DEFAULT_FOLDERS.map((name) => ({
    id: crypto.randomUUID(),
    path: name,
    name,
    type: 'folder',
    storage_key: null,
    size: null,
    mime_type: null,
  }));
  const { error } = await supabase
    .from('library_items')
    .upsert(rows, { onConflict: 'path', ignoreDuplicates: true });
  if (error) throw new Error(`Failed to seed default folders: ${error.message}`);
}

async function main() {
  console.log('Collecting stored file keys...');
  const keys = await collectStorageKeys();
  console.log(`Found ${keys.length} stored file(s).`);

  console.log('Removing stored files...');
  await removeStorageObjects(keys);

  console.log('Deleting all library rows...');
  await deleteAllRows();

  console.log(`Seeding default folders: ${DEFAULT_FOLDERS.join(', ')}`);
  await seedDefaults();

  console.log('Library reset complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
