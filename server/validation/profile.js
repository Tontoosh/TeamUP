import { z } from 'zod';
import { text, strings, link } from '../utils.js';
import { skillLevelsSchema } from './matching.js';
import { skillKey } from '../matching/algorithm.js';

export const profileSchema = z.object({
  name: text(2, 160),
  school: text(2, 160),
  major: text(2, 160),
  skills: strings.refine(items => new Set(items.map(skillKey)).size === items.length, 'Ур чадвар давхардаж болохгүй.'),
  skillLevels: skillLevelsSchema.optional(),
  interests: strings,
  experience: text(0, 3000),
  portfolio: link,
  hours: z
    .number()
    .int()
    .min(0)
    .max(80),
  bio: text(0, 3000),
});
