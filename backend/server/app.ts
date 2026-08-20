import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import apiRouter from './routes';

export type AppMode = 'dev' | 'production' | 'vercel';

export interface CreateAppOptions {
  mode?: AppMode;
  serveStatic?: boolean;
}

function getAllowedOrigins(): Set<string> {
  const raw = [
    process.env.CORS_ORIGINS,
    process.env.FRONTEND_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : '',
    process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:5173' : '',
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '',
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set(raw);
}

function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin as string | undefined;
  const allowedOrigins = getAllowedOrigins();

  if (origin && (allowedOrigins.size === 0 || allowedOrigins.has(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    req.headers['access-control-request-headers']?.toString() ||
      'Content-Type, Authorization, If-None-Match, X-Requested-With',
  );

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const mode: AppMode =
    options.mode ||
    (process.env.VERCEL ? 'vercel' : process.env.NODE_ENV === 'production' ? 'production' : 'dev');
  const serveStatic = options.serveStatic ?? mode !== 'vercel';

  app.use(corsMiddleware);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api', apiRouter);

  if (serveStatic) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}
