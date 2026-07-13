export type ImageSchema = {
  image: {
    data: Uint8Array;
    extension: string;
    filename: string;
  },
  alt: string;
  title?: string;
  width?: number;
  height?: number;

  /* Si queremos que la imagen se recorte a las dimensiones especificadas, podemos usar esta propiedad. */
  crop?: boolean;
};