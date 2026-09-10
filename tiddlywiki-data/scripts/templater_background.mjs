import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.resolve(
  __dirname,
  "../output/music.json"
);

const TEMPLATE_FILE = path.resolve(
  __dirname,
  "../files/new_html/templates/styles/background.css"
);

const OUTPUT_DIRECTORY = path.resolve(
  __dirname,
  "../files/new_html/styles/backgrounds"
);

function readJson(filePath) {
  try {
    const content = fs.readFileSync(
      filePath,
      "utf8"
    );

    return JSON.parse(content);
  } catch (error) {
    console.error(
      `Ошибка чтения JSON-файла:\n${filePath}`
    );

    console.error(error.message);
    process.exit(1);
  }
}

function readTemplate(filePath) {
  try {
    return fs.readFileSync(
      filePath,
      "utf8"
    );
  } catch (error) {
    console.error(
      `Ошибка чтения CSS-шаблона:\n${filePath}`
    );

    console.error(error.message);
    process.exit(1);
  }
}

function replaceVariable(
  content,
  variableName,
  value
) {
  return content.replaceAll(
    `{{${variableName}}}`,
    String(value ?? "")
  );
}

function sanitizeFileName(value) {
  return String(value)
    .trim()
    .replaceAll("/", "-")
    .replaceAll("\\", "-");
}

function createFileName(releaseName) {
  return `${sanitizeFileName(
    releaseName
  )}_background.css`;
}

function build() {
  console.log("Чтение JSON-файла:");
  console.log(DATA_FILE);

  const jsonData = readJson(DATA_FILE);

  console.log("");
  console.log("Чтение CSS-шаблона:");
  console.log(TEMPLATE_FILE);

  const template = readTemplate(TEMPLATE_FILE);

  const items = Array.isArray(jsonData)
    ? jsonData
    : jsonData.items;

  if (!Array.isArray(items)) {
    console.error("");
    console.error(
      "Ошибка: JSON должен содержать массив объектов."
    );

    process.exit(1);
  }

  try {
    fs.mkdirSync(
      OUTPUT_DIRECTORY,
      {
        recursive: true
      }
    );
  } catch (error) {
    console.error(
      `Ошибка создания директории:\n${OUTPUT_DIRECTORY}`
    );

    console.error(error.message);
    process.exit(1);
  }

  console.log("");
  console.log("Сохранение CSS-файлов в:");
  console.log(OUTPUT_DIRECTORY);
  console.log("");

  let createdCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (
    const [index, item] of items.entries()
  ) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      console.error(
        `Неудача: элемент с индексом ${index} не является объектом. Элемент пропущен.`
      );

      skippedCount++;
      continue;
    }

    const releaseName = String(
      item.releaseName ?? ""
    ).trim();

    if (!releaseName) {
      console.error(
        `Неудача: у элемента с индексом ${index} отсутствует releaseName. CSS-файл не создан.`
      );

      skippedCount++;
      continue;
    }

    try {
      const cssContent = replaceVariable(
        template,
        "title",
        releaseName
      );

      const fileName = createFileName(
        releaseName
      );

      const outputPath = path.join(
        OUTPUT_DIRECTORY,
        fileName
      );

      fs.writeFileSync(
        outputPath,
        cssContent,
        "utf8"
      );

      createdCount++;

      console.log(
        `Создан: ${fileName}`
      );
    } catch (error) {
      console.error(
        `Неудача при создании CSS-файла для "${releaseName}":`
      );

      console.error(error.message);
      failedCount++;
    }
  }

  console.log("");
  console.log(
    `Готово. Создано CSS-файлов: ${createdCount}`
  );

  console.log(
    `Пропущено элементов: ${skippedCount}`
  );

  console.log(
    `Неудачных операций: ${failedCount}`
  );
}

build();
