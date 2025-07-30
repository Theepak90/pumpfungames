import { useRef, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

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

class SmoothSnake {
  segments: Position[];
  speed: number;
  radius: number;
  currentAngle: number;
  turnSpeed: number;
  
  constructor(x: number, y: number) {
    // Start with a decent length snake (10 segments)
    this.segments = [];
    for (let i = 0; i < 10; i++) {
      this.segments.push({ x: x - i * 20, y });
    }
    this.speed = 3;
    this.radius = 12;
    this.currentAngle = 0; // Current movement angle
    this.turnSpeed = 0.08; // Smooth turning speed (lower = smoother)
  }
  
  get head() {
    return this.segments[0];
  }
  
  get length() {
    return this.segments.length;
  }
  
  move(targetX: number, targetY: number, isGrowing: boolean = false) {
    // Calculate target angle from head to mouse
    const dx = targetX - this.head.x;
    const dy = targetY - this.head.y;
    const targetAngle = Math.atan2(dy, dx);
    
    // Calculate angle difference and normalize to [-PI, PI]
    let angleDiff = targetAngle - this.currentAngle;
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    // Smoothly interpolate toward target angle
    this.currentAngle += angleDiff * this.turnSpeed;
    
    // Move head in current direction
    const newHead = {
      x: this.head.x + this.speed * Math.cos(this.currentAngle),
      y: this.head.y + this.speed * Math.sin(this.currentAngle)
    };
    
    // Add new head at front
    this.segments.unshift(newHead);
    
    // Only remove tail if NOT growing
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

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setLocation] = useLocation();
  const [targetMouse, setTargetMouse] = useState<Position>({ x: 400, y: 300 });
  const [snake] = useState(new SmoothSnake(2000, 2000)); // Start at center of large map
  const [foods, setFoods] = useState<Food[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  
  // Game constants - fullscreen
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });
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
      // Check if snake will eat food this frame
      let willGrow = false;
      const currentHead = snake.head;
      
      // Check food collision first to determine if growing
      for (let i = 0; i < foods.length; i++) {
        const food = foods[i];
        const dist = Math.sqrt((currentHead.x - food.x) ** 2 + (currentHead.y - food.y) ** 2);
        if (dist < snake.radius + food.size) {
          willGrow = true;
          break;
        }
      }

      // Move snake with smooth turning toward mouse
      snake.move(targetMouse.x, targetMouse.y, willGrow);

      // Check map boundaries (death barrier)
      const updatedHead = snake.head;
      if (updatedHead.x < 0 || updatedHead.x > MAP_WIDTH || updatedHead.y < 0 || updatedHead.y > MAP_HEIGHT) {
        setGameOver(true);
        return;
      }

      // Update food array after eating
      setFoods(prevFoods => {
        const newFoods = [...prevFoods];
        let scoreIncrease = 0;
        
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
            scoreIncrease += Math.floor(food.size);
            break; // Only eat one food per frame
          }
        }
        
        if (scoreIncrease > 0) {
          setScore(prev => prev + scoreIncrease);
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

      // Draw UI (fixed position)
      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px Arial';
      ctx.fillText(`Score: ${score}`, 20, 40);
      ctx.fillText(`Length: ${snake.length}`, 20, 70);
      
      // Draw crosshair at mouse position
      const mouseScreenX = targetMouse.x - snake.head.x + canvasSize.width/2;
      const mouseScreenY = targetMouse.y - snake.head.y + canvasSize.height/2;
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mouseScreenX - 10, mouseScreenY);
      ctx.lineTo(mouseScreenX + 10, mouseScreenY);
      ctx.moveTo(mouseScreenX, mouseScreenY - 10);
      ctx.lineTo(mouseScreenX, mouseScreenY + 10);
      ctx.stroke();

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [targetMouse, snake, foods, gameOver, canvasSize, score]);

  const resetGame = () => {
    setGameOver(false);
    setScore(0);
    // Reset snake to initial length and position
    snake.segments = [];
    for (let i = 0; i < 10; i++) {
      snake.segments.push({ x: 2000 - i * 20, y: 2000 });
    }
    snake.currentAngle = 0;
    setTargetMouse({ x: 2000, y: 2000 });
  };

  const exitGame = () => {
    setLocation('/');
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-dark-bg">
      {/* Exit Button */}
      <div className="absolute top-4 left-4 z-10">
        <Button
          onClick={exitGame}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Exit Game
        </Button>
      </div>
      
      {/* Score Display */}
      <div className="absolute top-4 right-4 z-10">
        <div className="bg-dark-card/80 backdrop-blur-sm border border-dark-border rounded-lg px-4 py-2">
          <div className="text-neon-yellow text-xl font-bold">Score: {score}</div>
          <div className="text-white text-sm">Length: {snake.length}</div>
        </div>
      </div>
      
      {gameOver && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="bg-dark-card/90 backdrop-blur-sm border border-dark-border rounded-lg p-8 text-center">
            <div className="text-red-500 text-4xl font-bold mb-4">Game Over!</div>
            <div className="text-white text-lg mb-2">Final Score: {score}</div>
            <div className="text-white text-lg mb-6">Length: {snake.length}</div>
            <div className="flex gap-4">
              <Button
                onClick={resetGame}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Play Again
              </Button>
              <Button
                onClick={exitGame}
                className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Exit
              </Button>
            </div>
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