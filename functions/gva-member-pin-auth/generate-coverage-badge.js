import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const summaryPath = path.join(__dirname, 'coverage', 'coverage-summary.json');
const badgePath = path.join(__dirname, 'coverage-badge.svg');

if (!fs.existsSync(summaryPath)) {
  console.error('❌ coverage-summary.json not found. Run coverage first.');
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

// Filter out 'total' and sort file entries by name
const entries = Object.entries(summary)
  .filter(([k]) => k !== 'total')
  .sort(([a], [b]) => a.localeCompare(b));

function getReadableColor(pct) {
  if (pct >= 90) return '#c8e6c9'; // light green
  if (pct >= 75) return '#fff9c4'; // light yellow
  if (pct >= 50) return '#ffe0b2'; // light orange
  return '#ffcdd2'; // light red
}

// Table layout
const rowHeight = 22;
const columnWidth = [240, 60, 70, 60, 70]; // File, Lines, Branches, Funcs, Stmts
const tableHeader = ['File', 'Lines', 'Branches', 'Funcs', 'Stmts'];
const tableWidth = columnWidth.reduce((a, b) => a + b, 0);
const tableHeight = (entries.length + 1) * rowHeight;

// Begin SVG
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tableWidth}" height="${tableHeight}">\n`;
svg += `<style>
  text { font-family: Verdana, monospace; font-size: 11px; }
</style>`;

// Header row
svg += `<g fill="#fff" font-weight="bold">`;
svg += `<rect x="0" y="0" width="${tableWidth}" height="${rowHeight}" fill="#263238"/>`;
let x = 0;
for (let i = 0; i < tableHeader.length; i++) {
  svg += `<text x="${x + 5}" y="15">${tableHeader[i]}</text>`;
  x += columnWidth[i];
}
svg += `</g>`;

// Data rows
entries.forEach(([filename, data], idx) => {
  const y = (idx + 1) * rowHeight;

  // ✅ Keep only /src/... path
  const relPath = filename.replace(/^.*?(\/src\/)/, '/src/');

  const row = [
    relPath,
    `${Math.round(data.lines.pct)}%`,
    `${Math.round(data.branches.pct)}%`,
    `${Math.round(data.functions.pct)}%`,
    `${Math.round(data.statements.pct)}%`,
  ];

  const bgColors = [
    '#e0e0e0', // File name column: light gray
    getReadableColor(data.lines.pct),
    getReadableColor(data.branches.pct),
    getReadableColor(data.functions.pct),
    getReadableColor(data.statements.pct),
  ];

  const textColors = ['#000', '#000', '#000', '#000', '#000'];

  x = 0;
  for (let i = 0; i < row.length; i++) {
    svg += `<g fill="${textColors[i]}">`;
    svg += `<rect x="${x}" y="${y}" width="${columnWidth[i]}" height="${rowHeight}" fill="${bgColors[i]}" />`;
    svg += `<text x="${x + 5}" y="${y + 15}">${row[i]}</text>`;
    svg += `</g>`;
    x += columnWidth[i];
  }
});

svg += `</svg>\n`;

fs.writeFileSync(badgePath, svg);
console.log(`✅ Detailed badge generated at: coverage/badge-detailed.svg`);
