// This file contains the build logic for the public repo
const {
  existsSync,
  appendFileSync,
  readFileSync,
  renameSync,
  unlinkSync,
} = require('fs');
const { join, resolve, dirname } = require('path');
const jake = require('jake');
const { fail, file, complete, directory, desc, task } = require('jake');
const { exec } = require('node:child_process');

// Variables
const compilerDirectory = 'src/compiler/';
const servicesDirectory = 'src/services/';
const libraryDirectory = 'typings/';

const builtLocalDirectory = 'built/local/';
const LKGDirectory = 'bin/';

const copyright = 'CopyrightNotice.txt';
const thirdParty = 'ThirdPartyNoticeText.txt';
const compilerSources = [
  'ast.ts',
  'astHelpers.ts',
  'astWalker.ts',
  'base64.ts',
  'bloomFilter.ts',
  'declarationEmitter.ts',
  'diagnostics.ts',
  'document.ts',
  'emitter.ts',
  'enumerator.ts',
  'flags.ts',
  'hashTable.ts',
  'identifierWalker.ts',
  'pathUtils.ts',
  'precompile.ts',
  'process.ts',
  'references.ts',
  'referenceResolution.ts',
  'referenceResolver.ts',
  'settings.ts',
  'sourceMapping.ts',
  'syntaxTreeToAstVisitor.ts',
  'types.ts',
  'core/arrayUtilities.ts',
  'core/bitMatrix.ts',
  'core/bitVector.ts',
  'core/constants.ts',
  'core/debug.ts',
  'core/diagnosticCore.ts',
  'core/diagnosticCategory.ts',
  'core/diagnosticInfo.ts',
  'core/environment.ts',
  'core/errors.ts',
  'core/hash.ts',
  'core/hashTable.ts',
  'core/integerUtilities.ts',
  'core/lineAndCharacter.ts',
  'core/lineMap.ts',
  'core/linePosition.ts',
  'core/mathPrototype.ts',
  'core/references.ts',
  'core/require.ts',
  'core/stringTable.ts',
  'core/stringUtilities.ts',
  'core/timer.ts',
  'resources/diagnosticCode.generated.ts',
  'resources/diagnosticInformationMap.generated.ts',
  'resources/references.ts',
  'syntax/characterInfo.ts',
  'syntax/constants.ts',
  'syntax/depthLimitedWalker.ts',
  'syntax/formattingOptions.ts',
  'syntax/indentation.ts',
  'syntax/languageVersion.ts',
  'syntax/parseOptions.ts',
  'syntax/parser.ts',
  'syntax/positionedElement.ts',
  'syntax/positionTrackingWalker.ts',
  'syntax/references.ts',
  'syntax/scanner.ts',
  'syntax/scannerUtilities.generated.ts',
  'syntax/separatedSyntaxList.ts',
  'syntax/slidingWindow.ts',
  'syntax/strings.ts',
  'syntax/syntax.ts',
  'syntax/syntaxDedenter.ts',
  'syntax/syntaxElement.ts',
  'syntax/syntaxFactory.generated.ts',
  'syntax/syntaxFacts.ts',
  'syntax/syntaxFacts2.ts',
  'syntax/syntaxIndenter.ts',
  'syntax/syntaxInformationMap.ts',
  'syntax/syntaxIndenter.ts',
  'syntax/syntaxKind.ts',
  'syntax/syntaxList.ts',
  'syntax/syntaxNode.ts',
  'syntax/syntaxNodeInvariantsChecker.ts',
  'syntax/syntaxNodeOrToken.ts',
  'syntax/syntaxNodes.generated.ts',
  'syntax/syntaxRewriter.generated.ts',
  'syntax/syntaxToken.generated.ts',
  'syntax/syntaxToken.ts',
  'syntax/syntaxTokenReplacer.ts',
  'syntax/syntaxTree.ts',
  'syntax/syntaxTrivia.ts',
  'syntax/syntaxTriviaList.ts',
  'syntax/syntaxUtilities.ts',
  'syntax/syntaxVisitor.generated.ts',
  'syntax/syntaxWalker.generated.ts',
  'syntax/unicode.ts',
  'text/characterCodes.ts',
  'text/lineMap.ts',
  'text/references.ts',
  'text/scriptSnapshot.ts',
  'text/text.ts',
  'text/textChangeRange.ts',
  'text/textFactory.ts',
  'text/textLine.ts',
  'text/textSpan.ts',
  'text/textUtilities.ts',
  'typecheck/pullDeclCollection.ts',
  'typecheck/pullDecls.ts',
  'typecheck/pullFlags.ts',
  'typecheck/pullHelpers.ts',
  'typecheck/pullSemanticInfo.ts',
  'typecheck/pullSymbolBinder.ts',
  'typecheck/pullSymbols.ts',
  'typecheck/pullTypeResolution.ts',
  'typecheck/pullTypeResolutionContext.ts',
  'typecheck/pullTypeInstantiation.ts',
  'typecheck/sound/tcUtil.ts',
  'typecheck/sound/types.ts',
  'typecheck/sound/tcEnv.ts',
  'typecheck/sound/treln.ts',
  'typecheck/sound/translateTypes.ts',
  'typecheck/sound/tc.ts',
  'typescript.ts',
].map(function (f) {
  return join(compilerDirectory, f);
});

