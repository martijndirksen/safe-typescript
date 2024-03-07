import { describe, expect, it } from 'vitest';
import { buildSample } from '../test/utils';

describe.skip('6-array', () => {
  it('array', async () => {
    const { success, output } = await buildSample('samples/6-array/array.ts');
    expect(success).toBeTruthy();
    expect(output).toBe(
      `var arr = [];
var arr2 = [2, 4, 7];
var arr3 = [[2], [4], [7]];
var arr4 = ['str1', 'str2', 'str3'];

arr4.push('str4');
var str = arr4[0] + arr4[1];
`
    );
  });

  it('array-err', async () => {
    const { success, stderr } = await buildSample(
      'samples/6-array/array-err.ts'
    );
    expect(success).toBeFalsy();
    console.log(stderr);
    expect(stderr).toContain(
      `error TS2011: Cannot convert 'string' to 'number'.`
    );
  });

  it.skip('add-gradual', async () => {
    const { success, output } = await buildSample(
      'samples/1-add/add-gradual.ts'
    );
    expect(success).toBeTruthy();
    expect(output).toBe(
      `function add(a, b) {
    return a + b;
}

var x = 4;
var y = add(2, RT.checkAndTag(x, RT.Any, RT.Num));
`
    );
  });
});
