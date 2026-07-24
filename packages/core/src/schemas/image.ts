export interface ImageContainerSchema {
  title?: string;
  width?: number;
  height?: number;

  cropTop?: number;
  cropRight?: number;
  cropBottom?: number;
  cropLeft?: number;
};

export interface ImageSchema extends ImageContainerSchema {
  imageSrc: string;
  alt?: string;
};