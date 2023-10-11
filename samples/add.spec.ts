import { expect, test } from 'vitest';
import { add } from './add.js';

test('add', () => {
  expect(add(5, 8)).toBe(13);
  expect(() => add(5, 'scissors')).toThrowError(
    'checkAndTag for primitive types mismatch: string !== number'
  );
});
