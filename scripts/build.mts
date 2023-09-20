import { mkdir, rmdir, copyFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob, globSync, globStream, globStreamSync, Glob } from 'glob';
import { rimraf } from 'rimraf';

const rootPath = dirname(join(fileURLToPath(import.meta.url), '..'));

const distPath = join(rootPath, 'dist');
const srcPath = join(rootPath, 'src');

async function cleanDistDirectory() {
  await rimraf(distPath);
}

async function createDistDirectory() {
  await mkdir(distPath);
}

async function copyTypings() {
  const g = new Glob('typings/*.d.ts', { withFileTypes: true });
  for await (const file of g) {
    await copyFile(file.fullpath(), join(distPath, file.name));
  }
}

(async () => {
  await cleanDistDirectory();
  await createDistDirectory();
  await copyTypings();
})();

const servicesGlob = 'src/services/**/*.ts';

const compileCmd = `tsc src/services/**/*.ts --target es5 --outfile dist/typescriptServices.js`;
