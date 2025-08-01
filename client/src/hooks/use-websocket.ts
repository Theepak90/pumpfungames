import { useEffect, useRef, useState } from "react";
import { WebSocketMessage, GameState } from "@shared/schema";

export function useWebSocket(userId: string | null) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    // Phase 1: Make WebSocket connection completely optional
    if (!userId) return;

    // Wrap WebSocket logic in try/catch to prevent breaking local gameplay
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
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
              console.log('Game state received:', message.payload);
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
        console.log('WebSocket disconnected');
        setIsConnected(false);
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      return () => {
        if (ws.current) {
          ws.current.close();
        }
      };
    } catch (error) {
      console.error('WebSocket initialization failed:', error);
      setIsConnected(false);
      // Fail silently to not break local gameplay
    }
  }, [userId]);

  const sendMessage = (message: WebSocketMessage) => {
    try {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      // Fail silently to not break local gameplay
    }
  };

  const joinGame = (gameId: string) => {
    try {
      console.log('Joining game:', gameId);
      sendMessage({
        type: 'join_game',
        payload: { gameId }
      });
    } catch (error) {
      console.error('Failed to join game:', error);
    }
  };

  const move = (direction: string) => {
    try {
      sendMessage({
        type: 'move',
        payload: { direction }
      });
    } catch (error) {
      console.error('Failed to send move:', error);
    }
  };

  const leaveGame = () => {
    try {
      sendMessage({
        type: 'leave_game',
        payload: {}
      });
    } catch (error) {
      console.error('Failed to leave game:', error);
    }
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
