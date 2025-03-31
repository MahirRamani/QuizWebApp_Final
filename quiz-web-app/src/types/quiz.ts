export type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'MULTIPLE_CORRECT';

export interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options: Option[];
  timeLimit: number;
  marks: number;
  order: number;
}

// types/quiz.ts
export interface Quiz {
  _id: string | number; // MongoDB's _id
  title: string;
  description: string;
  joinCode: string;
  questions: Question[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  isActive: boolean;
}


// Collaboration related types
export interface Cursor {
  x: number;
  y: number;
}

export interface User {
  id: string;
  name: string;
  color: string;
  cursor: Cursor;
  lastActivity: number;
}