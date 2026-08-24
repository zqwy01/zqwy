import csv
import re

INPUT_FILE = "tiddlers.csv"
OUTPUT_FILE = "music_clean.csv"

HTML_TAG_RE = re.compile(r"<[^>]*>")

with open(INPUT_FILE, "r", encoding="utf-8-sig", newline="") as infile:
    reader = csv.DictReader(infile)

    if not reader.fieldnames:
        raise ValueError("CSV-файл не содержит заголовков")

    required_columns = {"type_content", "title", "text"}
    missing_columns = required_columns - set(reader.fieldnames)

    if missing_columns:
        raise ValueError(
            f"В CSV отсутствуют столбцы: {', '.join(missing_columns)}"
        )

    with open(OUTPUT_FILE, "w", encoding="utf-8-sig", newline="") as outfile:
        writer = csv.DictWriter(
            outfile,
            fieldnames=reader.fieldnames,
            delimiter=","
        )
        writer.writeheader()

        for row in reader:
            if row["type_content"].strip().lower() == "music":
                title = row["title"].strip()

                if title.isdigit():
                    row["title"] = title.zfill(9)

                row["text"] = HTML_TAG_RE.sub("", row["text"])
                writer.writerow(row)

print(f"Готово. Результат сохранён в файл: {OUTPUT_FILE}")
