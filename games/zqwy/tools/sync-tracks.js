#!/usr/bin/env node
/* Сканер музыкального архива: каждый альбом-папка становится кассетой,
   а его основные треки — дорожками этой кассеты.

   Запуск из корня игры:
     node tools/sync-tracks.js
     node tools/sync-tracks.js --source /path/to/src/tracks
     node tools/sync-tracks.js --no-copy
     node tools/sync-tracks.js --no-catalog

   По умолчанию исходники ищутся в ../../src/tracks относительно игры
   (в рабочей копии путь можно передать явно). Файлы копируются в
   assets/music/<album>/<track>.opus, а рядом с игрой появляется
   js/tracks.generated.js. Повторный запуск не копирует уже совпадающие
   по размеру файлы, поэтому его можно вызывать после добавления новых
   треков. */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SOURCE = path.resolve(ROOT, '..', '..', 'src', 'tracks');
const DEFAULT_DEST = path.join(ROOT, 'assets', 'music');
const CATALOG_PATH = path.join(ROOT, 'js', 'tracks.generated.js');

const EXCLUDED_DIRS = new Set([
  'Media',
  'media',
  'loops',
  'Loops',
  'AutoSaves',
  'compare',
  'projects_rpp',
  'To Release'
]);

const EXCLUDED_FILE = [
  /(^|\/)compare\.opus$/i,
  /\/[^/]*\d+\s*bpm\.opus$/i,
  /\/#[0-9]+_/,
  /\/roar-/i
];

function parseArgs(argv) {
  const args = {
    source: DEFAULT_SOURCE,
    dest: DEFAULT_DEST,
    copy: true,
    catalog: true
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--source' && argv[i + 1]) {
      args.source = path.resolve(argv[++i]);
    } else if (arg === '--dest' && argv[i + 1]) {
      args.dest = path.resolve(argv[++i]);
    } else if (arg === '--no-copy') {
      args.copy = false;
    } else if (arg === '--no-catalog') {
      args.catalog = false;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Использование: node tools/sync-tracks.js [--source DIR] [--dest DIR] [--no-copy] [--no-catalog]');
      process.exit(0);
    }
  }
  return args;
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;
      walk(full, out);
    } else if (entry.isFile() && /\.opus$/i.test(entry.name)) {
      const rel = path.relative(argsSource, full).split(path.sep).join('/');
      if (EXCLUDED_FILE.some((pattern) => pattern.test(`/${rel}`))) continue;
      out.push(rel);
    }
  }
}

let argsSource = DEFAULT_SOURCE;
let argsDest = DEFAULT_DEST;

function albumIdFor(relative) {
  const first = relative.split('/')[0] || 'tracks';
  return first
    .replace(/^!/, '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'tracks';
}

function albumTitleFor(relative, id) {
  const first = relative.split('/')[0] || id;
  const clean = first.replace(/^!/, '').replace(/_+/g, ' ').trim();
  if (!clean) return id;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function trackTitleFor(relative) {
  const base = path.basename(relative).replace(/\.opus$/i, '');
  let title = base.replace(/^\d+_zqwy_/i, '').replace(/^\d+_/, '');
  title = title.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!title) title = base;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function trackKeyFor(relative) {
  const base = path.basename(relative).replace(/\.opus$/i, '');
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'track';
}

function numericPrefix(relative) {
  const base = path.basename(relative);
  const match = base.match(/^(\d+)/);
  return match ? Number(match[1]) : 9999;
}

function buildCatalog(files) {
  const albums = new Map();
  for (const relative of files) {
    const albumId = albumIdFor(relative);
    if (!albums.has(albumId)) {
      albums.set(albumId, {
        id: albumId,
        title: albumTitleFor(relative, albumId),
        tracks: []
      });
    }
    const album = albums.get(albumId);
    const base = path.basename(relative).replace(/\.opus$/i, '');
    let key = trackKeyFor(relative);
    if (album.tracks.some((track) => track.key === key)) {
      let index = 2;
      while (album.tracks.some((track) => track.key === `${key}_${index}`)) index += 1;
      key = `${key}_${index}`;
    }
    album.tracks.push({
      key,
      source: relative,
      file: `assets/music/${albumId}/${base}.opus`,
      title: trackTitleFor(relative),
      order: numericPrefix(relative)
    });
  }

  const result = Array.from(albums.values())
    .sort((a, b) => a.title.localeCompare(b.title, 'en'))
    .map((album) => {
      album.tracks.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'en'));
      const tracks = album.tracks.map((track) => ({
        id: `${album.id}__${track.key}`,
        file: track.file,
        title: track.title,
        source: track.source
      }));
      delete album.tracks;
      return { id: album.id, title: album.title, tracks };
    });
  return result;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyTracks(catalog) {
  let copied = 0;
  let skipped = 0;
  let failed = 0;
  for (const album of catalog) {
    for (const track of album.tracks) {
      const from = path.join(argsSource, track.source);
      const to = path.join(argsDest, album.id, path.basename(track.file));
      try {
        const sourceStat = fs.statSync(from);
        if (fs.existsSync(to)) {
          const targetStat = fs.statSync(to);
          if (targetStat.size === sourceStat.size) {
            skipped += 1;
            continue;
          }
        }
        ensureDir(path.dirname(to));
        fs.copyFileSync(from, to);
        copied += 1;
      } catch (error) {
        failed += 1;
        console.error(`  ! ${track.source}: ${error.message}`);
      }
    }
  }
  return { copied, skipped, failed };
}

function writeCatalog(catalog) {
  const payload = {
    generatedAt: new Date().toISOString(),
    albums: catalog
  };
  const source = `/* Сгенерировано tools/sync-tracks.js. Не редактируй вручную:
   запусти сканер, чтобы подхватить новые альбомы и треки. */
window.ZQ_TRACKS = ${JSON.stringify(payload, null, 2)};
`;
  fs.writeFileSync(CATALOG_PATH, source, 'utf8');
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  argsSource = parsed.source;
  argsDest = parsed.dest;
  if (!fs.existsSync(argsSource)) {
    console.error(`Не найден архив треков: ${argsSource}`);
    process.exit(1);
  }
  const files = [];
  walk(argsSource, files);
  files.sort((a, b) => a.localeCompare(b, 'en'));
  if (!files.length) {
    console.error(`В архиве нет подходящих .opus: ${argsSource}`);
    process.exit(1);
  }
  const catalog = buildCatalog(files);
  const trackCount = catalog.reduce((sum, album) => sum + album.tracks.length, 0);
  console.log(`Найдено альбомов: ${catalog.length}, треков: ${trackCount}.`);
  if (parsed.catalog) {
    writeCatalog(catalog);
    console.log(`Каталог записан: ${path.relative(ROOT, CATALOG_PATH)}`);
  }
  if (parsed.copy) {
    const result = copyTracks(catalog);
    console.log(`Скопировано: ${result.copied}, без изменений: ${result.skipped}, ошибок: ${result.failed}.`);
    if (result.failed) process.exitCode = 1;
  }
}

main();
