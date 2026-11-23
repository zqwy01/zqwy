#!/usr/bin/env node
/*
 * Создаёт dev/data/build-info.json — данные о версии для пункта «Версия сборки»
 * в настройках сайта.
 *
 * Источники:
 *   package.json      — человеческая версия проекта;
 *   git HEAD          — короткий хеш коммита (в Docker может отсутствовать);
 *   BUILD_VERSION     — переопределение версии для CI: export BUILD_VERSION=...
 *   дата запуска      — время сборки.
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
const OUT_FILE = path.join(PROJECT, "dev", "data", "build-info.json");

const pkg = JSON.parse(fs.readFileSync(PACKAGE_FILE, "utf8"));
const version = process.env.BUILD_VERSION || pkg.version || "0.0.0";

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
  commit: commit || null,
  label: commit ? `v${version} · ${commit}` : `v${version}`,
  builtAt: new Date().toISOString(),
};

writeFileSafe(OUT_FILE, `${JSON.stringify(info, null, 2)}\n`);
console.log(`Build info: ${info.label} (${info.builtAt})`);
