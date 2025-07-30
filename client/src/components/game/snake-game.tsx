import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GameState } from "@shared/schema";
import { LogOut } from "lucide-react";
import { Users, Trophy, Clock } from "lucide-react";

interface SnakeGameProps {
  gameState: GameState;
  onMove: (direction: string) => void;
  onLeave: () => void;
}

export function SnakeGame({ gameState, onMove, onLeave }: SnakeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameTime, setGameTime] = useState(0);

  // Update game timer
  useEffect(() => {
    const timer = setInterval(() => {
      setGameTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Render game on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw food
    gameState.food.forEach(food => {
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(food.position.x + 10, food.position.y + 10, 8, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw players
    gameState.players.forEach(player => {
      if (!player.isAlive) return;

      ctx.fillStyle = player.color;
      player.snake.segments.forEach((segment, index) => {
        const alpha = index === 0 ? 1 : Math.max(0.3, 1 - (index * 0.1));
        ctx.globalAlpha = alpha;
        
        ctx.fillRect(segment.x, segment.y, 20, 20);
        
        // Draw eyes on head
        if (index === 0) {
          ctx.fillStyle = 'white';
          ctx.fillRect(segment.x + 4, segment.y + 4, 4, 4);
          ctx.fillRect(segment.x + 12, segment.y + 4, 4, 4);
          ctx.fillStyle = 'black';
          ctx.fillRect(segment.x + 5, segment.y + 5, 2, 2);
          ctx.fillRect(segment.x + 13, segment.y + 5, 2, 2);
          ctx.fillStyle = player.color;
        }
      });
      ctx.globalAlpha = 1;
    });

    // Draw player names and stats
    gameState.players.forEach(player => {
      if (!player.isAlive) return;
      
      const head = player.snake.segments[0];
      ctx.fillStyle = 'white';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${player.username} (${player.kills} kills)`,
        head.x + 10,
        head.y - 5
      );
    });
  }, [gameState]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const alivePlayers = gameState.players.filter(p => p.isAlive);
  const deadPlayers = gameState.players.filter(p => !p.isAlive);

  return (
    <div className="space-y-4">
      {/* Game Info Bar */}
      <Card className="bg-dark-card border-dark-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 neon-green" />
                <span className="text-white">{alivePlayers.length} alive</span>
              </div>
              <div className="flex items-center space-x-2">
                <Trophy className="w-5 h-5 neon-yellow" />
                <span className="text-white">${gameState.betAmount} per kill</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 neon-blue" />
                <span className="text-white">{formatTime(gameTime)}</span>
              </div>
            </div>
            
            <Button
              onClick={onLeave}
              variant="destructive"
              size="sm"
              className="bg-red-600 hover:bg-red-700"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Leave Game
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Game Canvas */}
      <Card className="bg-dark-card border-dark-border">
        <CardContent className="p-0">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full h-auto border-0 rounded-lg"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </CardContent>
      </Card>

      {/* Game Controls Instructions */}
      <Card className="bg-dark-card border-dark-border">
        <CardContent className="p-4">
          <div className="text-center space-y-2">
            <h3 className="text-white font-semibold">Controls</h3>
            <p className="text-gray-400 text-sm">
              Use arrow keys or WASD to move • Eat food to grow • Kill other snakes to earn ${gameState.betAmount}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Live Players List */}
      {gameState.players.length > 0 && (
        <Card className="bg-dark-card border-dark-border">
          <CardHeader className="pb-2">
            <h3 className="text-white font-semibold">Players in Game</h3>
          </CardHeader>
          <CardContent className="space-y-2 max-h-32 overflow-y-auto">
            {alivePlayers.map(player => (
              <div key={player.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: player.color }}
                  />
                  <span className="text-white">{player.username}</span>
                  <span className="text-neon-green">ALIVE</span>
                </div>
                <div className="text-neon-yellow">
                  {player.kills} kills • ${player.earnings.toFixed(2)}
                </div>
              </div>
            ))}
            
            {deadPlayers.map(player => (
              <div key={player.id} className="flex items-center justify-between text-sm opacity-50">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-gray-500" />
                  <span className="text-gray-400">{player.username}</span>
                  <span className="text-red-400">ELIMINATED</span>
                </div>
                <div className="text-gray-400">
                  {player.kills} kills • ${player.earnings.toFixed(2)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
