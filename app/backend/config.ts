import dotenv from 'dotenv';

dotenv.config();

export const PORT = process.env.PORT || 4000;

export const FRONTEND_ORIGIN_RAW = process.env.FRONTEND_ORIGIN || '';

function parseFrontendOrigins(raw: string): { allowed: string[]; rejected: string[] } {
  const allowed: string[] = [];
  const rejected: string[] = [];

  for (const entry of raw.split(',')) {
    const trimmed = entry.trim().replace(/\/+$/, '');
    if (!trimmed) continue;
    if (/^https?:\/\//.test(trimmed)) {
      allowed.push(trimmed);
    } else {
      rejected.push(trimmed);
    }
  }

  if (allowed.length === 0 && rejected.length === 0) {
    allowed.push('http://localhost:5173');
  }

  return { allowed, rejected };
}

const parsed = parseFrontendOrigins(FRONTEND_ORIGIN_RAW || 'http://localhost:5173');

// Comma-separated list of allowed frontend origins (CORS).
// For GitHub Pages use https://YOUR_USERNAME.github.io (no repo path).
export const FRONTEND_ORIGINS = parsed.allowed;
export const FRONTEND_ORIGINS_REJECTED = parsed.rejected;

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
export const MUSICIAN_PASSWORD = process.env.MUSICIAN_PASSWORD || 'musician123';

export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const LIBRARY_BUCKET = process.env.SUPABASE_LIBRARY_BUCKET || 'library';
export const POSTS_BUCKET = process.env.SUPABASE_POSTS_BUCKET || 'posts';
