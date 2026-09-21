import { z } from 'astro/zod';
import { courseUnitRegex, courseUnitValidationMessage } from '@schemas/validation';

export const courseSchema = z.object({
  // Note: Course units should also not be reserved keywords, but because units cannot be actual keywords because their format is stricter, we can just use the unit regex to account for both the format and reserved keywords in one go. This way, we avoid having to check for reserved keywords separately.
  unit: z.string().regex(courseUnitRegex, { message: courseUnitValidationMessage }),
  title: z.string(),
  description: z.string().optional(),
});

export type Course = z.infer<typeof courseSchema>;