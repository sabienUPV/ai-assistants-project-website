export const slideAlignValues = ['left', 'center', 'right'] as const;

export type SlideSchema = {
  title?: string;
  align?: typeof slideAlignValues[number];
};