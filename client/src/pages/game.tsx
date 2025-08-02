import { useEffect, useRef, useState, useCallback } from 'react';
import { SmoothSnake } from '../lib/SmoothSnake';

const MAP_RADIUS = 1000;
const MAP_CENTER_X = 2000;
const MAP_CENTER_Y = 2000;

interface ServerPlayer {
  id: string;
  segments: Array<{ x: number; y: number; opacity: number }>;
  color: string;
  segmentRadius?: number;
}

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const gameOverRef = useRef(false);
  const [score, setScore] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  const [serverPlayers, setServerPlayers] = useState<ServerPlayer[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [myPlayerColor, setMyPlayerColor] = useState<string>('#d55400');
  const wsRef = useRef<WebSocket | null>(null);

  // Death loot system removed - snakes simply disappear on death
  const dropMultiplayerDeathLoot = () => {
    // No loot dropped - pure snake-vs-snake gameplay
  };

  // Initialize snake without food dependencies
  const snake = new SmoothSnake(MAP_CENTER_X, MAP_CENTER_Y);

  const startGame = () => {
    if (gameStarted) return;
    
    console.log("NEW SNAKE CREATED: mass=" + snake.totalMass + ", visibleSegments=" + snake.visibleSegments.length + ", trail=" + snake.segmentTrail.length);
    
    setGameStarted(true);
    setGameOver(false);
    gameOverRef.current = false;
    setScore(0);
    
    // Connect to multiplayer server
    connectToMultiplayer();
  };

  const connectToMultiplayer = () => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const socket = new WebSocket(`${wsProtocol}//${wsHost}/ws`);
    
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("Connected to multiplayer server!");
      setConnectionStatus('Connected');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'playerAssignment') {
          setMyPlayerId(data.playerId);
          setMyPlayerColor(data.color);
          console.log(`Assigned player ID: ${data.playerId}, color: ${data.color}`);
        } else if (data.type === 'gameWorld') {
          // Update server players (excluding self)
          setServerPlayers(data.players || []);
          console.log(`Received shared world: ${data.bots?.length || 0} bots, 0 food, ${data.players?.length || 0} players`);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    socket.onclose = (event) => {
      console.log("Disconnected from multiplayer server");
      setConnectionStatus('Disconnected');
      wsRef.current = null;
      
      // Auto-reconnect if game is still running
      if (event.code !== 1000 && gameStarted) {
        setTimeout(() => {
          if (gameStarted && !wsRef.current) {
            connectToMultiplayer();
          }
        }, 2000);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('Connection Error');
    };
  };

  // Game loop without food systems
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameOverRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Update snake
    snake.update();

    // Clear canvas
    ctx.fillStyle = '#15161b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Camera following snake head
    const offsetX = canvas.width / 2 - snake.head.x;
    const offsetY = canvas.height / 2 - snake.head.y;
    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Draw map boundary
    ctx.strokeStyle = '#53d392';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(MAP_CENTER_X, MAP_CENTER_Y, MAP_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Check for boundary collision
    const distFromCenter = Math.sqrt(
      (snake.head.x - MAP_CENTER_X) ** 2 + (snake.head.y - MAP_CENTER_Y) ** 2
    );
    if (distFromCenter > MAP_RADIUS - snake.getSegmentRadius()) {
      setGameOver(true);
      gameOverRef.current = true;
      return;
    }

    // Check collisions with other players
    for (const serverPlayer of serverPlayers) {
      if (!serverPlayer.segments || serverPlayer.segments.length === 0) continue;
      if (serverPlayer.id === myPlayerId) continue;
      
      for (const segment of serverPlayer.segments) {
        const dist = Math.sqrt((snake.head.x - segment.x) ** 2 + (snake.head.y - segment.y) ** 2);
        const collisionRadius = snake.getSegmentRadius() + 10;
        
        if (dist < collisionRadius) {
          console.log(`💀 CRASHED into player ${serverPlayer.id}!`);
          setGameOver(true);
          gameOverRef.current = true;
          dropMultiplayerDeathLoot();
          return;
        }
      }
    }

    // Draw other server players
    const otherServerPlayers = serverPlayers.filter(player => player.id !== myPlayerId);
    otherServerPlayers.forEach((serverPlayer) => {
      if (serverPlayer.segments && serverPlayer.segments.length > 0) {
        const segments = serverPlayer.segments;
        const segmentRadius = serverPlayer.segmentRadius || 10;
        
        // Draw segments from tail to head
        for (let i = segments.length - 1; i >= 0; i--) {
          const segment = segments[i];
          
          ctx.fillStyle = serverPlayer.color || '#ff0000';
          ctx.beginPath();
          ctx.arc(segment.x, segment.y, segmentRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    // Draw local snake
    snake.render(ctx);

    ctx.restore();

    // Send position updates to server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'playerUpdate',
        segments: snake.visibleSegments,
        mass: snake.totalMass,
        segmentRadius: snake.getSegmentRadius(),
        color: myPlayerColor
      }));
    }
  }, [gameStarted, serverPlayers, myPlayerId, myPlayerColor]);

  // Game loop interval
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const interval = setInterval(gameLoop, 16); // 60 FPS
    return () => clearInterval(interval);
  }, [gameLoop, gameStarted, gameOver]);

  // Keyboard controls
  useEffect(() => {
    if (!gameStarted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          snake.direction.y = -1;
          snake.direction.x = 0;
          break;
        case 's':
        case 'arrowdown':
          snake.direction.y = 1;
          snake.direction.x = 0;
          break;
        case 'a':
        case 'arrowleft':
          snake.direction.x = -1;
          snake.direction.y = 0;
          break;
        case 'd':
        case 'arrowright':
          snake.direction.x = 1;
          snake.direction.y = 0;
          break;
        case ' ':
          snake.isBoosting = true;
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        snake.isBoosting = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      const dx = mouseX - centerX;
      const dy = mouseY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 10) {
        snake.direction.x = dx / distance;
        snake.direction.y = dy / distance;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [gameStarted]);

  // Canvas resize
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

  if (!gameStarted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-8">Snake Game</h1>
          <button
            onClick={startGame}
            className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold text-xl rounded-lg"
          >
            Start Game
          </button>
        </div>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Game Over!</h1>
          <p className="text-xl mb-8">Score: {score}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold text-xl rounded-lg"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-gray-900 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-none"
      />
      
      {/* Game UI */}
      <div className="absolute top-4 left-4 text-white space-y-2">
        <div>Score: {score}</div>
        <div>Mass: {Math.floor(snake.totalMass)}/100</div>
        <div>Connection: {connectionStatus}</div>
        <div>Players: {serverPlayers.length}</div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-4 text-white text-sm">
        <div>WASD or Arrow Keys to move</div>
        <div>Space to boost</div>
        <div>Mouse to steer</div>
      </div>
    </div>
  );
}