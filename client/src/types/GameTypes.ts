// Core game types based on slither-plus architecture

export interface Position {
  x: number;
  y: number;
}

export interface SnakeData {
  id: string;
  username: string;
  snakeBody: Position[];
  velocityX: number;
  velocityY: number;
  color: string;
  score: number;
}

export interface OrbData {
  id: string;
  position: Position;
  size: OrbSize;
  color: string;
  mass: number;
}

export enum OrbSize {
  SMALL = "SMALL",
  LARGE = "LARGE",
}

export interface GameState {
  mySnake: SnakeData | null;
  otherSnakes: Map<string, SnakeData>;
  orbs: Set<OrbData>;
  gameCode: string;
  leaderboard: Map<string, number>;
}

export interface GameConfig {
  mapSize: Position;
  snakeVelocity: number;
  maxTurnRate: number;
}

export const GAME_CONFIG: GameConfig = {
  mapSize: { x: 3000, y: 3000 },
  snakeVelocity: 8,
  maxTurnRate: 0.1,
};