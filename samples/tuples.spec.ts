import { expect, test } from 'vitest';
import { bob } from './tuples.js';

test('add', () => {
  expect(bob[0]).toBe('Bob');
  expect(bob[1]).toBe(200000);
});
