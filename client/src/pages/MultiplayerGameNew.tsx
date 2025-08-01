import { useRef, useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import LoadingScreen from '@/components/LoadingScreen';
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

interface Food {
  x: number;
  y: number;
  size: number;
  mass: number;
  color: string;
  type: 'normal' | 'money';
  value?: number;
  spawnTime?: number;
}

interface OtherPlayer {
  id: number;
  segments: Array<{ x: number; y: number; opacity?: number }>;
  color: string;
  money: number;
}

export default function MultiplayerGameNew() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  
  // Game state
  const [mouseDirection, setMouseDirection] = useState<Position>({ x: 1, y: 0 });
  const [foods, setFoods] = useState<Food[]>([]);
  const [snake] = useState(() => new SmoothSnake(MAP_CENTER_X, MAP_CENTER_Y));
  const [isBoosting, setIsBoosting] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  
  // Multiplayer state
  const [otherPlayers, setOtherPlayers] = useState<OtherPlayer[]>([]);
  const [isMultiplayerActive, setIsMultiplayerActive] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  
  // Images
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [dollarSignImage, setDollarSignImage] = useState<HTMLImageElement | null>(null);
  
  // Canvas setup
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [zoom, setZoom] = useState(2);
  const minZoom = 0.3;
  const zoomSmoothing = 0.05;

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

  // Generate random food colors
  const getRandomFoodColor = useCallback(() => {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6ab04c'];
    return colors[Math.floor(Math.random() * colors.length)];
  }, []);

  // Generate initial food
  const generateFood = useCallback(() => {
    const foods: Food[] = [];
    const FOOD_COUNT = 200;

    for (let i = 0; i < FOOD_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * (MAP_RADIUS - 100);
      const x = MAP_CENTER_X + Math.cos(angle) * radius;
      const y = MAP_CENTER_Y + Math.sin(angle) * radius;

      const foodType = Math.random();
      let food: Food;

      if (foodType < 0.05) {
        food = {
          x, y,
          size: 20,
          mass: 25,
          color: '#ff8c00',
          type: 'normal'
        };
      } else if (foodType < 0.15) {
        food = {
          x, y,
          size: 10,
          mass: 0.8,
          color: getRandomFoodColor(),
          type: 'normal'
        };
      } else if (foodType < 0.50) {
        food = {
          x, y,
          size: 6,
          mass: 0.4,
          color: getRandomFoodColor(),
          type: 'normal'
        };
      } else {
        food = {
          x, y,
          size: 4,
          mass: 0.2,
          color: getRandomFoodColor(),
          type: 'normal'
        };
      }

      foods.push(food);
    }

    setFoods(foods);
  }, [getRandomFoodColor]);

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
        snake.setBoost(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        setIsBoosting(false);
        snake.setBoost(false);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) { // Left click
        setIsBoosting(true);
        snake.setBoost(true);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) { // Left click
        setIsBoosting(false);
        snake.setBoost(false);
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
  }, [gameStarted, snake]);

  // Game loop
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const gameLoop = () => {
      // Move snake
      snake.move(mouseDirection.x, mouseDirection.y, () => {});

      // Check food collisions
      const collisionRadius = 15;
      const head = snake.head;

      foods.forEach((food, index) => {
        const distance = Math.sqrt(
          (head.x - food.x) ** 2 + (head.y - food.y) ** 2
        );

        if (distance < collisionRadius) {
          // Consume food
          snake.grow(food.mass);
          if (food.type === 'money' && food.value) {
            snake.addMoney(food.value);
          }

          // Remove eaten food and replace with new one
          setFoods(prev => {
            const newFoods = [...prev];
            newFoods.splice(index, 1);
            
            // Add a new food to maintain count
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * (MAP_RADIUS - 100);
            const x = MAP_CENTER_X + Math.cos(angle) * radius;
            const y = MAP_CENTER_Y + Math.sin(angle) * radius;
            
            newFoods.push({
              x, y,
              size: 4,
              mass: 0.2,
              color: getRandomFoodColor(),
              type: 'normal'
            });
            
            return newFoods;
          });
        }
      });

      // Check boundary collision
      const distanceFromCenter = Math.sqrt(
        (snake.head.x - MAP_CENTER_X) ** 2 + (snake.head.y - MAP_CENTER_Y) ** 2
      );
      
      if (distanceFromCenter > MAP_RADIUS) {
        setGameOver(true);
        return;
      }

      // Dynamic zoom based on snake size
      const targetZoom = Math.max(minZoom, 2.5 - (snake.totalMass / 100));
      setZoom(prevZoom => prevZoom + (targetZoom - prevZoom) * zoomSmoothing);

      // Render game
      renderGame(ctx);

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [gameStarted, gameOver, mouseDirection, snake, zoom, foods, getRandomFoodColor, isMultiplayerActive, otherPlayers]);

  const renderGame = (ctx: CanvasRenderingContext2D) => {
    // Clear canvas
    ctx.fillStyle = '#15161b';
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Save context for camera transform
    ctx.save();

    // Apply zoom and camera following snake head
    ctx.translate(canvasSize.width / 2, canvasSize.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-snake.head.x, -snake.head.y);

    // Draw background pattern
    if (backgroundImage) {
      const mapSize = MAP_RADIUS * 2.5;
      const pattern = ctx.createPattern(backgroundImage, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(-mapSize, -mapSize, mapSize * 2, mapSize * 2);
      }
    }

    // Draw thin death barrier line (original green color)
    ctx.strokeStyle = '#53d392';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(MAP_CENTER_X, MAP_CENTER_Y, MAP_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Draw foods
    foods.forEach(food => {
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

    // Draw single glowing outline behind the whole snake when boosting
    if (snake.isBoosting && snake.visibleSegments.length > 0) {
      ctx.save();
      ctx.shadowColor = "white";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "white";
      
      snake.visibleSegments.forEach(segment => {
        ctx.globalAlpha = segment.opacity || 1.0;
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, snake.getSegmentRadius() + 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // Draw player snake body with proper shadow
    ctx.save();
    
    if (!snake.isBoosting) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    
    ctx.fillStyle = '#d55400';
    for (let i = snake.visibleSegments.length - 1; i >= 0; i--) {
      const segment = snake.visibleSegments[i];
      ctx.globalAlpha = segment.opacity || 1.0;
      ctx.beginPath();
      ctx.arc(segment.x, segment.y, snake.getSegmentRadius(), 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();

    // Draw money balance above player head
    if (snake.visibleSegments.length > 0) {
      const head = snake.visibleSegments[0];
      const moneyText = `$${snake.money.toFixed(2)}`;
      
      const scaleFactor = snake.getScaleFactor();
      const segmentRadius = snake.getSegmentRadius();
      
      const textY = head.y - segmentRadius - 25;
      
      ctx.font = `${Math.max(12, Math.floor(8 * scaleFactor))}px 'Press Start 2P', monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'white';
      ctx.strokeStyle = '#134242';
      ctx.lineWidth = 3;
      
      ctx.strokeText(moneyText, head.x, textY);
      ctx.fillText(moneyText, head.x, textY);
    }

    // Draw other players' complete snakes
    if (isMultiplayerActive && otherPlayers.length > 0) {
      otherPlayers.forEach((player, index) => {
        if (!player.segments || player.segments.length === 0) return;
        
        ctx.save();
        
        // Different colors for each player
        const playerColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6ab04c'];
        const playerColor = playerColors[index % playerColors.length];
        
        // Draw other player's full snake body
        ctx.fillStyle = playerColor;
        ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // Draw all segments
        for (let i = player.segments.length - 1; i >= 0; i--) {
          const segment = player.segments[i];
          ctx.globalAlpha = segment.opacity || 1.0;
          ctx.beginPath();
          ctx.arc(segment.x, segment.y, 10, 0, Math.PI * 2); // Same radius as player snake
          ctx.fill();
        }
        
        // Draw money above other player's head
        if (player.segments.length > 0) {
          const head = player.segments[0];
          const moneyText = `$${player.money.toFixed(2)}`;
          
          ctx.globalAlpha = 1.0;
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          ctx.font = '10px "Press Start 2P", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'white';
          ctx.strokeStyle = '#134242';
          ctx.lineWidth = 2;
          
          ctx.strokeText(moneyText, head.x, head.y - 25);
          ctx.fillText(moneyText, head.x, head.y - 25);
        }
        
        // Draw simple eyes on the head
        if (player.segments.length > 0) {
          const head = player.segments[0];
          const eyeDistance = 8;
          const eyeSize = 3;
          
          // Calculate angle from head to second segment for eye direction
          let eyeAngle = 0;
          if (player.segments.length > 1) {
            const second = player.segments[1];
            eyeAngle = Math.atan2(head.y - second.y, head.x - second.x);
          }
          
          const eye1X = head.x + Math.cos(eyeAngle - 0.4) * eyeDistance;
          const eye1Y = head.y + Math.sin(eyeAngle - 0.4) * eyeDistance;
          const eye2X = head.x + Math.cos(eyeAngle + 0.4) * eyeDistance;
          const eye2Y = head.y + Math.sin(eyeAngle + 0.4) * eyeDistance;
          
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
          ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = 'black';
          ctx.beginPath();
          ctx.arc(eye1X, eye1Y, eyeSize / 2, 0, Math.PI * 2);
          ctx.arc(eye2X, eye2Y, eyeSize / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.restore();
      });
    }

    // Draw player eyes
    if (snake.visibleSegments.length > 0) {
      const head = snake.visibleSegments[0];
      ctx.globalAlpha = 1.0;
      
      const movementAngle = snake.currentAngle;
      const scaleFactor = snake.getScaleFactor();
      const eyeDistance = 5 * scaleFactor;
      const eyeSize = 3 * scaleFactor;
      const pupilSize = 1.5 * scaleFactor;
      
      const cursorAngle = Math.atan2(mouseDirection.y, mouseDirection.x);
      
      const eye1X = head.x + Math.cos(movementAngle + Math.PI/2) * eyeDistance;
      const eye1Y = head.y + Math.sin(movementAngle + Math.PI/2) * eyeDistance;
      const eye2X = head.x + Math.cos(movementAngle - Math.PI/2) * eyeDistance;
      const eye2Y = head.y + Math.sin(movementAngle - Math.PI/2) * eyeDistance;
      
      // Draw rotated square eyes
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

  // WebSocket connection setup
  useEffect(() => {
    if (!gameStarted) return;

    console.log("Multiplayer layer inactive - running in local mode");
    
    // Try to connect to WebSocket server (will be used when available)
    try {
      // Connect to the simple WebSocket server on port 3000
      const socket = new WebSocket('ws://localhost:3000');
      
      socket.onopen = () => {
        console.log("WebSocket connected - multiplayer active");
        setIsMultiplayerActive(true);
        socketRef.current = socket;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "players") {
            // Render other players' snakes
            setOtherPlayers(data.players);
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
        }
      };

      socket.onclose = () => {
        console.log("WebSocket disconnected - running in local mode");
        setIsMultiplayerActive(false);
        socketRef.current = null;
      };

      socket.onerror = () => {
        console.warn("Multiplayer hooks not available, running in local mode");
        setIsMultiplayerActive(false);
      };

    } catch (error) {
      console.warn("Multiplayer hooks not available, running in local mode");
      setIsMultiplayerActive(false);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [gameStarted]);

  // Send player position to other players
  useEffect(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const sendInterval = setInterval(() => {
        // Send full snake data including all segments
        socketRef.current?.send(JSON.stringify({
          segments: snake.visibleSegments,
          color: '#d55400', // Player's snake color
          money: snake.money
        }));
      }, 50);

      return () => clearInterval(sendInterval);
    }
  }, [snake, isMultiplayerActive]);

  const handleLoadingComplete = useCallback(() => {
    setIsLoading(false);
    setGameStarted(true);
    generateFood();
  }, [generateFood]);

  const handleRestart = useCallback(() => {
    snake.reset(MAP_CENTER_X, MAP_CENTER_Y);
    setGameOver(false);
    generateFood();
  }, [snake, generateFood]);

  if (isLoading) {
    return <LoadingScreen onLoadingComplete={handleLoadingComplete} />;
  }

  return (
    <div className="h-screen w-screen bg-[#15161b] overflow-hidden relative">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="block"
        style={{ cursor: 'none' }}
      />

      {/* Minimal UI */}
      <div className="absolute top-4 left-4 text-white font-mono text-sm space-y-1">
        <div>Players: {isMultiplayerActive ? otherPlayers.length + 1 : 1} {isMultiplayerActive ? '(Online)' : '(Offline)'}</div>
        <div>Status: {isMultiplayerActive ? 'MULTIPLAYER' : 'LOCAL'}</div>
      </div>

      {/* Simple restart when game over */}
      {gameOver && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-4xl text-white font-bold mb-4">Game Over</h2>
            <button 
              onClick={handleRestart}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 text-white font-mono text-sm space-y-1">
        <div>Left click to boost</div>
        <div>Mouse to steer</div>
      </div>
    </div>
  );
}