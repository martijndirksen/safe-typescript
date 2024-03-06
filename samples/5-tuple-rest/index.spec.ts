import { describe, expect, it } from 'vitest';
import { buildSample, runSample } from '../test/utils';

describe('5-tuple-rest', () => {
  it('tuple-rest-element-non-array-err', async () => {
    const { success, stderr } = await buildSample(
      'samples/5-tuple-rest/tuple-rest-element-non-array-err.ts'
    );
    expect(success).toBeFalsy();
    expect(stderr).toContain(`Rest elements must be an array type`);
  });

  it('tuple-rest-element-multiple-rest-err', async () => {
    const { success, stderr } = await buildSample(
      'samples/5-tuple-rest/tuple-rest-element-multiple-rest-err.ts'
    );
    expect(success).toBeFalsy();
    expect(stderr).toContain(
      `A rest element cannot follow another rest element`
    );
  });

  it('tuple-rest-element', async () => {
    const { success, output } = await buildSample(
      'samples/5-tuple-rest/tuple-rest-element.ts'
    );
    expect(success).toBeTruthy();
    expect(output).toBe(
      `var val = [4, false, 'a', false];
var val2 = [4];
var val3 = [4, 'a', 'b'];
var val4 = [4, 'a', 'b', 'c'];
var val5 = [4, 'a', 'b', 'c'];
var val6 = ['a', 'b', 'c', 4];
var val7 = ['a', 'b', 'c', 4, 'y'];
var val8 = [4, 'y'];
var val9 = [4, 4, 'y'];
var val10 = [4, 4, 'y'];
var val11 = [4, 'a', 'b', 'c', 4, 'y'];
`
    );

    const runtimeOutput = await runSample(
      'samples/5-tuple-rest/tuple-rest-element.js'
    );

    expect(runtimeOutput.success).toBeTruthy();
  });

  it('tuple-rest-element-subtyping-err', async () => {
    const { success, stderr } = await buildSample(
      'samples/5-tuple-rest/tuple-rest-element-subtyping-err.ts'
    );
    expect(success).toBeFalsy();
    expect(stderr).toContain(
      `Variable 'val' of type '[number, ...string[], boolean]' cannot be assigned a value of type '[number]'`
    );
  });
});
