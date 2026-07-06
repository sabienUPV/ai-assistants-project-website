import { z } from 'astro/zod';

// Unit format: "1.2.3.4" (allows infinite number of subdivisions, but each level must be a positive integer)
export const courseUnitRegex = /^\d+(\.\d+)*$/;
export const courseUnitValidationMessage = 'Unit must be in the format "1.2.3.4". It can have any number of subdivisions';

export const courseSchema = z.object({
  unit: z.string().regex(courseUnitRegex, { message: courseUnitValidationMessage }),
  title: z.string(),
  description: z.string().optional(),
});

export type Course = z.infer<typeof courseSchema>;