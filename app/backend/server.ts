import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import cors from 'cors';
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
import catalogRoutes from './routes/catalog';

const app = express();

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
app.use('/api/catalog', catalogRoutes);

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
