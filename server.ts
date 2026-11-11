import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createInitialBotState } from './src/utils/botEngine';
import { BotDatabaseState } from './src/types/bot';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'bot_database.json');

function ensureDatabase(): BotDatabaseState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialBotState();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw) as BotDatabaseState;
  } catch {
    const fallback = createInitialBotState();
    fs.writeFileSync(DB_FILE, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
}

function saveDatabase(state: BotDatabaseState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  app.get('/api/bot-state', (_req, res) => {
    const state = ensureDatabase();
    res.json(state);
  });

  app.post('/api/bot-state', (req, res) => {
    const incoming = req.body as BotDatabaseState;
    if (!incoming || !Array.isArray(incoming.members) || !Array.isArray(incoming.roles)) {
      res.status(400).json({ error: 'Invalid bot database payload' });
      return;
    }
    saveDatabase(incoming);
    res.json({ ok: true, state: incoming });
  });

  app.post('/api/bot-state/reset', (_req, res) => {
    const fresh = createInitialBotState();
    saveDatabase(fresh);
    res.json(fresh);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AetherBot Nextcord Suite running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
