import type { FastifyInstance } from 'fastify';

// Store cookies per domain to maintain sessions with upstream servers
const cookieJar = new Map<string, string>();

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function storeCookies(url: string, response: Response) {
  const domain = extractDomain(url);
  const setCookies = response.headers.getSetCookie?.() || [];
  if (setCookies.length > 0) {
    // Extract just the cookie name=value pairs
    const cookies = setCookies.map((c) => c.split(';')[0]).join('; ');
    const existing = cookieJar.get(domain) || '';
    cookieJar.set(domain, existing ? `${existing}; ${cookies}` : cookies);
  }
}

function getCookies(url: string): string {
  return cookieJar.get(extractDomain(url)) || '';
}

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

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return reply.status(400).send({ error: 'Invalid protocol' });
      }

      try {
        const headers: Record<string, string> = {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Referer: `${parsed.origin}/`,
          Origin: parsed.origin,
          Accept: '*/*',
        };

        // Forward stored cookies for this domain
        const cookies = getCookies(url);
        if (cookies) {
          headers['Cookie'] = cookies;
        }

        const response = await fetch(url, { headers, redirect: 'follow' });

        // Store any cookies from response
        storeCookies(url, response);

        // Use the final URL after redirects as the base for resolving paths
        const finalUrl = response.url || url;
        let finalParsed: URL;
        try {
          finalParsed = new URL(finalUrl);
        } catch {
          finalParsed = parsed;
        }

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          request.log.error(`Proxy ${response.status} for ${url} (final: ${finalUrl}): ${body.slice(0, 200)}`);
          return reply.status(response.status).send({ error: `Upstream error: ${response.status}` });
        }

        const contentType = response.headers.get('content-type') || '';

        // For .m3u8 — rewrite URLs to go through our proxy
        if (url.endsWith('.m3u8') || finalUrl.endsWith('.m3u8') || contentType.includes('mpegurl') || contentType.includes('m3u8')) {
          const text = await response.text();
          const proxyBase = '/api/proxy?url=';

          const rewritten = text
            .split('\n')
            .map((line) => {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith('#')) return line;

              let absoluteUrl: string;

              if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                absoluteUrl = trimmed;
              } else if (trimmed.startsWith('/')) {
                // Absolute path — resolve against FINAL domain (after redirect)
                absoluteUrl = finalParsed.origin + trimmed;
              } else {
                // Relative path — resolve against FINAL URL base
                const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
                absoluteUrl = baseUrl + trimmed;
              }

              return proxyBase + encodeURIComponent(absoluteUrl);
            })
            .join('\n');

          reply.header('Content-Type', 'application/vnd.apple.mpegurl');
          reply.header('Access-Control-Allow-Origin', '*');
          return reply.send(rewritten);
        }

        // For .ts segments and other binary — stream through
        const buffer = Buffer.from(await response.arrayBuffer());
        reply.header('Content-Type', contentType || 'video/mp2t');
        reply.header('Access-Control-Allow-Origin', '*');
        return reply.send(buffer);
      } catch (err: any) {
        request.log.error(`Proxy error: ${err.message}`);
        return reply.status(502).send({ error: `Proxy error: ${err.message}` });
      }
    },
  );
}
