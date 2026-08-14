import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUserDocId,
  getDisplayPackages,
  getPrimaryPackage,
  normalizeBangladeshPhone,
  isValidBangladeshPhone,
} from '../src/utils/users.js';

test('getDisplayPackages accepts legacy single-category users and modern package arrays', () => {
  assert.deepEqual(getDisplayPackages({ packages: ['Internet', 'IPTV'] }), ['Internet', 'IPTV']);
  assert.deepEqual(getDisplayPackages({ category: 'Router' }), ['Router']);
  assert.deepEqual(getDisplayPackages({ packages: [], category: 'Router' }), ['Router']);
  assert.deepEqual(getDisplayPackages({}), []);
});

test('getPrimaryPackage returns the first selected package or a legacy category', () => {
  assert.equal(getPrimaryPackage({ packages: ['Internet', 'IPTV'] }), 'Internet');
  assert.equal(getPrimaryPackage({ category: 'Router' }), 'Router');
  assert.equal(getPrimaryPackage({}), '');
});

test('normalizeBangladeshPhone prefixes +880 and validates Bangladesh numbers', () => {
  assert.equal(normalizeBangladeshPhone('01712345678'), '+8801712345678');
  assert.equal(normalizeBangladeshPhone('+8801712345678'), '+8801712345678');
  assert.equal(normalizeBangladeshPhone('1712345678'), '+8801712345678');
  assert.equal(normalizeBangladeshPhone(''), '');
  assert.equal(isValidBangladeshPhone('+8801712345678'), true);
  assert.equal(isValidBangladeshPhone('01712345678'), true);
  assert.equal(isValidBangladeshPhone('12345'), false);
});

test('buildUserDocId produces unique ids for different users without phone numbers', () => {
  const first = buildUserDocId({ ownerId: 'owner-1', phone: '', name: 'User X' });
  const second = buildUserDocId({ ownerId: 'owner-1', phone: '', name: 'User Y' });

  assert.notEqual(first, second);
  assert.match(first, /^owner-1-/);
  assert.match(second, /^owner-1-/);
});
