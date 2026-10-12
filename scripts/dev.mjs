import { createServer } from 'vite';
import api from '../api/subscribe.js';

const server = await createServer({
  server: { host: '127.0.0.1', port: 5188, strictPort: true },
  plugins: [{
    name: 'subscription-api',
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        if (url.pathname !== '/api/subscribe') return next();
        try {
          const chunks = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 4096) {
              res.writeHead(413, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
              res.end(JSON.stringify({ ok: false, message: '입력 내용이 너무 길어요.' }));
              return;
            }
            chunks.push(chunk);
          }
          const request = new Request(url, {
            method: req.method,
            headers: req.headers,
            ...(!['GET', 'HEAD'].includes(req.method) ? { body: Buffer.concat(chunks) } : {}),
          });
          const response = await api.fetch(request);
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(await response.text());
        } catch {
          res.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ ok: false, message: '신청을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' }));
        }
      });
    },
  }],
});

await server.listen();
server.printUrls();