const tscSources = ['io.ts', 'optionsParser.ts', 'tsc.ts'].map(function (f) {
  return join(compilerDirectory, f);
});

const servicesSources = [
  'braceMatcher.ts',
  'breakpoints.ts',
  'classifier.ts',
  'compilerState.ts',
  'completionHelpers.ts',
  'completionSession.ts',
  'coreServices.ts',
  'diagnosticServices.ts',
  'es5compat.ts',
  'findReferenceHelpers.ts',
  'getScriptLexicalStructureWalker.ts',
  'indenter.ts',
  'keywordCompletions.ts',
  'languageService.ts',
  'outliningElementsCollector.ts',
  'pullLanguageService.ts',
  'shims.ts',
  'signatureInfoHelpers.ts',
  'typescriptServices.ts',
  'formatting/formatter.ts',
  'formatting/formatting.ts',
  'formatting/formattingContext.ts',
  'formatting/formattingManager.ts',
  'formatting/formattingRequestKind.ts',
  'formatting/indentationNodeContext.ts',
  'formatting/indentationNodeContextPool.ts',
  'formatting/indentationTrackingWalker.ts',
  'formatting/multipleTokenIndenter.ts',
  'formatting/rule.ts',
  'formatting/ruleAction.ts',
  'formatting/ruleDescriptor.ts',
  'formatting/ruleFlag.ts',
  'formatting/ruleOperation.ts',
  'formatting/ruleOperationContext.ts',
  'formatting/rules.ts',
  'formatting/rulesMap.ts',
  'formatting/rulesProvider.ts',
  'formatting/singleTokenIndenter.ts',
  'formatting/snapshotPoint.ts',
  'formatting/textEditInfo.ts',
  'formatting/textSnapshot.ts',
  'formatting/textSnapshotLine.ts',
  'formatting/tokenRange.ts',
  'formatting/tokenSpan.ts',
].map(function (f) {
  return join(servicesDirectory, f);
});

const libraryFiles = ['lib.d.ts', 'jquery.d.ts', 'winjs.d.ts', 'winrt.d.ts'];

const librarySources = libraryFiles.map(function (f) {
  return join(libraryDirectory, f);
});

const libraryTargets = libraryFiles.map(function (f) {
  return join(builtLocalDirectory, f);
});

function createChildProcess(cmd, completeFn, errorFn) {
  console.log(cmd);
  const childProcess = exec(cmd);

  let isFailureHandled = false;
  const handleFail = (err) => {
    if (isFailureHandled) return;
    isFailureHandled = true;
    console.log(err);
    errorFn(err);
    fail();
  };

  childProcess.on('exit', (code) => {
    if (code !== 0) {
      handleFail(`Child process exited with code ${code}`);
    } else {
      completeFn();
      complete();
    }
  });

  childProcess.on('error', (err) => {
    handleFail(err);
  });
}

// Prepends the contents of prefixFile to destinationFile
function prependFile(prefixFile, destinationFile) {
  if (!existsSync(prefixFile)) {
    fail(prefixFile + ' does not exist!');
  }
  if (!existsSync(destinationFile)) {
    fail(destinationFile + ' failed to be created!');
  }
  const temp = 'temptemp';
  jake.cpR(prefixFile, temp);
  appendFileSync(temp, readFileSync(destinationFile));
  renameSync(temp, destinationFile);
}

let useDebugMode = false;

function appendFile(f, ftail) {
  const cmd = 'cat ' + ftail + ' >> ' + f;
  createChildProcess(
    cmd,
    () => {},
    () => {
      console.log('Concatentation of ' + f + ' and ' + ftail + ' unsuccessful');
    }
  );
}

