import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8130);

// Read-only sources outside the project. Only the explicitly whitelisted files
// below are reachable through the server.
const TRACKS_ROOT = path.resolve(
  process.env.TRACKS_ROOT ||
    '/home/zqwy/smb/apps/tiddlywiki/tiddlywiki-data/files/src/tracks'
);
const ANGEL_FILE = path.resolve(
  process.env.ANGEL_FILE ||
    '/home/zqwy/smb/content/category/photo/angel/angel.webp'
);

const MUSIC_FILES = Object.freeze({
  tablet: 'mice_inside/tracks/4_zqwy_heart/4_zqwy_heart.opus',
  labyrinth: 'mice_inside/tracks/1_zqwy_trachea/1_zqwy_trachea.opus',
  trial: 'mice_inside/tracks/17_zqwy_coma/17_zqwy_coma.opus',
  deep: 'mice_inside/tracks/7_zqwy_spleen/7_zqwy_spleen.opus',
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.opus': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const DENIED_STATIC = new Set([
  'server.mjs',
  'package.json',
  'package-lock.json',
]);

function isInside(root, candidate) {
  return candidate === root || candidate.startsWith(root + path.sep);
}

function json(res, status, body) {
  const data = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
  });
  res.end(data);
}

async function sendFile(req, res, filePath, options = {}) {
  let info;
  try {
    info = await stat(filePath);
  } catch {
    json(res, 404, { error: 'not_found' });
    return;
  }
  if (!info.isFile()) {
    json(res, 404, { error: 'not_found' });
    return;
  }

  const type = options.contentType || MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  const headers = {
    'Content-Type': type,
    'Cache-Control': options.cacheControl || 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
  };

  const range = req.headers.range;
  if (range && options.ranges !== false) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      let start = match[1] === '' ? null : Number(match[1]);
      let end = match[2] === '' ? null : Number(match[2]);
      if (start === null && end !== null) {
        start = Math.max(0, info.size - end);
        end = info.size - 1;
      } else {
        start = start ?? 0;
        end = end ?? info.size - 1;
      }
      if (Number.isInteger(start) && Number.isInteger(end) && start <= end && start < info.size) {
        end = Math.min(end, info.size - 1);
        headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
        headers['Content-Length'] = end - start + 1;
        res.writeHead(206, headers);
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }
  }

  headers['Content-Length'] = info.size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

function resolveStatic(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const relative = decoded.replace(/^\/+/, '');
  if (!relative) return null;
  if (relative.split('/').some((part) => part.startsWith('.'))) return null;
  if (DENIED_STATIC.has(relative)) return null;
  const resolved = path.resolve(ROOT, relative);
  if (!isInside(ROOT, resolved)) return null;
  return resolved;
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    json(res, 400, { error: 'bad_request' });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }

  if (pathname === '/api/health') {
    json(res, 200, {
      ok: true,
      game: 'to-east-browser-prototype',
      musicIds: Object.keys(MUSIC_FILES),
      angelConfigured: isInside(path.dirname(ANGEL_FILE), ANGEL_FILE),
    });
    return;
  }

  if (pathname === '/' || pathname === '/east' || pathname === '/east/') {
    await sendFile(req, res, path.join(ROOT, 'east.html'));
    return;
  }

  if (pathname === '/asset/angel.webp') {
    await sendFile(req, res, ANGEL_FILE, {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=3600',
      ranges: true,
    });
    return;
  }

  if (pathname.startsWith('/music/')) {
    const id = pathname.slice('/music/'.length);
    if (!Object.prototype.hasOwnProperty.call(MUSIC_FILES, id)) {
      json(res, 404, { error: 'unknown_music_id' });
      return;
    }
    const filePath = path.resolve(TRACKS_ROOT, MUSIC_FILES[id]);
    if (!isInside(TRACKS_ROOT, filePath)) {
      json(res, 404, { error: 'not_found' });
      return;
    }
    await sendFile(req, res, filePath, {
      contentType: 'audio/ogg',
      cacheControl: 'public, max-age=3600',
      ranges: true,
    });
    return;
  }

  if (pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  const staticPath = resolveStatic(pathname);
  if (!staticPath) {
    json(res, 404, { error: 'not_found' });
    return;
  }
  await sendFile(req, res, staticPath);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Порт ${PORT} занят. Запустите: PORT=8131 npm start`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log('«К Востоку» — браузерный прототип');
  console.log(`  http://${HOST}:${PORT}/`);
  console.log(`  старый «Клетчатый лист»: http://${HOST}:${PORT}/index.html`);
  console.log('  Ctrl+C — остановить сервер');
});
