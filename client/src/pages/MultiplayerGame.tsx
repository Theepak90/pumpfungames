import { useRef, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { X, Volume2 } from 'lucide-react';
import dollarSignImageSrc from '@assets/$ (1)_1753992938537.png';

// Game constants
const MAP_CENTER_X = 2000;
const MAP_CENTER_Y = 2000;
const MAP_RADIUS = 1800;
const FOOD_COUNT = 300;

interface Position {
  x: number;
  y: number;
}

interface Food {
  x: number;
  y: number;
  mass: number;
  color: string;
  type?: 'food' | 'money';
  imageType?: 'dollar';
  isTestFood?: boolean;
}

interface MultiplayerSnake {
  id: string;
  name: string;
  head: Position;
  visibleSegments: Array<{ x: number; y: number; opacity: number }>;
  totalMass: number;
  color: string;
  money: number;
  isBoosting: boolean;
}

interface GameState {
  players: MultiplayerSnake[];
  foods: Food[];
  timestamp: number;
}

// Smooth snake class for local player
class SmoothSnake {
  head: Position = { x: MAP_CENTER_X, y: MAP_CENTER_Y };
  currentAngle: number = 0;
  segmentTrail: Position[] = [];
  totalMass: number = 10;
  visibleSegments: Array<{ x: number; y: number; opacity: number }> = [];
  money: number = 1.00;
  isBoosting: boolean = false;
  speed: number = 2;
  baseSpeed: number = 2;
  color: string = '#4CAF50';
  
  readonly START_MASS = 10;
  readonly MIN_MASS_TO_BOOST = 8;
  readonly SEGMENT_DISTANCE = 12;
  readonly BOOST_SPEED_MULTIPLIER = 2;
  readonly BOOST_MASS_LOSS_RATE = 1.5;

  getScaleFactor(): number {
    const baseRadius = 12;
    const maxScale = 3;
    return Math.min(1 + (this.totalMass - this.START_MASS) / 50, maxScale);
  }

  updateVisibleSegments(): void {
    this.visibleSegments = this.segmentTrail.slice(0, Math.floor(this.totalMass)).map((pos, index) => ({
      x: pos.x,
      y: pos.y,
      opacity: Math.max(0.3, 1 - (index * 0.02))
    }));
  }

  move(targetAngle: number, deltaTime: number): void {
    const turnSpeed = this.isBoosting ? 0.08 : 0.04;
    let angleDiff = targetAngle - this.currentAngle;
    
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    this.currentAngle += angleDiff * turnSpeed;
    
    const moveDistance = this.speed * deltaTime;
    const newX = this.head.x + Math.cos(this.currentAngle) * moveDistance;
    const newY = this.head.y + Math.sin(this.currentAngle) * moveDistance;
    
    this.head.x = Math.max(MAP_CENTER_X - MAP_RADIUS + 50, Math.min(MAP_CENTER_X + MAP_RADIUS - 50, newX));
    this.head.y = Math.max(MAP_CENTER_Y - MAP_RADIUS + 50, Math.min(MAP_CENTER_Y + MAP_RADIUS - 50, newY));
    
    if (this.segmentTrail.length === 0 || 
        Math.hypot(this.head.x - this.segmentTrail[0].x, this.head.y - this.segmentTrail[0].y) >= this.SEGMENT_DISTANCE) {
      this.segmentTrail.unshift({ x: this.head.x, y: this.head.y });
    }
    
    this.updateVisibleSegments();
  }

  startBoost(): void {
    if (this.totalMass > this.MIN_MASS_TO_BOOST) {
      this.isBoosting = true;
      this.speed = this.baseSpeed * this.BOOST_SPEED_MULTIPLIER;
    }
  }

  stopBoost(): void {
    this.isBoosting = false;
    this.speed = this.baseSpeed;
  }

  consumeMassForBoost(deltaTime: number): void {
    if (this.isBoosting && this.totalMass > this.MIN_MASS_TO_BOOST) {
      this.totalMass = Math.max(this.MIN_MASS_TO_BOOST, this.totalMass - this.BOOST_MASS_LOSS_RATE * deltaTime);
      if (this.totalMass <= this.MIN_MASS_TO_BOOST) {
        this.stopBoost();
      }
    }
  }
}

export default function MultiplayerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setLocation] = useLocation();
  
  // Game state
  const [snake] = useState(() => new SmoothSnake());
  const [gameState, setGameState] = useState<GameState>({ players: [], foods: [], timestamp: 0 });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [mouseDirection, setMouseDirection] = useState({ x: 1, y: 0 });
  const [isBoosting, setIsBoosting] = useState(false);
  
  // WebSocket connection
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [playerId, setPlayerId] = useState<string>('');

  // Sound controls
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('soundEnabled');
    return saved ? JSON.parse(saved) : true;
  });
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('volume');
    return saved ? parseFloat(saved) : 0.25;
  });

  // Initialize WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      console.log('Connected to multiplayer server');
      setWs(websocket);
      
      // Send join message
      websocket.send(JSON.stringify({
        type: 'join',
        data: {
          name: 'Player',
          color: snake.color,
          x: snake.head.x,
          y: snake.head.y
        }
      }));
    };
    
    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'player_id':
            setPlayerId(message.data.id);
            break;
            
          case 'game_state':
            setGameState(message.data);
            break;
            
          case 'player_died':
            if (message.data.playerId === playerId) {
              setGameOver(true);
            }
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    websocket.onclose = () => {
      console.log('Disconnected from multiplayer server');
      setWs(null);
    };
    
    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, []);

  // Send player updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN && playerId) {
        ws.send(JSON.stringify({
          type: 'player_update',
          data: {
            id: playerId,
            x: snake.head.x,
            y: snake.head.y,
            angle: snake.currentAngle,
            mass: snake.totalMass,
            money: snake.money,
            isBoosting: snake.isBoosting,
            segments: snake.visibleSegments
          }
        }));
      }
    }, 1000 / 30); // 30 FPS updates
    
    return () => clearInterval(interval);
  }, [ws, playerId, snake]);

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse movement handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const mouseX = e.clientX - rect.left - centerX;
      const mouseY = e.clientY - rect.top - centerY;
      
      const length = Math.sqrt(mouseX * mouseX + mouseY * mouseY);
      if (length > 0) {
        setMouseDirection({ x: mouseX / length, y: mouseY / length });
      }
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !isBoosting) {
        setIsBoosting(true);
        snake.startBoost();
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && isBoosting) {
        setIsBoosting(false);
        snake.stopBoost();
      }
    };
    
    const handleMouseDown = () => {
      if (!isBoosting) {
        setIsBoosting(true);
        snake.startBoost();
      }
    };
    
    const handleMouseUp = () => {
      if (isBoosting) {
        setIsBoosting(false);
        snake.stopBoost();
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isBoosting, snake]);

  // Game loop
  useEffect(() => {
    let animationId: number;
    let lastTime = performance.now();
    
    const gameLoop = (currentTime: number) => {
      const deltaTime = Math.min(currentTime - lastTime, 50) / 16.67;
      lastTime = currentTime;
      
      if (gameOver) {
        cancelAnimationFrame(animationId);
        return;
      }
      
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      
      // Update snake
      const targetAngle = Math.atan2(mouseDirection.y, mouseDirection.x);
      snake.move(targetAngle, deltaTime);
      snake.consumeMassForBoost(deltaTime);
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Set up camera
      ctx.save();
      const cameraX = canvas.width / 2 - snake.head.x;
      const cameraY = canvas.height / 2 - snake.head.y;
      ctx.translate(cameraX, cameraY);
      
      // Draw background pattern
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 1;
      const gridSize = 50;
      for (let x = -MAP_RADIUS; x <= MAP_RADIUS; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(MAP_CENTER_X + x, MAP_CENTER_Y - MAP_RADIUS);
        ctx.lineTo(MAP_CENTER_X + x, MAP_CENTER_Y + MAP_RADIUS);
        ctx.stroke();
      }
      for (let y = -MAP_RADIUS; y <= MAP_RADIUS; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(MAP_CENTER_X - MAP_RADIUS, MAP_CENTER_Y + y);
        ctx.lineTo(MAP_CENTER_X + MAP_RADIUS, MAP_CENTER_Y + y);
        ctx.stroke();
      }
      
      // Draw map boundary
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(MAP_CENTER_X, MAP_CENTER_Y, MAP_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw foods
      gameState.foods.forEach(food => {
        if (food.type === 'money') {
          // Draw money crate as green square
          ctx.fillStyle = '#53d493';
          ctx.fillRect(food.x - 8, food.y - 8, 16, 16);
          
          // Add $ symbol
          ctx.fillStyle = '#000';
          ctx.font = '12px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('$', food.x, food.y + 4);
        } else {
          // Regular food
          ctx.fillStyle = food.color;
          ctx.beginPath();
          ctx.arc(food.x, food.y, food.mass * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      
      // Draw other players
      gameState.players.forEach(player => {
        if (player.id === playerId) return; // Skip self
        
        const scaleFactor = Math.min(1 + (player.totalMass - 10) / 50, 3);
        const radius = 12 * scaleFactor;
        
        // Draw boost outline
        if (player.isBoosting) {
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 3;
          player.visibleSegments.forEach(segment => {
            ctx.beginPath();
            ctx.arc(segment.x, segment.y, radius + 3, 0, Math.PI * 2);
            ctx.stroke();
          });
        }
        
        // Draw player body
        ctx.fillStyle = player.color;
        player.visibleSegments.forEach(segment => {
          ctx.globalAlpha = segment.opacity;
          ctx.beginPath();
          ctx.arc(segment.x, segment.y, radius, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        
        // Draw money above head
        if (player.visibleSegments.length > 0) {
          const head = player.visibleSegments[0];
          ctx.font = `${Math.floor(14 * scaleFactor)}px 'Courier New', monospace`;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#134242';
          ctx.lineWidth = 3;
          ctx.textAlign = 'center';
          
          const moneyText = `$${player.money.toFixed(2)}`;
          ctx.strokeText(moneyText, head.x, head.y - 35);
          ctx.fillText(moneyText, head.x, head.y - 35);
        }
      });
      
      // Draw local player
      const scaleFactor = snake.getScaleFactor();
      const radius = 12 * scaleFactor;
      
      // Boost outline
      if (snake.isBoosting) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        snake.visibleSegments.forEach(segment => {
          ctx.beginPath();
          ctx.arc(segment.x, segment.y, radius + 3, 0, Math.PI * 2);
          ctx.stroke();
        });
      }
      
      // Snake body with shadow
      ctx.save();
      if (!snake.isBoosting) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }
      
      ctx.fillStyle = snake.color;
      snake.visibleSegments.forEach(segment => {
        ctx.globalAlpha = segment.opacity;
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
      ctx.globalAlpha = 1;
      
      // Draw player money
      if (snake.visibleSegments.length > 0) {
        const head = snake.visibleSegments[0];
        ctx.font = `${Math.floor(14 * scaleFactor)}px 'Courier New', monospace`;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#134242';
        ctx.lineWidth = 3;
        ctx.textAlign = 'center';
        
        const moneyText = `$${snake.money.toFixed(2)}`;
        ctx.strokeText(moneyText, head.x, head.y - 35);
        ctx.fillText(moneyText, head.x, head.y - 35);
      }
      
      ctx.restore();
      
      // Draw UI
      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px Arial';
      ctx.fillText(`Score: ${score}`, 20, 40);
      ctx.fillText(`Players: ${gameState.players.length}`, 20, 70);
      
      animationId = requestAnimationFrame(gameLoop);
    };
    
    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [mouseDirection, snake, gameState, gameOver, score, playerId]);

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
    localStorage.setItem('soundEnabled', JSON.stringify(!soundEnabled));
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    localStorage.setItem('volume', newVolume.toString());
  };

  const exitGame = () => {
    if (ws) {
      ws.close();
    }
    setLocation('/');
  };

  const resetGame = () => {
    setGameOver(false);
    setScore(0);
    snake.head = { x: MAP_CENTER_X, y: MAP_CENTER_Y };
    snake.currentAngle = 0;
    snake.segmentTrail = [];
    snake.totalMass = 10;
    snake.money = 1.00;
    snake.isBoosting = false;
    snake.speed = snake.baseSpeed;
    snake.updateVisibleSegments();
    setIsBoosting(false);
    setMouseDirection({ x: 1, y: 0 });
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

      {/* Volume Controls */}
      <div className="absolute top-4 left-40 z-10 flex items-center gap-2 bg-gray-700/80 backdrop-blur-sm px-3 py-2 border border-gray-600 rounded">
        <button 
          onClick={toggleSound}
          className="text-white text-sm hover:bg-gray-600 font-retro flex items-center gap-1"
        >
          <Volume2 className={`w-4 h-4 ${soundEnabled ? 'text-green-400' : 'text-red-400'}`} />
          {soundEnabled ? 'ON' : 'OFF'}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
        />
        <span className="text-white text-xs font-retro w-8 text-center">{Math.round(volume * 100)}%</span>
      </div>
      
      {/* Score Display */}
      <div className="absolute top-4 right-4 z-10">
        <div className="bg-dark-card/80 backdrop-blur-sm border border-dark-border rounded-lg px-4 py-2">
          <div className="text-neon-yellow text-xl font-bold">Score: {score.toFixed(1)}</div>
          <div className="text-white text-sm">Online Players: {gameState.players.length}</div>
          <div className="text-blue-400 text-xs">Total Mass: {snake.totalMass.toFixed(1)}</div>
          {isBoosting && (
            <div className="text-orange-400 text-xs font-bold animate-pulse">BOOST!</div>
          )}
        </div>
      </div>
      
      {/* Controls Instructions */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-dark-card/80 backdrop-blur-sm border border-dark-border rounded-lg px-4 py-2">
          <div className="text-white text-sm">Hold Shift or Mouse to Boost</div>
          <div className="text-gray-400 text-xs">Multiplayer Mode - Real Players</div>
          <div className="text-blue-400 text-xs">Collect food and money crates</div>
        </div>
      </div>
      
      {gameOver && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="bg-dark-card/90 backdrop-blur-sm border border-dark-border rounded-lg p-8 text-center">
            <div className="text-red-500 text-4xl font-bold mb-4">Game Over!</div>
            <div className="text-white text-lg mb-2">Final Score: {score}</div>
            <div className="text-white text-lg mb-6">Final Mass: {snake.totalMass.toFixed(1)}</div>
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
        className="cursor-default block"
        style={{ background: '#15161b' }}
      />
    </div>
  );
}