import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { GameState } from "@shared/schema";
import { LogOut, Users, Trophy } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

interface SnakeGameProps {
  gameState: GameState;
  onMove: (direction: string) => void;
  onLeave: () => void;
}

export function SnakeGame({ gameState, onMove, onLeave }: SnakeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { user } = useAuth();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [gameTime, setGameTime] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState<any>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0 });

  // Update game timer
  useEffect(() => {
    const timer = setInterval(() => {
      setGameTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Find current player
  useEffect(() => {
    if (user && gameState.players) {
      const player = gameState.players.find(p => p.id === user.id);
      setCurrentPlayer(player);
    }
  }, [user, gameState.players]);

  // Handle fullscreen canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Handle mouse movement for slither.io style controls
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      setMousePos({ x: mouseX, y: mouseY });
      
      // Calculate direction from center to mouse
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      const dx = mouseX - centerX;
      const dy = mouseY - centerY;
      const angle = Math.atan2(dy, dx);
      
      // Send movement direction to server
      onMove(angle.toString());
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) { // Left click for boost
        // TODO: Implement boost functionality
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onMove]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Clear canvas with dark background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update camera to follow current player (but don't cause re-render)
      let cameraX = camera.x;
      let cameraY = camera.y;
      if (currentPlayer && currentPlayer.snake.segments.length > 0) {
        const head = currentPlayer.snake.segments[0];
        cameraX = head.x - canvas.width / 2;
        cameraY = head.y - canvas.height / 2;
      }

      // Save context for camera transform
      ctx.save();
      ctx.translate(-cameraX, -cameraY);

      // Draw grid pattern
      drawGrid(ctx, canvas.width, canvas.height, cameraX, cameraY);
      
      // Draw food
      drawFood(ctx);
      
      // Draw all snakes
      drawSnakes(ctx);
      
      // Draw snake names
      drawPlayerNames(ctx);

      // Restore context
      ctx.restore();

      // Draw UI overlay (not affected by camera)
      drawUI(ctx, canvas.width, canvas.height);
    };

    render();
  }, [gameState, currentPlayer]);

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, cameraX: number, cameraY: number) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    
    const gridSize = 50;
    const startX = Math.floor(cameraX / gridSize) * gridSize;
    const startY = Math.floor(cameraY / gridSize) * gridSize;
    
    // Vertical lines
    for (let x = startX; x < cameraX + width + gridSize; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, cameraY);
      ctx.lineTo(x, cameraY + height);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = startY; y < cameraY + height + gridSize; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(cameraX, y);
      ctx.lineTo(cameraX + width, y);
      ctx.stroke();
    }
  };

  const drawFood = (ctx: CanvasRenderingContext2D) => {
    gameState.food.forEach(food => {
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(food.position.x, food.position.y, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  };

  const drawSnakes = (ctx: CanvasRenderingContext2D) => {
    gameState.players.forEach(player => {
      if (!player.isAlive || !player.snake.segments.length) return;

      // Draw snake body with smooth segments
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      player.snake.segments.forEach((segment, index) => {
        const radius = index === 0 ? 12 : Math.max(6, 12 - index * 0.5);
        const alpha = index === 0 ? 1 : Math.max(0.6, 1 - (index * 0.02));
        
        ctx.globalAlpha = alpha;
        ctx.fillStyle = player.color;
        
        // Add glow effect
        ctx.shadowColor = player.color;
        ctx.shadowBlur = 8;
        
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw eyes on head
        if (index === 0) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(segment.x - 4, segment.y - 4, 3, 0, 2 * Math.PI);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(segment.x + 4, segment.y - 4, 3, 0, 2 * Math.PI);
          ctx.fill();
          
          ctx.fillStyle = 'black';
          ctx.beginPath();
          ctx.arc(segment.x - 4, segment.y - 4, 1.5, 0, 2 * Math.PI);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(segment.x + 4, segment.y - 4, 1.5, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
      
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    });
  };

  const drawPlayerNames = (ctx: CanvasRenderingContext2D) => {
    gameState.players.forEach(player => {
      if (!player.isAlive || !player.snake.segments.length) return;
      
      const head = player.snake.segments[0];
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3;
      
      const text = `${player.username} (${player.kills})`;
      ctx.strokeText(text, head.x, head.y - 20);
      ctx.fillText(text, head.x, head.y - 20);
    });
  };

  const drawUI = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Draw score and stats in top left
    if (currentPlayer) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(20, 20, 200, 80);
      
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Score: ${currentPlayer.kills}`, 30, 45);
      
      ctx.fillStyle = 'white';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText(`Length: ${currentPlayer.snake.segments.length}`, 30, 65);
      ctx.fillText(`Earnings: $${currentPlayer.earnings.toFixed(2)}`, 30, 85);
    }
    
    // Draw alive players count in top right
    const alivePlayers = gameState.players.filter(p => p.isAlive);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(width - 150, 20, 130, 40);
    
    ctx.fillStyle = '#00FF88';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${alivePlayers.length} alive`, width - 25, 45);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const alivePlayers = gameState.players.filter(p => p.isAlive);

  return (
    <div className="fixed inset-0 bg-black">
      {/* Fullscreen Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-none"
        style={{ background: '#0a0a0a' }}
      />
      
      {/* Game UI Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top Bar */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-auto">
          <div className="bg-black/80 rounded-lg px-4 py-2 backdrop-blur-sm">
            <div className="flex items-center space-x-4 text-white">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-green-400" />
                <span className="text-sm">{alivePlayers.length} alive</span>
              </div>
              <div className="flex items-center space-x-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span className="text-sm">${gameState.betAmount}/kill</span>
              </div>
              <div className="text-sm">{formatTime(gameTime)}</div>
            </div>
          </div>
          
          <Button
            onClick={onLeave}
            variant="destructive"
            size="sm"
            className="bg-red-600/90 hover:bg-red-700/90 backdrop-blur-sm"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Leave Game
          </Button>
        </div>

        {/* Leaderboard - Top Right */}
        <div className="absolute top-20 right-4 bg-black/80 rounded-lg p-3 backdrop-blur-sm max-w-xs">
          <div className="text-white text-sm space-y-1">
            <div className="font-semibold mb-2 text-yellow-400">Leaderboard</div>
            {alivePlayers
              .sort((a, b) => b.kills - a.kills)
              .slice(0, 5)
              .map((player, index) => (
                <div key={player.id} className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className="w-4 text-center">{index + 1}.</span>
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: player.color }}
                    />
                    <span className={player.id === user?.id ? 'text-yellow-400 font-semibold' : ''}>
                      {player.username}
                    </span>
                  </div>
                  <span className="text-green-400">{player.kills}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Instructions - Bottom Center */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 rounded-lg px-4 py-2 backdrop-blur-sm">
          <div className="text-white text-sm text-center">
            <div className="font-semibold mb-1">Controls</div>
            <div className="text-gray-300">
              Move mouse to steer • Left click to boost • Eat food to grow • Kill snakes to earn ${gameState.betAmount}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
