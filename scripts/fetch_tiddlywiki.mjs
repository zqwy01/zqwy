#!/usr/bin/env node
/*
 * Download the current TiddlyWiki package into an ignored build cache.
 *
 * The engine is never committed: it lives in .cache/tiddlywiki/. With no
 * network, a previously downloaded version is reused (TIDDLYWIKI_OFFLINE=1
 * forces that behaviour). A specific release can be pinned with
 * TIDDLYWIKI_VERSION, e.g. `TIDDLYWIKI_VERSION=5.4.1 npm run wiki:tiddlywiki`.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT = path.resolve(HERE, "..");
export const CACHE_DIR = path.join(PROJECT, ".cache", "tiddlywiki");
export const PACKAGE_DIR = path.join(CACHE_DIR, "node_modules", "tiddlywiki");
export const CLI_FILE = path.join(PACKAGE_DIR, "tiddlywiki.js");

const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

function flag(name) {
  return ["1", "true", "yes", "on"].includes(String(process.env[name] || "").toLowerCase());
}

export function installedVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, "package.json"), "utf8")).version || null;
  } catch {
    return null;
  }
}

function latestVersion() {
  const raw = execFileSync(NPM, ["view", "tiddlywiki", "version", "--json"], {
    cwd: PROJECT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(raw);
}

function install(version) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`TiddlyWiki: загрузка ${version} в ${path.relative(PROJECT, CACHE_DIR)}/ ...`);
  execFileSync(NPM, [
    "install",
    "--prefix", CACHE_DIR,
    "--no-save",
    "--no-audit",
    "--no-fund",
    "--loglevel=error",
    `tiddlywiki@${version}`,
  ], { cwd: PROJECT, stdio: "inherit" });
}

export function ensureTiddlyWiki() {
  const requested = process.env.TIDDLYWIKI_VERSION || "latest";
  const offline = flag("TIDDLYWIKI_OFFLINE");
  const refresh = flag("TIDDLYWIKI_REFRESH");
  const current = installedVersion();

  let target = requested;
  if (offline && current) {
    target = current;
  } else if (requested === "latest" && !offline) {
    try {
      target = latestVersion();
    } catch {
      if (!current) throw new Error("Не удалось узнать актуальную версию TiddlyWiki и в кэше её нет");
      console.warn("Не удалось проверить актуальную версию TiddlyWiki — используем кэш.");
      target = current;
    }
  }

  if (!current || current !== target || refresh) {
    if (offline && !current) throw new Error("TiddlyWiki нет в кэше, а TIDDLYWIKI_OFFLINE=1 запрещает загрузку");
    install(target);
  } else {
    console.log(`TiddlyWiki: используем кэш ${current} (${path.relative(PROJECT, CACHE_DIR)}/)`);
  }

  if (!fs.existsSync(CLI_FILE)) {
    throw new Error(`TiddlyWiki загружен, но CLI не найден: ${CLI_FILE}`);
  }
  const version = installedVersion();
  console.log(`TiddlyWiki: готово, CLI ${version}`);
  return version;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    ensureTiddlyWiki();
  } catch (error) {
    console.error(`Ошибка загрузки TiddlyWiki: ${error.message}`);
    process.exitCode = 1;
  }
}
