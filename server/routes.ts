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
  
  // Shared game world state
  const gameWorld = {
    bots: [] as any[],
    // Food array removed per user request
    players: new Map() as Map<string, any>,
    initialized: false
  };

  // Initialize shared game world
  function initializeGameWorld() {
    if (gameWorld.initialized) return;
    
    // Don't create bots - multiplayer is for human players only
    gameWorld.bots = [];
    
    // Food system removed per user request
    
    gameWorld.initialized = true;
    console.log('Shared game world initialized (no food, no bots)');
  }

  wss.on("connection", function connection(ws: any) {
    const playerId = `player_${Date.now()}_${Math.random()}`;
    console.log(`Player ${playerId} joined multiplayer. Active: ${wss.clients.size}`);
    console.log(`WebSocket readyState: ${ws.readyState}`);
    
    ws.playerId = playerId;
    
    // Assign different colors to different players
    const colors = ['#d55400', '#4ecdc4', '#ff6b6b', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'];
    const playerColor = colors[wss.clients.size % colors.length];
    
    const player = {
      id: playerId,
      segments: [],
      color: playerColor,
      money: 1.00,
      lastUpdate: Date.now()
    };
    
    activePlayers.set(playerId, player);
    gameWorld.players.set(playerId, player); // Also add to shared game world

    // Send welcome message with player ID
    ws.send(JSON.stringify({
      type: 'welcome',
      playerId: playerId
    }));

    // Initialize game world if needed
    initializeGameWorld();
    
    // Send current players to new player
    setTimeout(() => {
      ws.send(JSON.stringify({
        type: 'players',
        players: Array.from(activePlayers.values())
      }));
      
      // Send shared game world state including all players
      ws.send(JSON.stringify({
        type: 'gameWorld',
        bots: gameWorld.bots,
        // Food data removed per user request
        players: Array.from(gameWorld.players.values())
      }));
    }, 100);

    ws.on("message", function incoming(message: any) {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'update') {
          // Update player data in both activePlayers and gameWorld
          const existingPlayer = activePlayers.get(playerId);
          // Enforce 100-segment and 100-mass limits on server side
          const MAX_SEGMENTS = 100;
          const MAX_MASS = 100;
          const segments = data.segments || [];
          const limitedSegments = segments.length > MAX_SEGMENTS ? segments.slice(0, MAX_SEGMENTS) : segments;
          const limitedMass = Math.min(data.totalMass || 6, MAX_MASS); // Cap mass at 100
          
          const player = {
            id: playerId,
            segments: limitedSegments,
            color: existingPlayer?.color || '#d55400',
            money: data.money || 1.00,
            totalMass: limitedMass, // Cap mass at 100
            segmentRadius: data.segmentRadius || 8,
            visibleSegmentCount: Math.min(data.visibleSegmentCount || 0, MAX_SEGMENTS),
            lastUpdate: Date.now()
          };
          console.log(`Server received update from ${playerId}: ${limitedSegments.length} segments (was ${segments.length}), mass: ${limitedMass.toFixed(1)} (was ${data.totalMass?.toFixed(1)}), radius: ${data.segmentRadius?.toFixed(1) || 'unknown'}`);
          
          // Check for collisions with other players BEFORE updating position
          const currentPlayerHead = data.segments && data.segments.length > 0 ? data.segments[0] : null;
          if (currentPlayerHead && data.segmentRadius) {
            let collisionDetected = false;
            
            // Check collision with all other players
            for (const [otherPlayerId, otherPlayer] of Array.from(gameWorld.players)) {
              if (otherPlayerId === playerId) continue; // Skip self
              if (!otherPlayer.segments || otherPlayer.segments.length === 0) continue;
              
              // Check collision with all segments of other player
              for (const segment of otherPlayer.segments) {
                const dist = Math.sqrt(
                  (currentPlayerHead.x - segment.x) ** 2 + 
                  (currentPlayerHead.y - segment.y) ** 2
                );
                const collisionRadius = data.segmentRadius + (otherPlayer.segmentRadius || 10);
                
                if (dist < collisionRadius) {
                  console.log(`💀 SERVER: Player ${playerId} crashed into ${otherPlayerId}!`);
                  collisionDetected = true;
                  
                  // Remove crashed player immediately
                  activePlayers.delete(playerId);
                  gameWorld.players.delete(playerId);
                  
                  // Send death notification to crashed player (client will handle death loot)
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'death',
                      reason: 'collision',
                      crashedInto: otherPlayerId
                    }));
                  }
                  
                  console.log(`💀 Player ${playerId} removed from server (client will handle death loot)`);
                  break;
                }
              }
              if (collisionDetected) break;
            }
            
            // Only update player if no collision detected
            if (!collisionDetected) {
              activePlayers.set(playerId, player);
              gameWorld.players.set(playerId, player);
            }
          } else {
            // No collision check needed if no head position
            activePlayers.set(playerId, player);
            gameWorld.players.set(playerId, player);
          }
        } else if (data.type === 'eatFood') {
          // Food system removed per user request
        } else if (data.type === 'dropFood') {
          // Food dropping system removed per user request
        } else if (data.type === 'playerDeath') {
          // Death loot system removed per user request
          
          // Remove the dead player from active players
          activePlayers.delete(playerId);
          gameWorld.players.delete(playerId);
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", (code: number, reason: Buffer) => {
      console.log(`Player ${playerId} left multiplayer. Code: ${code}, Reason: ${reason.toString()}, Remaining: ${wss.clients.size - 1}`);
      activePlayers.delete(playerId);
      gameWorld.players.delete(playerId);
    });

    ws.on("error", (error: any) => {
      console.error(`WebSocket error for player ${playerId}:`, error);
      activePlayers.delete(playerId);
      gameWorld.players.delete(playerId);
    });
  });

  // Broadcast game state every 100ms for stable multiplayer
  setInterval(() => {
    if (wss.clients.size > 0) {
      // No bots in multiplayer - keep empty array
      
      const worldMessage = JSON.stringify({
        type: 'gameWorld',
        bots: gameWorld.bots,
        // Food data removed per user request
        players: Array.from(gameWorld.players.values())
      });
      
      console.log(`Broadcasting to ${wss.clients.size} clients: ${gameWorld.players.size} players`);
      
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(worldMessage);
          } catch (error) {
            console.error('Broadcast error:', error);
            // Remove disconnected clients
            client.terminate();
          }
        } else {
          // Clean up disconnected clients
          console.log('Removing disconnected client');
          client.terminate();
        }
      });
    }
  }, 100);

  return httpServer;
}