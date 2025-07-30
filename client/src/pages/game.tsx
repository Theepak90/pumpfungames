import { useRef, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface Position {
  x: number;
  y: number;
}

interface Food {
  x: number;
  y: number;
  size: number;
  color: string;
  mass?: number; // Mass value for growth
}

class SmoothSnake {
  segments: Position[];
  speed: number;
  baseSpeed: number;
  radius: number;
  currentAngle: number;
  turnSpeed: number;
  segmentSpacing: number;
  growthRemaining: number;
  isBoosting: boolean;
  boostCooldown: number;
  segmentMass: number;
  minimumMass: number;
  
  constructor(x: number, y: number) {
    this.baseSpeed = 2.4 * 1.2; // 2.88 px/frame (20% faster than previous)
    this.speed = this.baseSpeed;
    this.radius = 12;
    this.currentAngle = 0;
    this.turnSpeed = 0.04; // Smoother turning speed to prevent snapping
    this.segmentSpacing = 8; // Distance between segments
    this.growthRemaining = 0; // Growth counter for eating food
    this.isBoosting = false;
    this.boostCooldown = 0;
    this.segmentMass = 1; // Each segment = 1 mass
    
    // Initialize with longer starting segments (30-40 like Slither.io)
    this.segments = [];
    const START_SEGMENTS = 35; // Much longer starting snake
    for (let i = 0; i < START_SEGMENTS; i++) {
      this.segments.push({ 
        x: x - i * this.segmentSpacing, 
        y: y 
      });
    }
    
    // Set minimum mass (50% of spawn mass)
    this.minimumMass = START_SEGMENTS * this.segmentMass * 0.5;
  }
  
  get head() {
    return this.segments[0];
  }
  
  get length() {
    return this.segments.length;
  }
  
  get totalMass() {
    return this.segments.length * this.segmentMass + this.growthRemaining;
  }
  
  move(mouseDirectionX: number, mouseDirectionY: number, onDropFood?: (food: Food) => void) {
    // Calculate target angle from mouse direction relative to screen center
    const targetAngle = Math.atan2(mouseDirectionY, mouseDirectionX);
    
    // Robust angle difference calculation to prevent 180° flips
    let angleDiff = targetAngle - this.currentAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    // Smoothly interpolate toward target angle
    this.currentAngle += angleDiff * this.turnSpeed;
    
    // Keep currentAngle in proper range to prevent accumulation
    if (this.currentAngle > Math.PI) this.currentAngle -= 2 * Math.PI;
    if (this.currentAngle < -Math.PI) this.currentAngle += 2 * Math.PI;
    
    // Handle boost mechanic with minimum mass protection
    const BOOST_MULTIPLIER = 2.0; // Double the normal speed
    const BOOST_DROP_INTERVAL = 20; // frames (3 drops per second at 60fps)
    const BOOST_DROP_MASS = 0.5;
    
    // Prevent boosting if below 50% of spawn mass
    if (this.totalMass <= this.minimumMass) {
      this.isBoosting = false;
    }
    
    if (this.isBoosting && this.totalMass > this.minimumMass) {
      this.speed = this.baseSpeed * BOOST_MULTIPLIER; // 5.76 pixels per frame when boosting (double normal)
      this.boostCooldown++;
      
      // Drop orb every 20 frames (3 per second)
      if (this.boostCooldown % BOOST_DROP_INTERVAL === 0 && onDropFood) {
        const tail = this.segments[this.segments.length - 1];
        onDropFood({
          x: tail.x,
          y: tail.y,
          size: 4,
          color: '#f55400',
          mass: BOOST_DROP_MASS
        });
        
        // Subtract 0.5 mass
        if (this.growthRemaining >= BOOST_DROP_MASS) {
          this.growthRemaining -= BOOST_DROP_MASS;
        } else {
          // Lose tail if growth buffer is empty
          if (this.segments.length > 1) {
            this.segments.pop();
          }
        }
      }
    } else {
      this.speed = this.baseSpeed;
    }
    
    // Move head in current direction
    const newHead = {
      x: this.head.x + this.speed * Math.cos(this.currentAngle),
      y: this.head.y + this.speed * Math.sin(this.currentAngle)
    };
    
    // Insert new head at the beginning
    this.segments.unshift(newHead);
    
    // Fix stretching when boosting by adding extra head segments for density
    if (this.isBoosting && this.totalMass > this.minimumMass) {
      // Add an extra segment between head positions to prevent stretching
      const intermediateHead = {
        x: this.head.x + (this.speed * 0.5) * Math.cos(this.currentAngle),
        y: this.head.y + (this.speed * 0.5) * Math.sin(this.currentAngle)
      };
      this.segments.splice(1, 0, intermediateHead);
    }
    
    // Adjust segment spacing based on boost state
    const currentSpacing = this.isBoosting ? this.segmentSpacing * 0.7 : this.segmentSpacing;
    
    // Smooth body following - each segment follows the one before it
    for (let i = 1; i < this.segments.length; i++) {
      const current = this.segments[i];
      const previous = this.segments[i - 1];
      
      const dx = previous.x - current.x;
      const dy = previous.y - current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > currentSpacing) {
        // Move segment toward the previous one, maintaining proper spacing
        const moveRatio = (distance - currentSpacing) / distance;
        this.segments[i] = {
          x: current.x + dx * moveRatio,
          y: current.y + dy * moveRatio
        };
      }
    }
    
    // Remove segments based on movement speed to maintain proper body density
    const segmentRemovalRate = this.isBoosting ? BOOST_MULTIPLIER : 1;
    
    for (let i = 0; i < segmentRemovalRate; i++) {
      if (this.growthRemaining > 0) {
        this.growthRemaining -= 1;
      } else {
        // Keep minimum length and remove excess
        if (this.segments.length > 15) {
          this.segments.pop();
        }
      }
    }
  }
  
  eatFood(food: Food) {
    // Growth based on food mass
    const mass = food.mass || 1; // Default to 1 if no mass specified
    this.growthRemaining += mass;
    return mass; // Return score increase based on mass
  }
  
  setBoost(boosting: boolean) {
    // Only allow boosting if above 50% of spawn mass
    if (boosting && this.totalMass <= this.minimumMass) {
      this.isBoosting = false;
      return;
    }
    
    this.isBoosting = boosting;
    if (!boosting) {
      this.boostCooldown = 0;
    }
  }
}

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setLocation] = useLocation();
  const [mouseDirection, setMouseDirection] = useState<Position>({ x: 1, y: 0 });
  const [snake] = useState(new SmoothSnake(2000, 2000));
  const [foods, setFoods] = useState<Food[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isBoosting, setIsBoosting] = useState(false);
  
  // Game constants - fullscreen
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const MAP_WIDTH = 4000;
  const MAP_HEIGHT = 4000;
  const FOOD_COUNT = 150;

  // Handle canvas resize for fullscreen
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

  // Initialize food with mass system
  useEffect(() => {
    const initialFoods: Food[] = [];
    for (let i = 0; i < FOOD_COUNT; i++) {
      const foodType = Math.random();
      let food: Food;
      
      if (foodType < 0.1) { // 10% big food
        food = {
          x: Math.random() * MAP_WIDTH,
          y: Math.random() * MAP_HEIGHT,
          size: 10,
          mass: 2,
          color: '#ff4444'
        };
      } else if (foodType < 0.4) { // 30% medium food
        food = {
          x: Math.random() * MAP_WIDTH,
          y: Math.random() * MAP_HEIGHT,
          size: 6,
          mass: 1,
          color: '#44ff44'
        };
      } else { // 60% small food
        food = {
          x: Math.random() * MAP_WIDTH,
          y: Math.random() * MAP_HEIGHT,
          size: 4,
          mass: 0.5,
          color: '#4444ff'
        };
      }
      
      initialFoods.push(food);
    }
    setFoods(initialFoods);
  }, []);

  // Mouse tracking
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate direction from screen center to mouse (Slither.io style)
      const directionX = mouseX - canvasSize.width / 2;
      const directionY = mouseY - canvasSize.height / 2;
      
      // Normalize the direction vector
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
  }, [canvasSize]);

  // Boost controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

    const handleMouseDown = () => {
      setIsBoosting(true);
      snake.setBoost(true);
    };

    const handleMouseUp = () => {
      setIsBoosting(false);
      snake.setBoost(false);
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
  }, [snake]);

  // Game loop
  useEffect(() => {
    if (gameOver) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    
    const gameLoop = () => {
      // Move snake with smooth turning based on mouse direction
      snake.move(mouseDirection.x, mouseDirection.y, (droppedFood: Food) => {
        // Add dropped food from boosting to the food array
        setFoods(prevFoods => [...prevFoods, droppedFood]);
      });

      // Check map boundaries (death barrier)
      const updatedHead = snake.head;
      if (updatedHead.x < 0 || updatedHead.x > MAP_WIDTH || updatedHead.y < 0 || updatedHead.y > MAP_HEIGHT) {
        setGameOver(true);
        return;
      }

      // Food gravitation toward snake head (30px radius, 2x faster)
      const suctionRadius = 30;
      const suctionStrength = 1.6;
      
      setFoods(prevFoods => {
        return prevFoods.map(food => {
          const dx = updatedHead.x - food.x;
          const dy = updatedHead.y - food.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < suctionRadius && dist > 0) {
            return {
              ...food,
              x: food.x + (dx / dist) * suctionStrength,
              y: food.y + (dy / dist) * suctionStrength
            };
          }
          return food;
        });
      });

      // Check for food collision and handle eating
      setFoods(prevFoods => {
        const newFoods = [...prevFoods];
        let scoreIncrease = 0;
        
        for (let i = newFoods.length - 1; i >= 0; i--) {
          const food = newFoods[i];
          const dist = Math.sqrt((updatedHead.x - food.x) ** 2 + (updatedHead.y - food.y) ** 2);
          
          if (dist < snake.radius + food.size) {
            // Snake eats the food - this handles growth internally
            scoreIncrease += snake.eatFood(food);
            
            // Remove eaten food and add new one with mass system
            newFoods.splice(i, 1);
            
            const foodType = Math.random();
            let newFood: Food;
            
            if (foodType < 0.1) { // 10% big food
              newFood = {
                x: Math.random() * MAP_WIDTH,
                y: Math.random() * MAP_HEIGHT,
                size: 10,
                mass: 2,
                color: '#ff4444'
              };
            } else if (foodType < 0.4) { // 30% medium food
              newFood = {
                x: Math.random() * MAP_WIDTH,
                y: Math.random() * MAP_HEIGHT,
                size: 6,
                mass: 1,
                color: '#44ff44'
              };
            } else { // 60% small food
              newFood = {
                x: Math.random() * MAP_WIDTH,
                y: Math.random() * MAP_HEIGHT,
                size: 4,
                mass: 0.5,
                color: '#4444ff'
              };
            }
            
            newFoods.push(newFood);
            break; // Only eat one food per frame
          }
        }
        
        if (scoreIncrease > 0) {
          setScore(prev => prev + scoreIncrease);
        }
        
        return newFoods;
      });

      // Clear canvas
      ctx.fillStyle = '#2c2c54';
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

      // Save context for camera transform
      ctx.save();

      // Camera follows snake head
      ctx.translate(canvasSize.width/2 - snake.head.x, canvasSize.height/2 - snake.head.y);

      // Draw map grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      const gridSize = 50;
      
      for (let x = 0; x <= MAP_WIDTH; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, MAP_HEIGHT);
        ctx.stroke();
      }
      
      for (let y = 0; y <= MAP_HEIGHT; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(MAP_WIDTH, y);
        ctx.stroke();
      }

      // Draw map boundaries
      ctx.strokeStyle = '#ff3333';
      ctx.lineWidth = 4;
      ctx.setLineDash([20, 10]);
      ctx.strokeRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
      ctx.setLineDash([]);

      // Draw food
      foods.forEach(food => {
        ctx.fillStyle = food.color;
        ctx.beginPath();
        ctx.arc(food.x, food.y, food.size, 0, 2 * Math.PI);
        ctx.fill();
        
        // Food glow effect
        ctx.shadowColor = food.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw snake body - uniform segments like Slither.io
      const segmentRadius = 12;
      const segmentColor = "#f55400";
      const headColor = "#ff6600";
      
      for (let i = 0; i < snake.segments.length; i++) {
        const segment = snake.segments[i];
        const isHead = i === 0;
        
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, segmentRadius, 0, Math.PI * 2);
        ctx.fillStyle = isHead ? headColor : segmentColor;
        ctx.fill();
        
        // Add subtle border for definition
        if (isHead) {
          ctx.strokeStyle = "#cc4400";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Draw eyes that follow snake's movement direction
      if (snake.segments.length > 0) {
        const snakeHead = snake.head;
        // Use snake's currentAngle instead of mouse direction
        const movementAngle = snake.currentAngle;
        const eyeDistance = 8;
        const eyeSize = 4;
        const pupilSize = 2;
        
        // Eye positions perpendicular to movement direction
        const eye1X = snakeHead.x + Math.cos(movementAngle + Math.PI/2) * eyeDistance;
        const eye1Y = snakeHead.y + Math.sin(movementAngle + Math.PI/2) * eyeDistance;
        const eye2X = snakeHead.x + Math.cos(movementAngle - Math.PI/2) * eyeDistance;
        const eye2Y = snakeHead.y + Math.sin(movementAngle - Math.PI/2) * eyeDistance;
        
        // White eyes with slight glow
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeSize, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eye2X, eye2Y, eyeSize, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Black pupils following movement direction
        const pupilOffset = 2;
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(
          eye1X + Math.cos(movementAngle) * pupilOffset, 
          eye1Y + Math.sin(movementAngle) * pupilOffset, 
          pupilSize, 0, 2 * Math.PI
        );
        ctx.fill();
        ctx.beginPath();
        ctx.arc(
          eye2X + Math.cos(movementAngle) * pupilOffset, 
          eye2Y + Math.sin(movementAngle) * pupilOffset, 
          pupilSize, 0, 2 * Math.PI
        );
        ctx.fill();
      }

      // Restore context
      ctx.restore();

      // Draw UI (fixed position)
      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px Arial';
      ctx.fillText(`Score: ${score}`, 20, 40);
      ctx.fillText(`Length: ${snake.length}`, 20, 70);
      


      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [mouseDirection, snake, foods, gameOver, canvasSize, score]);

  const resetGame = () => {
    setGameOver(false);
    setScore(0);
    // Reset snake to initial length and position (35 segments like Slither.io)
    snake.segments = [];
    const START_SEGMENTS = 35;
    for (let i = 0; i < START_SEGMENTS; i++) {
      snake.segments.push({ x: 2000 - i * snake.segmentSpacing, y: 2000 });
    }
    snake.currentAngle = 0;
    snake.growthRemaining = 0;
    snake.minimumMass = START_SEGMENTS * snake.segmentMass * 0.5; // Reset minimum mass (50% of spawn)
    snake.setBoost(false);
    setIsBoosting(false);
    setMouseDirection({ x: 1, y: 0 });
  };

  const exitGame = () => {
    setLocation('/');
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
      
      {/* Score Display */}
      <div className="absolute top-4 right-4 z-10">
        <div className="bg-dark-card/80 backdrop-blur-sm border border-dark-border rounded-lg px-4 py-2">
          <div className="text-neon-yellow text-xl font-bold">Score: {score.toFixed(1)}</div>
          <div className="text-white text-sm">Length: {snake.length}</div>
          <div className="text-blue-400 text-xs">Total Mass: {snake.totalMass.toFixed(1)}</div>
          <div className="text-gray-400 text-xs">Min Mass: {snake.minimumMass.toFixed(1)} (50% spawn)</div>
          {isBoosting && (
            <div className="text-orange-400 text-xs font-bold animate-pulse">BOOST!</div>
          )}
          {snake.totalMass <= snake.minimumMass && (
            <div className="text-red-400 text-xs">Cannot boost - too small!</div>
          )}
        </div>
      </div>
      
      {/* Controls Instructions */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-dark-card/80 backdrop-blur-sm border border-dark-border rounded-lg px-4 py-2">
          <div className="text-white text-sm">Hold Shift or Mouse to Boost</div>
          <div className="text-gray-400 text-xs">Drops 3 orbs/sec (0.5 mass each)</div>
          <div className="text-blue-400 text-xs">Red=2 mass, Green=1 mass, Blue=0.5 mass</div>
        </div>
      </div>
      
      {gameOver && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="bg-dark-card/90 backdrop-blur-sm border border-dark-border rounded-lg p-8 text-center">
            <div className="text-red-500 text-4xl font-bold mb-4">Game Over!</div>
            <div className="text-white text-lg mb-2">Final Score: {score}</div>
            <div className="text-white text-lg mb-6">Length: {snake.length}</div>
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
        style={{ background: '#2c2c54' }}
      />
    </div>
  );
}