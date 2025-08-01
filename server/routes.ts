import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertGameSchema,
} from "@shared/schema";
import { z } from "zod";

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
      res.status(400).json({ message: "Invalid amount" });
    }
  });



  // Game routes
  app.get("/api/games/active", async (req, res) => {
    const games = await storage.getActiveGames();
    res.json(games);
  });

  app.post("/api/games/create", async (req, res) => {
    try {
      const gameData = insertGameSchema.parse(req.body);
      const game = await storage.createGame(gameData);
      res.json(game);
    } catch (error) {
      res.status(400).json({ message: "Invalid game data" });
    }
  });

  app.post("/api/games/:gameId/join", async (req, res) => {
    try {
      const { userId } = z.object({ userId: z.string() }).parse(req.body);
      const game = await storage.getGame(req.params.gameId);
      
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const betAmount = parseFloat(game.betAmount);
      const userBalance = parseFloat(user.balance);

      // For testing - give unlimited balance
      if (userBalance < betAmount) {
        // Auto-add funds for testing instead of rejecting
        await storage.updateUserBalance(userId, betAmount * 10);
      }

      // Deduct bet amount
      await storage.updateUserBalance(userId, -betAmount);
      
      // Join game
      const participant = await storage.joinGame(game.id, userId);
      
      // Update game player count
      const participants = await storage.getGameParticipants(game.id);
      await storage.updateGame(game.id, { playersCount: participants.length });

      res.json(participant);
    } catch (error) {
      res.status(400).json({ message: "Failed to join game" });
    }
  });



  // Daily crate route
  app.post("/api/users/:id/claim-daily-crate", async (req, res) => {
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

  // WebSocket handling now managed by NewGameServer

  // Simple health check for multiplayer
  app.get("/api/multiplayer/status", (req, res) => {
    res.json({ 
      status: 'active',
      timestamp: Date.now()
    });
  });

  // WebSocket server for multiplayer on /ws path
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'
  });

  const activePlayers = new Map();

  wss.on("connection", function connection(ws: any) {
    const playerId = `player_${Date.now()}_${Math.random()}`;
    console.log(`Player ${playerId} joined multiplayer. Active: ${wss.clients.size}`);
    
    ws.playerId = playerId;
    activePlayers.set(playerId, {
      id: playerId,
      segments: [],
      color: '#d55400',
      money: 1.00,
      lastUpdate: Date.now()
    });

    // Send current players to new player
    ws.send(JSON.stringify({
      type: 'players',
      players: Array.from(activePlayers.values())
    }));

    ws.on("message", function incoming(message: any) {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'update') {
          // Update player data
          activePlayers.set(playerId, {
            id: playerId,
            segments: data.segments || [],
            color: data.color || '#d55400',
            money: data.money || 1.00,
            lastUpdate: Date.now()
          });
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", () => {
      console.log(`Player ${playerId} left multiplayer. Remaining: ${wss.clients.size - 1}`);
      activePlayers.delete(playerId);
    });

    ws.on("error", (error: any) => {
      console.error("WebSocket error:", error);
      activePlayers.delete(playerId);
    });
  });

  // Broadcast game state every 100ms
  setInterval(() => {
    if (wss.clients.size > 0) {
      const playerList = Array.from(activePlayers.values());
      const message = JSON.stringify({
        type: 'players',
        players: playerList
      });
      
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(message);
          } catch (error) {
            console.error('Broadcast error:', error);
          }
        }
      });
    }
  }, 100);

  return httpServer;
}