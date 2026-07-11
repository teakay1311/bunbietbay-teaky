import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = 'dist';
const files = [];
const visit = (directory) => readdirSync(directory).forEach((name) => {
  const path = join(directory, name);
  statSync(path).isDirectory() ? visit(path) : /\.(js|css)$/.test(name) && files.push(path);
});

visit(root);
files
  .map((path) => ({ path: relative(root, path), gzip: gzipSync(readFileSync(path)).length }))
  .sort((a, b) => b.gzip - a.gzip)
  .forEach(({ path, gzip }) => console.log(`${(gzip / 1024).toFixed(2)} KB\t${path}`));
