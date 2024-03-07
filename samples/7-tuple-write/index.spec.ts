import { describe, expect, it } from 'vitest';
import { buildSample, runSample } from '../test/utils';

describe('7-tuple-write', () => {
  it('tuple-write', async () => {
    const { success, output } = await buildSample(
      'samples/7-tuple-write/tuple-write.ts'
    );
    expect(success).toBeTruthy();
    expect(output).toBe(
      `var tuple = ['str', 13];
tuple[0] = 'mod';
tuple[1] = tuple[1] * 2;
console.log(tuple[0], tuple[1]);
`
    );

    const { stdout, success: runtimeSuccess } = await runSample(
      'samples/7-tuple-write/tuple-write.js'
    );
    expect(runtimeSuccess).toBeTruthy();
    expect(stdout).toBe('mod 26\n');
  });

  it('tuple-write-err', async () => {
    const { success, stderr } = await buildSample(
      'samples/7-tuple-write/tuple-write-err.ts'
    );
    expect(success).toBeFalsy();
    expect(stderr).toContain(
      `error TS7095: Tuple element assignment expected a type of 'string'; got 'boolean'`
    );
  });

  it('tuple-write-gradual', async () => {
    const { success, output, rawStderr } = await buildSample(
      'samples/7-tuple-write/tuple-write-gradual.ts'
    );
    expect(success).toBeTruthy();
    expect(rawStderr).toContain(
      `warning TS7087: Safe TS: Implicit conversion from 'any' to 'number'`
    );
    expect(output).toBe(
      `var tuple = ['str', 13];
var gradual = 44;
RT.writeField(tuple, RT.Tuple({
    "0": RT.Str,
    "1": RT.Num }), 1, RT.checkAndTag(gradual, RT.Any, RT.Num), RT.Any);
console.log(tuple[0], tuple[1]);
`
    );

    const { stdout: runtimeStdout, success: runtimeSuccess } = await runSample(
      'samples/7-tuple-write/tuple-write-gradual.js'
    );
    expect(runtimeSuccess).toBeTruthy();
    expect(runtimeStdout).toBe('str 44\n');
  });

  it('tuple-write-dynamic-index', async () => {
    const { success, output } = await buildSample(
      'samples/7-tuple-write/tuple-write-dynamic-index.ts'
    );
    expect(success).toBeTruthy();
    expect(output).toBe(
      `var tuple = [2, 8, 31, 2, 2, 8, 78];
var i = 8;
RT.writeField(tuple, RT.Tuple({
    "0": RT.Num,
    "1": RT.Num }, 1), i, 19, RT.Num);
`
    );

    const { stderr: runtimeStderr, success: runtimeSuccess } = await runSample(
      'samples/7-tuple-write/tuple-write-dynamic-index.js'
    );
    expect(runtimeSuccess).toBeFalsy();
    expect(runtimeStderr).toContain(
      'Error: writeField writing to unknown tuple field'
    );
  });
});
