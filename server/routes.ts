import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { MultiplayerGameServer } from "./multiplayer";
import {
  insertUserSchema,
  insertGameSchema,
  type GameState,
  type Player,
  type WebSocketMessage,
} from "@shared/schema";
import { z } from "zod";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  gameId?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server for real-time game communication
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Initialize multiplayer game server
  const multiplayerServer = new MultiplayerGameServer();
  multiplayerServer.init(wss);

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
      
      // Initialize game state with larger world for slither.io style
      const gameState: GameState = {
        id: game.id,
        players: [],
        food: generateFood(100, { width: 4000, height: 4000 }), // Much larger world
        gameArea: { width: 4000, height: 4000 },
        status: 'waiting',
        betAmount: parseFloat(game.betAmount)
      };
      
      await storage.updateGameState(game.id, gameState);
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

  // WebSocket handling
  wss.on('connection', (ws: AuthenticatedWebSocket) => {
    console.log('New WebSocket connection');
    
    ws.on('message', async (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        console.log('Received WebSocket message:', message);
        
        switch (message.type) {
          case 'authenticate':
            ws.userId = message.payload.userId;
            console.log('Authenticated user:', ws.userId);
            break;
            
          case 'join_game':
            console.log('Processing join_game request');
            await handleJoinGame(ws, message);
            break;
            
          case 'move':
            await handlePlayerMove(ws, message);
            break;
            
          case 'leave_game':
            await handleLeaveGame(ws, message);
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (ws.userId) {
        storage.updateUser(ws.userId, { isOnline: false });
      }
    });
  });

  // Game logic functions
  async function handleJoinGame(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    const { gameId } = message.payload;
    console.log('Joining game:', gameId, 'User:', ws.userId);
    
    const gameState = await storage.getGameState(gameId);
    console.log('Game state found:', !!gameState);
    
    if (!gameState || !ws.userId) {
      console.log('Missing game state or user ID');
      return;
    }

    ws.gameId = gameId;
    
    const user = await storage.getUser(ws.userId);
    if (!user) return;

    // Add player to game state with slither.io style positioning
    const startX = Math.random() * 2000 + 1000; // Larger game world
    const startY = Math.random() * 2000 + 1000;
    const startAngle = Math.random() * Math.PI * 2;
    
    const player: Player = {
      id: ws.userId,
      username: user.username,
      snake: {
        segments: [
          { x: startX, y: startY },
          { x: startX - 15, y: startY },
          { x: startX - 30, y: startY }
        ],
        direction: 'right',
        angle: startAngle,
        speed: 2,
        growing: false
      },
      kills: 0,
      earnings: 0,
      isAlive: true,
      color: user.snakeColor
    };

    gameState.players.push(player);
    await storage.updateGameState(gameId, gameState);

    // Start game if enough players
    if (gameState.players.length >= 1 && gameState.status === 'waiting') { // Start with 1 player for testing
      gameState.status = 'active';
      await storage.updateGameState(gameId, gameState);
      await storage.updateGame(gameId, { status: 'active', startedAt: new Date() });
      
      // Start game loop
      startGameLoop(gameId);
    }

    // Broadcast updated game state
    console.log('Broadcasting game state to', gameState.players.length, 'players');
    broadcastToGame(gameId, {
      type: 'game_state',
      payload: gameState
    });
  }

  async function handlePlayerMove(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    const { direction } = message.payload;
    const { gameId, userId } = ws;
    
    if (!gameId || !userId) return;

    const gameState = await storage.getGameState(gameId);
    if (!gameState) return;

    const player = gameState.players.find(p => p.id === userId);
    if (!player || !player.isAlive) return;

    // Update player angle for slither.io style movement
    const angle = parseFloat(direction);
    if (!isNaN(angle)) {
      player.snake.angle = angle;
    }

    await storage.updateGameState(gameId, gameState);
  }

  async function handleLeaveGame(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    const { gameId, userId } = ws;
    if (!gameId || !userId) return;

    const gameState = await storage.getGameState(gameId);
    if (!gameState) return;

    // Remove player from game
    gameState.players = gameState.players.filter(p => p.id !== userId);
    await storage.updateGameState(gameId, gameState);

    // Broadcast updated state
    broadcastToGame(gameId, {
      type: 'game_state', 
      payload: gameState
    });

    ws.gameId = undefined;
  }

  function broadcastToGame(gameId: string, message: WebSocketMessage) {
    wss.clients.forEach((client: WebSocket) => {
      const ws = client as AuthenticatedWebSocket;
      if (ws.gameId === gameId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  // Game loop for continuous movement (slither.io style)
  const gameLoops = new Map<string, NodeJS.Timeout>();

  function startGameLoop(gameId: string) {
    if (gameLoops.has(gameId)) return; // Already running

    const interval = setInterval(async () => {
      const gameState = await storage.getGameState(gameId);
      if (!gameState || gameState.status !== 'active') {
        clearInterval(interval);
        gameLoops.delete(gameId);
        return;
      }

      // Update all players with continuous movement
      for (const player of gameState.players) {
        if (player.isAlive) {
          updatePlayerPosition(player);
          
          // Check collisions with boundaries (wrap around like slither.io)
          const head = player.snake.segments[0];
          if (head.x < 0) head.x = gameState.gameArea.width;
          if (head.x > gameState.gameArea.width) head.x = 0;
          if (head.y < 0) head.y = gameState.gameArea.height;
          if (head.y > gameState.gameArea.height) head.y = 0;

          // Check food collision
          checkFoodCollision(player, gameState);
          
          // Check snake collisions
          checkSnakeCollisions(player, gameState);
        }
      }

      // Remove dead players after a delay
      gameState.players = gameState.players.filter(p => p.isAlive);

      // End game if only one player left
      if (gameState.players.length <= 1) {
        gameState.status = 'finished';
        await storage.updateGame(gameId, { status: 'finished', endedAt: new Date() });
        clearInterval(interval);
        gameLoops.delete(gameId);
      }

      await storage.updateGameState(gameId, gameState);

      // Broadcast update
      broadcastToGame(gameId, {
        type: 'game_update',
        payload: gameState
      });
    }, 50); // 20 FPS for smooth movement

    gameLoops.set(gameId, interval);
  }

  function updatePlayerPosition(player: Player) {
    const head = player.snake.segments[0];
    const speed = player.snake.speed;
    const angle = player.snake.angle;

    // Calculate new head position based on angle
    const newX = head.x + Math.cos(angle) * speed;
    const newY = head.y + Math.sin(angle) * speed;

    // Add new head
    player.snake.segments.unshift({ x: newX, y: newY });

    // Remove tail if not growing
    if (!player.snake.growing) {
      player.snake.segments.pop();
    } else {
      player.snake.growing = false;
    }
  }

  function checkFoodCollision(player: Player, gameState: GameState) {
    const head = player.snake.segments[0];
    const foodRadius = 8;
    const snakeRadius = 10;

    for (let i = gameState.food.length - 1; i >= 0; i--) {
      const food = gameState.food[i];
      const distance = Math.sqrt(
        Math.pow(head.x - food.position.x, 2) + Math.pow(head.y - food.position.y, 2)
      );

      if (distance < foodRadius + snakeRadius) {
        gameState.food.splice(i, 1);
        player.snake.growing = true;
        player.kills += 1;
        
        // Add new food to maintain count
        gameState.food.push(generateSingleFood(gameState.gameArea));
      }
    }
  }

  function checkSnakeCollisions(player: Player, gameState: GameState) {
    const head = player.snake.segments[0];
    const snakeRadius = 10;

    // Check collision with other snakes
    for (const otherPlayer of gameState.players) {
      if (otherPlayer.id === player.id || !otherPlayer.isAlive) continue;

      for (const segment of otherPlayer.snake.segments) {
        const distance = Math.sqrt(
          Math.pow(head.x - segment.x, 2) + Math.pow(head.y - segment.y, 2)
        );

        if (distance < snakeRadius * 2) {
          player.isAlive = false;
          return;
        }
      }
    }

    // Check self collision (after head)
    for (let i = 4; i < player.snake.segments.length; i++) {
      const segment = player.snake.segments[i];
      const distance = Math.sqrt(
        Math.pow(head.x - segment.x, 2) + Math.pow(head.y - segment.y, 2)
      );

      if (distance < snakeRadius) {
        player.isAlive = false;
        return;
      }
    }
  }

  // Helper functions for food generation
  function generateFood(count: number, gameArea: { width: number; height: number }) {
    const food = [];
    for (let i = 0; i < count; i++) {
      food.push(generateSingleFood(gameArea));
    }
    return food;
  }

  function generateSingleFood(gameArea: { width: number; height: number }) {
    return {
      position: {
        x: Math.random() * gameArea.width,
        y: Math.random() * gameArea.height
      },
      value: Math.floor(Math.random() * 5) + 1, // Random value 1-5
      color: `hsl(${Math.random() * 360}, 70%, 60%)`
    };
  }

  return httpServer;
}