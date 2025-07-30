import {
  type User,
  type InsertUser,
  type Game,
  type InsertGame,
  type GameParticipant,
  type InsertGameParticipant,
  type Friendship,
  type InsertFriendship,
  type DailyCrate,
  type InsertDailyCrate,
  type GameState,
  type Player
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  updateUserBalance(id: string, amount: number): Promise<User | undefined>;
  getLeaderboard(limit?: number): Promise<User[]>;

  // Game operations
  createGame(game: InsertGame): Promise<Game>;
  getGame(id: string): Promise<Game | undefined>;
  getActiveGames(): Promise<Game[]>;
  updateGame(id: string, updates: Partial<Game>): Promise<Game | undefined>;
  joinGame(gameId: string, userId: string): Promise<GameParticipant>;
  getGameParticipants(gameId: string): Promise<GameParticipant[]>;
  updateGameParticipant(id: string, updates: Partial<GameParticipant>): Promise<GameParticipant | undefined>;

  // Friend operations
  getFriends(userId: string): Promise<User[]>;
  addFriend(userId: string, friendId: string): Promise<Friendship>;
  acceptFriendRequest(userId: string, friendId: string): Promise<Friendship | undefined>;

  // Daily crate operations
  getLastDailyCrate(userId: string): Promise<DailyCrate | undefined>;
  claimDailyCrate(userId: string, reward: number): Promise<DailyCrate>;

  // Game state operations
  getGameState(gameId: string): Promise<GameState | undefined>;
  updateGameState(gameId: string, state: GameState): Promise<void>;
  removeGameState(gameId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private games: Map<string, Game>;
  private gameParticipants: Map<string, GameParticipant>;
  private friendships: Map<string, Friendship>;
  private dailyCrates: Map<string, DailyCrate>;
  private gameStates: Map<string, GameState>;

  constructor() {
    this.users = new Map();
    this.games = new Map();
    this.gameParticipants = new Map();
    this.friendships = new Map();
    this.dailyCrates = new Map();
    this.gameStates = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      username: insertUser.username,
      password: insertUser.password,
      balance: insertUser.balance || "0.0000",
      solBalance: insertUser.solBalance || "0.00000000",
      totalEarnings: insertUser.totalEarnings || "0.00",
      gamesPlayed: insertUser.gamesPlayed || 0,
      kills: insertUser.kills || 0,
      deaths: insertUser.deaths || 0,
      snakeColor: insertUser.snakeColor || "#00FF88",
      isOnline: insertUser.isOnline || false,
      createdAt: new Date(),
      lastActive: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates, lastActive: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserBalance(id: string, amount: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const currentBalance = parseFloat(user.balance);
    const newBalance = Math.max(0, currentBalance + amount);
    
    return this.updateUser(id, { 
      balance: newBalance.toFixed(4),
      totalEarnings: amount > 0 ? (parseFloat(user.totalEarnings) + amount).toFixed(2) : user.totalEarnings
    });
  }

  async getLeaderboard(limit = 10): Promise<User[]> {
    return Array.from(this.users.values())
      .sort((a, b) => parseFloat(b.totalEarnings) - parseFloat(a.totalEarnings))
      .slice(0, limit);
  }

  async createGame(insertGame: InsertGame): Promise<Game> {
    const id = randomUUID();
    const game: Game = {
      id,
      region: insertGame.region,
      betAmount: insertGame.betAmount,
      playersCount: insertGame.playersCount || 0,
      maxPlayers: insertGame.maxPlayers || 20,
      status: insertGame.status,
      createdAt: new Date(),
      startedAt: null,
      endedAt: null
    };
    this.games.set(id, game);
    return game;
  }

  async getGame(id: string): Promise<Game | undefined> {
    return this.games.get(id);
  }

  async getActiveGames(): Promise<Game[]> {
    return Array.from(this.games.values()).filter(
      (game) => game.status === 'waiting' || game.status === 'active'
    );
  }

  async updateGame(id: string, updates: Partial<Game>): Promise<Game | undefined> {
    const game = this.games.get(id);
    if (!game) return undefined;
    
    const updatedGame = { ...game, ...updates };
    this.games.set(id, updatedGame);
    return updatedGame;
  }

  async joinGame(gameId: string, userId: string): Promise<GameParticipant> {
    const id = randomUUID();
    const participant: GameParticipant = {
      id,
      gameId,
      userId,
      kills: 0,
      earnings: "0.00",
      isAlive: true,
      joinedAt: new Date(),
      eliminatedAt: null
    };
    this.gameParticipants.set(id, participant);
    return participant;
  }

  async getGameParticipants(gameId: string): Promise<GameParticipant[]> {
    return Array.from(this.gameParticipants.values()).filter(
      (participant) => participant.gameId === gameId
    );
  }

  async updateGameParticipant(id: string, updates: Partial<GameParticipant>): Promise<GameParticipant | undefined> {
    const participant = this.gameParticipants.get(id);
    if (!participant) return undefined;
    
    const updatedParticipant = { ...participant, ...updates };
    this.gameParticipants.set(id, updatedParticipant);
    return updatedParticipant;
  }

  async getFriends(userId: string): Promise<User[]> {
    const friendships = Array.from(this.friendships.values()).filter(
      (friendship) => 
        (friendship.userId === userId || friendship.friendId === userId) && 
        friendship.status === 'accepted'
    );

    const friendIds = friendships.map((friendship) =>
      friendship.userId === userId ? friendship.friendId : friendship.userId
    );

    return friendIds.map((id) => this.users.get(id)).filter(Boolean) as User[];
  }

  async addFriend(userId: string, friendId: string): Promise<Friendship> {
    const id = randomUUID();
    const friendship: Friendship = {
      id,
      userId,
      friendId,
      status: 'pending',
      createdAt: new Date()
    };
    this.friendships.set(id, friendship);
    return friendship;
  }

  async acceptFriendRequest(userId: string, friendId: string): Promise<Friendship | undefined> {
    const friendship = Array.from(this.friendships.values()).find(
      (f) => f.userId === friendId && f.friendId === userId && f.status === 'pending'
    );

    if (!friendship) return undefined;

    friendship.status = 'accepted';
    this.friendships.set(friendship.id, friendship);
    return friendship;
  }

  async getLastDailyCrate(userId: string): Promise<DailyCrate | undefined> {
    const userCrates = Array.from(this.dailyCrates.values())
      .filter((crate) => crate.userId === userId)
      .sort((a, b) => b.claimedAt.getTime() - a.claimedAt.getTime());
    
    return userCrates[0];
  }

  async claimDailyCrate(userId: string, reward: number): Promise<DailyCrate> {
    const id = randomUUID();
    const crate: DailyCrate = {
      id,
      userId,
      claimedAt: new Date(),
      reward: reward.toFixed(4)
    };
    this.dailyCrates.set(id, crate);
    return crate;
  }

  async getGameState(gameId: string): Promise<GameState | undefined> {
    return this.gameStates.get(gameId);
  }

  async updateGameState(gameId: string, state: GameState): Promise<void> {
    this.gameStates.set(gameId, state);
  }

  async removeGameState(gameId: string): Promise<void> {
    this.gameStates.delete(gameId);
  }
}

export const storage = new MemStorage();
