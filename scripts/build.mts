import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { EOL } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Glob } from 'glob';
import { rimraf } from 'rimraf';
import ts from 'typescript';

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
const compilerGlob = `src/compiler/**/*.ts`;
const servicesGlob = 'src/services/**/*.ts';
const tscGlob = 'src/compiler/{io,optionsParser,tsc}.ts';
const rtGlob = 'src/runtime/rt.ts';

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

const ignoredCompilerTscSources = [
  'src/compiler/nodeTypes.ts',
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

const ignoredSafeTsSources = [
  'src/compiler/nodeTypes.ts',
  'src/compiler/walkContext.ts',
  'src/compiler/core/cancellationToken.ts',
  'src/compiler/core/cancellationTokenSource.ts',
  'src/compiler/core/iterator.ts',
  'src/compiler/symbols/**/*.ts',
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
  // await cleanDistDirectory();
  // await createDistDirectory();
  // await copyTypings();
  // await buildProgram({
  //   globPattern: [compilerGlob],
  //   ignore: ignoredCompilerSources,
  //   compilerOptions: {
  //     ...baseCompilerOptions,
  //     outFile: join(distPath, 'typescript.js'),
  //   },
  // });
  // addLicenseInfoToFile(join(distPath, 'typescript.js'));
  // await buildProgram({
  //   globPattern: [compilerGlob, tscGlob],
  //   ignore: ignoredCompilerTscSources,
  //   compilerOptions: {
  //     ...baseCompilerOptions,
  //     outFile: join(distPath, 'tsc.js'),
  //   },
  // });
  // addLicenseInfoToFile(join(distPath, 'tsc.js'));
  // await buildProgram({
  //   globPattern: [compilerGlob, servicesGlob],
  //   ignore: ignoredCompilerSources,
  //   compilerOptions: {
  //     ...baseCompilerOptions,
  //     outFile: join(distPath, 'typescriptServices.js'),
  //   },
  // });
  // addLicenseInfoToFile(join(distPath, 'typescriptServices.js'));
  // await buildProgram({
  //   globPattern: [compilerGlob],
  //   ignore: ignoredSafeTsSources,
  //   compilerOptions: {
  //     ...baseCompilerOptions,
  //     outFile: join(distPath, 'tsc.safe.js'),
  //   },
  // });
  // addLicenseInfoToFile(join(distPath, 'tsc.safe.js'));
  await buildProgram({
    globPattern: [rtGlob],
    compilerOptions: {
      ...baseCompilerOptions,
      outDir: join(distPath, 'lib'),
      //outFile: join(distPath, 'lib', 'rt.js'),
    },
  });
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

  let program = ts.createProgram(files, compilerOptions);
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
  const copyrightNotice = await readFile(
    join(rootPath, 'CopyrightNotice.txt'),
    {
      encoding: 'utf8',
    }
  );
  const thirdParty = await readFile(
    join(rootPath, 'ThirdPartyNoticeText.txt'),
    {
      encoding: 'utf8',
    }
  );

  const file = await readFile(path, { encoding: 'utf8' });

  await writeFile(path, copyrightNotice + EOL + thirdParty + EOL + file);
}
