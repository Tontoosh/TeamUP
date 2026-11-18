import { z } from 'zod';
import { text } from '../utils.js';
import { skillKey } from '../matching/algorithm.js';

export const skillLevelsSchema = z.array(z.object({
  skill: text(1, 80), level: z.number().int().min(1).max(5),
})).max(30).refine(items => new Set(items.map(item => skillKey(item.skill))).size === items.length,
  'Ур чадвар давхардаж болохгүй.');
export const roleRequirementsSchema = z.array(z.object({
  role: text(1, 80), hours: z.number().int().min(1).max(80),
  hoursRequired: z.boolean(),
  skills: z.array(z.object({
    skill: text(1, 80), minLevel: z.number().int().min(1).max(5),
    weight: z.number().int().min(1).max(5), required: z.boolean(),
  })).min(1).max(30).refine(items => new Set(items.map(item => skillKey(item.skill))).size === items.length),
})).max(30).refine(items => new Set(items.map(item => item.role.toLowerCase())).size === items.length);
