
export interface Piece {
  id: number;
  row: number;
  col: number;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  isLocked: boolean;
  zIndex: number;
}

export enum Difficulty {
  EASY = 3, // 3x3
  MEDIUM = 4, // 4x4
  HARD = 6, // 6x6
  EXPERT = 8 // 8x8
}

export interface PuzzleMetadata {
  id: string;
  url: string;
  title: string;
  category: string;
}

export interface GameState {
  image: string | null;
  difficulty: Difficulty;
  pieces: Piece[];
  isSolved: boolean;
  moves: number;
  startTime: number | null;
  currentTime: number;
}
