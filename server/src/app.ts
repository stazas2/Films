import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoute } from './routes/health.js';
import { hlsProxyRoute } from './routes/hls-proxy.js';

export async function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  await app.register(cors, {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  });

  app.register(healthRoute);
  app.register(hlsProxyRoute);

  return app;
}
