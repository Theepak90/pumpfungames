import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface FreshSnakeProps {
  onExit: () => void;
}

export function FreshSnake({ onExit }: FreshSnakeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mouseX, setMouseX] = useState(400);
  const [mouseY, setMouseY] = useState(300);
  
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;

  // Handle mouse movement
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      setMouseX(e.clientX - rect.left);
      setMouseY(e.clientY - rect.top);
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    return () => canvas.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Clear canvas
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      
      for (let x = 0; x <= CANVAS_WIDTH; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      
      for (let y = 0; y <= CANVAS_HEIGHT; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // Draw simple snake head that follows mouse
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 10, 0, 2 * Math.PI);
      ctx.fill();

      requestAnimationFrame(render);
    };

    render();
  }, [mouseX, mouseY]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      <div className="bg-gray-900 p-4 flex justify-between items-center">
        <h1 className="text-white text-xl font-bold">Fresh Snake Game</h1>
        <Button onClick={onExit} className="bg-red-600 hover:bg-red-700">
          Exit
        </Button>
      </div>
      
      <div className="flex-1 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border border-gray-600"
          style={{ cursor: 'none' }}
        />
      </div>
    </div>
  );
}