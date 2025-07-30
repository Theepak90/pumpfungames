import { useEffect, useRef, useState } from "react";
import { WebSocketMessage, GameState } from "@shared/schema";

export function useWebSocket(userId: string | null) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    if (!userId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setIsConnected(true);
      // Authenticate with the server
      sendMessage({
        type: 'authenticate',
        payload: { userId }
      });
    };

    ws.current.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        switch (message.type) {
          case 'game_state':
          case 'game_update':
            setGameState(message.payload);
            break;
          default:
            console.log('Received message:', message);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    ws.current.onclose = () => {
      setIsConnected(false);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [userId]);

  const sendMessage = (message: WebSocketMessage) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  const joinGame = (gameId: string) => {
    sendMessage({
      type: 'join_game',
      payload: { gameId }
    });
  };

  const move = (direction: string) => {
    sendMessage({
      type: 'move',
      payload: { direction }
    });
  };

  const leaveGame = () => {
    sendMessage({
      type: 'leave_game',
      payload: {}
    });
  };

  return {
    isConnected,
    gameState,
    joinGame,
    move,
    leaveGame,
    sendMessage
  };
}
