import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';

interface Player {
  id: string | number;
  segments: Array<{ x: number; y: number; opacity?: number }>;
  color: string;
  money: number;
}

const MultiplayerGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setLocation] = useLocation();
  const [gameStarted, setGameStarted] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [otherPlayers, setOtherPlayers] = useState<Player[]>([]);
  
  // Game state
  const gameStateRef = useRef({
    snake: {
      segments: [{ x: 400, y: 300 }],
      angle: 0,
      speed: 2,
      boosting: false,
      totalMass: 20,
      currentSegmentCount: 3,
      color: '#d55400'
    },
    food: [] as Array<{ x: number; y: number; mass: number; color: string }>,
    bots: [] as Array<{ segments: Array<{ x: number; y: number }>, color: string, money: number }>,
    keys: { q: false, leftClick: false },
    money: 1.00,
    lastTime: 0,
    isVisible: true,
    lastVisibilityTime: 0,
    segmentTrail: [] as Array<{ x: number; y: number; time: number }>,
    animationId: null as number | null,
    ws: null as WebSocket | null
  });

  // Initialize loading sequence
  useEffect(() => {
    const stages = [20, 40, 70, 90, 100];
    let currentStage = 0;
    
    const progressInterval = setInterval(() => {
      if (currentStage < stages.length) {
        setLoadingProgress(stages[currentStage]);
        currentStage++;
      } else {
        clearInterval(progressInterval);
        setTimeout(() => setGameStarted(true), 500);
      }
    }, 300);

    return () => clearInterval(progressInterval);
  }, []);

  // WebSocket connection
  useEffect(() => {
    if (!gameStarted) return;

    console.log("Connecting to multiplayer server...");
    
    // Connect to WebSocket server
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const socket = new WebSocket(`${wsProtocol}//${wsHost}/game-ws`);
    
    socket.onopen = () => {
      console.log("Connected to multiplayer server!");
      setConnectionStatus('Connected');
      gameStateRef.current.ws = socket;
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'players') {
          // Filter out our own player data
          const others = data.players.filter((p: Player) => p.id !== socket);
          setOtherPlayers(others);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    socket.onclose = () => {
      console.log("Disconnected from multiplayer server");
      setConnectionStatus('Disconnected');
      gameStateRef.current.ws = null;
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('Connection Error');
    };

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [gameStarted]);

  // Send player data to server
  const sendPlayerData = useCallback(() => {
    const { ws, snake, money } = gameStateRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        segments: snake.segments,
        color: snake.color,
        money: money
      }));
    }
  }, []);

  // Initialize game
  useEffect(() => {
    if (!gameStarted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 1200;
    canvas.height = 800;

    // Initialize food
    const spawnFood = () => {
      const food = [];
      for (let i = 0; i < 150; i++) {
        food.push({
          x: Math.random() * (canvas.width - 40) + 20,
          y: Math.random() * (canvas.height - 40) + 20,
          mass: 3 + Math.random() * 5,
          color: `hsl(${Math.random() * 360}, 70%, 60%)`
        });
      }
      gameStateRef.current.food = food;
    };

    spawnFood();

    // Mouse movement
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      gameStateRef.current.snake.angle = Math.atan2(mouseY - centerY, mouseX - centerX);
    };

    // Key handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'q') gameStateRef.current.keys.q = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'q') gameStateRef.current.keys.q = false;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) gameStateRef.current.keys.leftClick = true;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) gameStateRef.current.keys.leftClick = false;
    };

    // Visibility change handler
    const handleVisibilityChange = () => {
      const now = performance.now();
      if (document.hidden) {
        gameStateRef.current.isVisible = false;
        gameStateRef.current.lastVisibilityTime = now;
      } else {
        const hiddenTime = now - gameStateRef.current.lastVisibilityTime;
        if (hiddenTime > 100) {
          // Move snake forward based on time hidden
          const distance = (hiddenTime / 1000) * gameStateRef.current.snake.speed * 60;
          const { snake } = gameStateRef.current;
          snake.segments[0].x += Math.cos(snake.angle) * distance;
          snake.segments[0].y += Math.sin(snake.angle) * distance;
        }
        gameStateRef.current.isVisible = true;
      }
    };

    // Add event listeners
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Game loop
    const gameLoop = (currentTime: number) => {
      const deltaTime = currentTime - gameStateRef.current.lastTime;
      gameStateRef.current.lastTime = currentTime;

      const { snake, food, keys, segmentTrail } = gameStateRef.current;

      // Update boosting
      snake.boosting = keys.q || keys.leftClick;
      snake.speed = snake.boosting ? 4 : 2;

      // Move snake head
      snake.segments[0].x += Math.cos(snake.angle) * snake.speed;
      snake.segments[0].y += Math.sin(snake.angle) * snake.speed;

      // Wrap around screen
      if (snake.segments[0].x < 0) snake.segments[0].x = canvas.width;
      if (snake.segments[0].x > canvas.width) snake.segments[0].x = 0;
      if (snake.segments[0].y < 0) snake.segments[0].y = canvas.height;
      if (snake.segments[0].y > canvas.height) snake.segments[0].y = 0;

      // Add to segment trail
      segmentTrail.push({
        x: snake.segments[0].x,
        y: snake.segments[0].y,
        time: currentTime
      });

      // Calculate target segments
      const targetSegments = Math.floor(snake.totalMass / 7);
      snake.currentSegmentCount = Math.min(targetSegments, segmentTrail.length);

      // Update segments from trail
      for (let i = 1; i < snake.currentSegmentCount; i++) {
        const trailIndex = Math.floor(i * (segmentTrail.length / snake.currentSegmentCount));
        if (segmentTrail[trailIndex]) {
          if (!snake.segments[i]) snake.segments[i] = { x: 0, y: 0 };
          snake.segments[i].x = segmentTrail[trailIndex].x;
          snake.segments[i].y = segmentTrail[trailIndex].y;
        }
      }

      // Remove old trail points
      const maxTrailLength = snake.currentSegmentCount * 10;
      if (segmentTrail.length > maxTrailLength) {
        segmentTrail.splice(0, segmentTrail.length - maxTrailLength);
      }

      // Food collision
      for (let i = food.length - 1; i >= 0; i--) {
        const f = food[i];
        const dx = snake.segments[0].x - f.x;
        const dy = snake.segments[0].y - f.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 15) {
          snake.totalMass += f.mass;
          food.splice(i, 1);
          
          // Respawn food
          food.push({
            x: Math.random() * (canvas.width - 40) + 20,
            y: Math.random() * (canvas.height - 40) + 20,
            mass: 3 + Math.random() * 5,
            color: `hsl(${Math.random() * 360}, 70%, 60%)`
          });
        }
      }

      // Send player data to server
      sendPlayerData();

      // Clear canvas
      ctx.fillStyle = '#15161b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw food
      food.forEach(f => {
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.mass, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw other players
      otherPlayers.forEach(player => {
        if (player.segments && player.segments.length > 0) {
          player.segments.forEach((segment, index) => {
            ctx.fillStyle = player.color;
            ctx.globalAlpha = segment.opacity || 1;
            ctx.beginPath();
            ctx.arc(segment.x, segment.y, index === 0 ? 12 : 8, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.globalAlpha = 1;
        }
      });

      // Draw player snake
      snake.segments.forEach((segment, index) => {
        if (index < snake.currentSegmentCount) {
          ctx.fillStyle = snake.color;
          ctx.beginPath();
          ctx.arc(segment.x, segment.y, index === 0 ? 12 : 8, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw money display
      ctx.fillStyle = '#fff';
      ctx.font = '16px Arial';
      ctx.fillText(`$${gameStateRef.current.money.toFixed(2)}`, snake.segments[0].x - 20, snake.segments[0].y - 20);

      // Draw UI
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '14px Arial';
      ctx.fillText('Hold Q to cash out', 20, canvas.height - 60);
      ctx.fillText('Left click to boost', 20, canvas.height - 40);
      ctx.fillText(`Players: ${otherPlayers.length + 1}`, 20, canvas.height - 20);
      ctx.fillText(connectionStatus, canvas.width - 150, 30);

      gameStateRef.current.animationId = requestAnimationFrame(gameLoop);
    };

    gameStateRef.current.animationId = requestAnimationFrame(gameLoop);

    return () => {
      // Cleanup
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (gameStateRef.current.animationId) {
        cancelAnimationFrame(gameStateRef.current.animationId);
      }
    };
  }, [gameStarted, otherPlayers, sendPlayerData]);

  if (!gameStarted) {
    return (
      <div className="w-full h-screen bg-[#15161b] flex flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-yellow-400 mb-8" style={{ fontFamily: 'Press Start 2P' }}>
            MULTIPLAYER SNAKE
          </h1>
          <div className="w-96 bg-gray-700 rounded-full h-4 mb-4">
            <div 
              className="bg-yellow-400 h-4 rounded-full transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <p className="text-white text-xl">Loading... {loadingProgress}%</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-[#15161b] overflow-hidden">
      <canvas 
        ref={canvasRef}
        className="w-full h-full cursor-none"
        style={{ display: 'block' }}
      />
    </div>
  );
};

export default MultiplayerGame;