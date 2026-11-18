import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, db, owner, student, guest, admin, createProject, apply } from './fixture.js';
import { client, projectData } from './helpers.js';
import { id, now } from '../server/utils.js';

const profile = {
  name: 'А. Анударь', school: 'МУИС', major: 'Мэдээллийн систем', skills: ['React', 'Figma'],
  skillLevels: [{ skill: 'React', level: 3 }, { skill: 'Figma', level: 2 }],
  interests: ['EdTech'], experience: '', portfolio: '', hours: 12, bio: '',
};
const configuration = { role: 'Хөгжүүлэгч', hours: 8, hoursRequired: true,
  skills: [{ skill: 'React', minLevel: 3, weight: 3, required: true }] };

test('Profile levels persist, validate canonical names and preserve legacy-client updates atomically', async () => {
  let response = await student.request('PATCH', '/users/me', { ...profile, reputation: { adjusted: 5 } });
  assert.equal(response.status, 200);
  assert.equal(response.data.reputation.adjusted, 4);
  assert.deepEqual(response.data.skillLevels, profile.skillLevels);
  const invalid = await student.request('PATCH', '/users/me', {
    ...profile, name: 'Should roll back', skillLevels: [{ skill: 'Python', level: 5 }],
  });
  assert.equal(invalid.status, 400);
  assert.equal((await db.get('SELECT name FROM users WHERE id = ?', ['demo-student'])).name, profile.name);
  for (const skillLevels of [[{ skill: 'React', level: 6 }], [{ skill: 'React', level: 1.5 }],
    [{ skill: 'React', level: 3 }, { skill: 'reactjs', level: 5 }]]) {
    assert.equal((await student.request('PATCH', '/users/me', { ...profile, skillLevels })).status, 400);
  }
  const { skillLevels, ...legacy } = profile;
  response = await student.request('PATCH', '/users/me', { ...legacy, skills: ['React'] });
  assert.equal(response.status, 200);
  assert.deepEqual(response.data.skillLevels, [profile.skillLevels[0]]);
  const viewed = await owner.request('GET', '/users/demo-student');
  assert.equal(viewed.data.email, undefined);
  assert.equal(viewed.data.password, undefined);
  await student.request('PATCH', '/users/me', profile);
});

test('Role requirements drive project and people recommendations, exclude members and enforce owner scope', async () => {
  const project = await createProject({ roleRequirements: [configuration] });
  const detail = await guest.request('GET', `/projects/${project.id}`);
  assert.deepEqual(detail.data.roleRequirements[0], { ...configuration, configured: true });
  const url = `/users/people?project=${project.id}&role=${encodeURIComponent('Хөгжүүлэгч')}`;
  let response = await owner.request('GET', url);
  assert.equal(response.status, 200);
  assert.deepEqual(response.data.items.map(user => user.id), ['demo-student']);
  assert.equal(response.data.items[0].match.score, 97.5);
  assert.equal(response.data.items[0].match.projectId, project.id);
  assert.equal(response.data.items[0].match.role, 'Хөгжүүлэгч');
  assert.equal((await student.request('GET', url)).status, 403);
  const suggested = await student.request('GET', '/users/recommendations');
  assert.equal(suggested.data.projects.find(item => item.id === project.id).match.score, 97.5);
  await student.request('PATCH', '/users/me', { ...profile, skillLevels: [{ skill: 'React', level: 2 }] });
  assert.equal((await owner.request('GET', url)).data.total, 0);
  await student.request('PATCH', '/users/me', { ...profile, hours: 4 });
  assert.equal((await owner.request('GET', url)).data.total, 0);
  assert.equal((await owner.request('PATCH', `/projects/${project.id}`, projectData({
    roleRequirements: [{ ...configuration, hoursRequired: false }],
  }))).status, 200);
  assert.equal((await owner.request('GET', url)).data.items[0].match.breakdown.availability, 10);
  await student.request('PATCH', '/users/me', profile);
  await student.request('POST', '/community/blocks', { target_id: 'demo-owner' });
  assert.equal((await owner.request('GET', url)).data.total, 0);
  await student.request('DELETE', '/community/blocks/demo-owner');
  const request = await apply(project);
  await owner.request('POST', `/applications/${request.id}/decision`, { action: 'accepted' });
  assert.equal((await owner.request('GET', `/users/people?project=${project.id}`)).data.items.some(item => item.id === 'demo-student'), false);
  const available = await owner.request('GET', '/users/owned-projects');
  assert.ok(available.data.every(item => item.owner_id === 'demo-owner' && item.status === 'open'));
});

