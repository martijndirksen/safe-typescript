import fs from 'node:fs';
import { Glob } from 'glob';
import path from 'node:path';

const sourceFiles = new Glob('src/typings/*.d.ts', {
  withFileTypes: false,
});

for (const file of sourceFiles) {
  const newDir = file.replace(path.join('src', 'typings'), 'dist');
  console.log(`Copying ${file} to ${newDir}`);
  fs.copyFileSync(file, newDir);
}
