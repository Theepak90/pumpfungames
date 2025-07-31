import { useRef, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { X, Volume2 } from 'lucide-react';

// Game constants
const MAP_CENTER_X = 2000;
const MAP_CENTER_Y = 2000;
const MAP_RADIUS = 1800; // Circular map radius
const FOOD_COUNT = 150;
const BOT_COUNT = 5;

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

interface BotSnake {
  id: string;
  head: Position;
  visibleSegments: Array<{ x: number; y: number; opacity: number }>;
  segmentTrail: Position[];
  totalMass: number;
  currentAngle: number;
  speed: number;
  color: string;
  targetAngle: number;
  lastDirectionChange: number;
  targetFood: Food | null;
  target: { x: number; y: number };
  wobble: number;
}

// Death drop utility function
function dropDeathFood(snake: SmoothSnake | BotSnake): Food[] {
  const deathFoods: Food[] = [];
  const segments = 'visibleSegments' in snake ? snake.visibleSegments : [];
  const mass = snake.totalMass;
  const amount = Math.floor(mass / 10);
  
  if (segments.length === 0 || amount === 0) return deathFoods;
  
  const segmentSpacing = Math.max(1, Math.floor(segments.length / amount));
  
  for (let i = 0; i < amount && i * segmentSpacing < segments.length; i++) {
    const segIndex = i * segmentSpacing;
    const segment = segments[segIndex];
    
    // Add slight randomness to prevent perfect stacking
    const offsetX = (Math.random() - 0.5) * 20;
    const offsetY = (Math.random() - 0.5) * 20;
    
    deathFoods.push({
      x: segment.x + offsetX,
      y: segment.y + offsetY,
      size: 8,
      color: '#ff8800', // Orange death food
      mass: 10
    });
  }
  
  return deathFoods;
}

// Bot snake utility functions
function createBotSnake(id: string): BotSnake {
  // Spawn bot at random location within map
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * (MAP_RADIUS - 200);
  const x = MAP_CENTER_X + Math.cos(angle) * radius;
  const y = MAP_CENTER_Y + Math.sin(angle) * radius;
  
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'];
  
  // Generate random target position
  const targetAngle = Math.random() * Math.PI * 2;
  const targetDistance = 100 + Math.random() * 300; // Target within reasonable range
  const targetX = x + Math.cos(targetAngle) * targetDistance;
  const targetY = y + Math.sin(targetAngle) * targetDistance;

  return {
    id,
    head: { x, y },
    visibleSegments: [{ x, y, opacity: 1.0 }],
    segmentTrail: [{ x, y }],
    totalMass: 8 + Math.random() * 12, // Start with 8-20 mass
    currentAngle: Math.random() * Math.PI * 2,
    speed: 1.8 + Math.random() * 0.8, // Slightly slower than player
    color: colors[Math.floor(Math.random() * colors.length)],
    targetAngle: Math.random() * Math.PI * 2,
    lastDirectionChange: 0,
    targetFood: null,
    target: { x: targetX, y: targetY },
    wobble: 0
  };
}

function updateBotSnake(bot: BotSnake, foods: Food[], playerSnake: SmoothSnake, otherBots: BotSnake[]): BotSnake {
  // AI Decision making
  const SEGMENT_SPACING = 10;
  const SEGMENT_RADIUS = 10;
  
  // Find nearest food if no target or target is too far
  if (!bot.targetFood || Math.sqrt((bot.head.x - bot.targetFood.x) ** 2 + (bot.head.y - bot.targetFood.y) ** 2) > 300) {
    let nearestFood: Food | null = null;
    let nearestDist = Infinity;
    
    foods.forEach(food => {
      const dist = Math.sqrt((bot.head.x - food.x) ** 2 + (bot.head.y - food.y) ** 2);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestFood = food;
      }
    });
    
    bot.targetFood = nearestFood;
  }
  
  // Use target position system for intelligent movement
  const dx = bot.target.x - bot.head.x;
  const dy = bot.target.y - bot.head.y;
  const distToTarget = Math.sqrt(dx * dx + dy * dy);
  
  // When close to target, pick a new random target
  if (distToTarget < 80) {
    const targetAngle = Math.random() * Math.PI * 2;
    const targetDistance = 150 + Math.random() * 200;
    bot.target.x = bot.head.x + Math.cos(targetAngle) * targetDistance;
    bot.target.y = bot.head.y + Math.sin(targetAngle) * targetDistance;
    
    // Keep target within map bounds
    const distFromCenter = Math.sqrt((bot.target.x - MAP_CENTER_X) ** 2 + (bot.target.y - MAP_CENTER_Y) ** 2);
    if (distFromCenter > MAP_RADIUS - 200) {
      bot.target.x = MAP_CENTER_X + (bot.target.x - MAP_CENTER_X) * (MAP_RADIUS - 200) / distFromCenter;
      bot.target.y = MAP_CENTER_Y + (bot.target.y - MAP_CENTER_Y) * (MAP_RADIUS - 200) / distFromCenter;
    }
  }
  
  // Calculate desired angle toward target
  const desiredAngle = Math.atan2(dy, dx);
  
  // Add wobble for organic movement
  bot.wobble += (Math.random() - 0.5) * 0.1;
  const wobbleEffect = Math.sin(bot.wobble) * 0.02;
  
  // Smooth turn toward target
  let angleDiff = desiredAngle - bot.currentAngle;
  // Normalize angle difference to [-PI, PI]
  angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
  
  bot.currentAngle += angleDiff * 0.05 + wobbleEffect; // Smooth turning with wobble
  
  // Move bot head
  const moveDx = Math.cos(bot.currentAngle) * bot.speed;
  const moveDy = Math.sin(bot.currentAngle) * bot.speed;
  bot.head.x += moveDx;
  bot.head.y += moveDy;
  
  // Update trail
  bot.segmentTrail.unshift({ x: bot.head.x, y: bot.head.y });
  const maxTrailLength = Math.floor((bot.totalMass / 1) * SEGMENT_SPACING * 2);
  if (bot.segmentTrail.length > maxTrailLength) {
    bot.segmentTrail.length = maxTrailLength;
  }
  
  // Update visible segments
  bot.visibleSegments = [];
  let distanceSoFar = 0;
  let segmentIndex = 0;
  const targetSegmentCount = Math.floor(bot.totalMass / 1);
  
  for (let i = 1; i < bot.segmentTrail.length && bot.visibleSegments.length < targetSegmentCount; i++) {
    const a = bot.segmentTrail[i - 1];
    const b = bot.segmentTrail[i];
    
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segmentDist = Math.sqrt(dx * dx + dy * dy);
    
    while (distanceSoFar + segmentDist >= segmentIndex * SEGMENT_SPACING && bot.visibleSegments.length < targetSegmentCount) {
      const targetDistance = segmentIndex * SEGMENT_SPACING;
      const overshoot = targetDistance - distanceSoFar;
      const t = segmentDist > 0 ? overshoot / segmentDist : 0;
      
      const x = a.x + dx * t;
      const y = a.y + dy * t;
      
      bot.visibleSegments.push({ x, y, opacity: 1.0 });
      segmentIndex++;
    }
    
    distanceSoFar += segmentDist;
  }
  
  return bot;
}

