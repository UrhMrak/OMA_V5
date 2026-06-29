import express from 'express';
import cors from 'cors';
import { FRONTEND_ORIGINS, PORT } from './config';
import authRoutes from './routes/auth';
import postsRoutes from './routes/posts';
import eventsRoutes from './routes/events';
import libraryRoutes from './routes/library';

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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, allowedOrigins: FRONTEND_ORIGINS });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`CORS allowed origins: ${FRONTEND_ORIGINS.join(', ') || '(none)'}`);
});
