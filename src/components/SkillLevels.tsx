import { useState } from 'react';
import type { SkillLevel } from '../types';
import { levelLabels, skillKey, uniqueSkills } from '../skill-utils';

export function SkillLevelsEditor({ skills, levels = [] }: { skills: string[]; levels?: SkillLevel[] }) {
  const [text, setText] = useState(skills.join(', '));
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(levels.map(item => [skillKey(item.skill), item.level])));
  const names = uniqueSkills(text);
  const levelFor = (skill: string) => Object.hasOwn(values, skillKey(skill)) ? values[skillKey(skill)] : 0;
  const selected = names.filter(skill => levelFor(skill))
    .map(skill => ({ skill, level: levelFor(skill) }));
  return (
    <fieldset className="matching-fieldset">
      <legend>Ур чадвар ба түвшин</legend>
      <label>Ур чадвар
        <input name="skills" aria-label="Ур чадвар" value={text} onChange={event => setText(event.target.value)}
          maxLength={2400} placeholder="React, Figma, TypeScript" />
        <small>Таслалаар тусгаарлана. Түвшнээ өөрийн одоогийн чадварт тохируулж сонгоорой.</small>
      </label>
      <input name="skillLevels" type="hidden" value={JSON.stringify(selected)} />
      <div className="skill-level-grid">
        {names.map(skill => (
          <label key={skillKey(skill)}>{skill} түвшин
            <select value={levelFor(skill) || ''} onChange={event =>
              setValues(previous => ({ ...previous, [skillKey(skill)]: Number(event.target.value) }))}>
              <option value="">Түвшин заагаагүй</option>
              {levelLabels.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
            </select>
          </label>
        ))}
      </div>
      <small className="helper">Өөрийн үнэлгээ. Багийнхны хамтын ажиллагааны үнэлгээг тусад нь харуулна.</small>
    </fieldset>
  );
}

export function SkillLevels({ skills, levels = [] }: { skills: string[]; levels?: SkillLevel[] }) {
  return <div className="tags skill-level-tags">{skills.map(skill => {
    const level = levels.find(item => skillKey(item.skill) === skillKey(skill))?.level;
    return <span key={skill} title={level ? levelLabels[level - 1] : 'Өөрийн түвшнийг хараахан заагаагүй'}>
      {skill}<b>{level ? `${level}/5` : 'Түвшин заагаагүй'}</b>
    </span>;
  })}</div>;
}
