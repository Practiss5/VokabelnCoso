// Browser-only: builds an editable Word quiz (student sheet + answer key). Import dynamically.
import { AlignmentType, BorderStyle, Document, Packer, PageBreak, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

type W = { german: string; french: string };
const border = { style: BorderStyle.SINGLE, size: 4, color: "555555" };
const borders = { top: border, bottom: border, left: border, right: border };
const COLS = [600, 4213, 4213]; // A4 content width 9026 DXA

function cell(text: string, width: number, bold = false) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA }, margins: { top: 120, bottom: 120, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
  });
}
function table(rows: W[], start: number, from: "french" | "german", key: boolean) {
  return new Table({
    width: { size: 9026, type: WidthType.DXA }, columnWidths: COLS,
    rows: rows.map((w, i) => new TableRow({ children: [
      cell(String(start + i + 1), COLS[0]!), cell(w[from], COLS[1]!),
      cell(key ? w[from === "french" ? "german" : "french"] : "", COLS[2]!, true),
    ] })),
  });
}
function sheet(title: string, words: W[], key: boolean) {
  const half = Math.ceil(words.length / 2);
  return [
    new Paragraph({ children: [new TextRun({ text: `Interrogation de vocabulaire${key ? " — CORRIGÉ" : ""}`, bold: true, size: 32 })] }),
    new Paragraph({ children: [new TextRun({ text: title, size: 26 })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Note : ____ / ${words.length}`, bold: true })] }),
    new Paragraph({ spacing: { before: 200, after: 200 }, children: [new TextRun("Nom : __________________   Prénom : ________________   Date : ____________")] }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "1. Traduis en allemand (avec l'article pour les noms).", bold: true })] }),
    table(words.slice(0, half), 0, "french", key),
    new Paragraph({ spacing: { before: 300, after: 120 }, children: [new TextRun({ text: "2. Traduis en français.", bold: true })] }),
    table(words.slice(half), half, "german", key),
  ];
}

export async function quizDocx(title: string, words: W[]): Promise<Blob> {
  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 24 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: [...sheet(title, words, false), new Paragraph({ children: [new PageBreak()] }), ...sheet(title, words, true)],
    }],
  });
  return Packer.toBlob(doc);
}
