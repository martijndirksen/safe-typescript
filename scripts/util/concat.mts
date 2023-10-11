import { readFile, writeFile } from 'node:fs/promises';
import { EOL } from 'node:os';

export async function concatFiles(outPath: string, ...paths: string[]) {
  const files = await Promise.all(
    paths.map((path) => readFile(path, { encoding: 'utf8' }))
  );

  files.join(EOL);

  await writeFile(outPath, files);
}
