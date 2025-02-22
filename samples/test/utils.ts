import { promisify } from 'node:util';
import { EOL } from 'node:os';
import childProcess from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

const execPromise = promisify(childProcess.exec);

async function prependFileWithContent(filePath: string, content: string) {
  const file = await readFile(filePath, { encoding: 'utf8' });
  const newFile = content + EOL + file;
  await writeFile(filePath, newFile);
}

// code output by Safe TypeScript always includes the lines below; we don't need to test for that
const ignoredOutput = `
var RT = require('../../dist/lib/rt.js').RT;
RT.registerType(RT.InterfaceRepr("Object", {
    "toString": RT.ArrowType([], RT.Str, undefined),
    "toLocaleString": RT.ArrowType([], RT.Str, undefined),
    "valueOf": RT.ArrowType([], RT.InterfaceType("Object"), undefined),
    "hasOwnProperty": RT.ArrowType([RT.Str], RT.Bool, undefined),
    "isPrototypeOf": RT.ArrowType([RT.InterfaceType("Object")], RT.Bool, undefined),
    "propertyIsEnumerable": RT.ArrowType([RT.Str], RT.Bool, undefined) }, {}, []));
RT.registerType(RT.InterfaceRepr("String", {
    "toString": RT.ArrowType([], RT.Str, undefined),
    "charAt": RT.ArrowType([RT.Num], RT.Str, undefined),
    "charCodeAt": RT.ArrowType([RT.Num], RT.Num, undefined),
    "concat": RT.ArrowType([RT.ArrayType(RT.Str)], RT.Str, {
        "type": RT.ArrayType(RT.Str),
        "optional": true }, 0),
    "indexOf": RT.ArrowType([RT.Str, RT.Num], RT.Num, undefined, 1),
    "lastIndexOf": RT.ArrowType([RT.Str, RT.Num], RT.Num, undefined, 1),
    "localeCompare": RT.ArrowType([RT.Str], RT.Num, undefined),
    "localeCompare": RT.ArrowType([RT.Str, RT.ArrayType(RT.Str), RT.JustType("CollatorOptions")], RT.Num, undefined, 2),
    "localeCompare": RT.ArrowType([RT.Str, RT.Str, RT.JustType("CollatorOptions")], RT.Num, undefined, 2),
    "match": RT.ArrowType([RT.Str], RT.ArrayType(RT.Str), undefined),
    "match": RT.ArrowType([RT.InterfaceType("RegExp")], RT.ArrayType(RT.Str), undefined),
    "replace": RT.ArrowType([RT.Str, RT.Str], RT.Str, undefined),
    "replace": RT.ArrowType([RT.Str, RT.StructuredType({
        "<call>": RT.ArrowType([RT.Str, RT.ArrayType(RT.Any)], RT.Str, {
            "type": RT.ArrayType(RT.Any),
            "optional": true }, 1) }, {})], RT.Str, undefined),
    "replace": RT.ArrowType([RT.InterfaceType("RegExp"), RT.Str], RT.Str, undefined),
    "replace": RT.ArrowType([RT.InterfaceType("RegExp"), RT.StructuredType({
        "<call>": RT.ArrowType([RT.Str, RT.ArrayType(RT.Any)], RT.Str, {
            "type": RT.ArrayType(RT.Any),
            "optional": true }, 1) }, {})], RT.Str, undefined),
    "search": RT.ArrowType([RT.Str], RT.Num, undefined),
    "search": RT.ArrowType([RT.InterfaceType("RegExp")], RT.Num, undefined),
    "slice": RT.ArrowType([RT.Num, RT.Num], RT.Str, undefined, 1),
    "split": RT.ArrowType([RT.Str, RT.Num], RT.ArrayType(RT.Str), undefined, 1),
    "split": RT.ArrowType([RT.InterfaceType("RegExp"), RT.Num], RT.ArrayType(RT.Str), undefined, 1),
    "substring": RT.ArrowType([RT.Num, RT.Num], RT.Str, undefined, 1),
    "toLowerCase": RT.ArrowType([], RT.Str, undefined),
    "toLocaleLowerCase": RT.ArrowType([], RT.Str, undefined),
    "toUpperCase": RT.ArrowType([], RT.Str, undefined),
    "toLocaleUpperCase": RT.ArrowType([], RT.Str, undefined),
    "trim": RT.ArrowType([], RT.Str, undefined),
    "substr": RT.ArrowType([RT.Num, RT.Num], RT.Str, undefined, 1) }, {
    "<index>": RT.IndexMapType(RT.Num, RT.Str),
    "length": RT.Num }, []));
RT.registerType(RT.InterfaceRepr("Number", {
    "toString": RT.ArrowType([RT.Num], RT.Str, undefined, 0),
    "toFixed": RT.ArrowType([RT.Num], RT.Str, undefined, 0),
    "toExponential": RT.ArrowType([RT.Num], RT.Str, undefined, 0),
    "toPrecision": RT.ArrowType([RT.Num], RT.Str, undefined, 0),
    "toLocaleString": RT.ArrowType([RT.ArrayType(RT.Str), RT.JustType("NumberFormatOptions")], RT.Str, undefined, 1),
    "toLocaleString": RT.ArrowType([RT.Str, RT.JustType("NumberFormatOptions")], RT.Str, undefined, 1) }, {}, []));
RT.registerType(RT.InterfaceRepr("Boolean", {}, {}, []));
RT.registerType(RT.InterfaceRepr("Error", {}, {
    "name": RT.Str,
    "message": RT.Str }, []));
RT.registerType(RT.InterfaceRepr("TypeError", {}, {
    "name": RT.Str,
    "message": RT.Str }, []));
RT.registerType(RT.InterfaceRepr("RegExp", {
    "exec": RT.ArrowType([RT.Str], RT.InterfaceType("RegExpExecArray"), undefined),
    "test": RT.ArrowType([RT.Str], RT.Bool, undefined),
    "compile": RT.ArrowType([], RT.InterfaceType("RegExp"), undefined) }, {
    "source": RT.Str,
    "global": RT.Bool,
    "ignoreCase": RT.Bool,
    "multiline": RT.Bool,
    "lastIndex": RT.Num }, []));`;

