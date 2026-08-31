/**
 * Reconstruct reading order from pdf-parse page text.
 * pdf-parse emits a tab when two items on the same baseline have a large x-gap
 * (two-column resumes). We read left column then right column per page.
 */

export interface PdfPageText {
  num: number;
  text: string;
}

export function reconstructPdfReadingOrder(pages: PdfPageText[]): {
  text: string;
  extractionMethod: "layout" | "regex";
  pageCount: number;
} {
  if (pages.length === 0) {
    return { text: "", extractionMethod: "regex", pageCount: 0 };
  }

  const usedLayout = pages.some((page) => pageLooksTwoColumn(page.text));
  const parts: string[] = [];

  for (const page of pages) {
    parts.push(`-- page ${page.num} --`);
    parts.push(usedLayout ? reconstructPageColumns(page.text) : flattenCells(page.text));
  }

  return {
    text: parts.join("\n").trim(),
    extractionMethod: usedLayout ? "layout" : "regex",
    pageCount: pages.length,
  };
}

function pageLooksTwoColumn(pageText: string): boolean {
  const lines = pageText.split("\n").filter((line) => line.trim());
  if (lines.length < 4) return false;
  const twoCell = lines.filter((line) => {
    const cells = line.split("\t").map((cell) => cell.trim()).filter(Boolean);
    return cells.length >= 2;
  }).length;
  return twoCell >= Math.max(3, Math.ceil(lines.length * 0.25));
}

function reconstructPageColumns(pageText: string): string {
  const left: string[] = [];
  const right: string[] = [];

  for (const line of pageText.split("\n")) {
    const cells = line.split("\t").map((cell) => cell.trim());
    if (cells[0]) left.push(cells[0]);
    for (const cell of cells.slice(1)) {
      if (cell) right.push(cell);
    }
  }

  return [...left, ...right].join("\n");
}

function flattenCells(pageText: string): string {
  return pageText
    .split("\n")
    .map((line) =>
      line
        .split("\t")
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join(" ")
    )
    .join("\n");
}
