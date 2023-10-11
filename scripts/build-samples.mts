import { Glob } from 'glob';
import { exec } from 'node:child_process';

const samplesGlob = `samples/**/!(*.spec).ts`;

(async () => {
  await buildSamples(samplesGlob);
})();

async function buildSamples(globPattern: string | string[]) {
  const glob = new Glob(globPattern, { withFileTypes: false });
  const files = await glob.walk();

  for (const file of files) {
    exec(`node ./dist/tsc.safe.js --safe ${file}`, (err, stdout, stderr) => {
      if (err) {
        console.log(err);
        return;
      }
      console.log(stdout);
      console.log(stderr);
    });
  }
}
