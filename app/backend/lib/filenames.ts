import path from 'path';

// Multer/busboy may deliver UTF-8 bytes interpreted as latin1.
export function decodeUploadFilename(name: string): string {
  const normalized = name.normalize('NFC');
  const decoded = Buffer.from(normalized, 'latin1').toString('utf8').normalize('NFC');
  if (decoded !== normalized && !decoded.includes('\uFFFD')) {
    return decoded;
  }
  return normalized;
}

// Supabase Storage object keys reject many non-ASCII characters. Build a safe
// key while keeping the original display name untouched.
export function toStorageKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9/._ -]/g, '_');
}

export function toStoredBasename(original: string): string {
  return toStorageKey(path.basename(original));
}

export function ensureUniqueFilename(used: Set<string>, filename: string): string {
  let candidate = filename;
  const ext = path.extname(filename);
  const stem = path.basename(filename, ext);
  let counter = 1;
  while (used.has(candidate)) {
    candidate = `${stem}-${counter}${ext}`;
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

export function contentDisposition(disposition: 'inline' | 'attachment', filename: string): string {
  const normalized = filename.normalize('NFC');
  const asciiFallback =
    normalized.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'download';
  const encoded = encodeURIComponent(normalized);
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
