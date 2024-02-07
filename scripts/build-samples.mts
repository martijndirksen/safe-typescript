import { promisify } from 'node:util';
import childProcess from 'node:child_process';
import { Glob } from 'glob';
import { prependFileWithContent } from './util/file.mjs';
import { rimraf } from 'rimraf';

const samplesGlob = `samples/**/*.ts`;
const execPromise = promisify(childProcess.exec);

(async () => {
  await buildSamples(samplesGlob);
})();

async function execCommand(command: string) {
  const { stdout, stderr } = await execPromise(command);
  console.log('stdout:', stdout);
  console.error('stderr:', stderr);
}

async function buildSamples(globPattern: string | string[]) {
  const glob = new Glob(globPattern, {
    withFileTypes: false,
    ignore: ['**/*.spec.ts', '**/util/**/*'],
  });
  const files = await glob.walk();

  await rimraf('samples/**/*.js', { glob: true });

  for (const file of files) {
    await execCommand(`node ./dist/tsc.js --safe ${file} --module commonjs`);
    await prependFileWithContent(
      file.replace('.ts', '.js'),
      `var RT = require('../dist/lib/rt.js').RT;`
    );
  }
}
