import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileSchema } from '../server/validation/profile.js';

const valid = {
  name: '  Оюутан  ', school: 'МУИС', major: 'Программ хангамж',
  skills: ['React'], interests: [], experience: '', portfolio: '', hours: 8, bio: '',
};
test('Reviewed profile contract trims input and strips privilege escalation fields', () => {
  const profile = profileSchema.parse({ ...valid, role: 'admin', verified: 1, id: 'other' });
  assert.equal(profile.name, 'Оюутан');
  assert.equal(profile.role, undefined);
  assert.equal(profile.verified, undefined);
  assert.equal(profile.id, undefined);
});
test('Reviewed profile contract rejects unsafe links, long biographies and invalid hours', () => {
  for (const changes of [
    { portfolio: 'javascript:alert(1)' }, { bio: 'x'.repeat(3001) },
    { hours: -1 }, { hours: 81 }, { hours: 1.5 }, { skills: Array(31).fill('React') },
  ]) assert.equal(profileSchema.safeParse({ ...valid, ...changes }).success, false);
  assert.equal(profileSchema.safeParse({ ...valid, portfolio: 'https://example.com' }).success, true);
});
