
export interface VocabularyItem {
  word: string;
  phonetic: string;
  translation: string;
}

export type Language = 'french' | 'japanese';
export type Level = 'A1' | 'A2' | 'N5' | 'N4';

export interface Story {
  id: number;
  language: Language;
  title: string;
  level: Level;
  content: string;
  translation: string;
  vocabulary: VocabularyItem[];
}

export interface AnalysisResult {
  score: number;
  feedback: string;
  wordsToImprove: string[];
}

export enum AppState {
  LOGIN = 'LOGIN',
  MENU = 'MENU',
  PRACTICE = 'PRACTICE',
  WRITING = 'WRITING',
  CONVERSATION = 'CONVERSATION',
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface StoryImage {
  id?: string;
  storyId: number;
  imageUrl: string; // base64
  labels: { word: string; x: number; y: number }[];
}

export type WritingMode = 'fill-in-the-blank' | 'full-story';

export interface WritingResult {
  original: string;
  corrected: string;
  improved: string;
  feedback: string;
  phonetic: string;
}

export enum RecordingState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  ANALYZED = 'ANALYZED',
}

export interface User {
  email: string;
  name: string;
  picture: string;
}

declare global {
  interface Window {
    google: any;
  }
}