import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  readJson,
  readTemplate,
  buildPages,
  getReleaseType
} from "./templater_page.js";


const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);


const DATA_FILE =
  path.resolve(
    __dirname,
    "../output/music.json"
  );

const TEMPLATE_FILE =
  path.resolve(
    __dirname,
    "../files/new_html/templates/template.html"
  );

const OUTPUT_DIRECTORY =
  path.resolve(
    __dirname,
    "../files/new_html/pages"
  );


console.log("Чтение JSON-файла:");
console.log(DATA_FILE);

const jsonData =
  readJson(DATA_FILE);


console.log("");
console.log("Чтение HTML-шаблона:");
console.log(TEMPLATE_FILE);

const template =
  readTemplate(TEMPLATE_FILE);


const allItems =
  Array.isArray(jsonData)
    ? jsonData
    : jsonData.items;


if (!Array.isArray(allItems)) {
  console.error("");
  console.error(
    "Ошибка: JSON должен содержать массив объектов."
  );

  process.exit(1);
}


const singles =
  allItems.filter(item => {
    return (
      item &&
      typeof item === "object" &&
      getReleaseType(item) === "single"
    );
  });


console.log("");
console.log(
  `Найдено синглов: ${singles.length}`
);

console.log("");
console.log("Сохранение синглов в:");
console.log(OUTPUT_DIRECTORY);
console.log("");


buildPages({
  items: singles,
  template,
  outputDirectory: OUTPUT_DIRECTORY,
  mode: "single"
});
