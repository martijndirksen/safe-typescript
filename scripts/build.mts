import { mkdir, rmdir, copyFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob, globSync, globStream, globStreamSync, Glob } from 'glob';
import { rimraf } from 'rimraf';
import ts from 'typescript';

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
  await buildProgram(['sample.ts'], {
    target: ts.ScriptTarget.ES5,
    outFile: 'dist/sample.js',
  });
})();

const servicesGlob = 'src/services/**/*.ts';

//const compileCmd = `tsc src/services/**/*.ts --target es5 --outfile dist/typescriptServices.js`;

// There are quite some files which need to be ignored, so we won't try to put this all in a single glob
// but rather just let the glob match them and then skip them in the build.
const ignoredCompilerSources = [
  'src/compiler/io.ts',
  'src/compiler/nodeTypes.ts',
  'src/compiler/optionsParser.ts',
  'src/compiler/tsc.ts',
  'src/compiler/walkContext.ts',
  'src/compiler/core/cancellationToken.ts',
  'src/compiler/core/cancellationTokenSource.ts',
  'src/compiler/core/iterator.ts',
  'src/compiler/symbols/**/*.ts',
  'src/compiler/syntax/emitter.ts',
  'src/compiler/syntax/prettyPrinter.ts',
  'src/compiler/syntax/syntaxGenerator.ts',
  'src/compiler/typecheck/rt.ts',
  'src/compiler/typecheck/rtapi.ts',
  'src/compiler/typecheck/rtnew.ts',
  'src/compiler/typecheck/rtnewapi.ts',
  'src/compiler/typecheck/rtweak.ts',
  'src/compiler/typecheck/types.ts',
];

const compilerGlob = `src/compiler/**/*.ts`;
const tscGlob = 'src/compiler/{io,optionsParser,tsc}.ts';

async function buildProgram(files: string[], options: ts.CompilerOptions) {
  let program = ts.createProgram(files, options);
  let emitResult = program.emit();

  let allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  allDiagnostics.forEach((diagnostic) => {
    if (diagnostic.file) {
      let { line, character } = ts.getLineAndCharacterOfPosition(
        diagnostic.file,
        diagnostic.start!
      );
      let message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      );
      console.log(
        `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
      );
    } else {
      console.log(
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      );
    }
  });

  let exitCode = emitResult.emitSkipped ? 1 : 0;
  console.log(`Process exiting with code '${exitCode}'.`);
  process.exit(exitCode);
}