class SmoothSnake {
  head: Position;
  currentAngle: number;
  turnSpeed: number;
  speed: number;
  baseSpeed: number;
  boostMultiplier: number;
  isBoosting: boolean;
  boostCooldown: number;
  
  // Trail and segment system
  segmentTrail: Position[];
  visibleSegments: Array<{ x: number; y: number; opacity: number }>; // Segments with opacity for fading
  totalMass: number;
  growthRemaining: number;
  distanceBuffer: number;
  currentSegmentCount: number; // Smoothly animated segment count
  
  // Constants
  START_MASS: number;
  MASS_PER_SEGMENT: number;
  SEGMENT_SPACING: number;
  SEGMENT_RADIUS: number;
  MIN_MASS_TO_BOOST: number;
  
  constructor(x: number, y: number) {
    // Movement properties
    this.head = { x, y };
    this.currentAngle = 0;
    this.turnSpeed = 0.032; // Reduced by 20% (0.04 * 0.8) for smoother turning
    this.baseSpeed = 2.4;
    this.boostMultiplier = 2.0;
    this.speed = this.baseSpeed;
    this.isBoosting = false;
    this.boostCooldown = 0;
    
    // Snake system constants
    this.START_MASS = 6; // Start with just 6 segments instead of 30
    this.MASS_PER_SEGMENT = 1;
    this.SEGMENT_SPACING = 10; // Heavy overlap (radius=10, so 10px overlap for maximum density)
    this.SEGMENT_RADIUS = 10;
    this.MIN_MASS_TO_BOOST = 4;
    
    // Initialize trail and segments
    this.segmentTrail = [{ x, y }];
    this.visibleSegments = [];
    this.totalMass = this.START_MASS;
    this.growthRemaining = 0;
    this.distanceBuffer = 0;
    this.currentSegmentCount = this.START_MASS; // Start with initial segment count
    
    this.updateVisibleSegments();
  }
  
