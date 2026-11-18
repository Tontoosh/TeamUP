import { useState } from 'react';
import type { RoleRequirement, SkillRequirement } from '../types';
import { levelLabels, skillKey } from '../skill-utils';

const requirement = (skill: string): SkillRequirement => ({ skill, minLevel: 1, weight: 1, required: false });

export function RoleRequirementsEditor({ roles, skills, hours, initial = [] }: {
  roles: string[]; skills: string[]; hours: number; initial?: RoleRequirement[];
}) {
  const [values, setValues] = useState<Record<string, RoleRequirement>>(() =>
    Object.fromEntries(initial.map(role => [role.role, role])));
  const configurations = roles.map(role => {
    const value = Object.hasOwn(values, role) ? values[role] : { role, hours, hoursRequired: false, skills: skills.map(requirement) };
    const selected = value.skills.filter(item => skills.some(skill => skillKey(skill) === skillKey(item.skill)));
    return { ...value, skills: selected.length ? selected : skills.slice(0, 1).map(requirement) };
  });
  const update = (value: RoleRequirement) => setValues(previous => ({ ...previous, [value.role]: value }));
  const updateSkill = (role: RoleRequirement, skill: string, changes: Partial<SkillRequirement>) =>
    update({ ...role, skills: role.skills.map(item => skillKey(item.skill) === skillKey(skill) ? { ...item, ...changes } : item) });
  return (
    <fieldset className="matching-fieldset">
      <legend>Үүрэг бүрийн шаардлага</legend>
      <p className="helper">Үүрэгт хэрэгтэй ур чадвар, доод түвшин, ач холбогдлыг заана. “Заавал” гэсэн шаардлага хангаагүй хүнийг санал болгохгүй.</p>
      <input type="hidden" name="roleRequirements" value={JSON.stringify(configurations)} />
      {configurations.map((role, index) => (
        <details className="role-config" key={role.role} open={index === 0}>
          <summary>{role.role} <span>{role.skills.length} ур чадвар</span></summary>
          <div className="role-config-body">
            <label>{role.role} · 7 хоногийн цаг
              <input type="number" min={1} max={80} value={role.hours} required
                onChange={event => update({ ...role, hours: Number(event.target.value) })} />
            </label>
            <label className="check-label"><input type="checkbox" checked={role.hoursRequired}
              onChange={event => update({ ...role, hoursRequired: event.target.checked })} />
              Цагийн шаардлагыг заавал хангана
            </label>
            {skills.map(skill => {
              const selected = role.skills.find(item => skillKey(item.skill) === skillKey(skill));
              return <div className="requirement-row" key={skillKey(skill)}>
                <label className="check-label"><input type="checkbox" checked={!!selected}
                  disabled={!!selected && role.skills.length === 1}
                  onChange={event => update({ ...role, skills: event.target.checked
                    ? [...role.skills, requirement(skill)]
                    : role.skills.filter(item => skillKey(item.skill) !== skillKey(skill)) })} />{skill}</label>
                {selected && <div className="requirement-controls">
                  <label>{role.role} · {skill} доод түвшин
                    <select value={selected.minLevel} onChange={event => updateSkill(role, skill, { minLevel: Number(event.target.value) })}>
                      {levelLabels.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}
                    </select>
                  </label>
                  <label>{role.role} · {skill} ач холбогдол
                    <select value={selected.weight} onChange={event => updateSkill(role, skill, { weight: Number(event.target.value) })}>
                      {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5</option>)}
                    </select>
                  </label>
                  <label className="check-label"><input type="checkbox" checked={selected.required}
                    aria-label={`${role.role} · ${skill} заавал`}
                    onChange={event => updateSkill(role, skill, { required: event.target.checked })} />Заавал</label>
                </div>}
              </div>;
            })}
          </div>
        </details>
      ))}
      {!roles.length && <p className="helper">Эхлээд нээлттэй үүргүүдээ оруулна уу.</p>}
    </fieldset>
  );
}

export function RoleRequirements({ roles = [] }: { roles?: RoleRequirement[] }) {
  return <div className="role-requirements">{roles.map(role => (
    <div key={role.role}>
      <b>{role.role}</b><small>{role.hours} цаг / 7 хоног{role.hoursRequired ? ' · Заавал' : ' · Уян хатан'}</small>
      <ul>{role.skills.map(item => <li key={item.skill}>
        {item.skill} · {item.minLevel}/5 түвшин · Ач холбогдол {item.weight}/5{item.required ? ' · Заавал' : ' · Давуу тал'}
      </li>)}</ul>
    </div>
  ))}</div>;
}
