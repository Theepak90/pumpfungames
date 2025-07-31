import { useRef, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { X, Volume2 } from 'lucide-react';
import dollarSignImageSrc from '@assets/$ (1)_1753992938537.png';

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
  type?: 'normal' | 'money'; // Food type
  value?: number; // Money value for money type
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
}

// Bot snake utility functions
function createBotSnake(id: string): BotSnake {
  // Spawn bot at random location within map
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * (MAP_RADIUS - 200);
  const x = MAP_CENTER_X + Math.cos(angle) * radius;
  const y = MAP_CENTER_Y + Math.sin(angle) * radius;
  
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'];
  
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
    targetFood: null
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
  
  // Calculate target angle based on AI behavior
  if (bot.targetFood) {
    bot.targetAngle = Math.atan2(bot.targetFood.y - bot.head.y, bot.targetFood.x - bot.head.x);
  } else {
    // Wander randomly if no food target
    bot.lastDirectionChange++;
    if (bot.lastDirectionChange > 60) {
      bot.targetAngle = Math.random() * Math.PI * 2;
      bot.lastDirectionChange = 0;
    }
  }
  
  // Avoid going too close to map edge
  const distFromCenter = Math.sqrt((bot.head.x - MAP_CENTER_X) ** 2 + (bot.head.y - MAP_CENTER_Y) ** 2);
  if (distFromCenter > MAP_RADIUS - 300) {
    bot.targetAngle = Math.atan2(MAP_CENTER_Y - bot.head.y, MAP_CENTER_X - bot.head.x);
  }
  
  // Smooth angle interpolation
  let angleDiff = bot.targetAngle - bot.currentAngle;
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  bot.currentAngle += angleDiff * 0.024; // 20% slower turning (0.03 * 0.8), maintaining slower than player
  
  // Move bot head
  const dx = Math.cos(bot.currentAngle) * bot.speed;
  const dy = Math.sin(bot.currentAngle) * bot.speed;
  bot.head.x += dx;
  bot.head.y += dy;
  
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
  partialGrowth: number; // For faster mass-to-segment conversion
  distanceBuffer: number;
  currentSegmentCount: number; // Smoothly animated segment count
  
  // Constants
  START_MASS: number;
  MASS_PER_SEGMENT: number;
  SEGMENT_SPACING: number;
  SEGMENT_RADIUS: number;
  MIN_MASS_TO_BOOST: number;
  
  // Money system
  money: number;
  
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
    this.partialGrowth = 0; // Initialize partialGrowth for faster mass conversion
    this.distanceBuffer = 0;
    this.currentSegmentCount = this.START_MASS; // Start with initial segment count
    
    // Initialize money
    this.money = 1.00;
    
    this.updateVisibleSegments();
  }
  
  updateVisibleSegments() {
    // Calculate target segment count based on mass
    const targetSegmentCount = Math.floor(this.totalMass / this.MASS_PER_SEGMENT);
    
    // Smoothly animate currentSegmentCount toward target
    const transitionSpeed = 0.08; // Slightly slower for more stability
    if (this.currentSegmentCount < targetSegmentCount) {
      this.currentSegmentCount += transitionSpeed;
    } else if (this.currentSegmentCount > targetSegmentCount) {
      this.currentSegmentCount -= transitionSpeed;
    }
    this.currentSegmentCount = Math.max(1, this.currentSegmentCount);
    
    // Use floor for solid segments, check if we need a fading segment
    const solidSegmentCount = Math.floor(this.currentSegmentCount);
    const fadeAmount = this.currentSegmentCount - solidSegmentCount;
    
    this.visibleSegments = [];
    let distanceSoFar = 0;
    let segmentIndex = 0;
    let totalSegmentsToPlace = Math.ceil(this.currentSegmentCount); // Include potential fading segment
    
    // Process all segments in one pass to avoid distance calculation issues
    for (let i = 1; i < this.segmentTrail.length && this.visibleSegments.length < totalSegmentsToPlace; i++) {
      const a = this.segmentTrail[i - 1];
      const b = this.segmentTrail[i];
      
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const segmentDist = Math.sqrt(dx * dx + dy * dy);
      
      // Check if we need to place segments in this trail section
      while (distanceSoFar + segmentDist >= segmentIndex * this.SEGMENT_SPACING && this.visibleSegments.length < totalSegmentsToPlace) {
        const targetDistance = segmentIndex * this.SEGMENT_SPACING;
        const overshoot = targetDistance - distanceSoFar;
        const t = segmentDist > 0 ? overshoot / segmentDist : 0;
        
        // Linear interpolation between trail points
        const x = a.x + dx * t;
        const y = a.y + dy * t;
        
        // Determine opacity - solid for most segments, fading for the last one
        let opacity = 1.0;
        if (segmentIndex >= solidSegmentCount) {
          // This is the fading segment - only add if opacity is significant
          opacity = fadeAmount;
          if (opacity < 0.15) { // Minimum threshold to prevent flickering
            break;
          }
        }
        
        this.visibleSegments.push({ x, y, opacity });
        segmentIndex++;
      }
      
      distanceSoFar += segmentDist;
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
    
    // Smooth angle interpolation with boosted turning
    let angleDiff = targetAngle - this.currentAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    // Increase turn speed while boosting to maintain same turn radius
    const baseTurnSpeed = this.turnSpeed;
    const boostTurnMultiplier = 2.0; // Turn 2x faster when boosting
    const currentTurnSpeed = this.isBoosting 
      ? baseTurnSpeed * boostTurnMultiplier 
      : baseTurnSpeed;
    
    this.currentAngle += angleDiff * currentTurnSpeed;
    
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
    
    // Add head position to trail every frame for smooth following
    this.segmentTrail.unshift({ x: this.head.x, y: this.head.y });

    // Remove excess trail length (keep enough to render full snake)
    const maxTrailLength = Math.floor((this.totalMass / this.MASS_PER_SEGMENT) * this.SEGMENT_SPACING * 2);
    if (this.segmentTrail.length > maxTrailLength) {
      this.segmentTrail.length = maxTrailLength;
    }

    // Sample segments at fixed spacing from the trail
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
    this.growthRemaining += mass * 0.5; // 1 mass = 0.5 segments
    return mass; // Return score increase
  }
  
  // Process growth at 10 mass per second rate
  processGrowth(deltaTime: number) {
    const growthRate = 10; // max 10 mass per second
    const maxGrowthThisFrame = growthRate * deltaTime;
    
    const growthThisFrame = Math.min(this.growthRemaining, maxGrowthThisFrame);
    this.partialGrowth += growthThisFrame;
    this.growthRemaining -= growthThisFrame;
    
    // Add segments when we have enough partial growth
    while (this.partialGrowth >= 1) {
      this.totalMass += 1;
      this.partialGrowth -= 1;
    }
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
  const [dollarSignImage, setDollarSignImage] = useState<HTMLImageElement | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [zoom, setZoom] = useState(2); // Start at 2× zoomed-inn
  const [lastFrameTime, setLastFrameTime] = useState(Date.now());
  
  // Zoom parameters
  const minZoom = 0.3; // Maximum zoom-out (0.3×)
  const zoomSmoothing = 0.05; // How smooth the zoom transition is
  
  // Game constants - fullscreen
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [gameIsVisible, setGameIsVisible] = useState(!document.hidden);

  // Function to drop food when snake dies (1 food per mass, in snake color)
  const dropDeathFood = (deathX: number, deathY: number, snakeMass: number) => {
    const foodCount = Math.floor(snakeMass); // 1 food per mass
    const newFoods: Food[] = [];
    const snakeColor = '#d55400'; // Snake's orange color
    
    // Get snake's visible segments to drop food along the body
    const segments = snake.visibleSegments;
    
    for (let i = 0; i < foodCount; i++) {
      let x, y;
      
      if (segments.length > 0) {
        // Drop food along the snake's body segments
        const segmentIndex = Math.floor((i / foodCount) * segments.length);
        const segment = segments[Math.min(segmentIndex, segments.length - 1)];
        
        // Add some randomness around each segment position
        const randomOffset = 8;
        x = segment.x + (Math.random() - 0.5) * randomOffset;
        y = segment.y + (Math.random() - 0.5) * randomOffset;
      } else {
        // Fallback to death location if no segments
        const angle = (i / foodCount) * 2 * Math.PI + Math.random() * 0.5;
        const radius = 20 + Math.random() * 30;
        x = deathX + Math.cos(angle) * radius;
        y = deathY + Math.sin(angle) * radius;
      }
      
      // Make sure food stays within map bounds
      const clampedX = Math.max(MAP_CENTER_X - MAP_RADIUS + 50, Math.min(MAP_CENTER_X + MAP_RADIUS - 50, x));
      const clampedY = Math.max(MAP_CENTER_Y - MAP_RADIUS + 50, Math.min(MAP_CENTER_Y + MAP_RADIUS - 50, y));
      
      newFoods.push({
        x: clampedX,
        y: clampedY,
        size: 7, // Size for death food
        mass: 1, // Each death food worth 1 mass
        color: snakeColor, // Same color as the snake
        type: 'normal'
      });
    }
    
    // Add the death food to the existing food array
    setFoods(prevFoods => [...prevFoods, ...newFoods]);
  };

  // Function to drop money crates when snake dies (20 crates worth $0.05 each)
  const dropMoneyCrates = () => {
    const moneyCrateCount = 20;
    const crateValue = 0.05;
    const segments = snake.visibleSegments;
    const segmentCount = segments.length;
    
    // Limit spread zone to first 40 segments or fewer
    const spreadLength = Math.min(segmentCount, 40);
    const newCrates: Food[] = [];
    
    for (let i = 0; i < moneyCrateCount; i++) {
      let x, y;
      
      if (segments.length > 0) {
        // Spread over the first 40 segments (or all if fewer)
        const segIndex = Math.floor((i / moneyCrateCount) * spreadLength);
        const segment = segments[segIndex];
        
        // Add randomness around segment position
        x = segment.x + (Math.random() - 0.5) * 10;
        y = segment.y + (Math.random() - 0.5) * 10;
      } else {
        // Fallback to snake head position with spread
        const angle = (i / moneyCrateCount) * Math.PI * 2;
        const radius = Math.random() * 40 + 20;
        x = snake.head.x + Math.cos(angle) * radius;
        y = snake.head.y + Math.sin(angle) * radius;
      }
      
      // Make sure crates stay within map bounds
      const clampedX = Math.max(MAP_CENTER_X - MAP_RADIUS + 50, Math.min(MAP_CENTER_X + MAP_RADIUS - 50, x));
      const clampedY = Math.max(MAP_CENTER_Y - MAP_RADIUS + 50, Math.min(MAP_CENTER_Y + MAP_RADIUS - 50, y));
      
      newCrates.push({
        x: clampedX,
        y: clampedY,
        size: 20, // 20x20 crate size
        mass: 0,
        color: '#00ff00', // Green color for money crates
        type: 'money',
        value: crateValue
      });
    }
    
    setFoods(prevFoods => [...prevFoods, ...newCrates]);
  };

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

  // Load dollar sign image for money squares
  useEffect(() => {
    const img = new Image();
    img.src = dollarSignImageSrc;
    img.onload = () => {
      console.log('Dollar sign image loaded successfully');
      setDollarSignImage(img);
    };
    img.onerror = (e) => {
      console.error('Failed to load dollar sign image:', e);
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
          color: '#ff8800',
          type: 'normal'
        };
      } else if (foodType < 0.15) { // 10% big food
        food = {
          x: x,
          y: y,
          size: 10,
          mass: 2,
          color: '#ff4444',
          type: 'normal'
        };
      } else if (foodType < 0.45) { // 30% medium food
        food = {
          x: x,
          y: y,
          size: 6,
          mass: 1,
          color: '#44ff44',
          type: 'normal'
        };
      } else { // 55% small food
        food = {
          x: x,
          y: y,
          size: 4,
          mass: 0.5,
          color: '#4444ff',
          type: 'normal'
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
    let movementInterval: number;
    let lastUpdate = Date.now();
    
    // Independent movement loop - runs at 60 FPS regardless of tab visibility
    movementInterval = window.setInterval(() => {
      if (gameOver) return;
      
      const now = Date.now();
      const deltaTime = Math.min((now - lastUpdate) / 1000, 0.033); // Cap at 33ms
      lastUpdate = now;
      
      // Time-based movement - works even when tab is inactive
      const dx = Math.cos(snake.currentAngle) * snake.speed * deltaTime * 60; // 60 FPS equivalent
      const dy = Math.sin(snake.currentAngle) * snake.speed * deltaTime * 60;
      
      snake.head.x += dx;
      snake.head.y += dy;
      
      // Add to trail for smooth movement
      snake.segmentTrail.unshift({ x: snake.head.x, y: snake.head.y });
      
      // Keep trail length reasonable
      const maxTrailLength = Math.floor((snake.totalMass / snake.MASS_PER_SEGMENT) * snake.SEGMENT_SPACING * 2);
      if (snake.segmentTrail.length > maxTrailLength) {
        snake.segmentTrail.length = maxTrailLength;
      }
      
      // Update visible segments
      snake.updateVisibleSegments();
      
      // Process growth at 10 mass per second rate
      snake.processGrowth(deltaTime);
      
    }, 1000 / 60); // 60 FPS movement loop
    
    const gameLoop = () => {
      // Calculate delta time for smooth growth processing
      const currentTime = Date.now();
      const deltaTime = Math.min((currentTime - lastFrameTime) / 1000, 0.033); // Cap at 33ms (30fps minimum)  
      setLastFrameTime(currentTime);
      
      // Only handle mouse-based turning and boost in the render loop
      // Smooth angle interpolation with dynamic turn speed
      const targetAngle = Math.atan2(mouseDirection.y, mouseDirection.x);
      let angleDiff = targetAngle - snake.currentAngle;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      
      // Dynamic turn speed - faster when boosting to maintain turn radius
      const baseTurnSpeed = snake.turnSpeed;
      const boostTurnMultiplier = 1.8; // Increase turning speed when boosting
      const currentTurnSpeed = snake.isBoosting ? baseTurnSpeed * boostTurnMultiplier : baseTurnSpeed;
      
      snake.currentAngle += angleDiff * currentTurnSpeed;
      
      // Keep angle in range
      if (snake.currentAngle > Math.PI) snake.currentAngle -= 2 * Math.PI;
      if (snake.currentAngle < -Math.PI) snake.currentAngle += 2 * Math.PI;
      
      // Handle boost mechanics (dropping food when boosting)
      snake.applyBoost((droppedFood: Food) => {
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
        // Drop food and money crates when snake dies
        dropDeathFood(updatedHead.x, updatedHead.y, snake.totalMass);
        dropMoneyCrates();
        snake.money = 0; // Reset snake's money on death
        setGameOver(true);
        return;
      }

      // Check collision between player snake and bot snakes
      for (const bot of botSnakes) {
        // Calculate bot's current radius based on mass (caps at 5x width)
        const botBaseRadius = 8;
        const maxScale = 5;
        const botScaleFactor = Math.min(1 + (bot.totalMass - 10) / 100, maxScale);
        const botRadius = botBaseRadius * botScaleFactor;
        
        for (const segment of bot.visibleSegments) {
          const dist = Math.sqrt((updatedHead.x - segment.x) ** 2 + (updatedHead.y - segment.y) ** 2);
          if (dist < snake.getSegmentRadius() + botRadius) {
            // Drop food and money crates when snake dies from collision
            dropDeathFood(updatedHead.x, updatedHead.y, snake.totalMass);
            dropMoneyCrates();
            snake.money = 0; // Reset snake's money on death
            setGameOver(true);
            return;
          }
        }
      }

      // Food collision detection
      const headRadius = snake.getSegmentRadius();
      setFoods(prevFoods => {
        return prevFoods.filter(food => {
          const foodDistance = Math.sqrt(
            (snake.head.x - food.x) ** 2 + (snake.head.y - food.y) ** 2
          );
          
          if (foodDistance < headRadius + food.size) {
            if (food.type === 'money') {
              // Money crate collected
              snake.money += food.value || 0;
            } else {
              // Regular food eaten - add mass for gradual growth
              snake.growthRemaining += food.mass || 1;
              setScore(prevScore => prevScore + (food.mass || 1));
            }
            return false; // Remove food
          }
          return true; // Keep food
        });
      });

      // Money crates are now handled as food items with type: 'money' in the food collision above

      // Bot collision detection (kill bots on contact)
      setBotSnakes(prevBots => {
        return prevBots.filter(bot => {
          // Check collision with bot head
          const headDistance = Math.sqrt(
            (snake.head.x - bot.head.x) ** 2 + (snake.head.y - bot.head.y) ** 2
          );
          
          if (headDistance < headRadius + 8) { // Bot collision
            // Kill bot and drop its food
            for (let i = 0; i < bot.visibleSegments.length; i++) {
              const segment = bot.visibleSegments[i];
              if (Math.random() < 0.3) { // 30% chance per segment
                const newFood: Food = {
                  x: segment.x + (Math.random() - 0.5) * 30,
                  y: segment.y + (Math.random() - 0.5) * 30,
                  mass: 1.5,
                  size: 7.5,
                  color: bot.color
                };
                setFoods(prevFoods => [...prevFoods, newFood]);
              }
            }
            
            // Award money for killing bot (minimum $0.50 or 5% of bot's mass)
            const moneyEarned = Math.max(0.50, bot.totalMass * 0.05);
            snake.money += moneyEarned;
            
            return false; // Remove bot
          }
          return true; // Keep bot
        });
      });
      for (const bot of botSnakes) {
        // Calculate bot's current radius based on mass (caps at 5x width)
        const botBaseRadius = 8;
        const maxScale = 5;
        const botScaleFactor = Math.min(1 + (bot.totalMass - 10) / 100, maxScale);
        const botRadius = botBaseRadius * botScaleFactor;
        
        for (const segment of bot.visibleSegments) {
          const dist = Math.sqrt((updatedHead.x - segment.x) ** 2 + (updatedHead.y - segment.y) ** 2);
          if (dist < snake.getSegmentRadius() + botRadius) {
            // Drop food and money crates when snake dies from collision
            dropDeathFood(updatedHead.x, updatedHead.y, snake.totalMass);
            dropMoneyCrates();
            snake.money = 0; // Reset snake's money on death
            setGameOver(true);
            return;
          }
        }
      }
      
      // Check if player snake kills any bot snakes
      for (let i = botSnakes.length - 1; i >= 0; i--) {
        const bot = botSnakes[i];
        const botBaseRadius = 8;
        const maxScale = 5;
        const botScaleFactor = Math.min(1 + (bot.totalMass - 10) / 100, maxScale);
        const botRadius = botBaseRadius * botScaleFactor;
        
        for (const segment of snake.visibleSegments) {
          const dist = Math.sqrt((segment.x - bot.head.x) ** 2 + (segment.y - bot.head.y) ** 2);
          if (dist < snake.getSegmentRadius() + botRadius) {
            // Player killed a bot - drop food and money squares
            dropDeathFood(bot.head.x, bot.head.y, bot.totalMass);
            
            // Drop money crates when bot dies (20 crates worth $0.05 each = $1.00 total)
            // Create temporary function call for bot death
            const originalSegments = snake.visibleSegments;
            snake.visibleSegments = bot.visibleSegments; // Temporarily use bot segments
            dropMoneyCrates();
            snake.visibleSegments = originalSegments; // Restore player segments
            
            // Remove the killed bot
            setBotSnakes(prevBots => prevBots.filter((_, index) => index !== i));
            
            // Spawn a new bot to replace the killed one
            setTimeout(() => {
              setBotSnakes(prevBots => [...prevBots, createBotSnake(`bot_${Date.now()}`)]);
            }, 3000); // 3 second delay before respawn
            
            break;
          }
        }
      }

      // Clear canvas with dark background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

      // Draw background pattern if available
      if (backgroundImage) {
        const pattern = ctx.createPattern(backgroundImage, 'repeat');
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
        }
      }

      // Set up camera variables that are used in rendering
      let cameraX = snake.head.x;
      let cameraY = snake.head.y;
      let currentZoom = Math.max(0.5, 1 - snake.visibleSegments.length * 0.005);

      // Draw food
      foods.forEach(food => {
        if (food.type === 'money') {
          // Draw money crate
          ctx.fillStyle = food.color;
          const wobble = Math.sin(Date.now() * 0.01) * 0.5;
          const crateSize = food.size + wobble;
          
          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(food.x - crateSize/2 + 2, food.y - crateSize/2 + 2, crateSize, crateSize);
          
          // Main crate
          ctx.fillStyle = food.color;
          ctx.fillRect(food.x - crateSize/2, food.y - crateSize/2, crateSize, crateSize);
          
          // Dollar sign overlay
          if (dollarSignImage) {
            ctx.drawImage(dollarSignImage, food.x - crateSize/2, food.y - crateSize/2, crateSize, crateSize);
          }
        } else {
          // Draw regular food with glow
          const glowRadius = food.size + 2;
          
          // Glow effect
          const gradient = ctx.createRadialGradient(food.x, food.y, 0, food.x, food.y, glowRadius);
          gradient.addColorStop(0, food.color);
          gradient.addColorStop(1, 'transparent');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(food.x, food.y, glowRadius, 0, 2 * Math.PI);
          ctx.fill();
          
          // Main food
          ctx.fillStyle = food.color;
          ctx.beginPath();
          ctx.arc(food.x, food.y, food.size, 0, 2 * Math.PI);
          ctx.fill();
        }
      });

      // Draw bot snakes
      botSnakes.forEach(bot => {
        // Draw bot segments with scaling
        bot.visibleSegments.forEach((segment, index) => {
          const isHead = index === 0;
          const botBaseRadius = 8;
          const maxScale = 5;
          const scaleFactor = Math.min(1 + (bot.totalMass - 10) / 100, maxScale);
          const radius = botBaseRadius * scaleFactor;
          
          // Apply glow effect for head
          if (isHead) {
            const glowRadius = radius + 3;
            const gradient = ctx.createRadialGradient(segment.x, segment.y, 0, segment.x, segment.y, glowRadius);
            gradient.addColorStop(0, bot.color);
            gradient.addColorStop(1, 'transparent');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(segment.x, segment.y, glowRadius, 0, 2 * Math.PI);
            ctx.fill();
          }
          
          // Main segment
          ctx.fillStyle = bot.color;
          ctx.beginPath();
          ctx.arc(segment.x, segment.y, radius, 0, 2 * Math.PI);
          ctx.fill();
        });
      });

      // Draw player snake with enhanced visual effects
      snake.visibleSegments.forEach((segment, index) => {
        const isHead = index === 0;
        const radius = snake.getSegmentRadius();
        
        // Apply shadow when not boosting
        if (!snake.isBoosting) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.beginPath();
          ctx.arc(segment.x + 3, segment.y + 3, radius, 0, 2 * Math.PI);
          ctx.fill();
        }
        
        // Apply boost glow effect
        if (snake.isBoosting) {
          const glowRadius = radius + 5;
          const gradient = ctx.createRadialGradient(segment.x, segment.y, 0, segment.x, segment.y, glowRadius);
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
          gradient.addColorStop(1, 'transparent');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(segment.x, segment.y, glowRadius, 0, 2 * Math.PI);
          ctx.fill();
        }
        
        // Main segment
        ctx.fillStyle = isHead ? '#00ff88' : '#0088ff';
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, radius, 0, 2 * Math.PI);
        ctx.fill();
      });

      // Draw eyes on snake head
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

      // Draw money balance above snake head
      if (snake.visibleSegments.length > 0) {
        const head = snake.visibleSegments[0];
        const scaleFactor = snake.getScaleFactor();
        const offsetY = -25 * scaleFactor; // Scale the offset distance
        const fontSize = Math.max(12, 16 * scaleFactor); // Scale font size with snake
        
        ctx.fillStyle = 'black'; // Outline
        ctx.font = `bold ${fontSize + 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(`$${snake.money.toFixed(2)}`, head.x, head.y + offsetY);
        
        ctx.fillStyle = '#00ff00'; // Green money text
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillText(`$${snake.money.toFixed(2)}`, head.x, head.y + offsetY);
      }

      // Restore context
      ctx.restore();

      // Draw UI (fixed position)
      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px Arial';
      ctx.fillText(`Score: ${score}`, 20, 40);
      ctx.fillText(`Segments: ${snake.visibleSegments.length}`, 20, 70);
      ctx.fillText(`Mass: ${Math.floor(snake.totalMass)}`, 20, 100);

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
                // Bot eats food (with new growth system: 1 mass = 0.5 segments)
                const mass = food.mass || 1;
                bot.totalMass += mass * 0.5;
                
                // Remove eaten food and add new one
                newFoods.splice(i, 1);
                
                const foodType = Math.random();
                let newFood: Food;
                
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * (MAP_RADIUS - 100);
                const newX = MAP_CENTER_X + Math.cos(angle) * radius;
                const newY = MAP_CENTER_Y + Math.sin(angle) * radius;
                
                if (foodType < 0.05) {
                  newFood = { x: newX, y: newY, size: 15, mass: 40, color: '#ff8800', type: 'normal' };
                } else if (foodType < 0.15) {
                  newFood = { x: newX, y: newY, size: 10, mass: 1.2, color: '#ff4444', type: 'normal' };
                } else if (foodType < 0.45) {
                  newFood = { x: newX, y: newY, size: 6, mass: 0.4, color: '#44ff44', type: 'normal' };
                } else {
                  newFood = { x: newX, y: newY, size: 4, mass: 0.2, color: '#4444ff', type: 'normal' };
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
          
          // Use appropriate collision detection based on food type
          const collisionRadius = food.type === 'money' ? 10 : food.size; // Money squares are 20x20px (10px radius)
          if (dist < snake.getSegmentRadius() + collisionRadius) {
            // Handle different food types
            if (food.type === 'money') {
              // Money pickup - add to snake's money balance
              snake.money += food.value || 0.05; // Default to $0.05 per crate
              newFoods.splice(i, 1);
              continue; // Don't spawn replacement food for money
            } else {
              // Regular food - grow snake
              scoreIncrease += snake.eatFood(food);
            }
            
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
                color: '#ff8800',
                type: 'normal'
              };
            } else if (foodType < 0.15) { // 10% big food
              newFood = {
                x: newX,
                y: newY,
                size: 10,
                mass: 1.2, // Reduced from 3 to 1.2 (2.5x less)
                color: '#ff4444',
                type: 'normal'
              };
            } else if (foodType < 0.45) { // 30% medium food
              newFood = {
                x: newX,
                y: newY,
                size: 6,
                mass: 0.4, // Reduced from 1 to 0.4 (2.5x less)
                color: '#44ff44',
                type: 'normal'
              };
            } else { // 55% small food
              newFood = {
                x: newX,
                y: newY,
                size: 4,
                mass: 0.2, // Reduced from 0.5 to 0.2 (2.5x less)
                color: '#4444ff',
                type: 'normal'
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

      // Clear canvas and render everything
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

      // Apply camera transform
      ctx.save();
      ctx.translate(canvasSize.width / 2, canvasSize.height / 2);
      ctx.scale(currentZoom, currentZoom);
      ctx.translate(-cameraX, -cameraY);

      // Draw food
      foods.forEach(food => {
        if (food.type === 'money') {
          // Draw money crate
          ctx.fillStyle = food.color;
          const wobble = Math.sin(Date.now() * 0.01) * 0.5;
          const crateSize = food.size + wobble;
          
          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(food.x - crateSize/2 + 2, food.y - crateSize/2 + 2, crateSize, crateSize);
          
          // Main crate
          ctx.fillStyle = food.color;
          ctx.fillRect(food.x - crateSize/2, food.y - crateSize/2, crateSize, crateSize);
          
          // Dollar sign overlay
          if (dollarSignImage) {
            ctx.drawImage(dollarSignImage, food.x - crateSize/2, food.y - crateSize/2, crateSize, crateSize);
          }
        } else {
          // Draw regular food with glow
          const glowRadius = food.size + 2;
          
          // Glow effect
          const gradient = ctx.createRadialGradient(food.x, food.y, 0, food.x, food.y, glowRadius);
          gradient.addColorStop(0, food.color);
          gradient.addColorStop(1, 'transparent');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(food.x, food.y, glowRadius, 0, 2 * Math.PI);
          ctx.fill();
          
          // Main food
          ctx.fillStyle = food.color;
          ctx.beginPath();
          ctx.arc(food.x, food.y, food.size, 0, 2 * Math.PI);
          ctx.fill();
        }
      });

      // Draw bot snakes
      botSnakes.forEach(bot => {
        bot.visibleSegments.forEach((segment, index) => {
          const isHead = index === 0;
          const botBaseRadius = 8;
          const maxScale = 5;
          const scaleFactor = Math.min(1 + (bot.totalMass - 10) / 100, maxScale);
          const radius = botBaseRadius * scaleFactor;
          
          // Apply glow effect for head
          if (isHead) {
            const glowRadius = radius + 3;
            const gradient = ctx.createRadialGradient(segment.x, segment.y, 0, segment.x, segment.y, glowRadius);
            gradient.addColorStop(0, bot.color);
            gradient.addColorStop(1, 'transparent');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(segment.x, segment.y, glowRadius, 0, 2 * Math.PI);
            ctx.fill();
          }
          
          // Main segment
          ctx.fillStyle = bot.color;
          ctx.beginPath();
          ctx.arc(segment.x, segment.y, radius, 0, 2 * Math.PI);
          ctx.fill();
        });
      });

      // Draw player snake
      snake.visibleSegments.forEach((segment, index) => {
        const isHead = index === 0;
        const radius = snake.getSegmentRadius();
        
        // Apply shadow when not boosting
        if (!snake.isBoosting) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.beginPath();
          ctx.arc(segment.x + 3, segment.y + 3, radius, 0, 2 * Math.PI);
          ctx.fill();
        }
        
        // Apply boost glow effect
        if (snake.isBoosting) {
          const glowRadius = radius + 5;
          const gradient = ctx.createRadialGradient(segment.x, segment.y, 0, segment.x, segment.y, glowRadius);
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
          gradient.addColorStop(1, 'transparent');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(segment.x, segment.y, glowRadius, 0, 2 * Math.PI);
          ctx.fill();
        }
        
        // Main segment
        ctx.fillStyle = isHead ? '#00ff88' : '#0088ff';
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, radius, 0, 2 * Math.PI);
        ctx.fill();
      });

      // Draw money balance above snake head
      if (snake.visibleSegments.length > 0) {
        const head = snake.visibleSegments[0];
        const scaleFactor = snake.getScaleFactor();
        const offsetY = -25 * scaleFactor;
        const fontSize = Math.max(12, 16 * scaleFactor);
        
        ctx.fillStyle = 'black'; // Outline
        ctx.font = `bold ${fontSize + 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(`$${snake.money.toFixed(2)}`, head.x, head.y + offsetY);
        
        ctx.fillStyle = '#00ff00'; // Green money text
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillText(`$${snake.money.toFixed(2)}`, head.x, head.y + offsetY);
      }

      // Restore context
      ctx.restore();

      // Continue with next frame
      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => {
      cancelAnimationFrame(animationId);
      clearInterval(movementInterval);
    };
  }, [gameOver, canvasSize, foods, botSnakes, score, backgroundImage, dollarSignImage, lastFrameTime, mouseDirection]);

  return (
    <div className="w-screen h-screen bg-gray-900 flex flex-col">
      {/* Exit Game Button */}
      <div className="absolute top-4 left-4 z-50">
        <Button
          onClick={() => navigate('/')}
          variant="destructive"
          size="sm"
          className="flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Exit Game
        </Button>
      </div>

      {/* Audio Toggle Button */}
      <div className="absolute top-4 right-4 z-50">
        <Button
          onClick={() => setAudioEnabled(!audioEnabled)}
          variant={audioEnabled ? "default" : "secondary"}
          size="sm"
          className="flex items-center gap-2"
        >
          <Volume2 className="w-4 h-4" />
          {audioEnabled ? 'ON' : 'OFF'}
        </Button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="bg-gray-900 cursor-none"
        tabIndex={0}
      />

      {/* Game UI Overlay */}
      <div className="absolute bottom-6 left-6 text-white text-lg">
        <div className="bg-black/50 rounded-lg p-4 space-y-2">
          <div>Segments: {snake?.visibleSegments.length || 0}</div>
          <div>Total Mass: {Math.floor(snake?.totalMass || 0)}</div>
          <div>Min Mass: 4 (boost threshold)</div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-white text-center">
        <div className="bg-black/50 rounded-lg p-4">
          <div>Hold Shift or Mouse to Boost</div>
          <div>Drops 3 orbs/s (0.5 mass each)</div>
          <div>Red=1 mass, Green=1 mass, Blue=0.5 mass</div>
        </div>
      </div>

      {/* Game Over Overlay */}
      {gameOver && (
        <div className="absolute inset-0 bg-black/75 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-8 text-center space-y-4">
            <h2 className="text-2xl font-bold text-red-600">Game Started!</h2>
            <p className="text-gray-700">Starting snake game with ${betAmount} bet.</p>
            <Button onClick={() => navigate('/')}>
              Return to Home
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