  updateVisibleSegments() {
    // Calculate target segment count based on mass
    const targetSegmentCount = Math.floor(this.totalMass / this.MASS_PER_SEGMENT);
    
    // Grow snake by adding segments to tail when needed
    while (this.visibleSegments.length < targetSegmentCount) {
      let newSegmentPos = { x: this.head.x, y: this.head.y };
      
      // If we have segments, place new one behind the last segment
      if (this.visibleSegments.length > 0) {
        const lastSegment = this.visibleSegments[this.visibleSegments.length - 1];
        newSegmentPos = { x: lastSegment.x, y: lastSegment.y };
      }
      
      // Add new segment without any fading - just solid opacity
      this.visibleSegments.push({ x: newSegmentPos.x, y: newSegmentPos.y, opacity: 1.0 });
    }
    
    // Shrink snake by removing tail segments when needed (rare)
    while (this.visibleSegments.length > targetSegmentCount) {
      this.visibleSegments.pop();
    }
    
    // Update segment positions using smooth following mechanics
    if (this.visibleSegments.length > 0) {
      // Head follows the actual head position
      this.visibleSegments[0] = { 
        x: this.head.x, 
        y: this.head.y, 
        opacity: 1.0 
      };
      
      // Each segment follows the one in front with fixed spacing
      for (let i = 1; i < this.visibleSegments.length; i++) {
        const prev = this.visibleSegments[i - 1];
        const curr = this.visibleSegments[i];
        
        const dx = prev.x - curr.x;
        const dy = prev.y - curr.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > this.SEGMENT_SPACING) {
          const angle = Math.atan2(dy, dx);
          curr.x = prev.x - Math.cos(angle) * this.SEGMENT_SPACING;
          curr.y = prev.y - Math.sin(angle) * this.SEGMENT_SPACING;
        }
        
        // Keep all segments fully opaque (no fading)
        curr.opacity = 1.0;
      }
    }
  }
  
  applyGrowth() {
    // Gradually increase mass from growthRemaining
    // Don't add segments manually - let updateVisibleSegments reveal them from trail
    if (this.growthRemaining > 0.05) {
      this.totalMass += 0.05;
      this.growthRemaining -= 0.05;
      // As totalMass increases, more trail segments become visible (smooth tail growth)
      this.updateVisibleSegments();
    }
  }
  
  getSegmentRadius() {
    // Dynamic scaling based on mass (baseline at mass=10, caps at 5x width)
    const maxScale = 5;
    const scaleFactor = Math.min(1 + (this.totalMass - 10) / 100, maxScale);
    return this.SEGMENT_RADIUS * scaleFactor;
  }

  // Get scale factor for all visual elements
  getScaleFactor() {
    const maxScale = 5;
    return Math.min(1 + (this.totalMass - 10) / 100, maxScale);
  }
  
  move(mouseDirectionX: number, mouseDirectionY: number, onDropFood?: (food: Food) => void) {
    // Calculate target angle from mouse direction
    const targetAngle = Math.atan2(mouseDirectionY, mouseDirectionX);
    
    // Smooth angle interpolation
    let angleDiff = targetAngle - this.currentAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    this.currentAngle += angleDiff * this.turnSpeed;
    
    // Keep angle in range
    if (this.currentAngle > Math.PI) this.currentAngle -= 2 * Math.PI;
    if (this.currentAngle < -Math.PI) this.currentAngle += 2 * Math.PI;
    
    // Handle boost mechanics
    this.applyBoost(onDropFood);
    
    // Move head
    const dx = Math.cos(this.currentAngle) * this.speed;
    const dy = Math.sin(this.currentAngle) * this.speed;
    
    this.head.x += dx;
    this.head.y += dy;
    
    // Update segments with smooth following system
    this.updateVisibleSegments();
    
    // Apply gradual growth
    this.applyGrowth();
  }
  
  applyBoost(onDropFood?: (food: Food) => void) {
    if (this.isBoosting && this.totalMass > this.MIN_MASS_TO_BOOST) {
      this.speed = this.baseSpeed * this.boostMultiplier;
      this.boostCooldown++;
      
      // Drop food more frequently for continuous trail effect
      if (this.boostCooldown % 10 === 0 && onDropFood) {
        // Find the second-to-last segment position for food drop
        let dropX = this.head.x;
        let dropY = this.head.y;
        
        if (this.visibleSegments.length >= 2) {
          // Use second-to-last segment position
          const secondToLast = this.visibleSegments[this.visibleSegments.length - 2];
          dropX = secondToLast.x;
          dropY = secondToLast.y;
        } else {
          // Fallback to behind the head if not enough segments
          dropX = this.head.x - Math.cos(this.currentAngle) * 25;
          dropY = this.head.y - Math.sin(this.currentAngle) * 25;
        }
        
        // Add slight randomness to avoid perfect stacking
        dropX += (Math.random() - 0.5) * 8;
        dropY += (Math.random() - 0.5) * 8;
        
        onDropFood({
          x: dropX,
          y: dropY,
          size: 3.5,
          color: '#f55400',
          mass: 0.25 // Each piece worth 0.25, dropped every 10 frames instead of 20
        });
        
        this.totalMass -= 0.25; // Reduce mass loss per drop to maintain same rate
        this.updateVisibleSegments();
      }
    } else {
      this.speed = this.baseSpeed;
      this.isBoosting = false;
    }
  }
  
  eatFood(food: Food) {
    const mass = food.mass || 1;
    this.growthRemaining += mass;
    return mass; // Return score increase
  }
  
  setBoost(boosting: boolean) {
    if (boosting && this.totalMass <= this.MIN_MASS_TO_BOOST) {
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
    // Snake constructor now creates 6 segments with 30 mass and proper spacing
    return newSnake;
  });
  const [foods, setFoods] = useState<Food[]>([]);
  const [botSnakes, setBotSnakes] = useState<BotSnake[]>([]);
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
  
  // Dynamic zoom level with more aggressive zoom-out
  const calculateZoom = (mass: number) => {
    const maxZoomOut = 0.2; // Zoom out further (was 0.3)
    const minZoomOutTriggerMass = 150; // Start zooming earlier (was 200)
    const maxZoomTriggerMass = 800; // Reach max zoom sooner (was 1000)
    
    if (mass <= minZoomOutTriggerMass) {
      return 1; // No zoom-out for small snakes
    }
    
    const factor = Math.min((mass - minZoomOutTriggerMass) / (maxZoomTriggerMass - minZoomOutTriggerMass), 1);
    return 1 - factor * (1 - maxZoomOut); // Smoothly goes from 1 → 0.2
  };
  
  const zoom = calculateZoom(snake.totalMass);
  
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
    img.src = '/backggorun.png';
    img.onload = () => {
      console.log('Background image loaded successfully');
      setBackgroundImage(img);
    };
    img.onerror = (e) => {
      console.error('Failed to load background image:', e);
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

  // Prevent browser zoom
  useEffect(() => {
    const preventZoom = (e: WheelEvent | KeyboardEvent) => {
      if ('ctrlKey' in e && e.ctrlKey) {
        e.preventDefault();
        return false;
      }
      if ('metaKey' in e && e.metaKey) {
        e.preventDefault();
        return false;
      }
    };

    const preventKeyboardZoom = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('wheel', preventZoom, { passive: false });
    document.addEventListener('keydown', preventKeyboardZoom, { passive: false });
    
    return () => {
      document.removeEventListener('wheel', preventZoom);
      document.removeEventListener('keydown', preventKeyboardZoom);
    };
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
      
      if (foodType < 0.05) { // 5% orange test food (40 mass)
        food = {
          x: x,
          y: y,
          size: 15,
          mass: 40,
          color: '#ff8800'
        };
      } else if (foodType < 0.15) { // 10% big food
        food = {
          x: x,
          y: y,
          size: 10,
          mass: 2,
          color: '#ff4444'
        };
      } else if (foodType < 0.45) { // 30% medium food
        food = {
          x: x,
          y: y,
          size: 6,
          mass: 1,
          color: '#44ff44'
        };
      } else { // 55% small food
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
    
    // Initialize bot snakes
    const initialBots: BotSnake[] = [];
    for (let i = 0; i < BOT_COUNT; i++) {
      initialBots.push(createBotSnake(`bot_${i}`));
    }
    setBotSnakes(initialBots);
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
      // Clear canvas completely every frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Move snake with smooth turning based on mouse direction
      snake.move(mouseDirection.x, mouseDirection.y, (droppedFood: Food) => {
        // Add dropped food from boosting to the food array
        setFoods(prevFoods => [...prevFoods, droppedFood]);
      });

      // Update bot snakes
      setBotSnakes(prevBots => {
        return prevBots.map(bot => updateBotSnake(bot, foods, snake, prevBots));
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

      // Check collision: Player head vs Bot bodies (exclude bot heads - last 10 segments)
      for (const bot of botSnakes) {
        const botBaseRadius = 8;
        const botScaleFactor = Math.min(1 + (bot.totalMass - 10) / 100, 5);
        const botRadius = botBaseRadius * botScaleFactor;
        
        // Only check against bot BODY segments (exclude last 10 to avoid head collision)
        // Make sure we have enough segments to exclude the head
        if (bot.visibleSegments.length <= 10) continue; // Skip bots that are too small
        
        const botBodySegments = bot.visibleSegments.slice(0, bot.visibleSegments.length - 10);
        
        for (const segment of botBodySegments) {
          const dx = updatedHead.x - segment.x;
          const dy = updatedHead.y - segment.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Use tighter collision detection with proper radius calculation
          const collisionRadius = (snake.getSegmentRadius() + botRadius) * 0.8; // Tighter collision
          
          if (dist < collisionRadius) {
            // Player head hit bot body - player dies
            console.log(`Player collision with bot body at distance: ${dist}, threshold: ${collisionRadius}`);
            const deathFoods = dropDeathFood(snake);
            setFoods(prevFoods => [...prevFoods, ...deathFoods]);
            setGameOver(true);
            return;
          }
        }
      }

      // Check self-collision: Player head vs Player body (exclude own head - last 15 segments for safety)
      if (snake.visibleSegments.length > 15) { // Only check self-collision if snake is long enough
        const playerBodySegments = snake.visibleSegments.slice(0, snake.visibleSegments.length - 15);
        
        for (const segment of playerBodySegments) {
          const dx = updatedHead.x - segment.x;
          const dy = updatedHead.y - segment.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Self-collision needs to be tighter to prevent false positives
          const selfCollisionRadius = snake.getSegmentRadius() * 1.2;
          
          if (dist < selfCollisionRadius) {
            // Player head hit own body - player dies
            console.log(`Player self-collision at distance: ${dist}, threshold: ${selfCollisionRadius}`);
            const deathFoods = dropDeathFood(snake);
            setFoods(prevFoods => [...prevFoods, ...deathFoods]);
            setGameOver(true);
            return;
          }
        }
      }

      // Check bot collisions: Bot heads vs other snake bodies only
      setBotSnakes(prevBots => {
        const newBots = [...prevBots];
        const botsToKill: number[] = [];
        
        for (let i = 0; i < newBots.length; i++) {
          if (botsToKill.includes(i)) continue;
          
          const bot = newBots[i];
          const botRadius = 8 * Math.min(1 + (bot.totalMass - 10) / 100, 5);
          
          // Bot head vs Player body (exclude player head - last 10 segments)
          const playerBodySegments = snake.visibleSegments.slice(0, Math.max(0, snake.visibleSegments.length - 10));
          for (const segment of playerBodySegments) {
            const dx = bot.head.x - segment.x;
            const dy = bot.head.y - segment.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < botRadius + snake.getSegmentRadius()) {
              // Bot head hit player body - bot dies
              botsToKill.push(i);
              break;
            }
          }
          
          if (botsToKill.includes(i)) continue;
          
          // Bot head vs Other bot bodies (exclude their heads - last 10 segments)
          for (let j = 0; j < newBots.length; j++) {
            if (i === j || botsToKill.includes(j)) continue;
            
            const otherBot = newBots[j];
            const otherBotRadius = 8 * Math.min(1 + (otherBot.totalMass - 10) / 100, 5);
            
            // Only check against other bot's BODY segments (exclude last 10)
            const otherBotBodySegments = otherBot.visibleSegments.slice(0, Math.max(0, otherBot.visibleSegments.length - 10));
            
            for (const segment of otherBotBodySegments) {
              const dx = bot.head.x - segment.x;
              const dy = bot.head.y - segment.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              
              if (dist < botRadius + otherBotRadius) {
                // Bot head hit other bot body - this bot dies
                botsToKill.push(i);
                break;
              }
            }
            if (botsToKill.includes(i)) break;
          }
          
          if (botsToKill.includes(i)) continue;
          
          // Bot head vs Own body (self-collision, exclude own head - last 10 segments)
          const ownBodySegments = bot.visibleSegments.slice(0, Math.max(0, bot.visibleSegments.length - 10));
          for (const segment of ownBodySegments) {
            const dx = bot.head.x - segment.x;
            const dy = bot.head.y - segment.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < botRadius * 1.5) {
              // Bot head hit own body - bot dies
              botsToKill.push(i);
              break;
            }
          }
        }
        
        // Create death food for killed bots
        botsToKill.forEach(index => {
          const deadBot = newBots[index];
          const deathFoods = dropDeathFood(deadBot);
          setFoods(prevFoods => [...prevFoods, ...deathFoods]);
        });
        
        // Remove dead bots and spawn new ones
        const survivingBots = newBots.filter((_, index) => !botsToKill.includes(index));
        
        // Spawn new bots to maintain BOT_COUNT
        while (survivingBots.length < BOT_COUNT) {
          survivingBots.push(createBotSnake(`bot_${Date.now()}_${Math.random()}`));
        }
        
        return survivingBots;
      });

      // Let bot snakes eat food
      setBotSnakes(prevBots => {
        return prevBots.map(bot => {
          setFoods(prevFoods => {
            const newFoods = [...prevFoods];
            
            for (let i = newFoods.length - 1; i >= 0; i--) {
              const food = newFoods[i];
              const dist = Math.sqrt((bot.head.x - food.x) ** 2 + (bot.head.y - food.y) ** 2);
              
              // Calculate bot's current radius for food collision (caps at 5x width)
              const botBaseRadius = 8;
              const maxScale = 5;
              const botScaleFactor = Math.min(1 + (bot.totalMass - 10) / 100, maxScale);
              const botRadius = botBaseRadius * botScaleFactor;
              
              if (dist < botRadius + food.size) {
                // Bot eats food
                bot.totalMass += food.mass || 1;
                
                // Remove eaten food and add new one
                newFoods.splice(i, 1);
                
                const foodType = Math.random();
                let newFood: Food;
                
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * (MAP_RADIUS - 100);
                const newX = MAP_CENTER_X + Math.cos(angle) * radius;
                const newY = MAP_CENTER_Y + Math.sin(angle) * radius;
                
                if (foodType < 0.05) {
                  newFood = { x: newX, y: newY, size: 15, mass: 40, color: '#ff8800' };
                } else if (foodType < 0.15) {
                  newFood = { x: newX, y: newY, size: 10, mass: 1.2, color: '#ff4444' };
                } else if (foodType < 0.45) {
                  newFood = { x: newX, y: newY, size: 6, mass: 0.4, color: '#44ff44' };
                } else {
                  newFood = { x: newX, y: newY, size: 4, mass: 0.2, color: '#4444ff' };
                }
                
                newFoods.push(newFood);
                break;
              }
            }
            
            return newFoods;
          });
          
          return bot;
        });
      });

      // Food gravitation toward snake head (50px radius, 2x faster)
      const suctionRadius = 50;
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
          
          if (dist < snake.getSegmentRadius() + food.size) {
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
            
            if (foodType < 0.05) { // 5% orange test food (40 mass)
              newFood = {
                x: newX,
                y: newY,
                size: 15,
                mass: 40,
                color: '#ff8800'
              };
            } else if (foodType < 0.15) { // 10% big food
              newFood = {
                x: newX,
                y: newY,
                size: 10,
                mass: 1.2, // Reduced from 3 to 1.2 (2.5x less)
                color: '#ff4444'
              };
            } else if (foodType < 0.45) { // 30% medium food
              newFood = {
                x: newX,
                y: newY,
                size: 6,
                mass: 0.4, // Reduced from 1 to 0.4 (2.5x less)
                color: '#44ff44'
              };
            } else { // 55% small food
              newFood = {
                x: newX,
                y: newY,
                size: 4,
                mass: 0.2, // Reduced from 0.5 to 0.2 (2.5x less)
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

      // Clear canvas with background image pattern or dark fallback
      if (backgroundImage) {
        // Create repeating pattern from background image
        const pattern = ctx.createPattern(backgroundImage, 'repeat');
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
        }
      } else {
        // Fallback to solid color if image not loaded
        ctx.fillStyle = '#15161b';
        ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
      }

      // Save context for camera transform
      ctx.save();

      // Apply zoom and camera following snake head
      ctx.translate(canvasSize.width / 2, canvasSize.height / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-snake.head.x, -snake.head.y);

      // Draw background image across the full map area if loaded
      if (backgroundImage) {
        const mapSize = MAP_RADIUS * 2.5;
        // Draw background image tiled across the entire game area
        const pattern = ctx.createPattern(backgroundImage, 'repeat');
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(-mapSize, -mapSize, mapSize * 2, mapSize * 2);
        }
      }
      
      // Draw green overlay only outside the play area (death barrier region)
      ctx.save();
      
      // Create a clipping path for the area outside the safe zone
      const mapSize = MAP_RADIUS * 2.5;
      ctx.beginPath();
      ctx.rect(-mapSize, -mapSize, mapSize * 2, mapSize * 2); // Full map area
      ctx.arc(MAP_CENTER_X, MAP_CENTER_Y, MAP_RADIUS, 0, Math.PI * 2, true); // Subtract safe zone (clockwise)
      ctx.clip();
      
      // Fill only the clipped area (outside the circle) with green overlay
      ctx.fillStyle = 'rgba(82, 164, 122, 0.4)'; // Semi-transparent green overlay
      ctx.fillRect(-mapSize, -mapSize, mapSize * 2, mapSize * 2);
      
      ctx.restore();

      // Draw thin death barrier line
      ctx.strokeStyle = '#53d392';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(MAP_CENTER_X, MAP_CENTER_Y, MAP_RADIUS, 0, Math.PI * 2);
      ctx.stroke();

      // Draw food as squares with gradient effect
      foods.forEach(food => {
        // Create linear gradient for square food
        const gradient = ctx.createLinearGradient(
          food.x - food.size, food.y - food.size,
          food.x + food.size, food.y + food.size
        );
        gradient.addColorStop(0, "#ffbaba"); // Light corner
        gradient.addColorStop(1, food.color); // Dark corner
        
        ctx.fillStyle = gradient;
        
        // Draw square food
        ctx.fillRect(
          food.x - food.size, 
          food.y - food.size, 
          food.size * 2, 
          food.size * 2
        );
        
        // Food glow effect
        ctx.shadowColor = food.color;
        ctx.shadowBlur = 10;
        ctx.fillRect(
          food.x - food.size, 
          food.y - food.size, 
          food.size * 2, 
          food.size * 2
        );
        ctx.shadowBlur = 0;
      });

      // Draw bot snakes first (behind player)
      botSnakes.forEach(bot => {
        // Bot dynamic scaling based on mass (caps at 5x width)
        const botBaseRadius = 8;
        const maxScale = 5;
        const botScaleFactor = Math.min(1 + (bot.totalMass - 10) / 100, maxScale);
        const botRadius = botBaseRadius * botScaleFactor;
        const botOutlineThickness = 2 * botScaleFactor;
        
        // Bot outline
        ctx.fillStyle = "white";
        for (let i = bot.visibleSegments.length - 1; i >= 0; i--) {
          const segment = bot.visibleSegments[i];
          ctx.globalAlpha = segment.opacity;
          ctx.beginPath();
          ctx.arc(segment.x, segment.y, botRadius + botOutlineThickness, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Bot body
        ctx.fillStyle = bot.color;
        for (let i = bot.visibleSegments.length - 1; i >= 0; i--) {
          const segment = bot.visibleSegments[i];
          ctx.globalAlpha = segment.opacity;
          ctx.beginPath();
          ctx.arc(segment.x, segment.y, botRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Draw bot eyes (similar to player)
        if (bot.visibleSegments.length > 0) {
          const botHead = bot.visibleSegments[0];
          const movementAngle = bot.currentAngle;
          const eyeDistance = 5 * botScaleFactor;
          const eyeSize = 3 * botScaleFactor;
          const pupilSize = 1.5 * botScaleFactor;
          
          // Eye positions perpendicular to movement direction
          const eye1X = botHead.x + Math.cos(movementAngle + Math.PI/2) * eyeDistance;
          const eye1Y = botHead.y + Math.sin(movementAngle + Math.PI/2) * eyeDistance;
          const eye2X = botHead.x + Math.cos(movementAngle - Math.PI/2) * eyeDistance;
          const eye2Y = botHead.y + Math.sin(movementAngle - Math.PI/2) * eyeDistance;
          
          // Draw rotated square eyes
          [
            { x: eye1X, y: eye1Y },
            { x: eye2X, y: eye2Y }
          ].forEach(eye => {
            ctx.save();
            ctx.translate(eye.x, eye.y);
            ctx.rotate(movementAngle);
            
            // White eye square
            ctx.fillStyle = "white";
            ctx.fillRect(-eyeSize, -eyeSize, eyeSize * 2, eyeSize * 2);
            
            // Black pupil square
            ctx.fillStyle = "black";
            ctx.fillRect(-pupilSize, -pupilSize, pupilSize * 2, pupilSize * 2);
            
            ctx.restore();
          });
        }
      });
      
      ctx.globalAlpha = 1.0;

      // First pass: Draw white outline behind ALL segments including head
      for (let i = snake.visibleSegments.length - 1; i >= 0; i--) {
        const segment = snake.visibleSegments[i];
        const segmentRadius = snake.getSegmentRadius();
        const scaleFactor = snake.getScaleFactor();
        
        ctx.globalAlpha = segment.opacity;
        
        // White outline circle (thickness scales with snake width)
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, segmentRadius + (2 * scaleFactor), 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Second pass: Draw actual segments on top (body segments only, excluding head)
      for (let i = snake.visibleSegments.length - 1; i > 0; i--) {
        const segment = snake.visibleSegments[i];
        const segmentRadius = snake.getSegmentRadius();
        
        ctx.globalAlpha = segment.opacity;
        
        // Solid orange color for body segments
        ctx.fillStyle = "#d55400";
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, segmentRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Third pass: Draw head on top
      if (snake.visibleSegments.length > 0) {
        const headSeg = snake.visibleSegments[0];
        const headRadius = snake.getSegmentRadius();
        
        ctx.globalAlpha = headSeg.opacity;
        
        // Same solid orange color as body
        ctx.fillStyle = "#d55400";
        ctx.beginPath();
        ctx.arc(headSeg.x, headSeg.y, headRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Reset global alpha
      ctx.globalAlpha = 1.0;

      // Draw eyes that track the cursor smoothly (after head is drawn)
      if (snake.visibleSegments.length > 0) {
        const snakeHead = snake.visibleSegments[0];
        const movementAngle = snake.currentAngle;
        // Dynamic eye scaling based on mass (same scale as segments)
        const scaleFactor = snake.getScaleFactor();
        const eyeDistance = 5 * scaleFactor; // Scale distance from center
        const eyeSize = 3 * scaleFactor; // Scale eye size
        const pupilSize = 1.5 * scaleFactor; // Scale pupil size
        
        // Calculate cursor direction using mouse direction vector
        const cursorAngle = Math.atan2(mouseDirection.y, mouseDirection.x);
        
        // Eye positions perpendicular to movement direction
        const eye1X = snakeHead.x + Math.cos(movementAngle + Math.PI/2) * eyeDistance;
        const eye1Y = snakeHead.y + Math.sin(movementAngle + Math.PI/2) * eyeDistance;
        const eye2X = snakeHead.x + Math.cos(movementAngle - Math.PI/2) * eyeDistance;
        const eye2Y = snakeHead.y + Math.sin(movementAngle - Math.PI/2) * eyeDistance;
        
        // Draw rotated square eyes
        ctx.save();
        
        // Draw first eye with rotation
        ctx.translate(eye1X, eye1Y);
        ctx.rotate(movementAngle);
        ctx.fillStyle = 'white';
        ctx.fillRect(-eyeSize, -eyeSize, eyeSize * 2, eyeSize * 2);
        
        // Draw first pupil (rotated relative to eye)
        const pupilOffset = 1.2;
        ctx.fillStyle = 'black';
        ctx.fillRect(
          (Math.cos(cursorAngle - movementAngle) * pupilOffset) - pupilSize,
          (Math.sin(cursorAngle - movementAngle) * pupilOffset) - pupilSize,
          pupilSize * 2, 
          pupilSize * 2
        );
        ctx.restore();
        
        // Draw second eye with rotation
        ctx.save();
        ctx.translate(eye2X, eye2Y);
        ctx.rotate(movementAngle);
        ctx.fillStyle = 'white';
        ctx.fillRect(-eyeSize, -eyeSize, eyeSize * 2, eyeSize * 2);
        
        // Draw second pupil (rotated relative to eye)
        ctx.fillStyle = 'black';
        ctx.fillRect(
          (Math.cos(cursorAngle - movementAngle) * pupilOffset) - pupilSize,
          (Math.sin(cursorAngle - movementAngle) * pupilOffset) - pupilSize,
          pupilSize * 2, 
          pupilSize * 2
        );
        ctx.restore();
      }

      // Restore context
      ctx.restore();

      // Draw UI (fixed position)
      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px Arial';
      ctx.fillText(`Score: ${score}`, 20, 40);
      ctx.fillText(`Segments: ${snake.visibleSegments.length}`, 20, 70);
      ctx.fillText(`Mass: ${Math.floor(snake.totalMass)}`, 20, 100);
      


      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [mouseDirection, snake, foods, gameOver, canvasSize, score]);

  const resetGame = () => {
    setGameOver(false);
    setScore(0);
    // Reset snake to initial state using new system
    snake.head = { x: MAP_CENTER_X, y: MAP_CENTER_Y };
    snake.currentAngle = 0;
    snake.segmentTrail = [{ x: MAP_CENTER_X, y: MAP_CENTER_Y }];
    snake.totalMass = snake.START_MASS;
    snake.growthRemaining = 0;
    snake.distanceBuffer = 0;
    snake.currentSegmentCount = snake.START_MASS; // Reset animated segment count
    snake.isBoosting = false;
    snake.boostCooldown = 0;
    snake.speed = snake.baseSpeed;
    snake.updateVisibleSegments();
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
          <div className="text-white text-sm">Segments: {snake.visibleSegments.length}</div>
          <div className="text-blue-400 text-xs">Total Mass: {snake.totalMass.toFixed(1)}</div>
          <div className="text-gray-400 text-xs">Min Mass: {snake.MIN_MASS_TO_BOOST} (boost threshold)</div>
          {isBoosting && (
            <div className="text-orange-400 text-xs font-bold animate-pulse">BOOST!</div>
          )}
          {snake.totalMass <= snake.MIN_MASS_TO_BOOST && (
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
            <div className="text-white text-lg mb-6">Final Segments: {snake.visibleSegments.length}</div>
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