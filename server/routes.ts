import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertGameSchema,
  type GameState,
  type Player,
  type WebSocketMessage,
  type Direction
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

  app.put("/api/users/:id/snake-color", async (req, res) => {
    try {
      const { color } = z.object({ color: z.string() }).parse(req.body);
      const user = await storage.updateUser(req.params.id, { snakeColor: color });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(400).json({ message: "Invalid color" });
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
      
      // Initialize game state
      const gameState: GameState = {
        id: game.id,
        players: [],
        food: generateFood(20, { width: 800, height: 600 }),
        gameArea: { width: 800, height: 600 },
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

      if (userBalance < betAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
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

  // Leaderboard route
  app.get("/api/leaderboard", async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const leaderboard = await storage.getLeaderboard(limit);
    res.json(leaderboard.map(user => ({ ...user, password: undefined })));
  });

  // Friends routes
  app.get("/api/users/:id/friends", async (req, res) => {
    const friends = await storage.getFriends(req.params.id);
    res.json(friends.map(friend => ({ ...friend, password: undefined })));
  });

  app.post("/api/users/:id/add-friend", async (req, res) => {
    try {
      const { friendUsername } = z.object({ friendUsername: z.string() }).parse(req.body);
      
      const friend = await storage.getUserByUsername(friendUsername);
      if (!friend) {
        return res.status(404).json({ message: "User not found" });
      }

      const friendship = await storage.addFriend(req.params.id, friend.id);
      res.json(friendship);
    } catch (error) {
      res.status(400).json({ message: "Failed to add friend" });
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
    ws.on('message', async (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'authenticate':
            ws.userId = message.payload.userId;
            break;
            
          case 'join_game':
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
    const gameState = await storage.getGameState(gameId);
    
    if (!gameState || !ws.userId) return;

    ws.gameId = gameId;
    
    const user = await storage.getUser(ws.userId);
    if (!user) return;

    // Add player to game state
    const player: Player = {
      id: ws.userId,
      username: user.username,
      snake: {
        segments: [{ x: Math.random() * 780 + 10, y: Math.random() * 580 + 10 }],
        direction: 'right',
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
    if (gameState.players.length >= 2 && gameState.status === 'waiting') {
      gameState.status = 'active';
      await storage.updateGameState(gameId, gameState);
      await storage.updateGame(gameId, { status: 'active', startedAt: new Date() });
      
      // Start game loop
      startGameLoop(gameId);
    }

    // Broadcast updated game state
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

    // Update player direction (with validation to prevent reverse)
    const currentDir = player.snake.direction;
    const opposites = { up: 'down', down: 'up', left: 'right', right: 'left' };
    
    if (opposites[currentDir as keyof typeof opposites] !== direction) {
      player.snake.direction = direction as Direction;
      await storage.updateGameState(gameId, gameState);
    }
  }

  async function handleLeaveGame(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    const { gameId, userId } = ws;
    
    if (!gameId || !userId) return;

    const gameState = await storage.getGameState(gameId);
    if (!gameState) return;

    // Remove player from game
    gameState.players = gameState.players.filter(p => p.id !== userId);
    await storage.updateGameState(gameId, gameState);

    // End game if no players left
    if (gameState.players.length === 0) {
      gameState.status = 'finished';
      await storage.updateGameState(gameId, gameState);
      await storage.updateGame(gameId, { status: 'finished', endedAt: new Date() });
    }

    ws.gameId = undefined;
    
    broadcastToGame(gameId, {
      type: 'game_state',
      payload: gameState
    });
  }

  function broadcastToGame(gameId: string, message: WebSocketMessage) {
    wss.clients.forEach((client: AuthenticatedWebSocket) => {
      if (client.readyState === WebSocket.OPEN && client.gameId === gameId) {
        client.send(JSON.stringify(message));
      }
    });
  }

  function startGameLoop(gameId: string) {
    const gameLoop = setInterval(async () => {
      const gameState = await storage.getGameState(gameId);
      if (!gameState || gameState.status !== 'active') {
        clearInterval(gameLoop);
        return;
      }

      // Update game logic
      await updateGameLogic(gameState);
      await storage.updateGameState(gameId, gameState);

      // Broadcast updated state
      broadcastToGame(gameId, {
        type: 'game_update',
        payload: gameState
      });

      // Check for game end conditions
      const alivePlayers = gameState.players.filter(p => p.isAlive);
      if (alivePlayers.length <= 1) {
        gameState.status = 'finished';
        await storage.updateGameState(gameId, gameState);
        await storage.updateGame(gameId, { status: 'finished', endedAt: new Date() });
        clearInterval(gameLoop);
      }
    }, 1000 / 10); // 10 FPS
  }

  async function updateGameLogic(gameState: GameState) {
    const { players, food, gameArea } = gameState;

    for (const player of players) {
      if (!player.isAlive) continue;

      const { snake } = player;
      const head = snake.segments[0];
      
      // Calculate new head position
      let newHead = { ...head };
      switch (snake.direction) {
        case 'up': newHead.y -= 20; break;
        case 'down': newHead.y += 20; break;
        case 'left': newHead.x -= 20; break;
        case 'right': newHead.x += 20; break;
      }

      // Check wall collision
      if (newHead.x < 0 || newHead.x >= gameArea.width || 
          newHead.y < 0 || newHead.y >= gameArea.height) {
        player.isAlive = false;
        await handlePlayerDeath(player.id);
        continue;
      }

      // Check self collision
      if (snake.segments.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        player.isAlive = false;
        await handlePlayerDeath(player.id);
        continue;
      }

      // Check collision with other snakes
      for (const otherPlayer of players) {
        if (otherPlayer.id === player.id || !otherPlayer.isAlive) continue;
        
        if (otherPlayer.snake.segments.some(segment => 
          segment.x === newHead.x && segment.y === newHead.y)) {
          player.isAlive = false;
          otherPlayer.kills++;
          otherPlayer.earnings += gameState.betAmount;
          
          // Award earnings to killer
          await storage.updateUserBalance(otherPlayer.id, gameState.betAmount);
          await storage.updateUser(otherPlayer.id, { 
            kills: (await storage.getUser(otherPlayer.id))!.kills + 1
          });
          
          await handlePlayerDeath(player.id);
          break;
        }
      }

      if (!player.isAlive) continue;

      // Move snake
      snake.segments.unshift(newHead);

      // Check food collision
      const eatenFood = food.findIndex(f => 
        Math.abs(f.position.x - newHead.x) < 20 && 
        Math.abs(f.position.y - newHead.y) < 20
      );

      if (eatenFood !== -1) {
        food.splice(eatenFood, 1);
        snake.growing = true;
        
        // Add new food
        food.push(...generateFood(1, gameArea));
      }

      // Remove tail if not growing
      if (snake.growing) {
        snake.growing = false;
      } else {
        snake.segments.pop();
      }
    }
  }

  async function handlePlayerDeath(playerId: string) {
    await storage.updateUser(playerId, {
      deaths: (await storage.getUser(playerId))!.deaths + 1
    });
  }

  function generateFood(count: number, gameArea: { width: number; height: number }) {
    const food = [];
    for (let i = 0; i < count; i++) {
      food.push({
        position: {
          x: Math.floor(Math.random() * (gameArea.width / 20)) * 20,
          y: Math.floor(Math.random() * (gameArea.height / 20)) * 20
        },
        value: 1
      });
    }
    return food;
  }

  return httpServer;
}
