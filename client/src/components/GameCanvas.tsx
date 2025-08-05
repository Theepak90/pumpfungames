import { useEffect, useRef, useState, useCallback } from 'react';
import { Position, GameState, GAME_CONFIG, SnakeData } from '../types/GameTypes';
import { MessageType, UpdatePositionMessage } from '../types/MessageTypes';
import Snake from './Snake';
import Orb from './Orb';
import './GameCanvas.css';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  socket: WebSocket | null;
}

export default function GameCanvas({ gameState, setGameState, socket }: GameCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState<Position>({ x: 0, y: 0 });
  const [cameraOffset, setCameraOffset] = useState<Position>({ x: 0, y: 0 });
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const animationFrameRef = useRef<number>();

  // Handle mouse movement for snake direction
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  // Move snake towards mouse position (slither-plus style)
  const moveSnake = useCallback((snake: SnakeData, deltaTime: number): SnakeData => {
    if (!snake || snake.snakeBody.length === 0) return snake;

    const head = snake.snakeBody[0];
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // Calculate desired direction towards mouse
    const targetAngle = Math.atan2(
      mousePosition.y - centerY,
      mousePosition.x - centerX
    );

    // Current velocity angle
    let currentAngle = Math.atan2(snake.velocityY, snake.velocityX);
    
    // Smooth turning towards target (slither-plus style)
    let angleDiff = targetAngle - currentAngle;
    
    // Normalize angle difference to [-π, π]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    // Apply turn rate limit
    const maxTurn = GAME_CONFIG.maxTurnRate * deltaTime / 16.67; // Normalize to 60 FPS
    const turnAmount = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
    currentAngle += turnAmount;

    // Update velocity based on new angle
    const newVelocityX = GAME_CONFIG.snakeVelocity * Math.cos(currentAngle);
    const newVelocityY = GAME_CONFIG.snakeVelocity * Math.sin(currentAngle);

    // Calculate new head position
    const newHead: Position = {
      x: head.x + newVelocityX * deltaTime / 16.67,
      y: head.y + newVelocityY * deltaTime / 16.67,
    };

    // Create new snake body
    const newBody = [newHead, ...snake.snakeBody];
    const tail = newBody.pop(); // Remove last segment

    // Send position update to server
    if (socket && socket.readyState === WebSocket.OPEN && tail) {
      const message: UpdatePositionMessage = {
        type: MessageType.UPDATE_POSITION,
        data: {
          newHead: { x: Math.round(newHead.x * 100) / 100, y: Math.round(newHead.y * 100) / 100 },
          removeTail: { x: Math.round(tail.x * 100) / 100, y: Math.round(tail.y * 100) / 100 },
        },
      };
      socket.send(JSON.stringify(message));
    }

    return {
      ...snake,
      snakeBody: newBody,
      velocityX: newVelocityX,
      velocityY: newVelocityY,
    };
  }, [mousePosition, socket]);

  // Game loop
  const gameLoop = useCallback(() => {
    const currentTime = Date.now();
    const deltaTime = currentTime - lastUpdateTimeRef.current;
    lastUpdateTimeRef.current = currentTime;

    if (gameState.mySnake) {
      const updatedSnake = moveSnake(gameState.mySnake, deltaTime);
      
      // Update camera to follow player snake
      const head = updatedSnake.snakeBody[0];
      if (head) {
        setCameraOffset({
          x: window.innerWidth / 2 - head.x,
          y: window.innerHeight / 2 - head.y,
        });
      }

      setGameState({
        ...gameState,
        mySnake: updatedSnake,
      });
    }

    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, moveSnake, setGameState]);

  // Setup mouse tracking and game loop
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [handleMouseMove, gameLoop]);

  return (
    <div ref={canvasRef} className="game-canvas">
      {/* Map boundaries */}
      <div
        className="map-boundary"
        style={{
          left: `${-GAME_CONFIG.mapSize.x / 2 + cameraOffset.x}px`,
          top: `${-GAME_CONFIG.mapSize.y / 2 + cameraOffset.y}px`,
          width: `${GAME_CONFIG.mapSize.x}px`,
          height: `${GAME_CONFIG.mapSize.y}px`,
        }}
      />

      {/* Render orbs */}
      {Array.from(gameState.orbs).map((orb) => (
        <Orb key={orb.id} orb={orb} offset={cameraOffset} />
      ))}

      {/* Render other snakes */}
      {Array.from(gameState.otherSnakes.values()).map((snake) => (
        <Snake key={snake.id} snake={snake} offset={cameraOffset} isMySnake={false} />
      ))}

      {/* Render my snake */}
      {gameState.mySnake && (
        <Snake snake={gameState.mySnake} offset={cameraOffset} isMySnake={true} />
      )}
    </div>
  );
}