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
    // Start with a decent length snake (10 segments)
    this.segments = [];
    for (let i = 0; i < 10; i++) {
      this.segments.push({ x: x - i * 20, y });
    }
    this.speed = 3;
    this.radius = 12;
  }
  
  get head() {
    return this.segments[0];
  }
  
  get length() {
    return this.segments.length;
  }
  
  move(direction: Position, isGrowing: boolean = false) {
    // Move head toward target
    const newHead = {
      x: this.head.x + direction.x,
      y: this.head.y + direction.y
    };
    
    // Add new head at front
    this.segments.unshift(newHead);
    
    // Only remove tail if NOT growing (this prevents infinite growth)
    if (!isGrowing) {
      this.segments.pop();
    }
    
    // Keep segments at proper distance - make body follow smoothly
    for (let i = 1; i < this.segments.length; i++) {
      const current = this.segments[i];
      const previous = this.segments[i - 1];
      
      const dx = previous.x - current.x;
      const dy = previous.y - current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const segmentDistance = this.radius * 1.8; // Tighter spacing
      
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
  
  // Game constants - fullscreen
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const MAP_WIDTH = 4000;
  const MAP_HEIGHT = 4000;
  const FOOD_COUNT = 150;

  // Handle canvas resize for fullscreen
  useEffect(() => {
    const updateCanvasSize = () => {
      setCanvasSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

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
      const worldX = mouseX - canvasSize.width/2 + snake.head.x;
      const worldY = mouseY - canvasSize.height/2 + snake.head.y;
      
      setTargetMouse({ x: worldX, y: worldY });
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    return () => canvas.removeEventListener('mousemove', handleMouseMove);
  }, [snake.head.x, snake.head.y, canvasSize]);

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

      // Check if snake will eat food this frame
      let willGrow = false;
      const currentHead = snake.head;
      
      // Check food collision first to determine if growing
      for (let i = 0; i < foods.length; i++) {
        const food = foods[i];
        const dist = Math.sqrt((currentHead.x + direction.x - food.x) ** 2 + (currentHead.y + direction.y - food.y) ** 2);
        if (dist < snake.radius + food.size) {
          willGrow = true;
          break;
        }
      }

      // Move snake (only grows if eating food)
      snake.move(direction, willGrow);

      // Check map boundaries (death barrier)
      const updatedHead = snake.head;
      if (updatedHead.x < 0 || updatedHead.x > MAP_WIDTH || updatedHead.y < 0 || updatedHead.y > MAP_HEIGHT) {
        setGameOver(true);
        return;
      }

      // Update food array after eating
      setFoods(prevFoods => {
        const newFoods = [...prevFoods];
        
        for (let i = newFoods.length - 1; i >= 0; i--) {
          const food = newFoods[i];
          const dist = Math.sqrt((updatedHead.x - food.x) ** 2 + (updatedHead.y - food.y) ** 2);
          
          if (dist < snake.radius + food.size) {
            // Remove eaten food and add new one
            newFoods.splice(i, 1);
            newFoods.push({
              x: Math.random() * MAP_WIDTH,
              y: Math.random() * MAP_HEIGHT,
              size: 3 + Math.random() * 8,
              color: `hsl(${Math.random() * 360}, 60%, 60%)`
            });
            break; // Only eat one food per frame
          }
        }
        
        return newFoods;
      });

      // Clear canvas
      ctx.fillStyle = '#2c2c54';
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

      // Save context for camera transform
      ctx.save();

      // Camera follows snake head
      ctx.translate(canvasSize.width/2 - snake.head.x, canvasSize.height/2 - snake.head.y);

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
        const snakeHead = snake.head;
        const eyeAngle = Math.atan2(targetMouse.y - snakeHead.y, targetMouse.x - snakeHead.x);
        const eyeDistance = 8;
        const eyeSize = 4;
        const pupilSize = 2;
        
        // Eye positions
        const eye1X = snakeHead.x + Math.cos(eyeAngle + Math.PI/2) * eyeDistance;
        const eye1Y = snakeHead.y + Math.sin(eyeAngle + Math.PI/2) * eyeDistance;
        const eye2X = snakeHead.x + Math.cos(eyeAngle - Math.PI/2) * eyeDistance;
        const eye2Y = snakeHead.y + Math.sin(eyeAngle - Math.PI/2) * eyeDistance;
        
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
  }, [targetMouse, snake, foods, gameOver, canvasSize]);

  const resetGame = () => {
    setGameOver(false);
    // Reset snake to initial length
    snake.segments = [];
    for (let i = 0; i < 10; i++) {
      snake.segments.push({ x: 2000 - i * 20, y: 2000 });
    }
    setTargetMouse({ x: 2000, y: 2000 });
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* UI Overlay */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-4">
        <button
          onClick={onExit}
          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
        >
          Exit
        </button>
        <div className="text-white font-bold">DAMNBRUH</div>
        <div className="text-white text-sm">Length: {snake.length}</div>
        {gameOver && (
          <button
            onClick={resetGame}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
          >
            Play Again
          </button>
        )}
      </div>
      
      {gameOver && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="text-red-500 text-4xl font-bold text-center">
            Game Over!
            <div className="text-white text-lg mt-2">You hit the death barrier!</div>
          </div>
        </div>
      )}
      
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="cursor-none block"
        style={{ background: '#2c2c54' }}
      />
    </div>
  );
}