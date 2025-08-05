// WebSocket message types for client-server communication

export enum MessageType {
  // Client to Server
  JOIN_GAME = "JOIN_GAME",
  CREATE_GAME = "CREATE_GAME",
  UPDATE_POSITION = "UPDATE_POSITION",
  
  // Server to Client
  JOIN_SUCCESS = "JOIN_SUCCESS",
  JOIN_ERROR = "JOIN_ERROR",
  GAME_STATE_UPDATE = "GAME_STATE_UPDATE",
  SNAKE_DIED = "SNAKE_DIED",
  OTHER_SNAKE_DIED = "OTHER_SNAKE_DIED",
  UPDATE_LEADERBOARD = "UPDATE_LEADERBOARD",
  SET_GAME_CODE = "SET_GAME_CODE",
  ORBS_UPDATE = "ORBS_UPDATE",
}

export interface JoinGameMessage {
  type: MessageType.JOIN_GAME;
  data: {
    username: string;
    gameCode?: string;
  };
}

export interface CreateGameMessage {
  type: MessageType.CREATE_GAME;
  data: {
    username: string;
  };
}

export interface UpdatePositionMessage {
  type: MessageType.UPDATE_POSITION;
  data: {
    newHead: { x: number; y: number };
    removeTail: { x: number; y: number };
  };
}

export interface GameStateUpdateMessage {
  type: MessageType.GAME_STATE_UPDATE;
  data: {
    snakes: Array<{
      id: string;
      username: string;
      body: Array<{ x: number; y: number }>;
      color: string;
      score: number;
    }>;
    orbs: Array<{
      id: string;
      x: number;
      y: number;
      size: string;
      color: string;
      mass: number;
    }>;
  };
}

export interface LeaderboardUpdateMessage {
  type: MessageType.UPDATE_LEADERBOARD;
  data: {
    leaderboard: Array<{
      username: string;
      score: number;
    }>;
  };
}

export type ClientMessage = JoinGameMessage | CreateGameMessage | UpdatePositionMessage;
export type ServerMessage = GameStateUpdateMessage | LeaderboardUpdateMessage;