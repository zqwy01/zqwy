#!/usr/bin/env node
/*
 * Проверка графа заметок после генерации: данные + все файлы движков.
 * Вызывается из build_dist.sh (dev) и из Docker-пайплайна (dist).
 *
 *   node scripts/verify_graph.mjs [dev|dist] [корень проекта]
 */
import fs from "node:fs";
import path from "node:path";

const target = process.argv[2] === "dist" ? "dist" : "dev";
const root = path.resolve(process.argv[3] || process.cwd());
const base = path.join(root, target);
const problems = [];

function readJson(relative) {
  const file = path.join(base, relative);
  if (!fs.existsSync(file)) {
    problems.push(`нет файла: ${target}/${relative}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    problems.push(`битый JSON: ${target}/${relative} (${error.message})`);
    return null;
  }
}

function requireFile(relative) {
  if (!fs.existsSync(path.join(base, relative))) {
    problems.push(`нет файла: ${target}/${relative}`);
  }
}

const data = readJson("data/note-graph.json");
if (data) {
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const links = Array.isArray(data.links) ? data.links : [];
  if (!nodes.length) problems.push("пустой список узлов");
  if (!links.length) problems.push("пустой список связей");
  if (!Array.isArray(data.categories) || !data.categories.length) {
    problems.push("нет категорий");
  }

  const ids = new Set(nodes.map((node) => node.id));
  if (ids.size !== nodes.length) problems.push("дублирующиеся id узлов");

  const degree = new Map(nodes.map((node) => [node.id, 0]));
  const kinds = new Set(["reference", "series", "similar"]);
  for (const [index, link] of links.entries()) {
    if (!ids.has(link.source) || !ids.has(link.target) || link.source === link.target) {
      problems.push(`связь ${index} указывает на неизвестный узел`);
      continue;
    }
    if (!kinds.has(link.kind)) {
      problems.push(`связь ${index} имеет неизвестный тип: ${link.kind}`);
    }
    degree.set(link.source, degree.get(link.source) + 1);
    degree.set(link.target, degree.get(link.target) + 1);
  }

  const isolated = [...degree.values()].filter((value) => value === 0).length;
  console.log(`Граф (${target}): ${nodes.length} узлов, ${links.length} связей, изолированных: ${isolated}`);
}

for (const relative of [
  "wiki/graph/index.html",
  "styles/graph.css",
  "scripts/graph.js",
  "scripts/graph/index.js",
  "scripts/graph/context.js",
  "scripts/graph/core.js",
  "scripts/graph/shared.js",
  "scripts/graph/ui.js",
  "scripts/graph/vendor.js",
  "scripts/graph/engines/canvas-force.js",
  "scripts/graph/engines/d3-force.js",
  "scripts/graph/engines/cytoscape.js",
  "scripts/graph/engines/orbit.js",
  "scripts/graph/engines/sigma.js",
  "scripts/graph/engines/vis.js",
  "scripts/graph/engines/jointjs.js",
  "scripts/graph/engines/force-graph.js",
  "scripts/graph/engines/springy.js",
  "scripts/graph/engines/3d-force-graph.js",
  "vendor/d3-dispatch.min.js",
  "vendor/d3-quadtree.min.js",
  "vendor/d3-timer.min.js",
  "vendor/d3-force.min.js",
  "vendor/cytoscape.min.js",
  "vendor/sigma.min.js",
  "vendor/vis-network.min.js",
  "vendor/jquery.min.js",
  "vendor/underscore-min.js",
  "vendor/backbone-min.js",
  "vendor/joint.min.js",
  "vendor/force-graph.min.js",
  "vendor/springy.js",
  "vendor/3d-force-graph.min.js",
]) {
  requireFile(relative);
}

function requireText(relative, needle, label) {
  const file = path.join(base, relative);
  if (!fs.existsSync(file)) return;
  if (!fs.readFileSync(file, "utf8").includes(needle)) {
    problems.push(`нет ${label} в ${target}/${relative}`);
  }
}

function forbidText(relative, needle, label) {
  const file = path.join(base, relative);
  if (!fs.existsSync(file)) return;
  if (fs.readFileSync(file, "utf8").includes(needle)) {
    problems.push(`${label} в ${target}/${relative}`);
  }
}

requireText("wiki/graph/index.html", 'id="graphEngines"', "списка движков");
requireText("wiki/graph/index.html", 'class="graph-engine-select-trigger"', "кнопки выбора движка");
requireText("wiki/graph/index.html", 'class="graph-stage-actions"', "иконок управления на сцене");
requireText("wiki/graph/index.html", "data-graph-bootstrap", "раннего списка движков");
requireText("scripts/graph/ui.js", "graph-engine-option", "опций с иконками движков");
requireText("scripts/graph/core.js", "engineDisabled", "автоотключения движков");
requireText("scripts/graph/core.js", "__zqwyGraphPendingEngine", "раннего выбора движка");
forbidText("scripts/transition/events.js", "P.initialLoaderTimer = window.setTimeout", "лоадер первой загрузки");

const homePage = path.join(base, "index.html");
if (fs.existsSync(homePage)) {
  const form = fs.readFileSync(homePage, "utf8")
    .match(/<form id="site-settings-form"[\s\S]*?<\/form>/)?.[0] || "";
  const firstGroup = form.match(/<fieldset class="settings-group[^"]*">[\s\S]*?<\/fieldset>/)?.[0] || "";
  if (!firstGroup.includes('name="language"')) problems.push("язык не является первой настройкой сайта");
}

if (target === "dist") {
  const index = readJson("data/search-index.json");
  const items = Array.isArray(index?.items) ? index.items : [];
  if (!items.some((item) => item.path === "./wiki/graph/")) {
    problems.push("страница графа отсутствует в поисковом индексе");
  }
}

if (problems.length) {
  console.error(`Проверка графа (${target}) не пройдена:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`Проверка графа (${target}): OK`);