/* Compiles a file from a list of sources
 * @param outFile: the target file name
 * @param sources: an array of the names of the source files
 * @param prereqs: prerequisite tasks to compiling the file
 * @param prefixes: a list of files to prepend to the target file
 * @param suffixes: a list of files to append to the target file
 * @param useBuiltCompiler: true to use the built compiler, false to use the LKG
 */
function compileFile(
  outFile,
  sources,
  prereqs,
  prefixes,
  suffixes,
  useBuiltCompiler
) {
  file(
    outFile,
    prereqs,
    function () {
      const dir = useBuiltCompiler ? builtLocalDirectory : LKGDirectory;
      let cmd =
        (process.env.host || process.env.TYPESCRIPT_HOST || 'node') +
        ' ' +
        dir +
        'tsc.js -removeComments -propagateEnumConstants -t ES5 -noImplicitAny --module commonjs ' +
        sources.join(' ') +
        ' -out ' +
        outFile;
      if (useDebugMode) {
        cmd = cmd + ' -sourcemap -mapRoot file:///' + resolve(dirname(outFile));
      }

      createChildProcess(
        cmd,
        () => {
          if (!useDebugMode && prefixes && existsSync(outFile)) {
            for (const i in prefixes) {
              prependFile(prefixes[i], outFile);
            }
          }
          if (!useDebugMode && suffixes && existsSync(outFile)) {
            for (const i in suffixes) {
              appendFile(outFile, suffixes[i]);
            }
          }
        },
        () => {
          unlinkSync(outFile);
          console.log('Compilation of ' + outFile + ' unsuccessful');
        }
      );
    },
    { async: true }
  );
}

// Prerequisite task for built directory and library typings
directory(builtLocalDirectory);

for (const i in libraryTargets) {
  (function (i) {
    file(
      libraryTargets[i],
      [builtLocalDirectory, librarySources[i]],
      function () {
        jake.cpR(librarySources[i], builtLocalDirectory);
      }
    );
  })(i);
}

const typescriptFile = join(builtLocalDirectory, 'typescript.js');
compileFile(
  typescriptFile,
  compilerSources,
  [builtLocalDirectory, copyright].concat(compilerSources),
  [copyright]
);

const tscFile = join(builtLocalDirectory, 'tsc.js');
compileFile(
  tscFile,
  compilerSources.concat(tscSources),
  [builtLocalDirectory, copyright].concat(compilerSources).concat(tscSources),
  [copyright]
);

const serviceFile = join(builtLocalDirectory, 'typescriptServices.js');
compileFile(
  serviceFile,
  compilerSources.concat(servicesSources),
  [builtLocalDirectory, thirdParty, copyright]
    .concat(compilerSources)
    .concat(servicesSources),
  [thirdParty, copyright],
  [
    /*servicesTail*/
  ]
);

// Local target to build the compiler and services
desc('Builds the full compiler and services');
task('local', libraryTargets.concat([typescriptFile, tscFile, serviceFile]));

// Local target to build the compiler and services
desc('Emit debug mode files with sourcemaps');
task('setDebugMode', function () {
  useDebugMode = true;
});

// Local target to build the compiler and services
desc('Builds the full compiler and services in debug mode');
task('local-debug', ['setDebugMode', 'local']);

// Set the default task to "local"
task('default', ['local']);


// Syntax Generator
const syntaxGeneratorOutFile = compilerDirectory + 'syntax/SyntaxGenerator.js';
const syntaxGeneratorInFile = compilerDirectory + 'syntax/SyntaxGenerator.ts';
file(compilerDirectory + 'syntax/syntaxKind.ts');
file(compilerDirectory + 'syntax/syntaxFacts.ts');
compileFile(
  syntaxGeneratorOutFile,
  [syntaxGeneratorInFile],
  [
    syntaxGeneratorInFile,
    compilerDirectory + 'syntax/syntaxKind.ts',
    compilerDirectory + 'syntax/syntaxFacts.ts',
  ],
  [],
  [],
  /*useBuiltCompiler:*/ false
);

desc('Builds and runs the syntax generator');
task(
  'run-syntax-generator',
  [syntaxGeneratorOutFile],
  function () {
    const host = process.env.host || process.env.TYPESCRIPT_HOST || 'node';
    const cmd = host + ' ' + syntaxGeneratorOutFile;
    createChildProcess(cmd);
  },
  { async: true }
);
