import csv
import json

with open("tiddlers.csv", "r", encoding="utf-8", newline="") as csv_file:
    rows = csv.DictReader(csv_file)

    with open("output.json", "w", encoding="utf-8") as json_file:
        json.dump(list(rows), json_file, ensure_ascii=False, indent=2)
