import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRateLimit, strictRateLimit } from './middleware/rateLimit.js';

import electionsRouter from './routes/elections.js';
import positionsRouter from './routes/positions.js';
import candidatesRouter from './routes/candidates.js';
import votesRouter from './routes/votes.js';
import studentsRouter from './routes/students.js';
import deviceRouter from './routes/device.js';
import statsRouter from './routes/stats.js';
import bundleRouter from './routes/bundle.js';
import publicRouter from './routes/public.js';

const app = express();
const PORT = process.env.PORT || 3001;
const STATIC_DIR = path.resolve(__dirname, '..', '..', 'dist');

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(authRateLimit);

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

app.use('/api/public', publicRouter);

app.use('/api/elections', electionsRouter);
app.use('/api/positions', positionsRouter);
app.use('/api/candidates', candidatesRouter);
app.use('/api/votes', strictRateLimit, votesRouter);
app.use('/api/students', studentsRouter);
app.use('/api/device', deviceRouter);
app.use('/api/stats', statsRouter);
app.use('/api/bundle', bundleRouter);

app.use(express.static(STATIC_DIR, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  },
}));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return;
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Serving frontend from: ${STATIC_DIR}`);
});
