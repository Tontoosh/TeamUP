import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const extensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.sql']);
const ignored = new Set([
  'node_modules',
  'dist',
  'data',
  '.git',
  'test-results',
  'playwright-report',
]);
const files = [];
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await visit(path);
    else if (extensions.has(extname(path))) {
      const source = await readFile(path, 'utf8');
      files.push({ path, lines: source.split('\n').length - Number(source.endsWith('\n')) });
    }
  }
}
await visit('.');
const failures = files.filter(file => file.lines > 300);
for (const file of failures) console.error(`${file.path}: ${file.lines} lines (maximum: 300)`);
const largest = files.sort((a, b) => b.lines - a.lines)[0];
console.log(
  `${files.length} code files checked. Largest: ${largest.path} (${largest.lines} lines).`
);
if (failures.length) process.exitCode = 1;
