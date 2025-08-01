import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

export interface Player {
  id: string;
  ws: WebSocket;
  x: number;
  y: number;
  angle: number;
  mass: number;
  money: number;
  color: string;
  segments: Array<{ x: number; y: number; opacity: number }>;
  isBoosting: boolean;
  isAlive: boolean;
  joinedAt: number;
}

export interface GameFood {
  id: string;
  x: number;
  y: number;
  size: number;
  mass: number;
  color: string;
  type: 'normal' | 'money';
  value?: number;
  spawnTime?: number;
}

export interface GameRoom {
  id: string;
  region: 'us' | 'eu';
  players: Map<string, Player>;
  foods: Map<string, GameFood>;
  maxPlayers: number;
  createdAt: number;
  lastUpdate: number;
}

export class MultiplayerGameServer {
  private rooms: Map<string, GameRoom> = new Map();
  private playerToRoom: Map<string, string> = new Map();
  private wss: WebSocketServer;
  private region: 'us' | 'eu';
  
  constructor(server: Server, region: 'us' | 'eu') {
    this.region = region;
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws',
      verifyClient: (info: any) => {
        // Allow all connections for now
        return true;
      }
    });
    
    this.wss.on('connection', this.handleConnection.bind(this));
    this.startGameLoop();
    this.startCleanupLoop();
  }

  private handleConnection(ws: WebSocket, request: any) {
    console.log(`New WebSocket connection from ${this.region} region`);
    
    const playerId = this.generatePlayerId();
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(playerId, ws, message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(playerId);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleDisconnection(playerId);
    });

    // Send connection confirmation
    this.sendToPlayer(ws, {
      type: 'connected',
      playerId,
      region: this.region
    });
  }

  private handleMessage(playerId: string, ws: WebSocket, message: any) {
    switch (message.type) {
      case 'join':
        this.handlePlayerJoin(playerId, ws, message);
        break;
      case 'move':
        this.handlePlayerMove(playerId, message);
        break;
      case 'boost':
        this.handlePlayerBoost(playerId, message);
        break;
      case 'death':
        this.handlePlayerDeath(playerId, message);
        break;
      case 'food_eaten':
        this.handleFoodEaten(playerId, message);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private handlePlayerJoin(playerId: string, ws: WebSocket, message: any) {
    // Find or create a room for this player
    const room = this.findAvailableRoom() || this.createRoom();
    
    // Create player object
    const player: Player = {
      id: playerId,
      ws,
      x: message.x || 400,
      y: message.y || 400,
      angle: message.angle || 0,
      mass: message.mass || 30,
      money: message.money || 1.0,
      color: message.color || '#d55400',
      segments: message.segments || [],
      isBoosting: false,
      isAlive: true,
      joinedAt: Date.now()
    };

    // Add player to room
    room.players.set(playerId, player);
    this.playerToRoom.set(playerId, room.id);

    // Send room info to player
    this.sendToPlayer(ws, {
      type: 'joined_room',
      roomId: room.id,
      playerId,
      playerCount: room.players.size
    });

    // Send initial game state
    this.sendGameState(room, playerId);

    // Notify other players
    this.broadcastToRoom(room, {
      type: 'player_joined',
      player: this.serializePlayer(player)
    }, playerId);

    console.log(`Player ${playerId} joined room ${room.id} in ${this.region}`);
  }

  private handlePlayerMove(playerId: string, message: any) {
    const roomId = this.playerToRoom.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(playerId);
    if (!player || !player.isAlive) return;

    // Update player position and state
    player.x = message.x;
    player.y = message.y;
    player.angle = message.angle;
    player.mass = message.mass;
    player.money = message.money;
    player.segments = message.segments || [];
    player.isBoosting = message.isBoosting || false;

    // Broadcast to other players in room
    this.broadcastToRoom(room, {
      type: 'player_update',
      player: this.serializePlayer(player)
    }, playerId);
  }

  private handlePlayerBoost(playerId: string, message: any) {
    const roomId = this.playerToRoom.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(playerId);
    if (!player || !player.isAlive) return;

    player.isBoosting = message.isBoosting;

    this.broadcastToRoom(room, {
      type: 'player_boost',
      playerId,
      isBoosting: message.isBoosting
    }, playerId);
  }

  private handlePlayerDeath(playerId: string, message: any) {
    const roomId = this.playerToRoom.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(playerId);
    if (!player) return;

    player.isAlive = false;

    // Generate death food based on player mass
    const deathFoods = this.generateDeathFood(player.x, player.y, player.mass, player.segments);
    const moneyCrates = this.generateMoneyCrates(player.x, player.y, player.money, player.segments);

    // Add foods to room
    [...deathFoods, ...moneyCrates].forEach(food => {
      room.foods.set(food.id, food);
    });

    // Broadcast death and new foods
    this.broadcastToRoom(room, {
      type: 'player_died',
      playerId,
      deathFoods: deathFoods.map(f => this.serializeFood(f)),
      moneyCrates: moneyCrates.map(f => this.serializeFood(f))
    });

    console.log(`Player ${playerId} died in room ${roomId}`);
  }

  private handleFoodEaten(playerId: string, message: any) {
    const roomId = this.playerToRoom.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const foodId = message.foodId;
    if (room.foods.has(foodId)) {
      room.foods.delete(foodId);
      
      // Broadcast food removal
      this.broadcastToRoom(room, {
        type: 'food_eaten',
        foodId,
        playerId
      });
    }
  }

  private handleDisconnection(playerId: string) {
    const roomId = this.playerToRoom.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    // Remove player from room
    room.players.delete(playerId);
    this.playerToRoom.delete(playerId);

    // Notify other players
    this.broadcastToRoom(room, {
      type: 'player_left',
      playerId
    });

    console.log(`Player ${playerId} disconnected from room ${roomId}`);

    // Clean up empty rooms
    if (room.players.size === 0) {
      this.rooms.delete(roomId);
      console.log(`Room ${roomId} deleted (empty)`);
    }
  }

  private findAvailableRoom(): GameRoom | null {
    for (const room of this.rooms.values()) {
      if (room.players.size < room.maxPlayers) {
        return room;
      }
    }
    return null;
  }

  private createRoom(): GameRoom {
    const roomId = `${this.region}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    const room: GameRoom = {
      id: roomId,
      region: this.region,
      players: new Map(),
      foods: new Map(),
      maxPlayers: 5,
      createdAt: Date.now(),
      lastUpdate: Date.now()
    };

    // Initialize room with food
    this.generateInitialFood(room);

    this.rooms.set(roomId, room);
    console.log(`Created new room: ${roomId} in ${this.region}`);
    
    return room;
  }

  private generateInitialFood(room: GameRoom) {
    const FOOD_COUNT = 200;
    const MAP_CENTER_X = 800;
    const MAP_CENTER_Y = 600;
    const MAP_RADIUS = 1000;

    for (let i = 0; i < FOOD_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * (MAP_RADIUS - 100);
      const x = MAP_CENTER_X + Math.cos(angle) * radius;
      const y = MAP_CENTER_Y + Math.sin(angle) * radius;

      const foodType = Math.random();
      let food: GameFood;

      if (foodType < 0.05) {
        food = {
          id: this.generateFoodId(),
          x, y,
          size: 20,
          mass: 25,
          color: '#ff8c00',
          type: 'normal'
        };
      } else if (foodType < 0.15) {
        food = {
          id: this.generateFoodId(),
          x, y,
          size: 10,
          mass: 0.8,
          color: this.getRandomFoodColor(),
          type: 'normal'
        };
      } else if (foodType < 0.50) {
        food = {
          id: this.generateFoodId(),
          x, y,
          size: 6,
          mass: 0.4,
          color: this.getRandomFoodColor(),
          type: 'normal'
        };
      } else {
        food = {
          id: this.generateFoodId(),
          x, y,
          size: 4,
          mass: 0.2,
          color: this.getRandomFoodColor(),
          type: 'normal'
        };
      }

      room.foods.set(food.id, food);
    }
  }

  private generateDeathFood(x: number, y: number, mass: number, segments: any[]): GameFood[] {
    const foods: GameFood[] = [];
    const foodCount = Math.floor(mass);
    const snakeColor = '#d55400';

    for (let i = 0; i < foodCount; i++) {
      let foodX, foodY;

      if (segments.length > 0) {
        const segmentIndex = Math.floor((i / foodCount) * segments.length);
        const segment = segments[Math.min(segmentIndex, segments.length - 1)];
        const randomOffset = 8;
        foodX = segment.x + (Math.random() - 0.5) * randomOffset;
        foodY = segment.y + (Math.random() - 0.5) * randomOffset;
      } else {
        const angle = (i / foodCount) * 2 * Math.PI + Math.random() * 0.5;
        const radius = 20 + Math.random() * 30;
        foodX = x + Math.cos(angle) * radius;
        foodY = y + Math.sin(angle) * radius;
      }

      foods.push({
        id: this.generateFoodId(),
        x: foodX,
        y: foodY,
        size: 7,
        mass: 1,
        color: snakeColor,
        type: 'normal'
      });
    }

    return foods;
  }

  private generateMoneyCrates(x: number, y: number, money: number, segments: any[]): GameFood[] {
    const crates: GameFood[] = [];
    const segmentCount = segments.length;
    const moneyPerCrate = segmentCount > 0 ? money / segmentCount : 0;

    for (let i = 0; i < segmentCount; i++) {
      let crateX, crateY;

      if (segments.length > 0) {
        const segment = segments[i];
        crateX = segment.x + (Math.random() - 0.5) * 15;
        crateY = segment.y + (Math.random() - 0.5) * 15;
      } else {
        const angle = (i / segmentCount) * Math.PI * 2;
        const radius = Math.random() * 40 + 20;
        crateX = x + Math.cos(angle) * radius;
        crateY = y + Math.sin(angle) * radius;
      }

      crates.push({
        id: this.generateFoodId(),
        x: crateX,
        y: crateY,
        size: 20,
        mass: 1,
        color: '#00ff00',
        type: 'money',
        value: moneyPerCrate,
        spawnTime: Date.now()
      });
    }

    return crates;
  }

  private startGameLoop() {
    const TICK_RATE = 60; // 60 FPS
    
    setInterval(() => {
      Array.from(this.rooms.values()).forEach(room => {
        this.updateRoom(room);
      });
    }, 1000 / TICK_RATE);
  }

  private updateRoom(room: GameRoom) {
    const currentTime = Date.now();
    room.lastUpdate = currentTime;

    // Remove expired money crates
    const MONEY_CRATE_LIFETIME = 10000; // 10 seconds
    const expiredFoods: string[] = [];

    Array.from(room.foods.entries()).forEach(([foodId, food]) => {
      if (food.type === 'money' && food.spawnTime) {
        const age = currentTime - food.spawnTime;
        if (age > MONEY_CRATE_LIFETIME) {
          expiredFoods.push(foodId);
        }
      }
    });

    // Remove expired foods
    expiredFoods.forEach(foodId => {
      room.foods.delete(foodId);
    });

    // Broadcast expired foods removal
    if (expiredFoods.length > 0) {
      this.broadcastToRoom(room, {
        type: 'foods_expired',
        foodIds: expiredFoods
      });
    }
  }

  private startCleanupLoop() {
    // Clean up inactive rooms every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const ROOM_TIMEOUT = 5 * 60 * 1000; // 5 minutes

      Array.from(this.rooms.entries()).forEach(([roomId, room]) => {
        if (room.players.size === 0 && (now - room.lastUpdate) > ROOM_TIMEOUT) {
          this.rooms.delete(roomId);
          console.log(`Cleaned up inactive room: ${roomId}`);
        }
      });
    }, 60000); // Check every minute
  }

  private sendGameState(room: GameRoom, playerId: string) {
    const player = room.players.get(playerId);
    if (!player) return;

    const gameState = {
      type: 'game_state',
      players: Array.from(room.players.values())
        .filter(p => p.id !== playerId && p.isAlive)
        .map(p => this.serializePlayer(p)),
      foods: Array.from(room.foods.values()).map(f => this.serializeFood(f))
    };

    this.sendToPlayer(player.ws, gameState);
  }

  private broadcastToRoom(room: GameRoom, message: any, excludePlayerId?: string) {
    Array.from(room.players.values()).forEach(player => {
      if (player.id !== excludePlayerId && player.ws.readyState === WebSocket.OPEN) {
        this.sendToPlayer(player.ws, message);
      }
    });
  }

  private sendToPlayer(ws: WebSocket, message: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private serializePlayer(player: Player) {
    return {
      id: player.id,
      x: player.x,
      y: player.y,
      angle: player.angle,
      mass: player.mass,
      money: player.money,
      color: player.color,
      segments: player.segments,
      isBoosting: player.isBoosting,
      isAlive: player.isAlive
    };
  }

  private serializeFood(food: GameFood) {
    return {
      id: food.id,
      x: food.x,
      y: food.y,
      size: food.size,
      mass: food.mass,
      color: food.color,
      type: food.type,
      value: food.value,
      spawnTime: food.spawnTime
    };
  }

  private generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFoodId(): string {
    return `food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getRandomFoodColor(): string {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6ab04c'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Public API for server status
  public getServerStats() {
    return {
      region: this.region,
      totalRooms: this.rooms.size,
      totalPlayers: Array.from(this.rooms.values()).reduce((sum, room) => sum + room.players.size, 0),
      rooms: Array.from(this.rooms.values()).map(room => ({
        id: room.id,
        playerCount: room.players.size,
        maxPlayers: room.maxPlayers,
        createdAt: room.createdAt
      }))
    };
  }
}