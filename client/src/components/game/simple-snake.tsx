import { useRef, useEffect } from 'react';

interface SimpleSnakeProps {
  onExit: () => void;
}

export function SimpleSnake({ onExit }: SimpleSnakeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add text indicating ready for instructions
    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Ready for new snake game instructions...', canvas.width / 2, canvas.height / 2);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onExit}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Back to Menu
        </button>
        <h2 className="text-2xl font-bold text-white">Snake Game - Ready for Instructions</h2>
      </div>
      
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border border-gray-300 bg-black"
      />
    </div>
  );
}