const ignoredLineCount = ignoredOutput.split('\n').length;

const ignoredStdErrPatterns = [
  'DeprecationWarning: Buffer() is deprecated',
  ': warning ',
  `(Use \`node --trace-deprecation ...\` to show where the warning was created)`,
];

const eol = '\n';

function normalizeLineEndings(input: string): string {
  return input.replace(/\r\n/g, eol);
}

function stripWarnings(stderr: string): string {
  const lines = normalizeLineEndings(stderr).split(eol);
  return lines
    .filter((x) => !ignoredStdErrPatterns.find((y) => x.includes(y)))
    .join(eol);
}

function stripOutput(rawOutput: string) {
  return normalizeLineEndings(rawOutput)
    .split(eol)
    .slice(ignoredLineCount - 1)
    .join(eol);
}

export async function buildSample(file: string): Promise<{
  success: boolean;
  stderr: string;
  rawStderr: string;
  output: string;
}> {
  const result = await execPromise(
    `node ./dist/tsc.js --safe ${file} --module commonjs`
  );
  const outputFile = file.replace('.ts', '.js');

  const stderr = stripWarnings(result.stderr);

  if (process.env.LOG_STDOUT) {
    console.log(result.stderr);
    console.log(result.stdout);
  }

  const success = !stderr;

  let output: string | undefined = undefined;

  if (success) {
    await prependFileWithContent(
      outputFile,
      `var RT = require('../../dist/lib/rt.js').RT;`
    );

    const rawOutput = await readFile(outputFile, { encoding: 'utf-8' });
    output = stripOutput(rawOutput);
  }

  return { success, stderr, rawStderr: result.stderr, output };
}

export async function runSample(
  file: string
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  try {
    const result = await execPromise(`node ${file}`);

    const stderr = stripWarnings(result.stderr);
    const success = !stderr;

    return { success, stdout: result.stdout, stderr };
  } catch (err) {
    return { success: false, stdout: '', stderr: (err as Error).message };
  }
}
