#!/usr/bin/env node
/* Сборка прототипа: увеличивает номер ядра и записывает js/build-info.js.
   Запуск: node build.js
   Версия берётся из js/config.js, поэтому одно место задаёт основу,
   а номер сборки меняется после каждого запуска. */
'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const configPath = path.join(root, 'js', 'config.js');
const infoPath = path.join(root, 'js', 'build-info.js');

let version = '0.0.0';
try {
  const config = fs.readFileSync(configPath, 'utf8');
  const match = config.match(/\bversion:\s*['"]([^'"]+)['"]/);
  if (match) version = match[1];
} catch (error) {
  console.error(`Не удалось прочитать js/config.js: ${error.message}`);
  process.exitCode = 1;
}

let previous = { build: 0 };
try {
  const source = fs.readFileSync(infoPath, 'utf8');
  const match = source.match(/window\.ZQ_BUILD\s*=\s*(\{[\s\S]*?\});/);
  if (match) previous = JSON.parse(match[1]);
} catch (error) {
  /* Первая сборка: файла может не быть. */
}

const build = (Number.isFinite(previous.build) ? previous.build : 0) + 1;
const info = {
  version,
  build,
  builtAt: new Date().toISOString()
};

const output = `/* Данные сборки. Файл обновляется командой «node build.js»:
   номер сборки увеличивается, версия берётся из js/config.js. */
window.ZQ_BUILD = ${JSON.stringify(info, null, 2)};
`;

fs.writeFileSync(infoPath, output, 'utf8');
console.log(`Сборка ${info.version} · ${info.build} · ${info.builtAt}`);
