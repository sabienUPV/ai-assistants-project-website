export type Answer = {
  text: string;
  isCorrect: boolean;
  explanation?: string;
  image?: string;
  imageAlt?: string;
}

export type Question = {
  prompt: string;
  image?: string;
  imageAlt?: string;
  answers: Answer[];
}