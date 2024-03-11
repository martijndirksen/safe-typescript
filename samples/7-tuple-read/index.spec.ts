import { describe, expect, it } from 'vitest';
import { buildSample, runSample } from '../test/utils';

describe('7-tuple-read', () => {
  it('tuple-read', async () => {
    const { success, output } = await buildSample(
      'samples/7-tuple-read/tuple-read.ts'
    );
    expect(success).toBeTruthy();
    expect(output).toBe(
      `var tuple = ['str', 13];
var a = tuple[0];
var b = tuple[1];
`
    );
  });

  it('tuple-read-dynamic-index', async () => {
    const { success, output, stderr } = await buildSample(
      'samples/7-tuple-read/tuple-read-dynamic-index.ts'
    );
    expect(success).toBeTruthy();
    console.log(stderr);
    expect(output).toBe(
      `var tuple = [false, true, 2, 'str'];

function access(index) {
    return RT.readField(tuple, RT.Tuple({
        "0": RT.Bool,
        "1": RT.Bool,
        "2": RT.Num,
        "3": RT.Str }), index);
}

var bool = RT.checkAndTag(access(0) && access(1), RT.Any, RT.Bool);
var isBoolean = typeof bool === 'boolean';
var num = RT.checkAndTag(access(2), RT.Any, RT.Num);
var str = RT.checkAndTag(access(3), RT.Any, RT.Str);

console.log(isBoolean, num, str);
`
    );

    const { stdout: runtimeStdout, success: runtimeSuccess } = await runSample(
      'samples/7-tuple-read/tuple-read-dynamic-index.js'
    );
    expect(runtimeSuccess).toBeTruthy();
    expect(runtimeStdout).toBe('true 2 str\n');
  });
});
