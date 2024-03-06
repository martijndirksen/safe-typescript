import { describe, expect, it } from 'vitest';
import { buildSample } from '../test/utils';

describe('1-add', () => {
  it('add', async () => {
    const { success, output } = await buildSample('samples/1-add/add.ts');
    expect(success).toBeTruthy();
    expect(output).toBe(
      `function add(a, b) {
    return a + b;
}
`
    );
  });

  it('add-err', async () => {
    const { success, stderr } = await buildSample('samples/1-add/add-err.ts');
    expect(success).toBeFalsy();
    expect(stderr).toContain(
      `error TS2011: Cannot convert 'number' to 'string'.`
    );
  });

  it('add-gradual', async () => {
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
