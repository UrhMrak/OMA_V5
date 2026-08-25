import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import {
  EMAIL_POLL_INTERVAL_MS,
  FRONTEND_ORIGINS,
  FRONTEND_ORIGIN_RAW,
  FRONTEND_ORIGINS_REJECTED,
  PORT,
} from './config';
import { ingestNewEmails, isEmailIngestConfigured } from './lib/emailIngest';
import authRoutes from './routes/auth';
import postsRoutes from './routes/posts';
import eventsRoutes from './routes/events';
import libraryRoutes from './routes/library';

const app = express();
const DEBUG_LOG_PATH = '/Users/urhmrak/Desktop/Web-Dev/OMA_V5/.cursor/debug-752d8c.log';

function debugLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  // #region agent log
  try {
    const entry = JSON.stringify({
      sessionId: '752d8c',
      runId: 'pre-fix',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    });
    fs.appendFileSync(DEBUG_LOG_PATH, `${entry}\n`);
  } catch {
    // Ignore logging failures outside local debug runs.
  }
  // #endregion
}

app.use((req, _res, next) => {
  if (req.path.startsWith('/api/auth/login')) {
    debugLog('A', 'server.ts:cors-check', 'auth login request', {
      requestOrigin: req.headers.origin || null,
      allowedOrigins: FRONTEND_ORIGINS,
      rejectedOrigins: FRONTEND_ORIGINS_REJECTED,
      rawFrontendOrigin: FRONTEND_ORIGIN_RAW,
    });
  }
  next();
});

app.use(
  cors({
    origin: FRONTEND_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/library', libraryRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    allowedOrigins: FRONTEND_ORIGINS,
    rejectedOrigins: FRONTEND_ORIGINS_REJECTED,
    rawFrontendOrigin: FRONTEND_ORIGIN_RAW,
    corsConfigured: FRONTEND_ORIGINS.some((origin) => origin.includes('github.io')),
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`CORS allowed origins: ${FRONTEND_ORIGINS.join(', ') || '(none)'}`);
  startEmailIngestPolling();
});

function startEmailIngestPolling() {
  if (!isEmailIngestConfigured()) {
    // eslint-disable-next-line no-console
    console.log('Email ingest polling is off (set EMAIL_IMAP_PASSWORD and EMAIL_ALLOWED_SENDERS to enable)');
    return;
  }

  const pollMs = Number.isFinite(EMAIL_POLL_INTERVAL_MS) && EMAIL_POLL_INTERVAL_MS > 0
    ? EMAIL_POLL_INTERVAL_MS
    : 120000;

  const poll = () => {
    ingestNewEmails().catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Email ingest poll failed', error);
    });
  };

  setTimeout(poll, 5000);
  setInterval(poll, pollMs);
  // eslint-disable-next-line no-console
  console.log(`Email ingest polling every ${Math.round(pollMs / 1000)}s`);
}
