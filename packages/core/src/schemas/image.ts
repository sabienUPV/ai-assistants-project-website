type CropOption = 
  // Forma A: Está desactivado (discriminant es false, value no existe)
  | { 
      discriminant: false; 
      value?: never; // 'never' le dice a TS: "si discriminant es false, value está prohibidísimo"
    }
  // Forma B: Está activado (discriminant es true, value tiene las propiedades)
  | { 
      discriminant: true; 
      value: {
        cropTop?: number;
        cropRight?: number;
        cropBottom?: number;
        cropLeft?: number;
      };
    };

export interface ImageContainerSchema {
  title?: string;
  width?: number;
  height?: number;
  crop?: CropOption;
};

export interface ImageSchema extends ImageContainerSchema {
  imageSrc: string;
  alt?: string;
};