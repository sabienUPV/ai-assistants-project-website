export type Answer = {
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

export type Question = {
  prompt: string;
  answers: Answer[];
}