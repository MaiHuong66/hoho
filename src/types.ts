export interface Document {
  id: string;
  title: string;
  content: string;
  uploadedAt: Date;
}

export interface Lecture {
  title: string;
  objectives: string[];
  mainContent: string;
  examples: string[];
  conclusion: string;
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // Index of options
  explanation: string;
}

export interface TestResult {
  id: string;
  studentName: string;
  studentClass: string;
  score: number;
  totalQuestions: number;
  feedback: string;
  answers: {
    questionId: string;
    selectedOption: number;
    isCorrect: boolean;
  }[];
  timestamp: Date;
}

export type UserRole = 'LECTURER' | 'STUDENT';
