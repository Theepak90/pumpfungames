import { useRef, useEffect, useState } from 'react';

interface SimpleSnakeProps {
  onExit: () => void;
}

interface Position {
  x: number;
  y: number;
}

interface Food {
  x: number;
  y: number;
  size: number;
  color: string;
}

class Snake {
  segments: Position[];
  speed: number;
  radius: number;
  
  constructor(x: number, y: number) {
    this.segments = [{ x, y }];
    this.speed = 3;
    this.radius = 12;
  }
  
  get head() {
    return this.segments[0];
  }
  
  get length() {
    return this.segments.length;
  }
  
  move(direction: Position) {
    // Move head toward target
    const newHead = {
      x: this.head.x + direction.x,
      y: this.head.y + direction.y
    };
    
    // Add new head
    this.segments.unshift(newHead);
    
    // Keep segments at proper distance
    for (let i = 1; i < this.segments.length; i++) {
      const current = this.segments[i];
      const previous = this.segments[i - 1];
      
      const dx = previous.x - current.x;
      const dy = previous.y - current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const segmentDistance = this.radius * 2;
      
      if (distance > segmentDistance) {
        const ratio = segmentDistance / distance;
        this.segments[i] = {
          x: previous.x - dx * ratio,
          y: previous.y - dy * ratio
        };
      }
    }
  }
  
  grow(amount: number) {
    const tail = this.segments[this.segments.length - 1];
    for (let i = 0; i < amount; i++) {
      this.segments.push({ ...tail });
    }
  }
}

