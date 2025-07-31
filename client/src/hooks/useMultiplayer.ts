import { useState, useEffect, useRef, useCallback } from 'react';

interface MultiplayerPlayer {
  id: string;
  x: number;
  y: number;
  angle: number;
  segments: Array<{ x: number; y: number; opacity: number }>;
  totalMass: number;
  money: number;
  isBoosting: boolean;
  isAlive: boolean;
  color: string;
  name?: string;
}

interface MultiplayerFood {
  id: string;
  x: number;
  y: number;
  size: number;
  mass: number;
  color: string;
  type: 'normal' | 'money';
  value?: number;
}

interface UseMultiplayerReturn {
  isConnected: boolean;
  currentPlayer: MultiplayerPlayer | null;
  otherPlayers: MultiplayerPlayer[];
  foods: MultiplayerFood[];
  sendPlayerUpdate: (playerData: Partial<MultiplayerPlayer>) => void;
  sendFoodEaten: (foodId: string) => void;
  sendDeath: () => void;
  connect: () => void;
  disconnect: () => void;
}

export function useMultiplayer(): UseMultiplayerReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<MultiplayerPlayer | null>(null);
  const [otherPlayers, setOtherPlayers] = useState<MultiplayerPlayer[]>([]);
  const [foods, setFoods] = useState<MultiplayerFood[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('Connecting to multiplayer server:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to multiplayer server');
      setIsConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from multiplayer server');
      setIsConnected(false);
      setCurrentPlayer(null);
      setOtherPlayers([]);
      
      // Auto-reconnect after 3 seconds
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleServerMessage(message);
      } catch (error) {
        console.error('Error parsing server message:', error);
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setCurrentPlayer(null);
    setOtherPlayers([]);
  }, []);

  const sendPlayerUpdate = useCallback((playerData: Partial<MultiplayerPlayer>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'move',
        ...playerData
      }));
    }
  }, []);

  const sendFoodEaten = useCallback((foodId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'eatFood',
        foodId
      }));
    }
  }, []);

  const sendDeath = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'death'
      }));
    }
  }, []);

  const handleServerMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'init':
        console.log('Initialized as player:', message.playerId);
        setCurrentPlayer(message.player);
        setOtherPlayers(message.players);
        setFoods(message.foods);
        break;

      case 'gameState':
        // Update all player positions
        const updatedPlayers = message.players as MultiplayerPlayer[];
        const currentPlayerId = currentPlayer?.id;
        
        if (currentPlayerId) {
          const updatedCurrentPlayer = updatedPlayers.find(p => p.id === currentPlayerId);
          if (updatedCurrentPlayer) {
            setCurrentPlayer(updatedCurrentPlayer);
          }
          
          setOtherPlayers(updatedPlayers.filter(p => p.id !== currentPlayerId));
        }
        break;

      case 'playerJoined':
        console.log('Player joined:', message.player.id);
        setOtherPlayers(prev => [...prev, message.player]);
        break;

      case 'playerLeft':
        console.log('Player left:', message.playerId);
        setOtherPlayers(prev => prev.filter(p => p.id !== message.playerId));
        break;

      case 'foodEaten':
        setFoods(prev => prev.filter(f => f.id !== message.foodId));
        break;

      case 'newFood':
        setFoods(prev => [...prev, message.food]);
        break;

      case 'deathFoodCreated':
        setFoods(prev => [...prev, ...message.foods]);
        break;

      case 'playerRespawned':
        if (message.player.id === currentPlayer?.id) {
          setCurrentPlayer(message.player);
        } else {
          setOtherPlayers(prev => 
            prev.map(p => p.id === message.player.id ? message.player : p)
          );
        }
        break;

      case 'respawn':
        setCurrentPlayer(message.player);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }, [currentPlayer?.id]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    currentPlayer,
    otherPlayers,
    foods,
    sendPlayerUpdate,
    sendFoodEaten,
    sendDeath,
    connect,
    disconnect
  };
}