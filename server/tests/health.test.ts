import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';

describe('Health endpoint', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /health returns { status: "ok" }', async () => {
    app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
