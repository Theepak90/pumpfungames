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

  // Room status endpoint for room assignment
  app.get("/api/multiplayer/room-status/:roomId", (req, res) => {
    const roomId = req.params.roomId;
    const room = gameRooms.get(roomId);
    
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    
    const playerCount = room.players.size;
    const isFull = playerCount >= MAX_PLAYERS_PER_ROOM;
    
    res.json({
      roomId,
      playerCount,
      maxPlayers: MAX_PLAYERS_PER_ROOM,
      isFull,
      status: 'active'
    });
  });

  // Get all rooms status
  app.get("/api/multiplayer/rooms", (req, res) => {
    const roomsStatus = Array.from(gameRooms.entries()).map(([roomId, room]) => ({
      roomId,
      playerCount: room.players.size,
      maxPlayers: MAX_PLAYERS_PER_ROOM,
      isFull: room.players.size >= MAX_PLAYERS_PER_ROOM
    }));
    
    res.json({ rooms: roomsStatus });
  });

  // Multi-room WebSocket server system
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'
  });

  // Room management - support rooms 1-20
  const MAX_ROOMS = 20;
  const MAX_PLAYERS_PER_ROOM = 8;
  
  const gameRooms = new Map<string, {
    players: Map<string, any>;
    activePlayers: Map<string, any>;
    gameWorld: {
      bots: any[];
      food: any[];
      players: Map<string, any>;
      initialized: boolean;
    };
  }>();

  // Initialize all rooms
  for (let i = 1; i <= MAX_ROOMS; i++) {
    gameRooms.set(i.toString(), {
      players: new Map(),
      activePlayers: new Map(),
      gameWorld: {
        bots: [],
        food: [],
        players: new Map(),
        initialized: false
      }
    });
  }

  // Initialize room game world
  function initializeRoomGameWorld(roomId: string) {
    const room = gameRooms.get(roomId);
    if (!room || room.gameWorld.initialized) return;
    
    // Don't create bots - multiplayer is for human players only
    room.gameWorld.bots = [];
    
    // Create shared food for this room
    for (let i = 0; i < 200; i++) {
      room.gameWorld.food.push({
        id: `food_${roomId}_${i}`,
        x: Math.random() * 4000 - 2000,
        y: Math.random() * 4000 - 2000,
        size: 4 + Math.random() * 6,
        color: ['#ff4444', '#44ff44', '#4444ff', '#ffff44'][Math.floor(Math.random() * 4)]
      });
    }
    
    room.gameWorld.initialized = true;
    console.log(`Room ${roomId} game world initialized (food only, no bots)`);
  }

  wss.on("connection", function connection(ws: any, req: any) {
    // Extract room ID from query string
    const url = new URL(req.url, `http://${req.headers.host}`);
    const roomId = url.searchParams.get('room') || '1';
    
    // Validate room ID
    if (!gameRooms.has(roomId)) {
      ws.close(1003, 'Invalid room');
      return;
    }
    
    const room = gameRooms.get(roomId)!;
    
    // Check if room is full
    if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
      ws.close(1003, 'Room full');
      return;
    }
    
    const playerId = `player_${Date.now()}_${Math.random()}`;
    console.log(`Player ${playerId} joined room ${roomId}. Room players: ${room.players.size + 1}/${MAX_PLAYERS_PER_ROOM}`);
    
    ws.playerId = playerId;
    ws.roomId = roomId;
    
    // Assign different colors to different players
    const colors = ['#d55400', '#4ecdc4', '#ff6b6b', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'];
    const playerColor = colors[room.players.size % colors.length];
    
    const player = {
      id: playerId,
      segments: [],
      color: playerColor,
      money: 1.00,
      lastUpdate: Date.now(),
      roomId: roomId
    };
    
    room.activePlayers.set(playerId, player);
    room.gameWorld.players.set(playerId, player);

    // Send welcome message with player ID and room info
    ws.send(JSON.stringify({
      type: 'welcome',
      playerId: playerId,
      roomId: roomId,
      playerCount: room.players.size + 1
    }));

    // Initialize room game world if needed
    initializeRoomGameWorld(roomId);
    
    // Send current players to new player
    setTimeout(() => {
      ws.send(JSON.stringify({
        type: 'players',
        players: Array.from(room.activePlayers.values())
      }));
      
      // Send room game world state including all players
      ws.send(JSON.stringify({
        type: 'gameWorld',
        bots: room.gameWorld.bots,
        food: room.gameWorld.food,
        players: Array.from(room.gameWorld.players.values())
      }));
    }, 100);

    ws.on("message", function incoming(message: any) {
      try {
        const data = JSON.parse(message.toString());
        const room = gameRooms.get(roomId)!;
        
        if (data.type === 'update') {
          // Update player data in room
          const existingPlayer = room.activePlayers.get(playerId);
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
            lastUpdate: Date.now(),
            roomId: roomId
          };
          console.log(`Room ${roomId} - Server received update from ${playerId}: ${limitedSegments.length} segments (was ${segments.length}), mass: ${limitedMass.toFixed(1)} (was ${data.totalMass?.toFixed(1)}), radius: ${data.segmentRadius?.toFixed(1) || 'unknown'}`);
          
          // Check for collisions with other players in same room BEFORE updating position
          const currentPlayerHead = data.segments && data.segments.length > 0 ? data.segments[0] : null;
          if (currentPlayerHead && data.segmentRadius) {
            let collisionDetected = false;
            
            // Check collision with all other players in the same room
            for (const [otherPlayerId, otherPlayer] of Array.from(room.gameWorld.players)) {
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
                  console.log(`💀 SERVER: Player ${playerId} in room ${roomId} crashed into ${otherPlayerId}!`);
                  collisionDetected = true;
                  
                  // Remove crashed player immediately from room
                  room.activePlayers.delete(playerId);
                  room.gameWorld.players.delete(playerId);
                  
                  // Send death notification to crashed player (client will handle death loot)
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'death',
                      reason: 'collision',
                      crashedInto: otherPlayerId
                    }));
                  }
                  
                  console.log(`💀 Player ${playerId} removed from room ${roomId} (client will handle death loot)`);
                  break;
                }
              }
              if (collisionDetected) break;
            }
            
            // Only update player if no collision detected
            if (!collisionDetected) {
              room.activePlayers.set(playerId, player);
              room.gameWorld.players.set(playerId, player);
            }
          } else {
            // No collision check needed if no head position
            room.activePlayers.set(playerId, player);
            room.gameWorld.players.set(playerId, player);
          }
        } else if (data.type === 'eatFood') {
          // Handle server-side food collision within room
          const foodId = data.foodId;
          const foodIndex = room.gameWorld.food.findIndex((f: any) => f.id === foodId);
          
          if (foodIndex !== -1) {
            // Remove eaten food from room
            const eatenFood = room.gameWorld.food[foodIndex];
            room.gameWorld.food.splice(foodIndex, 1);
            
            // Create new food to maintain count for this room
            const newFood = {
              id: `food_${roomId}_${Date.now()}_${Math.random()}`,
              x: Math.random() * 4000 - 2000,
              y: Math.random() * 4000 - 2000,
              size: 4 + Math.random() * 6,
              color: ['#ff4444', '#44ff44', '#4444ff', '#ffff44'][Math.floor(Math.random() * 4)]
            };
            room.gameWorld.food.push(newFood);
            
            console.log(`Room ${roomId} - Player ${playerId} ate food ${foodId}, spawned new food ${newFood.id}`);
          }
        } else if (data.type === 'dropFood') {
          // Handle server-side food dropping from boosting within room
          const droppedFood = data.food;
          
          // Add dropped food to room's food array with unique ID
          const serverFood = {
            id: `dropped_${roomId}_${Date.now()}_${Math.random()}`,
            x: droppedFood.x,
            y: droppedFood.y,
            size: droppedFood.size,
            color: droppedFood.color
          };
          room.gameWorld.food.push(serverFood);
          
          console.log(`Room ${roomId} - Player ${playerId} dropped food at (${droppedFood.x.toFixed(1)}, ${droppedFood.y.toFixed(1)})`);
        } else if (data.type === 'playerDeath') {
          // Handle player death and death loot drops within room
          const deathLoot = data.deathLoot;
          
          if (deathLoot && Array.isArray(deathLoot)) {
            // Add all death loot items to room food
            for (const loot of deathLoot) {
              const serverLoot = {
                id: `death_${roomId}_${Date.now()}_${Math.random()}`,
                x: loot.x,
                y: loot.y,
                size: loot.size,
                color: loot.color,
                type: loot.type, // 'food' or 'money'
                mass: loot.mass || 1,
                value: loot.value || 0 // For money crates
              };
              room.gameWorld.food.push(serverLoot);
            }
            
            console.log(`💀 Room ${roomId} - Player ${playerId} died, added ${deathLoot.length} death loot items to room`);
            
            // Remove the dead player from room
            room.activePlayers.delete(playerId);
            room.gameWorld.players.delete(playerId);
          }
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", (code: number, reason: Buffer) => {
      const room = gameRooms.get(roomId);
      if (room) {
        room.activePlayers.delete(playerId);
        room.gameWorld.players.delete(playerId);
        console.log(`Player ${playerId} left room ${roomId}. Code: ${code}, Reason: ${reason.toString()}, Room players: ${room.players.size}`);
      }
    });

    ws.on("error", (error: any) => {
      const room = gameRooms.get(roomId);
      if (room) {
        room.activePlayers.delete(playerId);
        room.gameWorld.players.delete(playerId);
        console.error(`WebSocket error for player ${playerId} in room ${roomId}:`, error);
      }
    });
  });

  // Broadcast game state every 100ms for stable multiplayer - per room
  setInterval(() => {
    if (wss.clients.size > 0) {
      // Broadcast to each room separately
      gameRooms.forEach((room, roomId) => {
        if (room.gameWorld.players.size > 0) {
          // Calculate barrier expansion based on room player count
          const currentPlayerCount = room.gameWorld.players.size;
          const BASE_MAP_RADIUS = 1800;
          const EXPANSION_RATE = 0.25; // 25% expansion per 2 players
          const MAX_PLAYERS = MAX_PLAYERS_PER_ROOM; // Use room max players
          const EXPANSION_THRESHOLD = 6; // First expansion starts at 6 players
          
          // Calculate expansion tiers: first expansion at 6 players, then every 2 players adds 25%
          const effectivePlayerCount = Math.min(currentPlayerCount, MAX_PLAYERS);
          const expansionTiers = Math.max(0, Math.floor((effectivePlayerCount - EXPANSION_THRESHOLD) / 2));
          const targetRadius = BASE_MAP_RADIUS * (1 + (expansionTiers * EXPANSION_RATE));
          
          const shouldExpand = currentPlayerCount >= EXPANSION_THRESHOLD;
          
          const worldMessage = JSON.stringify({
            type: 'gameWorld',
            bots: room.gameWorld.bots,
            food: room.gameWorld.food,
            players: Array.from(room.gameWorld.players.values()),
            barrierExpansion: {
              currentPlayerCount,
              shouldExpand,
              targetRadius,
              baseRadius: BASE_MAP_RADIUS,
              expansionTiers,
              effectivePlayerCount
            }
          });
          
          console.log(`Broadcasting to room ${roomId}: ${room.gameWorld.players.size} players`);
          
          // Send to clients in this room
          wss.clients.forEach((client: any) => {
            if (client.readyState === WebSocket.OPEN && client.roomId === roomId) {
              try {
                client.send(worldMessage);
              } catch (error) {
                console.error(`Broadcast error for room ${roomId}:`, error);
                // Clean up from room
                if (room.activePlayers.has(client.playerId)) {
                  room.activePlayers.delete(client.playerId);
                  room.gameWorld.players.delete(client.playerId);
                }
                client.terminate();
              }
            }
          });
        }
      });
    }
  }, 100);

  return httpServer;
}