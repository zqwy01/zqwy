#!/usr/bin/env node
/*
 * Создаёт dev/data/build-info.json — данные о версии для пункта «Версия сборки»
 * в настройках сайта.
 *
 * Источники:
 *   package.json        — человеческая версия проекта;
 *   scripts/.build-number — монотонный номер сборки (увеличивается на 1);
 *   git HEAD            — короткий хеш коммита (в Docker может отсутствовать);
 *   BUILD_VERSION       — переопределение версии для CI: export BUILD_VERSION=...
 *   BUILD_NUMBER        — внешний номер сборки для CI/Docker (счётчик не трогаем);
 *   дата запуска        — время сборки.
 *
 * Запускается автоматически из scripts/build_dist.sh и вручную:
 *   node scripts/build_version.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeFileSafe } from "./lib/write-file-smb-safe.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, "..");
const PACKAGE_FILE = path.join(PROJECT, "package.json");
const COUNTER_FILE = path.join(HERE, ".build-number");
const OUT_FILE = path.join(PROJECT, "dev", "data", "build-info.json");

const pkg = JSON.parse(fs.readFileSync(PACKAGE_FILE, "utf8"));
const version = process.env.BUILD_VERSION || pkg.version || "0.0.0";

/*
 * Номер сборки — единственный источник истины в scripts/.build-number.
 * Обычный запуск увеличивает его на 1 и сохраняет, поэтому номер растёт при
 * каждом `npm run build`. В CI/Docker номер можно передать через BUILD_NUMBER:
 * в этом случае файл-счётчик не меняется (сборка внутри образа не может
 * записать файл на хосте), а номер задаётся снаружи.
 */
function nextBuildNumber() {
  const external = process.env.BUILD_NUMBER;
  if (external !== undefined && external !== "") {
    const value = Number(external);
    if (!Number.isInteger(value) || value < 1) {
      throw new Error("BUILD_NUMBER должен быть целым числом больше нуля");
    }
    return value;
  }

  let current = 0;
  try {
    const parsed = Number(fs.readFileSync(COUNTER_FILE, "utf8").trim());
    if (Number.isInteger(parsed) && parsed >= 0) current = parsed;
  } catch {
    // Первая сборка: файла ещё нет или он нечитаем — начинаем с нуля.
  }

  const value = current + 1;
  writeFileSafe(COUNTER_FILE, `${value}\n`);
  return value;
}

const build = nextBuildNumber();

let commit = "";
try {
  commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: PROJECT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {
  // .git is excluded from the Docker build context — a version without a hash
  // is still perfectly valid there.
}

const info = {
  version,
  build,
  commit: commit || null,
  label: commit ? `v${version} · #${build} · ${commit}` : `v${version} · #${build}`,
  builtAt: new Date().toISOString(),
};

writeFileSafe(OUT_FILE, `${JSON.stringify(info, null, 2)}\n`);
console.log(`Build info: ${info.label} (${info.builtAt})`);
