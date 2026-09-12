import fs from "node:fs";
import path from "node:path";

const src = "d:/10000_quotes.txt";
const outPath = path.join(process.cwd(), "src", "data", "islamic-quotes.json");

const lines = fs
  .readFileSync(src, "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => l.replace(/^["'\u201c\u201d]+|["'\u201c\u201d]+$/g, "").trim())
  .filter((t) => t.length > 0);

const quotes = lines.map((text) => ({ text }));
fs.writeFileSync(outPath, `${JSON.stringify(quotes)}\n`);

const unique = new Set(lines.map((t) => t.toLowerCase()));
console.log(
  JSON.stringify(
    {
      wrote: quotes.length,
      unique: unique.size,
      avgLen: Math.round(lines.reduce((a, b) => a + b.length, 0) / lines.length),
      sample: lines.slice(0, 5),
      outPath,
    },
    null,
    2,
  ),
);
