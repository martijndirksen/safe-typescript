import { describe, expect, it } from 'vitest';
import { buildSample } from '../test/utils';

describe('2-tuple-empty', () => {
  it('tuple-empty-type', async () => {
    const { success, stderr } = await buildSample(
      'samples/2-tuple-empty/tuple-empty.ts'
    );
    expect(success).toBeFalsy();
    expect(stderr).toContain(
      `error TS7090: Tuple type must have at least one type element.`
    );
  });
});
