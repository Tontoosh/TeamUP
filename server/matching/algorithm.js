export const matchingPolicy = Object.freeze({
  version: 'role-weighted-v1',
  weights: { skills: 60, availability: 20, interest: 10, reputation: 10 },
  priorMean: 4,
  priorWeight: 5,
});
const round = value => Math.round(value * 10) / 10;
const clamp = value => Math.max(0, Math.min(1, value));
const aliases = { 'react.js': 'react', reactjs: 'react', nodejs: 'node.js', js: 'javascript', ts: 'typescript' };
export function skillKey(value) {
  const key = value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  return Object.hasOwn(aliases, key) ? aliases[key] : key;
}

export function reputationSummary(reviews) {
  const authors = new Map();
  const totals = { quality: 0, reliability: 0, communication: 0 };
  for (const review of reviews) {
    const score = (review.quality + review.reliability + review.communication) / 3;
    const values = authors.get(review.author_id) || [];
    values.push(score);
    authors.set(review.author_id, values);
    for (const key of Object.keys(totals)) totals[key] += review[key];
  }
  // Repeated reviews from the same teammate count as one independent voice.
  const votes = [...authors.values()].map(values => values.reduce((a, b) => a + b, 0) / values.length);
  const sum = votes.reduce((a, b) => a + b, 0);
  const { priorMean, priorWeight } = matchingPolicy;
  return {
    count: reviews.length, reviewers: votes.length,
    average: votes.length ? round(sum / votes.length) : null,
    adjusted: (sum + priorWeight * priorMean) / (votes.length + priorWeight),
    confidence: votes.length / (votes.length + priorWeight),
    dimensions: Object.fromEntries(Object.entries(totals).map(([key, value]) =>
      [key, reviews.length ? round(value / reviews.length) : null])),
  };
}

export function defaultRole(project, role) {
  return {
    role, hours: project.hours, hoursRequired: false, configured: false,
    skills: [...new Map(project.skills.map(skill => [skillKey(skill), skill])).values()]
      .map(skill => ({ skill, minLevel: 1, weight: 1, required: false })),
  };
}

export function scoreCandidate(candidate, project, role) {
  const known = new Set(candidate.skills.map(skillKey));
  const levels = new Map((candidate.skillLevels || []).map(item => [skillKey(item.skill), item.level]));
  const missing = [];
  const skills = role.skills.map(requirement => {
    const key = skillKey(requirement.skill);
    const present = known.has(key);
    const level = present ? levels.get(key) || null : null;
    const credit = level ? clamp(level / requirement.minLevel) : present ? 0.5 / requirement.minLevel : 0;
    if (requirement.required && (!level || level < requirement.minLevel))
      missing.push(`${requirement.skill}: ${requirement.minLevel}-р түвшин шаардлагатай`);
    return { ...requirement, level, present, credit };
  });
  const hours = candidate.hours || 0;
  if (role.hoursRequired && hours < role.hours)
    missing.push(`7 хоногт ${role.hours} цаг шаардлагатай`);
  const totalWeight = skills.reduce((sum, item) => sum + item.weight, 0);
  const reputation = candidate.reputation || reputationSummary([]);
  const values = {
    skills: totalWeight ? skills.reduce((sum, item) => sum + item.weight * item.credit, 0) / totalWeight : 0,
    availability: role.hours > 0 ? clamp(hours / role.hours) : 1,
    interest: candidate.interests.some(item => skillKey(item) === skillKey(project.category)) ? 1 : 0,
    reputation: clamp((reputation.adjusted - 1) / 4),
  };
  const breakdown = Object.fromEntries(Object.entries(values).map(([key, value]) =>
    [key, round(value * matchingPolicy.weights[key])]));
  const reasons = skills.filter(item => item.present).map(item => item.level
    ? `${item.skill}: ${item.level}/${item.minLevel} түвшин` : `${item.skill}: түвшин заагаагүй`);
  reasons.push(`${hours}/${role.hours} цаг / 7 хоног`);
  if (values.interest) reasons.push(`${project.category} сонирхолтой`);
  reasons.push(reputation.count ? `${reputation.reviewers} хүний хамтын ажиллагааны үнэлгээ` : 'Хамтын ажиллагааны үнэлгээ хараахан байхгүй');
  return {
    version: matchingPolicy.version, eligible: missing.length === 0,
    score: round(Object.values(breakdown).reduce((a, b) => a + b, 0)), breakdown,
    projectId: project.id, projectName: project.name, role: role.role,
    skills, reasons, missing, hasSharedSkill: skills.some(item => item.present),
    ungradedSkills: skills.filter(item => item.present && !item.level).length,
  };
}

export function bestMatch(candidate, project, roles = project.roleRequirements || []) {
  return roles.map(role => scoreCandidate(candidate, project, role))
    .filter(match => match.eligible && match.hasSharedSkill)
    .sort((a, b) => b.score - a.score || a.role.localeCompare(b.role, 'mn'))[0] || null;
}
