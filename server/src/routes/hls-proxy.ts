import type { FastifyInstance } from 'fastify';

export async function hlsProxyRoute(app: FastifyInstance) {
  app.get<{ Querystring: { url: string } }>(
    '/api/proxy',
    async (request, reply) => {
      const { url } = request.query;

      if (!url) {
        return reply.status(400).send({ error: 'Missing url parameter' });
      }

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return reply.status(400).send({ error: 'Invalid URL' });
      }

      // Only allow http/https
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return reply.status(400).send({ error: 'Invalid protocol' });
      }

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Referer: parsed.origin,
            Origin: parsed.origin,
          },
        });

        if (!response.ok) {
          return reply.status(response.status).send({ error: `Upstream error: ${response.status}` });
        }

        const contentType = response.headers.get('content-type') || '';

        // For .m3u8 — rewrite relative URLs to absolute proxied URLs
        if (url.endsWith('.m3u8') || contentType.includes('mpegurl') || contentType.includes('m3u8')) {
          const text = await response.text();
          const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
          const proxyBase = '/api/proxy?url=';

          const rewritten = text
            .split('\n')
            .map((line) => {
              const trimmed = line.trim();
              // Skip comments and empty lines
              if (!trimmed || trimmed.startsWith('#')) return line;
              // Make relative URLs absolute and proxy them
              if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                return proxyBase + encodeURIComponent(trimmed);
              }
              return proxyBase + encodeURIComponent(baseUrl + trimmed);
            })
            .join('\n');

          reply.header('Content-Type', 'application/vnd.apple.mpegurl');
          reply.header('Access-Control-Allow-Origin', '*');
          return reply.send(rewritten);
        }

        // For .ts segments and other binary data — stream through
        const buffer = Buffer.from(await response.arrayBuffer());
        reply.header('Content-Type', contentType || 'video/mp2t');
        reply.header('Access-Control-Allow-Origin', '*');
        return reply.send(buffer);
      } catch (err: any) {
        return reply.status(502).send({ error: `Proxy error: ${err.message}` });
      }
    },
  );
}
