import { useRef, useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { MultiplayerWebSocketClient, type MultiplayerPlayer, type MultiplayerFood } from '@/lib/websocket';
import { RegionManager } from '@/lib/regionManager';
import LoadingScreen from '@/components/LoadingScreen';
import { RegionSelector } from '@/components/RegionSelector';
import { SmoothSnake } from '@/lib/SmoothSnake';
import dollarSignImageSrc from '@assets/$ (1)_1753992938537.png';

// Game constants
const MAP_CENTER_X = 800;
const MAP_CENTER_Y = 600;
const MAP_RADIUS = 1000;

interface Position {
  x: number;
  y: number;
}

export default function MultiplayerGameNew() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [showRegionSelector, setShowRegionSelector] = useState(true);
  
  // Game state
  const [mouseDirection, setMouseDirection] = useState<Position>({ x: 1, y: 0 });
  const [multiplayerPlayers, setMultiplayerPlayers] = useState<Map<string, MultiplayerPlayer>>(new Map());
  const [multiplayerFoods, setMultiplayerFoods] = useState<Map<string, MultiplayerFood>>(new Map());
  const [localFoods, setLocalFoods] = useState<MultiplayerFood[]>([]);
  const [localPlayer] = useState(() => new SmoothSnake(MAP_CENTER_X, MAP_CENTER_Y));
  const [isBoosting, setIsBoosting] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  
  // Images
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [dollarSignImage, setDollarSignImage] = useState<HTMLImageElement | null>(null);
  
  // Canvas setup
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [zoom, setZoom] = useState(2);
  const minZoom = 0.3;
  const zoomSmoothing = 0.05;

  // WebSocket client
  const [wsClient] = useState(() => new MultiplayerWebSocketClient());

  // Load images
  useEffect(() => {
    const bg = new Image();
    bg.src = '/backggorun.png';
    bg.onload = () => setBackgroundImage(bg);

    const dollar = new Image();
    dollar.src = dollarSignImageSrc;
    dollar.onload = () => setDollarSignImage(dollar);
  }, []);

  // Canvas resize handler
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

  // WebSocket event handlers
  useEffect(() => {
    wsClient.onConnected = (data) => {
      console.log('Connected to WebSocket:', data);
      setConnectionStatus('connected');
      
      // Join the game automatically
      wsClient.joinGame({
        x: localPlayer.head.x,
        y: localPlayer.head.y,
        angle: localPlayer.currentAngle,
        mass: localPlayer.totalMass,
        money: localPlayer.money,
        color: '#d55400',
        segments: localPlayer.visibleSegments
      });
    };

    wsClient.onJoinedRoom = (data) => {
      console.log('Joined room:', data);
      setRoomInfo(data);
      setShowRegionSelector(false);
    };

    wsClient.onGameState = (data) => {
      console.log('Game state received:', data);
      
      // Update other players
      const playersMap = new Map<string, MultiplayerPlayer>();
      data.players?.forEach((player: MultiplayerPlayer) => {
        playersMap.set(player.id, player);
      });
      setMultiplayerPlayers(playersMap);

      // Update foods
      const foodsMap = new Map<string, MultiplayerFood>();
      data.foods?.forEach((food: MultiplayerFood) => {
        foodsMap.set(food.id, food);
      });
      setMultiplayerFoods(foodsMap);
    };

    wsClient.onPlayerJoined = (data) => {
      console.log('Player joined:', data);
      setMultiplayerPlayers(prev => {
        const newMap = new Map(prev);
        newMap.set(data.player.id, data.player);
        return newMap;
      });
    };

    wsClient.onPlayerLeft = (data) => {
      console.log('Player left:', data);
      setMultiplayerPlayers(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.playerId);
        return newMap;
      });
    };

    wsClient.onPlayerUpdate = (data) => {
      setMultiplayerPlayers(prev => {
        const newMap = new Map(prev);
        newMap.set(data.player.id, data.player);
        return newMap;
      });
    };

    wsClient.onPlayerDied = (data) => {
      console.log('Player died:', data);
      // Add death foods and money crates
      const newFoods = new Map(multiplayerFoods);
      [...(data.deathFoods || []), ...(data.moneyCrates || [])].forEach((food: MultiplayerFood) => {
        newFoods.set(food.id, food);
      });
      setMultiplayerFoods(newFoods);
    };

    wsClient.onFoodEaten = (data) => {
      setMultiplayerFoods(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.foodId);
        return newMap;
      });
    };

    wsClient.onConnectionError = (error) => {
      console.error('WebSocket connection error:', error);
      setConnectionStatus('error');
    };

    wsClient.onDisconnected = () => {
      console.log('WebSocket disconnected');
      setConnectionStatus('disconnected');
    };

    return () => {
      wsClient.disconnect();
    };
  }, [wsClient, localPlayer, multiplayerFoods]);

  // Mouse tracking
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameStarted) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const directionX = mouseX - canvasSize.width / 2;
      const directionY = mouseY - canvasSize.height / 2;
      
      const magnitude = Math.sqrt(directionX * directionX + directionY * directionY);
      if (magnitude > 0) {
        setMouseDirection({
          x: directionX / magnitude,
          y: directionY / magnitude
        });
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    return () => canvas.removeEventListener('mousemove', handleMouseMove);
  }, [canvasSize, gameStarted]);

  // Keyboard controls
  useEffect(() => {
    if (!gameStarted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      
      if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        setIsBoosting(true);
        localPlayer.setBoost(true);
        if (wsClient.isConnected()) {
          wsClient.sendPlayerBoost(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        setIsBoosting(false);
        localPlayer.setBoost(false);
        if (wsClient.isConnected()) {
          wsClient.sendPlayerBoost(false);
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) { // Left click
        setIsBoosting(true);
        localPlayer.setBoost(true);
        if (wsClient.isConnected()) {
          wsClient.sendPlayerBoost(true);
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) { // Left click
        setIsBoosting(false);
        localPlayer.setBoost(false);
        if (wsClient.isConnected()) {
          wsClient.sendPlayerBoost(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gameStarted, localPlayer, wsClient]);

  // Game loop
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const gameLoop = () => {
      // Always move local player regardless of connection status
      localPlayer.move(mouseDirection.x, mouseDirection.y, () => {});

      // Check food collisions manually
      const allFoods = wsClient.isConnected() ? 
        Array.from(multiplayerFoods.values()) : 
        localFoods;

      const collisionRadius = 15;
      const head = localPlayer.head;

      allFoods.forEach((food, index) => {
        const distance = Math.sqrt(
          (head.x - food.x) ** 2 + (head.y - food.y) ** 2
        );

        if (distance < collisionRadius) {
          // Consume food
          localPlayer.grow(food.mass);
          if (food.type === 'money' && food.value) {
            localPlayer.addMoney(food.value);
          }

          if (wsClient.isConnected()) {
            // Remove from multiplayer foods and notify server
            wsClient.sendFoodEaten(food.id);
          } else {
            // Remove from local foods and regenerate
            setLocalFoods(prev => {
              const newFoods = [...prev];
              newFoods.splice(index, 1);
              
              // Add a new food to maintain count
              const angle = Math.random() * Math.PI * 2;
              const radius = Math.random() * (MAP_RADIUS - 100);
              const x = MAP_CENTER_X + Math.cos(angle) * radius;
              const y = MAP_CENTER_Y + Math.sin(angle) * radius;
              
              newFoods.push({
                id: `local_food_${Date.now()}_${Math.random()}`,
                x, y,
                size: 4,
                mass: 0.2,
                color: '#45b7d1',
                type: 'normal'
              });
              
              return newFoods;
            });
          }
        }
      });

      // Send player update to server only if connected
      if (wsClient.isConnected()) {
        wsClient.sendPlayerMove({
          x: localPlayer.head.x,
          y: localPlayer.head.y,
          angle: localPlayer.currentAngle,
          mass: localPlayer.totalMass,
          money: localPlayer.money,
          segments: localPlayer.visibleSegments,
          isBoosting: localPlayer.isBoosting
        });
      }

      // Check boundary collision
      const distanceFromCenter = Math.sqrt(
        (localPlayer.head.x - MAP_CENTER_X) ** 2 + (localPlayer.head.y - MAP_CENTER_Y) ** 2
      );
      
      if (distanceFromCenter > MAP_RADIUS) {
        if (wsClient.isConnected()) {
          wsClient.sendPlayerDeath({
            x: localPlayer.head.x,
            y: localPlayer.head.y,
            mass: localPlayer.totalMass,
            money: localPlayer.money,
            segments: localPlayer.visibleSegments
          });
        }
        setGameOver(true);
        return;
      }

      // Dynamic zoom based on snake size
      const targetZoom = Math.max(minZoom, 2.5 - (localPlayer.totalMass / 100));
      setZoom(prevZoom => prevZoom + (targetZoom - prevZoom) * zoomSmoothing);

      // Render game
      renderGame(ctx);

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [gameStarted, gameOver, mouseDirection, localPlayer, wsClient, zoom, multiplayerPlayers, multiplayerFoods]);

  const renderGame = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    ctx.save();

    // Camera follows player
    const cameraX = canvasSize.width / 2 - localPlayer.head.x * zoom;
    const cameraY = canvasSize.height / 2 - localPlayer.head.y * zoom;
    
    ctx.translate(cameraX, cameraY);
    ctx.scale(zoom, zoom);

    // Draw background
    if (backgroundImage) {
      const pattern = ctx.createPattern(backgroundImage, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(-2000, -2000, 4000, 4000);
      }
    }

    // Draw circular boundary
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(MAP_CENTER_X, MAP_CENTER_Y, MAP_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Draw foods (multiplayer or local)
    const foodsToRender = wsClient.isConnected() ? 
      Array.from(multiplayerFoods.values()) : 
      localFoods;

    foodsToRender.forEach(food => {
      if (food.type === 'money') {
        // Draw money crates
        const time = Date.now() * 0.003;
        const wobbleX = Math.sin(time) * 2;
        const wobbleY = Math.cos(time * 1.2) * 1.5;
        
        ctx.fillStyle = food.color;
        ctx.fillRect(food.x + wobbleX - 10, food.y + wobbleY - 10, 20, 20);
        
        if (dollarSignImage) {
          ctx.drawImage(dollarSignImage, food.x + wobbleX - 10, food.y + wobbleY - 10, 20, 20);
        }
      } else {
        // Draw regular food
        ctx.shadowColor = food.color;
        ctx.shadowBlur = 15;
        ctx.fillStyle = food.color;
        ctx.beginPath();
        ctx.arc(food.x, food.y, food.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Draw multiplayer players
    Array.from(multiplayerPlayers.values()).forEach(player => {
      if (!player.isAlive) return;

      const baseRadius = 8;
      const scaleFactor = Math.min(1 + (player.mass - 10) / 100, 5);
      const radius = baseRadius * scaleFactor;

      // Draw player snake
      ctx.fillStyle = player.color;
      player.segments.forEach((segment, index) => {
        ctx.globalAlpha = segment.opacity;
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Draw player money above head
      if (player.segments.length > 0) {
        const head = player.segments[0];
        ctx.font = `${Math.floor(10 * scaleFactor)}px 'Press Start 2P', monospace`;
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#134242";
        ctx.lineWidth = 3 * scaleFactor;
        ctx.textAlign = "center";
        
        const moneyText = `$${player.money.toFixed(2)}`;
        const offsetY = 35 * scaleFactor;
        
        ctx.strokeText(moneyText, head.x, head.y - offsetY);
        ctx.fillText(moneyText, head.x, head.y - offsetY);
      }
    });

    // Draw local player (ensure it's always visible)
    if (localPlayer.visibleSegments && localPlayer.visibleSegments.length > 0) {
      const scaleFactor = localPlayer.getScaleFactor();
      const segmentRadius = 8 * scaleFactor;

      // Player outline when boosting
      if (localPlayer.isBoosting) {
        ctx.fillStyle = "white";
        localPlayer.visibleSegments.forEach(segment => {
          ctx.globalAlpha = segment.opacity || 1.0;
          ctx.beginPath();
          ctx.arc(segment.x, segment.y, segmentRadius + 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Player body with shadow
      ctx.save();
      if (!localPlayer.isBoosting) {
        ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }

      ctx.fillStyle = '#d55400';
      localPlayer.visibleSegments.forEach(segment => {
        ctx.globalAlpha = segment.opacity || 1.0;
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, segmentRadius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
      ctx.globalAlpha = 1.0;
    }

    // Draw local player money
    if (localPlayer.visibleSegments.length > 0) {
      const head = localPlayer.visibleSegments[0];
      ctx.font = `${Math.floor(10 * scaleFactor)}px 'Press Start 2P', monospace`;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#134242";
      ctx.lineWidth = 3 * scaleFactor;
      ctx.textAlign = "center";
      
      const moneyText = `$${localPlayer.money.toFixed(2)}`;
      const offsetY = 35 * scaleFactor;
      
      ctx.strokeText(moneyText, head.x, head.y - offsetY);
      ctx.fillText(moneyText, head.x, head.y - offsetY);
    }

    // Draw local player eyes
    if (localPlayer.visibleSegments.length > 0) {
      const head = localPlayer.visibleSegments[0];
      const movementAngle = localPlayer.currentAngle;
      const eyeDistance = 5 * scaleFactor;
      const eyeSize = 3 * scaleFactor;
      const pupilSize = 1.5 * scaleFactor;
      
      const cursorAngle = Math.atan2(mouseDirection.y, mouseDirection.x);
      
      const eye1X = head.x + Math.cos(movementAngle + Math.PI/2) * eyeDistance;
      const eye1Y = head.y + Math.sin(movementAngle + Math.PI/2) * eyeDistance;
      const eye2X = head.x + Math.cos(movementAngle - Math.PI/2) * eyeDistance;
      const eye2Y = head.y + Math.sin(movementAngle - Math.PI/2) * eyeDistance;
      
      // Draw square eyes
      ctx.save();
      
      // First eye
      ctx.translate(eye1X, eye1Y);
      ctx.rotate(movementAngle);
      ctx.fillStyle = 'white';
      ctx.fillRect(-eyeSize, -eyeSize, eyeSize * 2, eyeSize * 2);
      
      const pupilOffset = 1.2;
      ctx.fillStyle = 'black';
      ctx.fillRect(
        (Math.cos(cursorAngle - movementAngle) * pupilOffset) - pupilSize,
        (Math.sin(cursorAngle - movementAngle) * pupilOffset) - pupilSize,
        pupilSize * 2, 
        pupilSize * 2
      );
      ctx.restore();
      
      // Second eye
      ctx.save();
      ctx.translate(eye2X, eye2Y);
      ctx.rotate(movementAngle);
      ctx.fillStyle = 'white';
      ctx.fillRect(-eyeSize, -eyeSize, eyeSize * 2, eyeSize * 2);
      
      ctx.fillStyle = 'black';
      ctx.fillRect(
        (Math.cos(cursorAngle - movementAngle) * pupilOffset) - pupilSize,
        (Math.sin(cursorAngle - movementAngle) * pupilOffset) - pupilSize,
        pupilSize * 2, 
        pupilSize * 2
      );
      ctx.restore();
    }

    ctx.restore();
  };

  const handleRegionChange = useCallback((regionId: string) => {
    setSelectedRegion(regionId);
    wsClient.setRegion(regionId);
  }, [wsClient]);

  const handleJoinGame = useCallback(async () => {
    setIsLoading(true);
    setShowRegionSelector(false);
    setGameStarted(true);
    
    // Start game even if connection fails
    const connected = await wsClient.connect();
    if (connected) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('error');
      console.log('Playing in offline mode - multiplayer features disabled');
    }
    setIsLoading(false);
  }, [wsClient]);

  // Generate local foods for offline play
  const generateLocalFoods = useCallback(() => {
    const foods: MultiplayerFood[] = [];
    const FOOD_COUNT = 200;

    for (let i = 0; i < FOOD_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * (MAP_RADIUS - 100);
      const x = MAP_CENTER_X + Math.cos(angle) * radius;
      const y = MAP_CENTER_Y + Math.sin(angle) * radius;

      const foodType = Math.random();
      let food: MultiplayerFood;

      if (foodType < 0.05) {
        food = {
          id: `local_food_${i}_${Date.now()}`,
          x, y,
          size: 20,
          mass: 25,
          color: '#ff8c00',
          type: 'normal'
        };
      } else if (foodType < 0.15) {
        food = {
          id: `local_food_${i}_${Date.now()}`,
          x, y,
          size: 10,
          mass: 0.8,
          color: '#4ecdc4',
          type: 'normal'
        };
      } else if (foodType < 0.50) {
        food = {
          id: `local_food_${i}_${Date.now()}`,
          x, y,
          size: 6,
          mass: 0.4,
          color: '#ff6b6b',
          type: 'normal'
        };
      } else {
        food = {
          id: `local_food_${i}_${Date.now()}`,
          x, y,
          size: 4,
          mass: 0.2,
          color: '#45b7d1',
          type: 'normal'
        };
      }

      foods.push(food);
    }

    setLocalFoods(foods);
  }, []);

  const handleLoadingComplete = useCallback(() => {
    setIsLoading(false);
    setGameStarted(true);
    generateLocalFoods();
  }, [generateLocalFoods]);

  const exitGame = () => {
    wsClient.disconnect();
    setLocation('/');
  };

  if (isLoading) {
    return <LoadingScreen onLoadingComplete={handleLoadingComplete} />;
  }

  if (showRegionSelector) {
    return (
      <div className="min-h-screen bg-[#15161b] flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-white font-mono">MULTIPLAYER SNAKE</h1>
            <p className="text-gray-400">Real-time multiplayer action</p>
          </div>
          
          <div className="bg-gray-800/50 rounded-lg p-6 space-y-4">
            <RegionSelector
              selectedRegion={selectedRegion}
              onRegionChange={handleRegionChange}
            />
            
            <div className="space-y-2">
              <div className="text-sm text-gray-400">Connection Status:</div>
              <div className={`text-sm font-medium ${
                connectionStatus === 'connected' ? 'text-green-400' :
                connectionStatus === 'error' ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {connectionStatus.toUpperCase()}
              </div>
            </div>
            
            <button
              onClick={handleJoinGame}
              disabled={!selectedRegion || connectionStatus === 'connecting'}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 
                         disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded
                         transition-colors duration-200"
            >
              {connectionStatus === 'connecting' ? 'CONNECTING...' : 'JOIN GAME'}
            </button>
            
            <button
              onClick={exitGame}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded
                         transition-colors duration-200"
            >
              BACK TO MENU
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute inset-0 cursor-none"
      />

      {/* Minimal UI */}
      <div className="absolute top-4 left-4 text-white font-mono text-sm space-y-1">
        <div>Players: {multiplayerPlayers.size + 1}</div>
        <div>Region: {selectedRegion?.toUpperCase()}</div>
        <div>Room: {roomInfo?.roomId}</div>
      </div>

      <div className="absolute bottom-4 left-4 text-white font-mono text-sm space-y-1">
        <div>Left click or Shift to boost</div>
      </div>

      {/* Game Over Screen */}
      {gameOver && (
        <div className="absolute inset-0 bg-[#15161b] flex items-center justify-center">
          <div className="text-center space-y-6">
            <h1 className="text-6xl font-bold text-red-500 font-mono">GAME OVER</h1>
            <div className="space-y-4">
              <button
                onClick={() => window.location.reload()}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded
                           font-mono text-lg transition-colors duration-200"
              >
                RESPAWN
              </button>
              <button
                onClick={exitGame}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded
                           font-mono text-lg transition-colors duration-200 ml-4"
              >
                EXIT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}