import { describe, expect, it } from 'vitest';
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
var RT = require('../dist/lib/rt.js').RT;
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

async function buildSample(
  file: string
): Promise<{ success: boolean; stderr: string; output: string }> {
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
      `var RT = require('../dist/lib/rt.js').RT;`
    );

    const rawOutput = await readFile(outputFile, { encoding: 'utf-8' });
    output = stripOutput(rawOutput);
  }

  return { success, stderr, output };
}

async function runSample(
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

describe('Safe TypeScript', () => {
  it('add', async () => {
    const { success, output } = await buildSample('samples/add.ts');
    expect(success).toBeTruthy();
    expect(output).toBe(
      `function add(a, b) {
    return a + b;
}
`
    );
  });

  it('add-err', async () => {
    const { success, stderr } = await buildSample('samples/add-err.ts');
    expect(success).toBeFalsy();
    expect(stderr).toContain(
      `error TS2011: Cannot convert 'number' to 'string'.`
    );
  });

  it('tuple-empty-type', async () => {
    const { success, stderr } = await buildSample(
      'samples/tuple-empty-type.ts'
    );
    expect(success).toBeFalsy();
    expect(stderr).toContain(
      `error TS7090: Tuple type must have at least one type element.`
    );
  });

  it('tuple-multiplicity', async () => {
    const { success, output } = await buildSample(
      'samples/tuple-multiplicity.ts'
    );
    expect(success).toBeTruthy();
    expect(output).toBe(
      `var val = RT.checkAndTag([4], RT.Any, RT.Tuple({
    "0": RT.Num }));
var val2 = RT.checkAndTag([4, 8], RT.Any, RT.Tuple({
    "0": RT.Num,
    "1": RT.Num }));
var val3 = RT.checkAndTag([4, 'str', true], RT.Any, RT.Tuple({
    "0": RT.Num,
    "1": RT.Str,
    "2": RT.Bool }));
`
    );
  });

  it('tuple-order', async () => {
    const { success, output } = await buildSample('samples/tuple-order.ts');
    expect(success).toBeTruthy();
    expect(output).toBe(
      `var val = RT.checkAndTag(['str', 4], RT.Any, RT.Tuple({
    "0": RT.Num,
    "1": RT.Str }));
`
    );
    const runtimeOutput = await runSample('samples/tuple-order.js');

    expect(runtimeOutput.stderr).toContain(
      'Error: Value is not compatible with target tuple, because it is not a subtype'
    );
  });

  it('tuple-width-mismatch', async () => {
    const { success, output } = await buildSample(
      'samples/tuple-width-mismatch.ts'
    );
    expect(success).toBeTruthy();
    expect(output).toBe(
      `var val = RT.checkAndTag([4], RT.Any, RT.Tuple({
    "0": RT.Num,
    "1": RT.Str }));
`
    );
    const runtimeOutput = await runSample('samples/tuple-width-mismatch.js');

    expect(runtimeOutput.stderr).toContain(
      'Error: Tuple length mismatch detected, source has 1 and target expects 2'
    );
  });

  it('tuple-depth-subtyping', async () => {
    const { success, output, stderr } = await buildSample(
      'samples/tuple-depth-subtyping.ts'
    );
    console.log(stderr);
    expect(success).toBeTruthy();
    expect(output).toBe(
      `RT.registerType(RT.InterfaceRepr("B", {
    "foo": RT.ArrowType([], RT.Void, undefined) }, {
    "bar": RT.Str }, [], false));
RT.registerType(RT.InterfaceRepr("A", {
    "baz": RT.ArrowType([], RT.Void, undefined),
    "foo": RT.ArrowType([], RT.Void, undefined) }, {
    "bar": RT.Str }, ["B"], false));

var a = { foo: function () {
    }, bar: 'success', baz: function () {
    } };

function parse(entities) {
    return RT.checkAndTag(RT.readField(RT.readField(entities, RT.InstanceType("tuple"), 0), RT.Any, "bar"), RT.Any, RT.Str);
}

console.log(parse(RT.checkAndTag([
    RT.shallowTag(a, RT.InterfaceType("A"))
], RT.Any, RT.InstanceType("tuple"))));
`
    );
    const runtimeOutput = await runSample('samples/tuple-depth-subtyping.js');

    console.log(runtimeOutput.stderr);
    expect(runtimeOutput.stdout).toContain('success');
  });
});
