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
    origin: (origin, callback) => {
      // Allow non-browser clients (no origin) and any configured origin.
      if (!origin || FRONTEND_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/library', libraryRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});
