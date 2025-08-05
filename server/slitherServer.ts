// Slither.io-style game server based on slither-plus architecture
import { WebSocket } from 'ws';

export interface Position {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  username: string;
  socket: WebSocket;
  snake: {
    body: Position[];
    color: string;
    score: number;
  };
  lastUpdate: number;
}

export interface Orb {
  id: string;
  x: number;
  y: number;
  size: 'SMALL' | 'LARGE';
  color: string;
  mass: number;
}

export interface GameRoom {
  id: string;
  players: Map<string, Player>;
  orbs: Map<string, Orb>;
  gameCode: string;
  maxPlayers: number;
  lastOrbGeneration: number;
}

export class SlitherServer {
  private rooms = new Map<string, GameRoom>();
  private gameLoopInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startGameLoop();
  }

  // Create a new game room
  createRoom(): GameRoom {
    const gameCode = this.generateGameCode();
    const room: GameRoom = {
      id: gameCode,
      players: new Map(),
      orbs: new Map(),
      gameCode,
      maxPlayers: 20, // Slither.io style - many players
      lastOrbGeneration: Date.now(),
    };

    this.rooms.set(gameCode, room);
    this.generateInitialOrbs(room);
    
    console.log(`Created new game room: ${gameCode}`);
    return room;
  }

  // Add player to a room
  addPlayerToRoom(socket: WebSocket, username: string, gameCode?: string): GameRoom | null {
    let room: GameRoom | undefined;

    if (gameCode) {
      room = this.rooms.get(gameCode);
      if (!room) {
        return null; // Room doesn't exist
      }
      if (room.players.size >= room.maxPlayers) {
        return null; // Room is full
      }
    } else {
      // Find an available room or create a new one
      room = Array.from(this.rooms.values()).find(r => r.players.size < r.maxPlayers);
      if (!room) {
        room = this.createRoom();
      }
    }

    const playerId = `player_${Date.now()}_${Math.random()}`;
    const startPosition = this.generateStartPosition();
    
    const player: Player = {
      id: playerId,
      username,
      socket,
      snake: {
        body: this.generateInitialSnake(startPosition),
        color: this.generateRandomColor(),
        score: 0,
      },
      lastUpdate: Date.now(),
    };

    room.players.set(playerId, player);
    
    // Set up socket cleanup
    socket.on('close', () => {
      this.removePlayerFromRoom(playerId, room!);
    });

    console.log(`Player ${username} (${playerId}) joined room ${room.gameCode}. Room size: ${room.players.size}/${room.maxPlayers}`);
    return room;
  }

  // Remove player from room
  removePlayerFromRoom(playerId: string, room: GameRoom) {
    room.players.delete(playerId);
    console.log(`Player ${playerId} left room ${room.gameCode}. Room size: ${room.players.size}/${room.maxPlayers}`);
    
    // Remove empty rooms
    if (room.players.size === 0) {
      this.rooms.delete(room.gameCode);
      console.log(`Removed empty room: ${room.gameCode}`);
    } else {
      // Broadcast updated game state
      this.broadcastGameState(room);
    }
  }

  // Handle player position update
  updatePlayerPosition(playerId: string, room: GameRoom, newHead: Position, removeTail: Position) {
    const player = room.players.get(playerId);
    if (!player) return;

    // Update snake body
    player.snake.body = [newHead, ...player.snake.body];
    player.snake.body.pop(); // Remove tail
    player.lastUpdate = Date.now();

    // Check for orb collisions
    this.checkOrbCollisions(player, room);
    
    // Check for snake collisions
    this.checkSnakeCollisions(player, room);
  }

  // Check if player snake collided with orbs
  private checkOrbCollisions(player: Player, room: GameRoom) {
    const head = player.snake.body[0];
    const collisionRadius = 15; // Collision detection radius

    Array.from(room.orbs.values()).forEach(orb => {
      const distance = Math.sqrt(
        Math.pow(head.x - orb.x, 2) + Math.pow(head.y - orb.y, 2)
      );

      if (distance < collisionRadius) {
        // Player ate the orb
        player.snake.score += orb.mass;
        
        // Grow snake (add segment at tail)
        const tail = player.snake.body[player.snake.body.length - 1];
        player.snake.body.push({ ...tail });
        
        // Remove orb
        room.orbs.delete(orb.id);
        
        console.log(`Player ${player.username} ate orb ${orb.id}. New score: ${player.snake.score}`);
      }
    });
  }

  // Check if player snake collided with other snakes
  private checkSnakeCollisions(player: Player, room: GameRoom) {
    const head = player.snake.body[0];
    const collisionRadius = 12;

    // Check collision with other snakes
    Array.from(room.players.values()).forEach(otherPlayer => {
      if (otherPlayer.id === player.id) return;

      otherPlayer.snake.body.forEach((segment, index) => {
        const distance = Math.sqrt(
          Math.pow(head.x - segment.x, 2) + Math.pow(head.y - segment.y, 2)
        );

        if (distance < collisionRadius) {
          // Player died - remove from room
          console.log(`Player ${player.username} died by collision with ${otherPlayer.username}`);
          
          // Send death message
          if (player.socket.readyState === WebSocket.OPEN) {
            player.socket.send(JSON.stringify({
              type: 'SNAKE_DIED',
              data: { reason: 'collision' }
            }));
          }

          // Generate orbs from dead snake
          this.generateDeathOrbs(player, room);
          
          // Remove player
          this.removePlayerFromRoom(player.id, room);
        }
      });
    });

    // Check boundary collision
    if (head.x < -1500 || head.x > 1500 || head.y < -1500 || head.y > 1500) {
      console.log(`Player ${player.username} died by boundary collision`);
      
      if (player.socket.readyState === WebSocket.OPEN) {
        player.socket.send(JSON.stringify({
          type: 'SNAKE_DIED',
          data: { reason: 'boundary' }
        }));
      }

      this.generateDeathOrbs(player, room);
      this.removePlayerFromRoom(player.id, room);
    }
  }

  // Generate orbs when a snake dies
  private generateDeathOrbs(player: Player, room: GameRoom) {
    const orbCount = Math.min(player.snake.body.length, 20); // Max 20 orbs
    
    player.snake.body.forEach((segment, index) => {
      if (index < orbCount) {
        const orb: Orb = {
          id: `death_${Date.now()}_${Math.random()}`,
          x: segment.x + (Math.random() - 0.5) * 30,
          y: segment.y + (Math.random() - 0.5) * 30,
          size: 'LARGE',
          color: player.snake.color,
          mass: 2,
        };
        room.orbs.set(orb.id, orb);
      }
    });
  }

  // Broadcast game state to all players in room
  broadcastGameState(room: GameRoom) {
    const gameState = {
      type: 'GAME_STATE_UPDATE',
      data: {
        snakes: Array.from(room.players.values()).map(player => ({
          id: player.id,
          username: player.username,
          body: player.snake.body,
          color: player.snake.color,
          score: player.snake.score,
        })),
        orbs: Array.from(room.orbs.values()).map(orb => ({
          id: orb.id,
          x: orb.x,
          y: orb.y,
          size: orb.size,
          color: orb.color,
          mass: orb.mass,
        })),
      },
    };

    const message = JSON.stringify(gameState);
    room.players.forEach(player => {
      if (player.socket.readyState === WebSocket.OPEN) {
        player.socket.send(message);
      }
    });
  }

  // Broadcast leaderboard to all players in room
  broadcastLeaderboard(room: GameRoom) {
    const leaderboard = Array.from(room.players.values())
      .map(player => ({
        username: player.username,
        score: player.snake.score,
      }))
      .sort((a, b) => b.score - a.score);

    const message = JSON.stringify({
      type: 'UPDATE_LEADERBOARD',
      data: { leaderboard },
    });

    room.players.forEach(player => {
      if (player.socket.readyState === WebSocket.OPEN) {
        player.socket.send(message);
      }
    });
  }

  // Generate initial orbs for a room
  private generateInitialOrbs(room: GameRoom) {
    const orbCount = 200; // Initial orbs
    
    for (let i = 0; i < orbCount; i++) {
      const orb: Orb = {
        id: `orb_${Date.now()}_${Math.random()}`,
        x: (Math.random() - 0.5) * 2800, // Within map bounds
        y: (Math.random() - 0.5) * 2800,
        size: Math.random() > 0.8 ? 'LARGE' : 'SMALL',
        color: this.generateRandomOrbColor(),
        mass: Math.random() > 0.8 ? 2 : 1,
      };
      room.orbs.set(orb.id, orb);
    }
  }

  // Generate new orbs periodically
  private generateNewOrbs(room: GameRoom) {
    const now = Date.now();
    if (now - room.lastOrbGeneration > 2000) { // Generate orbs every 2 seconds
      const orbsNeeded = Math.max(0, 200 - room.orbs.size);
      
      for (let i = 0; i < Math.min(orbsNeeded, 10); i++) {
        const orb: Orb = {
          id: `orb_${Date.now()}_${Math.random()}`,
          x: (Math.random() - 0.5) * 2800,
          y: (Math.random() - 0.5) * 2800,
          size: Math.random() > 0.8 ? 'LARGE' : 'SMALL',
          color: this.generateRandomOrbColor(),
          mass: Math.random() > 0.8 ? 2 : 1,
        };
        room.orbs.set(orb.id, orb);
      }
      
      room.lastOrbGeneration = now;
    }
  }

  // Helper methods
  private generateGameCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateStartPosition(): Position {
    return {
      x: (Math.random() - 0.5) * 1000, // Start in center area
      y: (Math.random() - 0.5) * 1000,
    };
  }

  private generateInitialSnake(startPos: Position): Position[] {
    const body: Position[] = [];
    for (let i = 0; i < 5; i++) {
      body.push({
        x: startPos.x,
        y: startPos.y + i * 10,
      });
    }
    return body;
  }

  private generateRandomColor(): string {
    const colors = [
      '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
      '#FF8000', '#8000FF', '#80FF00', '#FF0080', '#0080FF', '#FF8080'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private generateRandomOrbColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Main game loop
  private startGameLoop() {
    this.gameLoopInterval = setInterval(() => {
      this.rooms.forEach(room => {
        this.generateNewOrbs(room);
        this.broadcastGameState(room);
        this.broadcastLeaderboard(room);
      });
    }, 100); // 10 FPS server updates
  }

  // Get all rooms
  getRooms(): GameRoom[] {
    return Array.from(this.rooms.values());
  }

  // Get room by code
  getRoom(gameCode: string): GameRoom | undefined {
    return this.rooms.get(gameCode);
  }
}