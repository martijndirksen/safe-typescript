import { expect, test } from 'vitest';
import { concat } from './tuple.js';

test('concat', () => {
  expect(concat([500, 'Buckaroos'])).toBe('500 Buckaroos');
});
