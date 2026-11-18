import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestMatch, defaultRole, reputationSummary, scoreCandidate, skillKey } from '../server/matching/algorithm.js';

const project = { id: 'p1', name: 'Төсөл', category: 'EdTech', skills: ['React', 'Figma'], hours: 8 };
const role = { role: 'Frontend', hours: 8, hoursRequired: true, skills: [
  { skill: 'React', minLevel: 3, weight: 3, required: true },
  { skill: 'Figma', minLevel: 2, weight: 1, required: false },
] };
const person = { skills: ['React', 'Figma'], skillLevels: [{ skill: 'React', level: 3 }, { skill: 'Figma', level: 2 }],
  hours: 8, interests: ['EdTech'], reputation: reputationSummary([]) };
const review = (author, value) => ({ author_id: author, quality: value, reliability: value, communication: value });

test('Weighted role matching is bounded, normalized and explainable', () => {
  const match = scoreCandidate(person, project, role);
  assert.equal(match.eligible, true);
  assert.equal(match.score, 97.5);
  assert.deepEqual(match.breakdown, { skills: 60, availability: 20, interest: 10, reputation: 7.5 });
  assert.equal(match.role, 'Frontend');
  assert.ok(match.reasons.some(reason => reason.includes('React')));
  assert.equal(scoreCandidate({ ...person, hours: 80, skillLevels: person.skillLevels.map(s => ({ ...s, level: 5 })) }, project, role).score, 97.5);
  assert.equal(scoreCandidate({ ...person, skills: [...person.skills, 'Python', 'IoT'] }, project, role).score, match.score);
});

test('Mandatory skills and time cannot be compensated by reputation or unrelated skills', () => {
  const strongReputation = reputationSummary(Array.from({ length: 100 }, (_, i) => review(String(i), 5)));
  const missing = scoreCandidate({ ...person, skills: ['Figma'], reputation: strongReputation }, project, role);
  assert.equal(missing.eligible, false);
  assert.ok(missing.missing[0].includes('React'));
  assert.equal(scoreCandidate({ ...person, hours: 7 }, project, role).eligible, false);
  const flexible = scoreCandidate({ ...person, hours: 4 }, project, { ...role, hoursRequired: false });
  assert.equal(flexible.eligible, true);
  assert.equal(flexible.breakdown.availability, 10);
  assert.equal(bestMatch({ ...person, skills: ['Python'] }, project, [role]), null);
});

test('Legacy levels remain unknown, earn partial credit and never satisfy mandatory levels', () => {
  const legacy = { ...person, skillLevels: [] };
  assert.equal(scoreCandidate(legacy, project, role).eligible, false);
  const soft = { ...role, skills: role.skills.map(item => ({ ...item, required: false })) };
  const unknown = scoreCandidate(legacy, project, soft);
  const beginner = scoreCandidate({ ...person, skillLevels: person.skillLevels.map(item => ({ ...item, level: 1 })) }, project, soft);
  assert.equal(unknown.ungradedSkills, 2);
  assert.ok(unknown.breakdown.skills < beginner.breakdown.skills);
  assert.equal(defaultRole(project, 'Хөгжүүлэгч').hoursRequired, false);
});

test('Skill aliases normalize safely, and each project selects its best open role', () => {
  assert.equal(skillKey(' React.JS '), 'react');
  assert.equal(skillKey('__proto__'), '__proto__');
  assert.equal(skillKey('constructor'), 'constructor');
  assert.equal(scoreCandidate({ ...person, skills: ['reactjs', 'figma'] }, project, role).eligible, true);
  const other = { ...role, role: 'Python', skills: [{ skill: 'Python', minLevel: 3, weight: 1, required: true }] };
  assert.equal(bestMatch(person, project, [other, role]).role, 'Frontend');
});

test('Bayesian reputation gives new users a prior and discounts small samples', () => {
  const fresh = reputationSummary([]);
  assert.equal(fresh.average, null);
  assert.equal(fresh.adjusted, 4);
  assert.equal(fresh.confidence, 0);
  const one = reputationSummary([review('a', 5)]);
  const many = reputationSummary(Array.from({ length: 20 }, (_, i) => review(String(i), 4.7)));
  assert.ok(Math.abs(one.adjusted - 25 / 6) < 1e-9);
  assert.ok(one.adjusted < many.adjusted);
  const repeated = reputationSummary(Array.from({ length: 30 }, () => review('a', 5)));
  assert.equal(repeated.count, 30);
  assert.equal(repeated.reviewers, 1);
  assert.equal(repeated.adjusted, one.adjusted);
});
