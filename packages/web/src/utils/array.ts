/**
 * Función de barajado Fisher-Yates determinista mediante una semilla
 */
export function seededShuffle<T>(array: T[], seed: number): T[] {
  let m: number = array.length, t: T, i: number;
  let shuffled = [...array];
  // Generador de números pseudo-aleatorios basado en la semilla
  const random = (s: number) => {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };

  while (m) {
    i = Math.floor(random(seed + m) * m--);
    t = shuffled[m];
    shuffled[m] = shuffled[i];
    shuffled[i] = t;
  }
  return shuffled;
}