import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

interface GameWorld {
  bots: any[];
  players: Map<string, any>;
  initialized: boolean;
}

interface GameServerInstance {
  wss: WebSocketServer;
  activePlayers: Map<string, any>;
  gameWorld: GameWorld;
  serverId: number;
}

export class MultiServerManager {
  private static readonly MAX_PLAYERS_PER_SERVER = 8;
  private gameServers = new Map<number, GameServerInstance>();
  private nextServerId = 0;
  
  constructor(private httpServer: Server) {}
  
  createGameServer(serverId: number): GameServerInstance {
    const wss = new WebSocketServer({ 
      server: this.httpServer, 
      path: `/ws/${serverId}`,
      perMessageDeflate: false // Disable compression to fix RSV1 frame errors
    });
    
    const activePlayers = new Map<string, any>();
    
    const gameWorld: GameWorld = {
      bots: [],
      players: new Map(),
      initialized: false
    };
    
    const serverInstance: GameServerInstance = {
      wss,
      activePlayers,
      gameWorld,
      serverId
    };
    
    this.gameServers.set(serverId, serverInstance);
    this.setupServerWebSocket(serverInstance);
    console.log(`🚀 Created game server ${serverId} (path: /ws/${serverId})`);
    
    return serverInstance;
  }
  
  getAvailableServer(): GameServerInstance {
    // Find server with available slots
    for (const [id, server] of Array.from(this.gameServers.entries())) {
      if (server.activePlayers.size < MultiServerManager.MAX_PLAYERS_PER_SERVER) {
        return server;
      }
    }
    
    // All servers full, create new one
    const newServer = this.createGameServer(this.nextServerId++);
    console.log(`📈 All servers full! Created new server ${newServer.serverId}`);
    return newServer;
  }
  
  initialize() {
    // Create initial server
    this.createGameServer(this.nextServerId++);
    
    // Setup legacy WebSocket for backwards compatibility
    const legacyWss = new WebSocketServer({ 
      server: this.httpServer, 
      path: '/ws',
      perMessageDeflate: false // Disable compression to fix RSV1 frame errors
    });
    legacyWss.on('connection', (ws) => {
      ws.close(1000, 'Please connect to /ws/0 or use the server selection API');
    });
    
    // Broadcast game state for all servers
    this.startBroadcasting();
  }
  