export function SimpleSnake({ onExit }: SimpleSnakeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [targetMouse, setTargetMouse] = useState<Position>({ x: 400, y: 300 });
  const [snake] = useState(new Snake(2000, 2000)); // Start at center of large map
  const [foods, setFoods] = useState<Food[]>([]);
  const [gameOver, setGameOver] = useState(false);
  
  // Game constants
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const MAP_WIDTH = 4000;
  const MAP_HEIGHT = 4000;
  const FOOD_COUNT = 150;

  // Initialize food
  useEffect(() => {
    const initialFoods: Food[] = [];
    for (let i = 0; i < FOOD_COUNT; i++) {
      initialFoods.push({
        x: Math.random() * MAP_WIDTH,
        y: Math.random() * MAP_HEIGHT,
        size: 3 + Math.random() * 8,
        color: `hsl(${Math.random() * 360}, 60%, 60%)`
      });
    }
    setFoods(initialFoods);
  }, []);

  // Mouse tracking
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Convert screen coordinates to world coordinates
      const worldX = mouseX - CANVAS_WIDTH/2 + snake.head.x;
      const worldY = mouseY - CANVAS_HEIGHT/2 + snake.head.y;
      
      setTargetMouse({ x: worldX, y: worldY });
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    return () => canvas.removeEventListener('mousemove', handleMouseMove);
  }, [snake.head.x, snake.head.y]);

  // Game loop
  useEffect(() => {
    if (gameOver) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    
    const gameLoop = () => {
      // Calculate direction to mouse
      const dx = targetMouse.x - snake.head.x;
      const dy = targetMouse.y - snake.head.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      let direction = { x: 0, y: 0 };
      if (distance > 0) {
        direction = {
          x: (dx / distance) * snake.speed,
          y: (dy / distance) * snake.speed
        };
      }

      // Move snake
      snake.move(direction);

      // Check map boundaries (death barrier)
      const head = snake.head;
      if (head.x < 0 || head.x > MAP_WIDTH || head.y < 0 || head.y > MAP_HEIGHT) {
        setGameOver(true);
        return;
      }

      // Food collision detection
      setFoods(prevFoods => {
        const newFoods = [...prevFoods];
        let hasEaten = false;
        
        for (let i = newFoods.length - 1; i >= 0; i--) {
          const food = newFoods[i];
          const dist = Math.sqrt((head.x - food.x) ** 2 + (head.y - food.y) ** 2);
          
          if (dist < snake.radius + food.size) {
            // Eat food
            snake.grow(3);
            newFoods.splice(i, 1);
            hasEaten = true;
            
            // Add new food to maintain count
            newFoods.push({
              x: Math.random() * MAP_WIDTH,
              y: Math.random() * MAP_HEIGHT,
              size: 3 + Math.random() * 8,
              color: `hsl(${Math.random() * 360}, 60%, 60%)`
            });
          }
        }
        
        return hasEaten ? newFoods : prevFoods;
      });

      // Clear canvas
      ctx.fillStyle = '#2c2c54';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Save context for camera transform
      ctx.save();

      // Camera follows snake head
      ctx.translate(CANVAS_WIDTH/2 - snake.head.x, CANVAS_HEIGHT/2 - snake.head.y);

      // Draw map grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      const gridSize = 50;
      
      for (let x = 0; x <= MAP_WIDTH; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, MAP_HEIGHT);
        ctx.stroke();
      }
      
      for (let y = 0; y <= MAP_HEIGHT; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(MAP_WIDTH, y);
        ctx.stroke();
      }

      // Draw map boundaries
      ctx.strokeStyle = '#ff3333';
      ctx.lineWidth = 4;
      ctx.setLineDash([20, 10]);
      ctx.strokeRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
      ctx.setLineDash([]);

      // Draw food
      foods.forEach(food => {
        ctx.fillStyle = food.color;
        ctx.beginPath();
        ctx.arc(food.x, food.y, food.size, 0, 2 * Math.PI);
        ctx.fill();
        
        // Food glow effect
        ctx.shadowColor = food.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw snake body
      snake.segments.forEach((segment, index) => {
        const isHead = index === 0;
        const radius = isHead ? snake.radius : Math.max(6, snake.radius - index * 0.3);
        
        // Body gradient
        const gradient = ctx.createRadialGradient(
          segment.x, segment.y, 0,
          segment.x, segment.y, radius
        );
        gradient.addColorStop(0, '#ff8c42');
        gradient.addColorStop(0.7, '#ff6b1a');
        gradient.addColorStop(1, '#cc4400');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Body border
        ctx.strokeStyle = '#994400';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // Draw eyes that follow mouse
      if (snake.segments.length > 0) {
        const head = snake.head;
        const eyeAngle = Math.atan2(targetMouse.y - head.y, targetMouse.x - head.x);
        const eyeDistance = 8;
        const eyeSize = 4;
        const pupilSize = 2;
        
        // Eye positions
        const eye1X = head.x + Math.cos(eyeAngle + Math.PI/2) * eyeDistance;
        const eye1Y = head.y + Math.sin(eyeAngle + Math.PI/2) * eyeDistance;
        const eye2X = head.x + Math.cos(eyeAngle - Math.PI/2) * eyeDistance;
        const eye2Y = head.y + Math.sin(eyeAngle - Math.PI/2) * eyeDistance;
        
        // White eyes
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeSize, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eye2X, eye2Y, eyeSize, 0, 2 * Math.PI);
        ctx.fill();
        
        // Black pupils looking at mouse
        const pupilOffset = 2;
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(
          eye1X + Math.cos(eyeAngle) * pupilOffset, 
          eye1Y + Math.sin(eyeAngle) * pupilOffset, 
          pupilSize, 0, 2 * Math.PI
        );
        ctx.fill();
        ctx.beginPath();
        ctx.arc(
          eye2X + Math.cos(eyeAngle) * pupilOffset, 
          eye2Y + Math.sin(eyeAngle) * pupilOffset, 
          pupilSize, 0, 2 * Math.PI
        );
        ctx.fill();
      }

      // Restore context
      ctx.restore();

      // Draw UI
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.fillText(`Length: ${snake.length}`, 20, 30);
      ctx.fillText(`Position: ${Math.round(snake.head.x)}, ${Math.round(snake.head.y)}`, 20, 60);

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [targetMouse, snake, foods, gameOver]);

  const resetGame = () => {
    setGameOver(false);
    snake.segments = [{ x: 2000, y: 2000 }];
    setTargetMouse({ x: 2000, y: 2000 });
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onExit}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Back to Menu
        </button>
        <h2 className="text-2xl font-bold text-white">DAMNBRUH Snake Game</h2>
        {gameOver && (
          <button
            onClick={resetGame}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Play Again
          </button>
        )}
      </div>
      
      {gameOver && (
        <div className="text-red-500 text-xl font-bold">
          Game Over! You hit the death barrier!
        </div>
      )}
      
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-gray-400 cursor-none"
        style={{ background: '#2c2c54' }}
      />
      
      <div className="text-white text-sm">
        Move your mouse to control the snake. Eat the colored food to grow!
      </div>
    </div>
  );
}