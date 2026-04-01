import express from 'express';
import cors, { type CorsOptions } from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Redis } from 'ioredis';
import { healthRouter } from './routes/health';
import { webhookRouter } from './routes/webhook';

dotenv.config({ path: '../../.env' });

const app = express();
const port = process.env.PORT || 3001;
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const webhookBodyLimit = process.env.WEBHOOK_BODY_LIMIT || '1mb';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowAllDevOrigins = process.env.NODE_ENV !== 'production' && allowedOrigins.length === 0;

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowAllDevOrigins || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed by CORS policy'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: false,
};

const webhookRateLimiter = rateLimit({
  windowMs: Number(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.WEBHOOK_RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
});

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.use(express.json({
  limit: webhookBodyLimit,
  verify: (req: express.Request, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({
  limit: webhookBodyLimit,
  extended: true,
  verify: (req: express.Request, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(cors(corsOptions));

app.use('/health', healthRouter);
app.use('/webhook', webhookRateLimiter, webhookRouter);

const server = createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const origin = req.headers.origin;
  if (!allowAllDevOrigins && allowedOrigins.length > 0 && origin && !allowedOrigins.includes(origin)) {
    ws.close(1008, 'Origin not allowed');
    return;
  }

  console.log('[Sentinel WebSocket] Client connected');
  
  ws.on('close', () => {
    console.log('[Sentinel WebSocket] Client disconnected');
  });
});

const subscriber = new Redis(redisUrl);
subscriber.subscribe('gitflow:dashboard-updates', (err, count) => {
  if (err) {
    console.error('Failed to subscribe to Redis channel', err);
  } else {
    console.log(`[Sentinel] Subscribed to ${count} Redis channels for WS broadcast`);
  }
});

subscriber.on('message', (channel, message) => {
  if (channel === 'gitflow:dashboard-updates') {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
});

server.listen(port, () => {
  console.log(`🚀 [Sentinel] Webhook ingress listening on port ${port}`);
  console.log(`📡 [Sentinel] WebSocket endpoint ready at ws://localhost:${port}/ws`);
});