  private setupServerWebSocket(serverInstance: GameServerInstance) {
    const { wss, activePlayers, gameWorld, serverId } = serverInstance;
    
    wss.on("connection", (ws: any) => {
      // Check server capacity
      if (activePlayers.size >= MultiServerManager.MAX_PLAYERS_PER_SERVER) {
        console.log(`Server ${serverId} full, rejecting connection`);
        ws.close(1013, 'Server full');
        return;
      }

      const playerId = `player_${Date.now()}_${Math.random()}`;
      console.log(`Player ${playerId} joined server ${serverId}. Active: ${wss.clients.size}`);
      
      ws.playerId = playerId;
      
      const colors = ['#d55400', '#4ecdc4', '#ff6b6b', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'];
      const playerColor = colors[activePlayers.size % colors.length];
      
      const player = {
        id: playerId,
        segments: [],
        color: playerColor,
        money: 1.00,
        lastUpdate: Date.now()
      };
      
      activePlayers.set(playerId, player);
      gameWorld.players.set(playerId, player);

      // Initialize game world if needed
      this.initializeGameWorld(gameWorld);

      // Send consolidated welcome message with all initial data
      try {
        const welcomeMessage = {
          type: 'welcome',
          playerId: playerId,
          initialState: {
            players: Array.from(activePlayers.values()),
            bots: gameWorld.bots,
            gameWorld: Array.from(gameWorld.players.values())
          }
        };
        
        ws.send(JSON.stringify(welcomeMessage));
      } catch (error) {
        console.error(`Error sending welcome message to ${playerId}:`, error);
      }

      ws.on("message", (message: any) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'update') {
            this.handlePlayerUpdate(data, playerId, serverInstance, ws);
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
          // Don't close connection for parsing errors
        }
      });

      ws.on("close", (code: number, reason: Buffer) => {
        console.log(`Player ${playerId} left server ${serverId}. Code: ${code}, Remaining: ${wss.clients.size - 1}`);
        activePlayers.delete(playerId);
        gameWorld.players.delete(playerId);
      });

      ws.on("error", (error: any) => {
        console.error(`WebSocket error for player ${playerId}:`, error);
        activePlayers.delete(playerId);
        gameWorld.players.delete(playerId);
      });
    });
  }
  
  private handlePlayerUpdate(data: any, playerId: string, serverInstance: GameServerInstance, ws: any) {
    const { activePlayers, gameWorld } = serverInstance;
    const existingPlayer = activePlayers.get(playerId);
    
    // Enforce 100-segment and 100-mass limits
    const MAX_SEGMENTS = 100;
    const MAX_MASS = 100;
    const segments = data.segments || [];
    const limitedSegments = segments.length > MAX_SEGMENTS ? segments.slice(0, MAX_SEGMENTS) : segments;
    const limitedMass = Math.min(data.totalMass || 6, MAX_MASS);
    
    const player = {
      id: playerId,
      segments: limitedSegments,
      color: existingPlayer?.color || '#d55400',
      money: data.money || 1.00,
      totalMass: limitedMass,
      segmentRadius: data.segmentRadius || 8,
      visibleSegmentCount: Math.min(data.visibleSegmentCount || 0, MAX_SEGMENTS),
      lastUpdate: Date.now()
    };
    
    // Check for collisions with other players
    const currentPlayerHead = data.segments && data.segments.length > 0 ? data.segments[0] : null;
    if (currentPlayerHead && data.segmentRadius) {
      let collisionDetected = false;
      
      for (const [otherPlayerId, otherPlayer] of Array.from(gameWorld.players.entries())) {
        if (otherPlayerId === playerId) continue;
        if (!otherPlayer.segments || otherPlayer.segments.length === 0) continue;
        
        for (const segment of otherPlayer.segments) {
          const dx = currentPlayerHead.x - segment.x;
          const dy = currentPlayerHead.y - segment.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const collisionThreshold = data.segmentRadius + (otherPlayer.segmentRadius || 8) - 2;
          
          if (distance < collisionThreshold) {
            collisionDetected = true;
            activePlayers.delete(playerId);
            gameWorld.players.delete(playerId);
            
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'death',
                reason: 'collision',
                crashedInto: otherPlayerId
              }));
            }
            
            console.log(`💀 Player ${playerId} removed from server (collision)`);
            break;
          }
        }
        if (collisionDetected) break;
      }
      
      if (!collisionDetected) {
        activePlayers.set(playerId, player);
        gameWorld.players.set(playerId, player);
      }
    } else {
      activePlayers.set(playerId, player);
      gameWorld.players.set(playerId, player);
    }
  }
  
  private initializeGameWorld(gameWorld: GameWorld) {
    if (gameWorld.initialized) return;
    
    gameWorld.bots = [];
    // Food system completely removed per user request
    
    gameWorld.initialized = true;
    console.log('Game world initialized (no food, multiplayer only)');
  }
  
  private startBroadcasting() {
    setInterval(() => {
      this.gameServers.forEach((serverInstance) => {
        const { wss, gameWorld, serverId } = serverInstance;
        
        if (wss.clients.size > 0) {
          const worldMessage = JSON.stringify({
            type: 'gameWorld',
            bots: gameWorld.bots,
            players: Array.from(gameWorld.players.values())
          });
          
          console.log(`Broadcasting to ${wss.clients.size} clients on server ${serverId}: ${gameWorld.players.size} players`);
          
          wss.clients.forEach((client: any) => {
            if (client.readyState === WebSocket.OPEN) {
              try {
                client.send(worldMessage);
              } catch (error) {
                console.error('Broadcast error:', error);
                client.terminate();
              }
            } else {
              client.terminate();
            }
          });
        }
      });
    }, 100);
  }
}