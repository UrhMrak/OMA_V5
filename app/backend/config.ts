import dotenv from 'dotenv';

dotenv.config();

export const PORT = process.env.PORT || 4000;

// Comma-separated list of allowed frontend origins (CORS).
// For GitHub Pages use https://YOUR_USERNAME.github.io (no repo path).
export const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
export const MUSICIAN_PASSWORD = process.env.MUSICIAN_PASSWORD || 'musician123';

export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const LIBRARY_BUCKET = process.env.SUPABASE_LIBRARY_BUCKET || 'library';
export const POSTS_BUCKET = process.env.SUPABASE_POSTS_BUCKET || 'posts';
