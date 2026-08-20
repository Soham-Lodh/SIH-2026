import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import apiRouter from './server/routes';
import { initializeAlertSocketServer } from './server/alertSocket';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Mount API routes
  app.use('/api', apiRouter);

  // Vite middleware for development vs static files for production
  const isProduction =
    process.env.FORCE_STATIC === '1' ||
    process.env.NODE_ENV === 'production' ||
    process.argv[1]?.includes('dist/server.cjs');

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = createServer(app);
  initializeAlertSocketServer(server);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Disaster Intelligence Platform server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
