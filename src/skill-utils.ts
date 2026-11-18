import { splitList } from './api';
const aliases: Record<string, string> = { 'react.js': 'react', reactjs: 'react', nodejs: 'node.js', js: 'javascript', ts: 'typescript' };

export const skillKey = (value: string) => {
  const key = value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  return Object.hasOwn(aliases, key) ? aliases[key] : key;
};
export const uniqueSkills = (value: string) => [...new Map(splitList(value).map(skill => [skillKey(skill), skill])).values()];
export const levelLabels = [
  '1 · Анхан шат', '2 · Тусламжтай ажиллана', '3 · Бие дааж ажиллана',
  '4 · Нарийн асуудал шийднэ', '5 · Бусдад зааж, чиглүүлнэ',
];
