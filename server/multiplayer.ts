import { WebSocketServer, WebSocket } from 'ws';

interface Position {
  x: number;
  y: number;
}

interface MultiplayerPlayer {
  id: string;
  name: string;
  ws: WebSocket;
  x: number;
  y: number;
  angle: number;
  mass: number;
  money: number;
  color: string;
  isBoosting: boolean;
  segments: Array<{ x: number; y: number; opacity: number }>;
  lastUpdate: number;
}

interface Food {
  x: number;
  y: number;
  mass: number;
  color: string;
  type: 'food' | 'money';
}

interface GameState {
  players: Array<{
    id: string;
    name: string;
    head: Position;
    visibleSegments: Array<{ x: number; y: number; opacity: number }>;
    totalMass: number;
    color: string;
    money: number;
    isBoosting: boolean;
  }>;
  foods: Food[];
  timestamp: number;
}

class MultiplayerGameServer {
  private players = new Map<string, MultiplayerPlayer>();
  private foods: Food[] = [];
  private wss: WebSocketServer | null = null;
  
  // Game constants
  private readonly MAP_CENTER_X = 2000;
  private readonly MAP_CENTER_Y = 2000;
  private readonly MAP_RADIUS = 1800;
  private readonly FOOD_COUNT = 300;

  constructor() {
    this.generateInitialFood();
    
    // Start game loop
    setInterval(() => {
      this.gameLoop();
    }, 1000 / 30); // 30 FPS
  }

  init(wss: WebSocketServer) {
    this.wss = wss;
    
    wss.on('connection', (ws: WebSocket) => {
      console.log('New multiplayer connection');
      
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });
      
      ws.on('close', () => {
        // Remove player on disconnect
        for (const [id, player] of this.players) {
          if (player.ws === ws) {
            this.players.delete(id);
            console.log(`Player ${id} disconnected`);
            break;
          }
        }
      });
    });
  }

  private handleMessage(ws: WebSocket, message: any) {
    switch (message.type) {
      case 'join':
        this.handlePlayerJoin(ws, message.data);
        break;
      case 'player_update':
        this.handlePlayerUpdate(message.data);
        break;
    }
  }

  private handlePlayerJoin(ws: WebSocket, data: any) {
    const playerId = this.generatePlayerId();
    
    const player: MultiplayerPlayer = {
      id: playerId,
      name: data.name || 'Player',
      ws,
      x: data.x || this.MAP_CENTER_X,
      y: data.y || this.MAP_CENTER_Y,
      angle: 0,
      mass: 10,
      money: 1.00,
      color: data.color || '#4CAF50',
      isBoosting: false,
      segments: [],
      lastUpdate: Date.now()
    };
    
    this.players.set(playerId, player);
    
    // Send player ID to client
    ws.send(JSON.stringify({
      type: 'player_id',
      data: { id: playerId }
    }));
    
    console.log(`Player ${playerId} joined the game`);
  }

  private handlePlayerUpdate(data: any) {
    const player = this.players.get(data.id);
    if (!player) return;
    
    player.x = data.x;
    player.y = data.y;
    player.angle = data.angle;
    player.mass = data.mass;
    player.money = data.money;
    player.isBoosting = data.isBoosting;
    player.segments = data.segments || [];
    player.lastUpdate = Date.now();
  }

  private gameLoop() {
    // Remove inactive players (haven't updated in 10 seconds)
    const now = Date.now();
    for (const [id, player] of this.players) {
      if (now - player.lastUpdate > 10000) {
        this.players.delete(id);
        console.log(`Removed inactive player ${id}`);
      }
    }
    
    // Maintain food count
    while (this.foods.length < this.FOOD_COUNT) {
      this.spawnFood();
    }
    
    // Broadcast game state to all players
    this.broadcastGameState();
  }

  private generateInitialFood() {
    for (let i = 0; i < this.FOOD_COUNT; i++) {
      this.spawnFood();
    }
  }

  private spawnFood() {
    // 10% chance for money crate, 90% regular food
    const isMoney = Math.random() < 0.1;
    
    if (isMoney) {
      // Money crate
      this.foods.push({
        x: this.MAP_CENTER_X + (Math.random() - 0.5) * this.MAP_RADIUS * 1.8,
        y: this.MAP_CENTER_Y + (Math.random() - 0.5) * this.MAP_RADIUS * 1.8,
        mass: 1,
        color: '#53d493',
        type: 'money'
      });
    } else {
      // Regular food
      const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'];
      const masses = [0.5, 1, 2];
      
      this.foods.push({
        x: this.MAP_CENTER_X + (Math.random() - 0.5) * this.MAP_RADIUS * 1.8,
        y: this.MAP_CENTER_Y + (Math.random() - 0.5) * this.MAP_RADIUS * 1.8,
        mass: masses[Math.floor(Math.random() * masses.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        type: 'food'
      });
    }
  }

  private broadcastGameState() {
    const gameState: GameState = {
      players: Array.from(this.players.values()).map(player => ({
        id: player.id,
        name: player.name,
        head: { x: player.x, y: player.y },
        visibleSegments: player.segments,
        totalMass: player.mass,
        color: player.color,
        money: player.money,
        isBoosting: player.isBoosting
      })),
      foods: this.foods,
      timestamp: Date.now()
    };
    
    const message = JSON.stringify({
      type: 'game_state',
      data: gameState
    });
    
    // Send to all connected players
    for (const player of this.players.values()) {
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(message);
      }
    }
  }

  private generatePlayerId(): string {
    return 'player_' + Math.random().toString(36).substr(2, 9);
  }
}

export { MultiplayerGameServer };