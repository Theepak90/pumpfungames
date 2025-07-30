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
  
  const GRID_SIZE = 20;
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const SNAKE_SPEED = 2;
  const DEATH_BARRIER_RADIUS = 350; // Red circle radius
  const CENTER_X = CANVAS_WIDTH / 2;
  const CENTER_Y = CANVAS_HEIGHT / 2;
  
  const [snake, setSnake] = useState<Snake>({
    segments: [{ x: CENTER_X, y: CENTER_Y }],
    direction: { x: SNAKE_SPEED, y: 0 } // Always moving initially
  });
  const [targetDirection, setTargetDirection] = useState({ x: SNAKE_SPEED, y: 0 });

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

  // Update snake direction based on mouse position - use ref for real-time updates
  const mousePosRef = useRef(mousePos);
  mousePosRef.current = mousePos;
  
  const snakeRef = useRef(snake);
  snakeRef.current = snake;

  // Continuous direction updating
  useEffect(() => {
    const updateDirection = () => {
      const head = snakeRef.current.segments[0];
      if (!head) return;
      
      // Calculate direction from snake head to mouse
      const dx = mousePosRef.current.x - head.x;
      const dy = mousePosRef.current.y - head.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Always keep moving - calculate direction to mouse
      setTargetDirection({
        x: (dx / distance) * SNAKE_SPEED,
        y: (dy / distance) * SNAKE_SPEED
      });
    };

    const intervalId = setInterval(updateDirection, 16); // ~60fps updates
    return () => clearInterval(intervalId);
  }, []);

  // Game loop with requestAnimationFrame for smoother movement
  useEffect(() => {
    let animationId: number;
    
    const gameLoop = () => {
      setSnake(prevSnake => {
        const newSnake = { ...prevSnake };
        
        // Much faster and smoother interpolation
        newSnake.direction.x += (targetDirection.x - newSnake.direction.x) * 0.3;
        newSnake.direction.y += (targetDirection.y - newSnake.direction.y) * 0.3;
        
        // Move snake head
        const head = { ...newSnake.segments[0] };
        head.x += newSnake.direction.x;
        head.y += newSnake.direction.y;
        
        // Check death barrier collision and teleport to center
        const distanceFromCenter = Math.sqrt(
          (head.x - CENTER_X) ** 2 + (head.y - CENTER_Y) ** 2
        );
        
        if (distanceFromCenter > DEATH_BARRIER_RADIUS) {
          // Teleport back to center
          head.x = CENTER_X;
          head.y = CENTER_Y;
        }
        
        // Update segments - slither.io style smooth following
        const newSegments = [head];
        const segmentDistance = 16; // Distance between segments
        
        for (let i = 1; i < Math.min(20, prevSnake.segments.length + 1); i++) {
          const prevSegment = newSegments[i - 1];
          const currentSegment = prevSnake.segments[i - 1] || prevSegment;
          
          // Calculate direction from current to previous segment
          const dx = prevSegment.x - currentSegment.x;
          const dy = prevSegment.y - currentSegment.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > segmentDistance) {
            // Move segment towards previous one maintaining fixed distance
            const ratio = (distance - segmentDistance) / distance;
            newSegments.push({
              x: currentSegment.x + dx * ratio,
              y: currentSegment.y + dy * ratio
            });
          } else {
            newSegments.push({ ...currentSegment });
          }
        }
        
        newSnake.segments = newSegments;
        return newSnake;
      });
      
      animationId = requestAnimationFrame(gameLoop);
    };
    
    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [targetDirection]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Clear canvas with dark blue background like slither.io
      ctx.fillStyle = '#2c2c54';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw subtle grid pattern
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
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

      // Draw death barrier (red circle)
      ctx.strokeStyle = '#ff3333';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.arc(CENTER_X, CENTER_Y, DEATH_BARRIER_RADIUS, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw slither.io style snake
      if (snake.segments.length > 1) {
        // Draw snake body with gradient segments
        snake.segments.forEach((segment, index) => {
          const isHead = index === 0;
          const baseRadius = isHead ? 12 : Math.max(8, 12 - index * 0.15);
          
          // Create gradient colors like slither.io
          const hue = 30; // Orange/brown base
          const saturation = isHead ? 80 : Math.max(60, 80 - index * 2);
          const lightness = isHead ? 65 : Math.max(45, 65 - index * 1);
          
          ctx.globalAlpha = 1;
          
          // Draw main segment body
          const gradient = ctx.createRadialGradient(
            segment.x, segment.y, 0,
            segment.x, segment.y, baseRadius
          );
          gradient.addColorStop(0, `hsl(${hue}, ${saturation}%, ${lightness + 20}%)`);
          gradient.addColorStop(0.7, `hsl(${hue}, ${saturation}%, ${lightness}%)`);
          gradient.addColorStop(1, `hsl(${hue}, ${saturation}%, ${lightness - 15}%)`);
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(segment.x, segment.y, baseRadius, 0, 2 * Math.PI);
          ctx.fill();
          
          // Add darker border
          ctx.strokeStyle = `hsl(${hue}, ${saturation}%, ${lightness - 25}%)`;
          ctx.lineWidth = 1;
          ctx.stroke();
          
          // Draw eyes on head only
          if (isHead) {
            const head = snake.segments[0];
            const direction = snake.direction;
            const magnitude = Math.sqrt(direction.x ** 2 + direction.y ** 2);
            
            if (magnitude > 0) {
              const normalizedX = direction.x / magnitude;
              const normalizedY = direction.y / magnitude;
              
              // Eye positions based on movement direction
              const eyeDistance = 6;
              const eyeOffsetX = -normalizedY * eyeDistance;
              const eyeOffsetY = normalizedX * eyeDistance;
              
              // Draw eyes
              ctx.fillStyle = 'white';
              ctx.beginPath();
              ctx.arc(head.x + eyeOffsetX, head.y + eyeOffsetY, 3, 0, 2 * Math.PI);
              ctx.fill();
              ctx.beginPath();
              ctx.arc(head.x - eyeOffsetX, head.y - eyeOffsetY, 3, 0, 2 * Math.PI);
              ctx.fill();
              
              // Eye pupils
              ctx.fillStyle = 'black';
              ctx.beginPath();
              ctx.arc(head.x + eyeOffsetX + normalizedX, head.y + eyeOffsetY + normalizedY, 1.5, 0, 2 * Math.PI);
              ctx.fill();
              ctx.beginPath();
              ctx.arc(head.x - eyeOffsetX + normalizedX, head.y - eyeOffsetY + normalizedY, 1.5, 0, 2 * Math.PI);
              ctx.fill();
            }
          }
        });
      }
      
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