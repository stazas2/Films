import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { healthRoute } from './routes/health.js';
import { hlsProxyRoute } from './routes/hls-proxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

export async function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  await app.register(cors, {
    origin: process.env.CLIENT_ORIGIN || (isProd ? true : 'http://localhost:5173'),
  });

  app.register(healthRoute);
  app.register(hlsProxyRoute);

  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (existsSync(clientDist)) {
    await app.register(fastifyStatic, {
      root: clientDist,
      prefix: '/',
      wildcard: false,
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.method !== 'GET') {
        return reply.status(404).send({ error: 'Not found' });
      }
      if (request.url.startsWith('/api') || request.url.startsWith('/socket.io')) {
        return reply.status(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
