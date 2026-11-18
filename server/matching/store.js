import { check, decode, id, publicUser } from '../utils.js';
import { defaultRole, reputationSummary, skillKey } from './algorithm.js';

const groupBy = (items, key) => {
  const groups = new Map();
  for (const item of items) {
    const value = key(item);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
};
const roleKey = (projectId, role) => JSON.stringify([projectId, role]);

export async function loadUserMatching(db, userId) {
  const where = userId ? ' WHERE user_id = ?' : '';
  const [levels, reviews] = await Promise.all([
    db.all(`SELECT * FROM user_skill_levels${where}`, userId ? [userId] : []),
    db.all(`SELECT r.* FROM peer_reviews r JOIN projects p ON p.id = r.project_id
      WHERE p.visibility = 'visible'${userId ? ' AND r.target_id = ?' : ''}`, userId ? [userId] : []),
  ]);
  return {
    levels: groupBy(levels, item => item.user_id),
    reputations: new Map([...groupBy(reviews, item => item.target_id)]
      .map(([user, items]) => [user, reputationSummary(items)])),
  };
}

export function matchingUser(row, data) {
  const user = publicUser(row);
  const levels = new Map((data.levels.get(user.id) || []).map(item => [item.skill_key, item.level]));
  return {
    ...user,
    skillLevels: user.skills.filter(skill => levels.has(skillKey(skill)))
      .map(skill => ({ skill, level: levels.get(skillKey(skill)) })),
    reputation: data.reputations.get(user.id) || reputationSummary([]),
  };
}

export async function loadRoleMatching(db) {
  const [settings, requirements, completions] = await Promise.all([
    db.all('SELECT * FROM role_settings'), db.all('SELECT * FROM role_requirements'),
    db.all('SELECT * FROM project_completions'),
  ]);
  return {
    settings: new Map(settings.map(item => [roleKey(item.project_id, item.role), item])),
    requirements: groupBy(requirements, item => roleKey(item.project_id, item.role)),
    completions: new Map(completions.map(item => [item.id, item.completed_at])),
  };
}

export function matchingProject(row, data) {
  const project = Array.isArray(row.roles) ? row : decode(row);
  return {
    ...project,
    completed_at: data.completions.get(project.id) || null,
    roleRequirements: project.roles.map(role => {
      const key = roleKey(project.id, role);
      const setting = data.settings.get(key);
      const skills = (data.requirements.get(key) || [])
        .map(item => ({ skill: item.skill, minLevel: item.min_level, weight: item.weight, required: !!item.required }));
      return setting && skills.length ? {
        role, hours: setting.hours, hoursRequired: !!setting.hours_required, configured: true, skills,
      } : defaultRole(project, role);
    }),
  };
}

export async function saveSkillLevels(db, userId, skills, levels) {
  const names = new Map(skills.map(skill => [skillKey(skill), skill]));
  if (levels === undefined) {
    levels = (await db.all('SELECT * FROM user_skill_levels WHERE user_id = ?', [userId]))
      .filter(item => names.has(item.skill_key));
  }
  check(levels.every(item => names.has(skillKey(item.skill))), 'Түвшин нь профайлын ур чадварт хамаарах ёстой.');
  await db.run('DELETE FROM user_skill_levels WHERE user_id = ?', [userId]);
  for (const item of levels) await db.insert('user_skill_levels', {
    id: id(), user_id: userId, skill: names.get(skillKey(item.skill)),
    skill_key: skillKey(item.skill), level: item.level,
  });
}

export async function saveRoleRequirements(db, project, configurations) {
  const names = new Set(project.skills.map(skillKey));
  if (configurations === undefined) {
    const current = matchingProject(project, await loadRoleMatching(db));
    configurations = current.roleRequirements.filter(role => role.configured)
      .map(role => ({ ...role, skills: role.skills.filter(item => names.has(skillKey(item.skill))) }))
      .filter(role => role.skills.length);
  }
  check(configurations.every(role => project.roles.includes(role.role)), 'Шаардлага нь нээлттэй үүрэгт хамаарах ёстой.');
  check(configurations.every(role => role.skills.every(item => names.has(skillKey(item.skill)))),
    'Үүргийн ур чадвар нь төслийн ур чадварын жагсаалтад байх ёстой.');
  await db.run('DELETE FROM role_requirements WHERE project_id = ?', [project.id]);
  await db.run('DELETE FROM role_settings WHERE project_id = ?', [project.id]);
  for (const role of configurations) {
    await db.insert('role_settings', {
      id: id(), project_id: project.id, role: role.role, hours: role.hours, hours_required: Number(role.hoursRequired),
    });
    for (const item of role.skills) await db.insert('role_requirements', {
      id: id(), project_id: project.id, role: role.role, skill: item.skill, skill_key: skillKey(item.skill),
      min_level: item.minLevel, weight: item.weight, required: Number(item.required),
    });
  }
}

