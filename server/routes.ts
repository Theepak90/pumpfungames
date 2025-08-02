import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertGameSchema,
} from "@shared/schema";
import { z } from "zod";
import { HttpMultiplayerManager } from "./httpMultiplayer";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const user = await storage.createUser({
        username,
        password, // In production, this should be hashed
        balance: "10.0000", // Start with $10
        solBalance: "0.05000000", // Start with some SOL
        totalEarnings: "0.00",
        gamesPlayed: 0,
        kills: 0,
        deaths: 0,
        snakeColor: "#00FF88",
        isOnline: false
      });

      res.json({ user: { ...user, password: undefined } });
    } catch (error) {
      res.status(400).json({ message: "Invalid registration data" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = z.object({
        username: z.string(),
        password: z.string()
      }).parse(req.body);

      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      await storage.updateUser(user.id, { isOnline: true });
      res.json({ user: { ...user, password: undefined } });
    } catch (error) {
      res.status(400).json({ message: "Invalid login data" });
    }
  });

  // User routes
  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ ...user, password: undefined });
  });

  app.post("/api/users/:id/update-balance", async (req, res) => {
    try {
      const { amount } = z.object({ amount: z.number() }).parse(req.body);
      const user = await storage.updateUserBalance(req.params.id, amount);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  // Game routes
  app.post("/api/games", async (req, res) => {
    try {
      const gameData = insertGameSchema.parse(req.body);
      const game = await storage.createGame(gameData);
      res.json(game);
    } catch (error) {
      res.status(400).json({ message: "Invalid game data" });
    }
  });

  app.get("/api/games/:id", async (req, res) => {
    const game = await storage.getGame(req.params.id);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }
    res.json(game);
  });

  app.get("/api/users/:id/games", async (req, res) => {
    const games = await storage.getUserGames(req.params.id);
    res.json(games);
  });

  app.get("/api/leaderboard", async (req, res) => {
    const leaderboard = await storage.getLeaderboard();
    res.json(leaderboard);
  });

  // Friends routes
  app.post("/api/users/:id/friends", async (req, res) => {
    try {
      const { friendId } = z.object({ friendId: z.string() }).parse(req.body);
      const friendship = await storage.addFriend(req.params.id, friendId);
      res.json(friendship);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.get("/api/users/:id/friends", async (req, res) => {
    const friends = await storage.getFriends(req.params.id);
    res.json(friends);
  });

  app.delete("/api/users/:userId/friends/:friendId", async (req, res) => {
    await storage.removeFriend(req.params.userId, req.params.friendId);
    res.json({ success: true });
  });

  // Daily crate routes
  app.post("/api/users/:id/daily-crate", async (req, res) => {
    const lastCrate = await storage.getLastDailyCrate(req.params.id);
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (lastCrate && lastCrate.claimedAt > yesterday) {
      return res.status(400).json({ message: "Daily crate already claimed today" });
    }

    const reward = Math.random() * 5 + 0.5; // Random reward between $0.50 and $5.50
    const crate = await storage.claimDailyCrate(req.params.id, reward);
    await storage.updateUserBalance(req.params.id, reward);

    res.json(crate);
  });

  // Simple health check for multiplayer
  app.get("/api/multiplayer/status", (req, res) => {
    res.json({ 
      status: 'active',
      timestamp: Date.now()
    });
  });

  // Initialize HTTP-based multiplayer (replacing WebSocket due to protocol issues)
  const httpMultiplayer = new HttpMultiplayerManager();
  httpMultiplayer.setupRoutes(app);

  // Legacy WebSocket server selection endpoint for backward compatibility
  app.get('/api/server/available', (req, res) => {
    res.json({ serverId: 0 }); // Single room system
  });

  return httpServer;
}