test('Role configurations validate membership, preserve old edits and cannot be injected into another project', async () => {
  const invalid = await owner.request('POST', '/projects', projectData({ name: 'Invalid role project', roleRequirements: [
    { ...configuration, role: 'Байхгүй үүрэг' },
  ] }));
  assert.equal(invalid.status, 400);
  assert.equal(await db.get('SELECT id FROM projects WHERE name = ?', ['Invalid role project']), undefined);
  const project = await createProject({ roleRequirements: [configuration] });
  assert.equal((await student.request('PATCH', `/projects/${project.id}`, projectData({ roleRequirements: [] }))).status, 403);
  assert.equal((await owner.request('PATCH', `/projects/${project.id}`, projectData())).status, 200);
  assert.equal((await guest.request('GET', `/projects/${project.id}`)).data.roleRequirements[0].skills[0].required, true);
  assert.equal((await guest.request('GET', `/projects/${project.id}`)).data.roleRequirements[0].skills[0].minLevel, 3);
  for (const roleRequirements of [
    [{ ...configuration, skills: [{ ...configuration.skills[0], skill: 'Python' }] }],
    [{ ...configuration, skills: [{ ...configuration.skills[0], minLevel: 0 }] }],
    [configuration, configuration],
  ]) assert.equal((await owner.request('PATCH', `/projects/${project.id}`, projectData({ roleRequirements }))).status, 400);
});

test('Completion snapshots gate peer reviews, prevent spoofing and duplicates, and survive archiving', async () => {
  const project = await createProject();
  const request = await apply(project);
  await owner.request('POST', `/applications/${request.id}/decision`, { action: 'accepted' });
  const body = { project_id: project.id, target_id: 'demo-student', quality: 5, reliability: 4,
    communication: 5, comment: 'Хамтран ажиллахад ойлгомжтой, ажлаа хугацаанд нь хийсэн.' };
  assert.equal((await guest.request('POST', '/reviews', body)).status, 401);
  assert.equal((await owner.request('POST', '/reviews', body)).status, 403);
  await owner.request('POST', `/projects/${project.id}/status`, { status: 'closed' });
  assert.equal((await owner.request('POST', '/reviews', body)).status, 403);
  assert.equal((await student.request('POST', `/projects/${project.id}/status`, { status: 'completed' })).status, 403);
  assert.equal((await owner.request('POST', `/projects/${project.id}/status`, { status: 'completed' })).status, 200);
  assert.equal((await owner.request('POST', `/projects/${project.id}/status`, { status: 'completed' })).status, 400);
  assert.equal((await student.request('GET', '/reviews/demo-owner')).data.eligibleProjects[0].id, project.id);
  assert.equal((await admin.request('POST', '/reviews', body)).status, 403);
  assert.equal((await owner.request('POST', '/reviews', { ...body, target_id: 'demo-owner' })).status, 400);
  assert.equal((await owner.request('POST', '/reviews', { ...body, quality: 6 })).status, 400);
  assert.equal((await owner.request('PATCH', `/projects/${project.id}`, projectData())).status, 400);
  assert.equal((await owner.request('PATCH', `/projects/${project.id}/members/demo-student`, { role: 'Changed' })).status, 400);
  const chat = new FormData(); chat.set('body', 'Дууссан төслийн мессеж');
  assert.equal((await student.request('POST', `/chat/${project.id}`, chat)).status, 400);
  const duplicates = await Promise.all([owner.request('POST', '/reviews', body), owner.request('POST', '/reviews', body)]);
  assert.deepEqual(duplicates.map(response => response.status).sort(), [201, 409]);
  const reviews = await student.request('GET', '/reviews/demo-student');
  assert.equal(reviews.data.total, 1);
  assert.equal(reviews.data.reputation.reviewers, 1);
  assert.equal(reviews.data.items[0].author_id, 'demo-owner');
  assert.equal((await owner.request('GET', '/reviews/demo-student')).data.eligibleProjects.length, 0);
  assert.equal((await guest.request('GET', `/projects/${project.id}`)).data.completed_at.length > 0, true);
  await owner.request('POST', `/projects/${project.id}/status`, { status: 'archived' });
  assert.equal((await student.request('POST', '/reviews', { ...body, target_id: 'demo-owner', author_id: 'demo-admin' })).status, 201);
  assert.equal((await owner.request('GET', '/reviews/demo-owner')).data.items[0].author_id, 'demo-student');
  const late = client(app); await late.login('nomin@teamup.mn');
  await db.insert('memberships', { id: id(), project_id: project.id, user_id: 'demo-nomin', role: 'Хожим нэмсэн', created_at: now() });
  assert.equal((await late.request('POST', '/reviews', body)).status, 403);
  await db.update('projects', project.id, { visibility: 'hidden' });
  assert.equal((await owner.request('GET', '/reviews/demo-student')).data.total, 0);
  assert.equal((await owner.request('GET', '/users/demo-student')).data.reputation.count, 0);
});
