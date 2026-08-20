import { createApp } from '../../server/app';

const app = createApp({ mode: 'vercel', serveStatic: false });

export default app;

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};
