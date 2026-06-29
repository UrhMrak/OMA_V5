import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

for (const table of ['posts', 'events', 'library_items']) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  console.log(`table ${table}: ${error ? 'ERROR ' + error.message : count + ' rows'}`);
}

const { count: fileCount } = await supabase
  .from('library_items')
  .select('*', { count: 'exact', head: true })
  .eq('type', 'file');
console.log(`library files: ${fileCount}`);

const { data: buckets } = await supabase.storage.listBuckets();
console.log('buckets:', buckets.map((b) => b.name).join(', '));
