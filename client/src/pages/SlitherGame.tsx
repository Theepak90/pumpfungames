import { useState, useEffect, useCallback } from 'react';
import { GameState, SnakeData, OrbData, OrbSize } from '../types/GameTypes';
import { MessageType, GameStateUpdateMessage, LeaderboardUpdateMessage } from '../types/MessageTypes';
import GameCanvas from '../components/GameCanvas';
import Leaderboard from '../components/Leaderboard';
import GameCode from '../components/GameCode';
import './SlitherGame.css';

interface SlitherGameProps {
  socket: WebSocket;
  username: string;
  onGameEnd: () => void;
}

export default function SlitherGame({ socket, username, onGameEnd }: SlitherGameProps) {
  const [gameState, setGameState] = useState<GameState>({
    mySnake: null,
    otherSnakes: new Map(),
    orbs: new Set(),
    gameCode: '',
    leaderboard: new Map(),
  });

  const [isConnected, setIsConnected] = useState(true);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case MessageType.SET_GAME_CODE:
          setGameState(prev => ({
            ...prev,
            gameCode: message.data.gameCode,
          }));
          break;

        case MessageType.GAME_STATE_UPDATE:
          const updateMsg = message as GameStateUpdateMessage;
          
          // Find my snake in the update
          const mySnakeData = updateMsg.data.snakes.find(s => s.username === username);
          const otherSnakesData = updateMsg.data.snakes.filter(s => s.username !== username);
          
          // Update snakes
          const otherSnakes = new Map<string, SnakeData>();
          otherSnakesData.forEach(snake => {
            otherSnakes.set(snake.id, {
              id: snake.id,
              username: snake.username,
              snakeBody: snake.body,
              velocityX: 0,
              velocityY: 0,
              color: snake.color,
              score: snake.score,
            });
          });

          // Update orbs
          const orbs = new Set<OrbData>();
          updateMsg.data.orbs.forEach(orb => {
            orbs.add({
              id: orb.id,
              position: { x: orb.x, y: orb.y },
              size: orb.size === 'SMALL' ? OrbSize.SMALL : OrbSize.LARGE,
              color: orb.color,
              mass: orb.mass,
            });
          });

          setGameState(prev => {
            const newState = {
              ...prev,
              otherSnakes,
              orbs,
            };

            // Only update my snake if we received data for it
            if (mySnakeData && (!prev.mySnake || prev.mySnake.snakeBody.length === 0)) {
              newState.mySnake = {
                id: mySnakeData.id,
                username: mySnakeData.username,
                snakeBody: mySnakeData.body,
                velocityX: 0,
                velocityY: 8, // Initial velocity
                color: mySnakeData.color,
                score: mySnakeData.score,
              };
            }

            return newState;
          });
          break;

        case MessageType.UPDATE_LEADERBOARD:
          const leaderboardMsg = message as LeaderboardUpdateMessage;
          const leaderboard = new Map<string, number>();
          leaderboardMsg.data.leaderboard.forEach(entry => {
            leaderboard.set(entry.username, entry.score);
          });
          
          setGameState(prev => ({
            ...prev,
            leaderboard,
          }));
          break;

        case MessageType.SNAKE_DIED:
          // Player died - show death screen and return to home
          alert('You died! Your snake collided with another snake.');
          onGameEnd();
          break;

        case MessageType.OTHER_SNAKE_DIED:
          // Another snake died - remove from game state
          const deadSnakeId = message.data.snakeId;
          setGameState(prev => {
            const newOtherSnakes = new Map(prev.otherSnakes);
            newOtherSnakes.delete(deadSnakeId);
            return {
              ...prev,
              otherSnakes: newOtherSnakes,
            };
          });
          break;

        default:
          console.log('Unhandled message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, [username, onGameEnd]);

  // Setup WebSocket event handlers
  useEffect(() => {
    socket.onmessage = handleMessage;
    
    socket.onclose = () => {
      setIsConnected(false);
      // Give user a moment to see disconnection, then return to home
      setTimeout(() => {
        onGameEnd();
      }, 2000);
    };

    socket.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      // Cleanup handlers
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
    };
  }, [socket, handleMessage, onGameEnd]);

  if (!isConnected) {
    return (
      <div className="connection-lost">
        <div className="connection-lost-message">
          <h2>Connection Lost</h2>
          <p>Returning to main menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="slither-game">
      <GameCanvas 
        gameState={gameState} 
        setGameState={setGameState} 
        socket={socket} 
      />
      <GameCode gameCode={gameState.gameCode} />
      <Leaderboard leaderboard={gameState.leaderboard} />
      
      {/* Score display */}
      {gameState.mySnake && (
        <div className="score-display">
          <div className="current-score">
            Score: {gameState.mySnake.score}
          </div>
          <div className="snake-length">
            Length: {gameState.mySnake.snakeBody.length}
          </div>
        </div>
      )}
    </div>
  );
}