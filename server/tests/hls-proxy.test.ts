import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';

describe('HLS Proxy', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  afterAll(async () => {
    if (app) await app.close();
  });

  it('returns 400 when url parameter is missing', async () => {
    app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/proxy' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for invalid URL', async () => {
    app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/proxy?url=not-a-url',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Invalid URL');
  });

  it('returns 400 for non-http protocol', async () => {
    app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/proxy?url=' + encodeURIComponent('ftp://example.com/file'),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Invalid protocol');
  });
});
