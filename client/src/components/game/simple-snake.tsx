import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface SimpleSnakeProps {
  onExit: () => void;
}

interface SnakeSegment {
  x: number;
  y: number;
}

interface Snake {
  segments: SnakeSegment[];
  direction: { x: number; y: number };
}

export function SimpleSnake({ onExit }: SimpleSnakeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snake, setSnake] = useState<Snake>({
    segments: [{ x: 400, y: 300 }],
    direction: { x: 0, y: 0 }
  });
  const [targetDirection, setTargetDirection] = useState({ x: 0, y: 0 });
  
  const GRID_SIZE = 20;
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const SNAKE_SPEED = 3;

  // Track mouse position
  const [mousePos, setMousePos] = useState({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });

  // Handle mouse movement for direction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Update mouse position
      setMousePos({ x: mouseX, y: mouseY });
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    return () => canvas.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Update snake direction based on mouse position
  useEffect(() => {
    const head = snake.segments[0];
    if (!head) return;
    
    // Calculate direction from snake head to mouse
    const dx = mousePos.x - head.x;
    const dy = mousePos.y - head.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 5) { // Only move if mouse is far enough
      setTargetDirection({
        x: (dx / distance) * SNAKE_SPEED,
        y: (dy / distance) * SNAKE_SPEED
      });
    } else {
      // Stop moving when very close to mouse
      setTargetDirection({ x: 0, y: 0 });
    }
  }, [mousePos, snake.segments]);

  // Game loop
  useEffect(() => {
    const gameLoop = setInterval(() => {
      setSnake(prevSnake => {
        const newSnake = { ...prevSnake };
        
        // Smoothly interpolate direction
        newSnake.direction.x += (targetDirection.x - newSnake.direction.x) * 0.1;
        newSnake.direction.y += (targetDirection.y - newSnake.direction.y) * 0.1;
        
        // Move snake head
        const head = { ...newSnake.segments[0] };
        head.x += newSnake.direction.x;
        head.y += newSnake.direction.y;
        
        // Keep snake on screen
        head.x = Math.max(10, Math.min(CANVAS_WIDTH - 10, head.x));
        head.y = Math.max(10, Math.min(CANVAS_HEIGHT - 10, head.y));
        
        // Update segments
        newSnake.segments = [head, ...newSnake.segments.slice(0, 10)]; // Keep 10 segments
        
        return newSnake;
      });
    }, 50);

    return () => clearInterval(gameLoop);
  }, [targetDirection]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Clear canvas
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      
      // Vertical lines
      for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      
      // Horizontal lines
      for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // Draw snake
      snake.segments.forEach((segment, index) => {
        const radius = index === 0 ? 8 : Math.max(4, 8 - index * 0.3);
        const alpha = index === 0 ? 1 : Math.max(0.3, 1 - (index * 0.1));
        
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#FFD700'; // Neon yellow
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw eyes on head
        if (index === 0) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(segment.x - 3, segment.y - 3, 2, 0, 2 * Math.PI);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(segment.x + 3, segment.y - 3, 2, 0, 2 * Math.PI);
          ctx.fill();
          
          ctx.fillStyle = 'black';
          ctx.beginPath();
          ctx.arc(segment.x - 3, segment.y - 3, 1, 0, 2 * Math.PI);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(segment.x + 3, segment.y - 3, 1, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
      
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Draw mouse cursor indicator
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.strokeStyle = '#32CD32';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, 3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Draw line from snake head to mouse
      const head = snake.segments[0];
      if (head) {
        const distance = Math.sqrt(
          (mousePos.x - head.x) ** 2 + (mousePos.y - head.y) ** 2
        );
        
        if (distance > 5) {
          ctx.strokeStyle = 'rgba(50, 205, 50, 0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(head.x, head.y);
          ctx.lineTo(mousePos.x, mousePos.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    };

    const animationId = requestAnimationFrame(function animate() {
      render();
      requestAnimationFrame(animate);
    });

    return () => cancelAnimationFrame(animationId);
  }, [snake]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Game Header */}
      <div className="bg-dark-bg/90 backdrop-blur-sm border-b border-dark-border p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold neon-yellow">DAMNBRUH Snake</h1>
          <Button 
            onClick={onExit}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Exit Game
          </Button>
        </div>
      </div>

      {/* Game Canvas */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="border border-gray-600 rounded-lg"
            style={{ cursor: 'none' }}
          />
          
          {/* Instructions */}
          <div className="absolute top-4 left-4 text-white text-sm bg-black/50 p-2 rounded">
            Move your mouse to control the snake
          </div>
        </div>
      </div>
    </div>
  );
}