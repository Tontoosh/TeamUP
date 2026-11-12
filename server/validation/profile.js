import { z } from 'zod';
import { text, strings, link } from '../utils.js';

export const profileSchema = z.object({
  name: text(2, 160),
  school: text(2, 160),
  major: text(2, 160),
  skills: strings,
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
