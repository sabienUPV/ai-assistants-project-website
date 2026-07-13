export type ImageSchema = {
  image: string;
  alt: string;
  title?: string;
  width?: number;
  height?: number;

  cropTop?: number;
  cropRight?: number;
  cropBottom?: number;
  cropLeft?: number;
};