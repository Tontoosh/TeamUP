import { bestMatch, matchingPolicy } from './algorithm.js';
import { loadUserMatching, matchingUser } from './store.js';
import { decorateProjects } from '../routes/projects.js';

export const matchOrder = (a, b) => b.match.score - a.match.score || a.id.localeCompare(b.id);

export async function recommendationsFor(db, row) {
  const [data, rows, memberships, blocks, projects] = await Promise.all([
    loadUserMatching(db), db.all("SELECT * FROM users WHERE status = 'active' AND role = 'student'"),
    db.all('SELECT * FROM memberships'), db.all('SELECT * FROM blocks'),
    decorateProjects(db, await db.all("SELECT * FROM projects WHERE status = 'open' AND visibility = 'visible'")),
  ]);
  const user = matchingUser(row, data);
  const blocked = target => blocks.some(item =>
    (item.user_id === user.id && item.target_id === target) || (item.user_id === target && item.target_id === user.id));
  const member = (project, userId) => memberships.some(item => item.project_id === project.id && item.user_id === userId);
  const available = projects.filter(project => project.roles.length && project.member_count < project.capacity);
  const ranked = available.flatMap(project => {
    if (project.owner_id === user.id || member(project, user.id) || blocked(project.owner_id)) return [];
    const match = bestMatch(user, project);
    return match ? [{ ...project, match, reasons: match.reasons }] : [];
  }).sort(matchOrder);
  const own = available.filter(project => project.owner_id === user.id);
  const people = rows.flatMap(candidateRow => {
    if (candidateRow.id === user.id || blocked(candidateRow.id)) return [];
    const candidate = matchingUser(candidateRow, data);
    const matches = own.filter(project => !member(project, candidate.id))
      .map(project => bestMatch(candidate, project)).filter(Boolean)
      .sort((a, b) => b.score - a.score || a.projectId.localeCompare(b.projectId));
    return matches.length ? [{ ...candidate, match: matches[0], reasons: matches[0].reasons }] : [];
  }).sort(matchOrder);
  return {
    projects: ranked, people, policy: matchingPolicy,
    incomplete: !user.hours || !user.skills.length || user.skillLevels.length < user.skills.length,
  };
}
