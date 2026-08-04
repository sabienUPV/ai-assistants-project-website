export interface OrderGameItem {
  text: string;
}

export interface MatchingGamePair {
  leftText: string;
  rightText: string;

  // Opcional: para pasarle la ruta de las imágenes o iconos en un futuro
  leftImage?: string; 
  rightImage?: string;
}