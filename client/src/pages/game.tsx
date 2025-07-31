import { useRef, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { X, Volume2 } from 'lucide-react';

// Game constants
const MAP_CENTER_X = 2000;
const MAP_CENTER_Y = 2000;
const MAP_RADIUS = 1800; // Circular map radius
const FOOD_COUNT = 150;

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
  massPerSegment: number;
  baseSegmentRadius: number;
  maxSegmentRadius: number;
  
  constructor(x: number, y: number) {
    this.baseSpeed = 2.4 * 1.2; // 2.88 px/frame (20% faster than previous)
    this.speed = this.baseSpeed;
    this.radius = 12;
    this.currentAngle = 0;
    this.turnSpeed = 0.04; // Smoother turning speed to prevent snapping
    this.segmentSpacing = 24; // Connected segments like a worm
    this.growthRemaining = 0; // Growth counter for eating food
    this.isBoosting = false;
    this.boostCooldown = 0;
    this.segmentMass = 1; // Each segment = 1 mass
    this.massPerSegment = 5; // 5 mass = 1 new segment
    this.baseSegmentRadius = 14; // Fixed segment radius
    this.maxSegmentRadius = 14; // Keep consistent size
    
    // Start with 5 balls (25 mass total)
    this.segments = [];
    const START_MASS = 25; // 5 balls x 5 mass each
    this.growthRemaining = START_MASS;
    
    // Initialize exactly 5 segments for tracking
    const START_SEGMENTS = 5;
    for (let i = 0; i < START_SEGMENTS; i++) {
      this.segments.push({ 
        x: x - i * this.segmentSpacing, // Each segment overlaps half of the previous
        y: y 
      });
    }
    
    // Set minimum mass (cannot go below starting size)
    this.minimumMass = START_MASS;
  }
  
  get head() {
    return this.segments[0];
  }
  
  get length() {
    return this.segments.length;
  }
  
  get totalMass() {
    return this.growthRemaining; // Mass is now tracked purely in growthRemaining
  }
  
  get visibleSegments() {
    return Math.floor(this.totalMass / this.massPerSegment);
  }
  
  // All segments have consistent size - no gradual size increase
  getSegmentRadius(segmentIndex: number) {
    return this.baseSegmentRadius; // Fixed size for all segments
  }
  
  // Add new segment when mass threshold is reached
  addSegment() {
    if (this.segments.length < 2) return;
    
    // Duplicate from second-to-last segment position
    const secondLast = this.segments[this.segments.length - 2];
    const last = this.segments[this.segments.length - 1];
    
    // Calculate direction from second-last to last
    const dx = last.x - secondLast.x;
    const dy = last.y - secondLast.y;
    const length = Math.sqrt(dx * dx + dy * dy) || this.segmentSpacing;
    
    // Place new segment behind the last one
    const newX = last.x + (dx / length) * this.segmentSpacing;
    const newY = last.y + (dy / length) * this.segmentSpacing;
    
    this.segments.push({ x: newX, y: newY });
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
      
      // Drop orb every 20 frames (3 per second) just behind the head
      if (this.boostCooldown % BOOST_DROP_INTERVAL === 0 && onDropFood) {
        const dropDistance = 20; // pixels behind head
        const dropX = this.head.x - Math.cos(this.currentAngle) * dropDistance;
        const dropY = this.head.y - Math.sin(this.currentAngle) * dropDistance;
        
        onDropFood({
          x: dropX,
          y: dropY,
          size: 4,
          color: '#f55400',
          mass: BOOST_DROP_MASS
        });
      }
      
      // Continuous mass loss while boosting (0.025 per frame = 1.5 per second at 60fps)
      const boostMassLoss = BOOST_DROP_MASS / BOOST_DROP_INTERVAL;
      if (this.growthRemaining >= boostMassLoss) {
        this.growthRemaining -= boostMassLoss;
      } else {
        // Cap at minimum mass, don't go below
        this.growthRemaining = Math.max(0, this.growthRemaining - boostMassLoss);
      }
    } else {
      this.speed = this.baseSpeed;
    }
    
    // Move head in current direction
    const newHead = {
      x: this.head.x + this.speed * Math.cos(this.currentAngle),
      y: this.head.y + this.speed * Math.sin(this.currentAngle)
    };
    
    // Always update head position for smooth movement
    this.segments.unshift(newHead);
    
    // Remove extra head segment addition to prevent jittering
    
    // Keep consistent spacing regardless of boost state to prevent stretching
    const currentSpacing = this.segmentSpacing;
    
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
    
    // Trim segments to match actual snake length based on mass
    const maxSegments = Math.floor(this.totalMass / this.massPerSegment);
    if (this.segments.length > maxSegments) {
      this.segments = this.segments.slice(0, maxSegments);
    }
  }
  
  eatFood(food: Food) {
    // Growth based on food mass
    const mass = food.mass || 1; // Default to 1 if no mass specified
    const oldMass = this.growthRemaining;
    this.growthRemaining += mass;
    
    // Check if we should add a new segment (every 5 mass)
    const oldSegments = Math.floor(oldMass / this.massPerSegment);
    const newSegments = Math.floor(this.growthRemaining / this.massPerSegment);
    
    if (newSegments > oldSegments) {
      this.addSegment();
    }
    
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
  const [snake] = useState(() => {
    const newSnake = new SmoothSnake(MAP_CENTER_X, MAP_CENTER_Y);
    newSnake.segmentSpacing = 24; // Connected segments like a worm
    // Recreate segments with proper spacing
    newSnake.segments = [];
    for (let i = 0; i < 5; i++) {
      newSnake.segments.push({ 
        x: MAP_CENTER_X - i * newSnake.segmentSpacing, 
        y: MAP_CENTER_Y 
      });
    }
    return newSnake;
  });
  const [foods, setFoods] = useState<Food[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isBoosting, setIsBoosting] = useState(false);
  const [backgroundMusic, setBackgroundMusic] = useState<HTMLAudioElement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('soundEnabled');
    return saved ? JSON.parse(saved) : true;
  });
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('volume');
    return saved ? parseFloat(saved) : 0.25;
  });
  const [previousVolume, setPreviousVolume] = useState(() => {
    const saved = localStorage.getItem('previousVolume');
    return saved ? parseFloat(saved) : 0.25;
  });
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  
  // Game constants - fullscreen
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Background music setup
  useEffect(() => {
    const audio = new Audio();
    audio.src = '/audio/background-music.mp3';
    audio.preload = 'auto';
    audio.loop = true;
    audio.volume = volume;
    setBackgroundMusic(audio);
    
    // Start playing music when game loads if sound is enabled
    if (soundEnabled) {
      audio.play().catch(console.error);
    }

    return () => {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    };
  }, []);

  // Load background image
  useEffect(() => {
    const img = new Image();
    img.src = '/background.png';
    img.onload = () => {
      setBackgroundImage(img);
    };
  }, []);

  // Handle volume changes
  useEffect(() => {
    if (backgroundMusic) {
      backgroundMusic.volume = volume;
      if (soundEnabled) {
        backgroundMusic.play().catch(console.error);
      } else {
        backgroundMusic.pause();
      }
    }
  }, [backgroundMusic, volume, soundEnabled]);

  // Toggle sound function
  const toggleSound = () => {
    const newSoundState = !soundEnabled;
    setSoundEnabled(newSoundState);
    localStorage.setItem('soundEnabled', JSON.stringify(newSoundState));
    
    if (newSoundState) {
      // Turning sound ON - restore previous volume
      setVolume(previousVolume);
      localStorage.setItem('volume', previousVolume.toString());
    } else {
      // Turning sound OFF - save current volume and set to 0
      setPreviousVolume(volume);
      localStorage.setItem('previousVolume', volume.toString());
      setVolume(0);
      localStorage.setItem('volume', '0');
    }
  };

  // Handle volume change
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    localStorage.setItem('volume', newVolume.toString());
    if (soundEnabled && newVolume > 0) {
      setPreviousVolume(newVolume);
      localStorage.setItem('previousVolume', newVolume.toString());
    }
  };

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
      // Generate food within circular boundary
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * (MAP_RADIUS - 100); // Keep food away from edge
      const x = MAP_CENTER_X + Math.cos(angle) * radius;
      const y = MAP_CENTER_Y + Math.sin(angle) * radius;
      
      const foodType = Math.random();
      let food: Food;
      
      if (foodType < 0.1) { // 10% big food
        food = {
          x: x,
          y: y,
          size: 10,
          mass: 2,
          color: '#ff4444'
        };
      } else if (foodType < 0.4) { // 30% medium food
        food = {
          x: x,
          y: y,
          size: 6,
          mass: 1,
          color: '#44ff44'
        };
      } else { // 60% small food
        food = {
          x: x,
          y: y,
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

      // Check circular map boundaries (death barrier)
      const updatedHead = snake.head;
      const distanceFromCenter = Math.sqrt(
        (updatedHead.x - MAP_CENTER_X) ** 2 + (updatedHead.y - MAP_CENTER_Y) ** 2
      );
      if (distanceFromCenter > MAP_RADIUS) {
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
            
            // Generate new food within circular boundary
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * (MAP_RADIUS - 100);
            const newX = MAP_CENTER_X + Math.cos(angle) * radius;
            const newY = MAP_CENTER_Y + Math.sin(angle) * radius;
            
            if (foodType < 0.1) { // 10% big food
              newFood = {
                x: newX,
                y: newY,
                size: 10,
                mass: 2,
                color: '#ff4444'
              };
            } else if (foodType < 0.4) { // 30% medium food
              newFood = {
                x: newX,
                y: newY,
                size: 6,
                mass: 1,
                color: '#44ff44'
              };
            } else { // 60% small food
              newFood = {
                x: newX,
                y: newY,
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

      // Clear canvas with background image or dark fallback
      if (backgroundImage) {
        // Calculate scale to cover entire canvas while maintaining aspect ratio
        const scale = Math.max(
          canvasSize.width / backgroundImage.width,
          canvasSize.height / backgroundImage.height
        );
        const scaledWidth = backgroundImage.width * scale;
        const scaledHeight = backgroundImage.height * scale;
        const offsetX = (canvasSize.width - scaledWidth) / 2;
        const offsetY = (canvasSize.height - scaledHeight) / 2;
        
        ctx.drawImage(backgroundImage, offsetX, offsetY, scaledWidth, scaledHeight);
      } else {
        // Fallback to solid color if image not loaded
        ctx.fillStyle = '#15161b';
        ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
      }

      // Save context for camera transform
      ctx.save();

      // Camera follows snake head
      ctx.translate(canvasSize.width/2 - snake.head.x, canvasSize.height/2 - snake.head.y);

      // Fill area outside death barrier with darker green
      const mapSize = MAP_RADIUS * 2.5;
      ctx.fillStyle = '#52a47a';
      ctx.fillRect(-mapSize, -mapSize, mapSize * 2, mapSize * 2);
      
      // Cut out the safe zone circle
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(MAP_CENTER_X, MAP_CENTER_Y, MAP_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      
      // Draw simple black grid overlay
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 1;
      const gridSize = 50;
      
      // Vertical lines
      for (let x = -mapSize; x <= mapSize; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, -mapSize);
        ctx.lineTo(x, mapSize);
        ctx.stroke();
      }
      
      // Horizontal lines
      for (let y = -mapSize; y <= mapSize; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(-mapSize, y);
        ctx.lineTo(mapSize, y);
        ctx.stroke();
      }

      // Draw thin death barrier line
      ctx.strokeStyle = '#53d392';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(MAP_CENTER_X, MAP_CENTER_Y, MAP_RADIUS, 0, Math.PI * 2);
      ctx.stroke();

      // Draw food with gradient effect
      foods.forEach(food => {
        // Create radial gradient for food
        const gradient = ctx.createRadialGradient(
          food.x, food.y, 0,
          food.x, food.y, food.size
        );
        gradient.addColorStop(0, "#ffbaba"); // Light center
        gradient.addColorStop(1, food.color); // Dark edge
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(food.x, food.y, food.size, 0, 2 * Math.PI);
        ctx.fill();
        
        // Food glow effect
        ctx.shadowColor = food.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw snake body with consistent sized spheres
      const actualSegments = snake.segments.length;
      
      // Draw all actual segments (no spacing calculation needed)
      for (let i = 0; i < actualSegments; i++) {
        const segment = snake.segments[i];
        const isHead = i === 0;
        const segmentRadius = snake.getSegmentRadius(i);
        
        // Create radial gradient for 3D effect (light top, dark bottom)
        const gradient = ctx.createRadialGradient(
          segment.x - 4, segment.y - 4, 0,
          segment.x, segment.y, segmentRadius
        );
        
        if (isHead) {
          // Head gradient - bright orange center, darker edges
          gradient.addColorStop(0, "#ff8800");  // Bright orange center
          gradient.addColorStop(0.6, "#ff6600"); // Medium orange
          gradient.addColorStop(0.8, "#cc4400"); // Darker orange
          gradient.addColorStop(1, "#992200");   // Dark orange/red edge
        } else {
          // Body gradient - bright orange center, darker edges for 3D effect
          gradient.addColorStop(0, "#ff8800");  // Bright orange center
          gradient.addColorStop(0.6, "#ff6600"); // Medium orange
          gradient.addColorStop(0.8, "#cc4400"); // Darker orange
          gradient.addColorStop(1, "#992200");   // Dark orange/red edge
        }
        
        // Draw segment sphere
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, segmentRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Add subtle rim lighting for extra 3D effect
        if (isHead) {
          const rimGradient = ctx.createRadialGradient(
            segment.x, segment.y, segmentRadius - 2,
            segment.x, segment.y, segmentRadius
          );
          rimGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
          rimGradient.addColorStop(1, "rgba(255, 255, 255, 0.3)");
          
          ctx.fillStyle = rimGradient;
          ctx.beginPath();
          ctx.arc(segment.x, segment.y, segmentRadius, 0, Math.PI * 2);
          ctx.fill();
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
      ctx.fillText(`Segments: ${snake.segments.length}`, 20, 70);
      


      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [mouseDirection, snake, foods, gameOver, canvasSize, score]);

  const resetGame = () => {
    setGameOver(false);
    setScore(0);
    // Reset snake to initial state (5 segments, 25 mass) with new spacing
    snake.segments = [];
    const START_MASS = 25;
    const START_SEGMENTS = 5;
    snake.segmentSpacing = 24; // Ensure spacing is updated on reset
    for (let i = 0; i < START_SEGMENTS; i++) {
      snake.segments.push({ x: MAP_CENTER_X - i * snake.segmentSpacing, y: MAP_CENTER_Y });
    }
    snake.currentAngle = 0;
    snake.growthRemaining = START_MASS;
    snake.minimumMass = START_MASS; // Reset minimum mass (cannot go below starting)
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
          style={{
            background: `linear-gradient(to right, #53d493 0%, #53d493 ${volume * 100}%, #4b5563 ${volume * 100}%, #4b5563 100%)`
          }}
        />
        <span className="text-white text-xs font-retro w-8 text-center">{Math.round(volume * 100)}%</span>
      </div>
      
      {/* Score Display */}
      <div className="absolute top-4 right-4 z-10">
        <div className="bg-dark-card/80 backdrop-blur-sm border border-dark-border rounded-lg px-4 py-2">
          <div className="text-neon-yellow text-xl font-bold">Score: {score.toFixed(1)}</div>
          <div className="text-white text-sm">Segments: {snake.segments.length}</div>
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
            <div className="text-white text-lg mb-6">Final Segments: {snake.segments.length}</div>
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