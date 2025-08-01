import { RegionManager, getWebSocketUrl } from './regionManager';

export interface MultiplayerPlayer {
  id: string;
  x: number;
  y: number;
  angle: number;
  mass: number;
  money: number;
  color: string;
  segments: Array<{ x: number; y: number; opacity: number }>;
  isBoosting: boolean;
  isAlive: boolean;
}

export interface MultiplayerFood {
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

export interface WebSocketGameMessage {
  type: 'connected' | 'joined_room' | 'game_state' | 'player_joined' | 'player_left' | 
        'player_update' | 'player_boost' | 'player_died' | 'food_eaten' | 'foods_expired';
  [key: string]: any;
}

export class MultiplayerWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private selectedRegion: string | null = null;
  
  // Event handlers
  public onConnected: ((data: any) => void) | null = null;
  public onJoinedRoom: ((data: any) => void) | null = null;
  public onGameState: ((data: any) => void) | null = null;
  public onPlayerJoined: ((data: any) => void) | null = null;
  public onPlayerLeft: ((data: any) => void) | null = null;
  public onPlayerUpdate: ((data: any) => void) | null = null;
  public onPlayerBoost: ((data: any) => void) | null = null;
  public onPlayerDied: ((data: any) => void) | null = null;
  public onFoodEaten: ((data: any) => void) | null = null;
  public onFoodsExpired: ((data: any) => void) | null = null;
  public onConnectionError: ((error: string) => void) | null = null;
  public onDisconnected: (() => void) | null = null;

  constructor() {
    // Auto-detect region on initialization
    this.selectedRegion = RegionManager.detectRegionFromTimezone();
  }

  public setRegion(regionId: string) {
    this.selectedRegion = regionId;
  }

  public async connect(): Promise<boolean> {
    try {
      const wsUrl = getWebSocketUrl(this.selectedRegion || undefined);
      console.log(`Connecting to WebSocket: ${wsUrl} (${this.selectedRegion || 'auto'} region)`);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected successfully');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketGameMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        this.onDisconnected?.();
        
        // Attempt to reconnect if it wasn't a normal closure
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onConnectionError?.('WebSocket connection failed');
      };

      return new Promise((resolve) => {
        const checkConnection = () => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            resolve(true);
          } else if (this.ws?.readyState === WebSocket.CLOSED) {
            resolve(false);
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.onConnectionError?.('Failed to connect to game server');
      return false;
    }
  }

  private scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private handleMessage(message: WebSocketGameMessage) {
    switch (message.type) {
      case 'connected':
        this.onConnected?.(message);
        break;
      case 'joined_room':
        this.onJoinedRoom?.(message);
        break;
      case 'game_state':
        this.onGameState?.(message);
        break;
      case 'player_joined':
        this.onPlayerJoined?.(message);
        break;
      case 'player_left':
        this.onPlayerLeft?.(message);
        break;
      case 'player_update':
        this.onPlayerUpdate?.(message);
        break;
      case 'player_boost':
        this.onPlayerBoost?.(message);
        break;
      case 'player_died':
        this.onPlayerDied?.(message);
        break;
      case 'food_eaten':
        this.onFoodEaten?.(message);
        break;
      case 'foods_expired':
        this.onFoodsExpired?.(message);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  public joinGame(playerData: {
    x: number;
    y: number;
    angle: number;
    mass: number;
    money: number;
    color: string;
    segments: Array<{ x: number; y: number; opacity: number }>;
  }) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'join',
        ...playerData
      });
    }
  }

  public sendPlayerMove(moveData: {
    x: number;
    y: number;
    angle: number;
    mass: number;
    money: number;
    segments: Array<{ x: number; y: number; opacity: number }>;
    isBoosting: boolean;
  }) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'move',
        ...moveData
      });
    }
  }

  public sendPlayerBoost(isBoosting: boolean) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'boost',
        isBoosting
      });
    }
  }

  public sendPlayerDeath(deathData: {
    x: number;
    y: number;
    mass: number;
    money: number;
    segments: Array<{ x: number; y: number; opacity: number }>;
  }) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'death',
        ...deathData
      });
    }
  }

  public sendFoodEaten(foodId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'food_eaten',
        foodId
      });
    }
  }

  private send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public getConnectionState(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }
}