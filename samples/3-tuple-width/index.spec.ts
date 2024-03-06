import { describe, expect, it } from 'vitest';
import { buildSample } from '../test/utils';

describe('3-tuple-width', () => {
  it('tuple-multiplicity', async () => {
    const { success, output } = await buildSample(
      'samples/3-tuple-width/tuple-multiplicity.ts'
    );
    expect(success).toBeTruthy();
    expect(output).toBe(
      `var val = [4];
var val2 = [4, 8];
var val3 = [4, 'str', true];
`
    );
  });

  it('tuple-order', async () => {
    const { success, stderr } = await buildSample(
      'samples/3-tuple-width/tuple-order.ts'
    );
    expect(success).toBeFalsy();
    console.log(stderr);

    expect(stderr).toContain(
      `error TS7034: Safe TS: Variable 'val' of type '[number, string]' cannot be assigned a value of type '[string, number]'`
    );
  });

  it('tuple-width-mismatch', async () => {
    const { success, stderr } = await buildSample(
      'samples/3-tuple-width/tuple-width-mismatch.ts'
    );
    expect(success).toBeFalsy();
    expect(stderr).toContain(
      `error TS7034: Safe TS: Variable 'val' of type '[number, string]' cannot be assigned a value of type '[number]'`
    );
  });
});
