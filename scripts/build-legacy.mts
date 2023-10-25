import { mkdir, copyFile } from 'node:fs/promises';
import { EOL } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Glob } from 'glob';
import { rimraf } from 'rimraf';
import ts from 'typescript';
import { concatFiles } from './util/file.mjs';

const rootPath = dirname(join(fileURLToPath(import.meta.url), '..'));
const isWithSourcemaps = false;

const distPath = join(rootPath, 'dist');

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
const compilerGlob = `src/legacy/compiler/**/*.ts`;
const servicesGlob = 'src/legacy/services/**/*.ts';
const tscGlob = 'src/legacy/compiler/{io,optionsParser,tsc}.ts';
const rtGlob = 'src/legacy/runtime/rt.ts';

// There are quite some files which need to be ignored, so we won't try to put this all in a single glob
// but rather just let the glob match them and then skip them in the build.
const ignoredCompilerSources = [
  'src/legacy/compiler/io.ts',
  'src/legacy/compiler/nodeTypes.ts',
  'src/legacy/compiler/optionsParser.ts',
  'src/legacy/compiler/tsc.ts',
  'src/legacy/compiler/walkContext.ts',
  'src/legacy/compiler/core/cancellationToken.ts',
  'src/legacy/compiler/core/cancellationTokenSource.ts',
  'src/legacy/compiler/core/iterator.ts',
  'src/legacy/compiler/symbols/**/*.ts',
  'src/legacy/compiler/syntax/emitter.ts',
  'src/legacy/compiler/syntax/prettyPrinter.ts',
  'src/legacy/compiler/syntax/syntaxGenerator.ts',
  'src/legacy/compiler/typecheck/rt.ts',
  'src/legacy/compiler/typecheck/rtapi.ts',
  'src/legacy/compiler/typecheck/rtnew.ts',
  'src/legacy/compiler/typecheck/rtnewapi.ts',
  'src/legacy/compiler/typecheck/rtweak.ts',
  'src/legacy/compiler/typecheck/types.ts',
];

const ignoredCompilerTscSources = [
  'src/legacy/compiler/nodeTypes.ts',
  'src/legacy/compiler/walkContext.ts',
  'src/legacy/compiler/core/cancellationToken.ts',
  'src/legacy/compiler/core/cancellationTokenSource.ts',
  'src/legacy/compiler/core/iterator.ts',
  'src/legacy/compiler/symbols/**/*.ts',
  'src/legacy/compiler/syntax/emitter.ts',
  'src/legacy/compiler/syntax/prettyPrinter.ts',
  'src/legacy/compiler/syntax/syntaxGenerator.ts',
  'src/legacy/compiler/typecheck/rt.ts',
  'src/legacy/compiler/typecheck/rtapi.ts',
  'src/legacy/compiler/typecheck/rtnew.ts',
  'src/legacy/compiler/typecheck/rtnewapi.ts',
  'src/legacy/compiler/typecheck/rtweak.ts',
  'src/legacy/compiler/typecheck/types.ts',
];

const ignoredSafeTsSources = [
  'src/legacy/compiler/nodeTypes.ts',
  'src/legacy/compiler/walkContext.ts',
  'src/legacy/compiler/core/cancellationToken.ts',
  'src/legacy/compiler/core/cancellationTokenSource.ts',
  'src/legacy/compiler/core/iterator.ts',
  'src/legacy/compiler/symbols/**/*.ts',
];

const baseCompilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES5,
  module: ts.ModuleKind.CommonJS,
  noImplicitAny: true,
  preserveConstEnums: true,
  removeComments: true,
  sourceMap: isWithSourcemaps,
};

(async () => {
  await cleanDistDirectory();
  await createDistDirectory();
  await copyTypings();
  await buildProgram({
    globPattern: [compilerGlob],
    ignore: ignoredCompilerSources,
    compilerOptions: {
      ...baseCompilerOptions,
      outFile: join(distPath, 'typescript.js'),
    },
  });
  addLicenseInfoToFile(join(distPath, 'typescript.js'));
  await buildProgram({
    globPattern: [compilerGlob, tscGlob],
    ignore: ignoredCompilerTscSources,
    compilerOptions: {
      ...baseCompilerOptions,
      outFile: join(distPath, 'tsc.js'),
    },
  });
  addLicenseInfoToFile(join(distPath, 'tsc.js'));
  await buildProgram({
    globPattern: [compilerGlob, servicesGlob],
    ignore: ignoredCompilerSources,
    compilerOptions: {
      ...baseCompilerOptions,
      outFile: join(distPath, 'typescriptServices.js'),
    },
  });
  addLicenseInfoToFile(join(distPath, 'typescriptServices.js'));
  await buildProgram({
    globPattern: [rtGlob],
    compilerOptions: {
      ...baseCompilerOptions,
      declaration: true,
      outDir: join(distPath, 'lib'),
    },
  });
  await buildProgram({
    globPattern: [compilerGlob],
    ignore: ignoredSafeTsSources,
    compilerOptions: {
      ...baseCompilerOptions,
      outFile: join(distPath, 'tsc.safe.js'),
    },
  });
  concatFiles(
    join(distPath, 'tsc.safe.js'),
    join(rootPath, 'CopyrightNotice.txt'),
    join(rootPath, 'ThirdPartyNoticeText.txt'),
    join(distPath, 'lib', 'rt.js'),
    join(distPath, 'tsc.safe.js')
  );
})();

async function buildProgram({
  globPattern,
  ignore,
  compilerOptions,
}: {
  globPattern: string | string[];
  ignore?: string[];
  compilerOptions: ts.CompilerOptions;
}) {
  const glob = new Glob(globPattern, { withFileTypes: false, ignore });
  const files = await glob.walk();

  const program = ts.createProgram(files, compilerOptions);
  const emitResult = program.emit();

  const allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  allDiagnostics.forEach((diagnostic) => {
    if (diagnostic.file) {
      const { line, character } = ts.getLineAndCharacterOfPosition(
        diagnostic.file,
        diagnostic.start!
      );
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        EOL
      );
      console.log(
        `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
      );
    } else {
      console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, EOL));
    }
  });

  if (emitResult.emitSkipped) {
    throw new Error('Build failed');
  }
}

async function addLicenseInfoToFile(path: string) {
  return concatFiles(
    path,
    join(rootPath, 'CopyrightNotice.txt'),
    join(rootPath, 'ThirdPartyNoticeText.txt'),
    path
  );
}
