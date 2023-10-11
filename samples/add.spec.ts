import { expect, test, vitest } from 'vitest';
import { RT } from '../dist/lib/rt.js';
import { add } from './add.js';

test('add', () => {
  expect(add(5, 8)).toBe(13);
});
