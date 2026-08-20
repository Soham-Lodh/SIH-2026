import { createServer } from 'http';
import { createApp } from './server/app';

async function startServer() {
  const app = createApp({ mode: 'dev', serveStatic: false });
  const port = Number(process.env.PORT || 3000);

  const server = createServer(app);

  server.listen(port, '0.0.0.0', () => {
    console.log(`Disaster Intelligence Platform API listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start backend server:', error);
  process.exit(1);
});
