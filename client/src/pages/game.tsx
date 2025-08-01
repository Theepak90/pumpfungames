import { useRef, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { X, Volume2 } from 'lucide-react';
import dollarSignImageSrc from '@assets/$ (1)_1753992938537.png';

// Game constants
const MAP_CENTER_X = 2000;
const MAP_CENTER_Y = 2000;
const MAP_RADIUS = 1800; // Circular map radius
const FOOD_COUNT = 300; // Doubled from 150
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
  spawnTime?: number; // Timestamp when money crate was created
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
  money: number; // Bot's money balance
}

// Utility function to generate random food colors
function getRandomFoodColor(): string {
  const colors = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', 
    '#ff9ff3', '#54a0ff', '#5f27cd', '#fd79a8', '#fdcb6e',
    '#6c5ce7', '#a29bfe', '#74b9ff', '#0984e3', '#00b894',
    '#00cec9', '#55a3ff', '#ff7675', '#e84393', '#a0e4cb',
    '#ffeaa7', '#fab1a0', '#e17055', '#81ecec', '#74b9ff'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
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
    targetFood: null,
    money: 1.00 + Math.random() * 2.00 // Start with $1-3 money
  };
}

function updateBotSnake(bot: BotSnake, foods: Food[], playerSnake: SmoothSnake, otherBots: BotSnake[]): BotSnake {
  // Enhanced AI Decision making with realistic behavior
  const SEGMENT_SPACING = 10;
  const SEGMENT_RADIUS = 10;
  const currentTime = Date.now();
  
  // Check for nearby threats (player snake body segments and other bots)
  let nearestThreat: { x: number, y: number, distance: number } | null = null;
  let threatDistance = Infinity;
  
  // Check player snake segments for collision avoidance (more aggressive avoidance)
  for (let i = 1; i < playerSnake.visibleSegments.length; i++) { // Skip head (index 0)
    const segment = playerSnake.visibleSegments[i];
    const dist = Math.sqrt((bot.head.x - segment.x) ** 2 + (bot.head.y - segment.y) ** 2);
    if (dist < 120 && dist < threatDistance) { // Increased danger zone to 120 pixels for more avoidance
      threatDistance = dist;
      nearestThreat = { x: segment.x, y: segment.y, distance: dist };
    }
  }
  
  // Also avoid player head more aggressively
  const playerHeadDist = Math.sqrt((bot.head.x - playerSnake.head.x) ** 2 + (bot.head.y - playerSnake.head.y) ** 2);
  if (playerHeadDist < 100 && playerHeadDist < threatDistance) {
    threatDistance = playerHeadDist;
    nearestThreat = { x: playerSnake.head.x, y: playerSnake.head.y, distance: playerHeadDist };
  }
  
  // Check other bot snakes for collision avoidance
  for (const otherBot of otherBots) {
    if (otherBot.id === bot.id) continue;
    for (const segment of otherBot.visibleSegments) {
      const dist = Math.sqrt((bot.head.x - segment.x) ** 2 + (bot.head.y - segment.y) ** 2);
      if (dist < 60 && dist < threatDistance) { // Smaller danger zone for other bots
        threatDistance = dist;
        nearestThreat = { x: segment.x, y: segment.y, distance: dist };
      }
    }
  }
  
  // Threat avoidance takes priority (more sensitive)
  if (nearestThreat && nearestThreat.distance < 80) { // Increased avoidance threshold
    // Calculate escape angle (away from threat)
    const threatAngle = Math.atan2(nearestThreat.y - bot.head.y, nearestThreat.x - bot.head.x);
    bot.targetAngle = threatAngle + Math.PI; // Opposite direction
    bot.lastDirectionChange = currentTime; // Reset direction change timer
  } else {
    // Find nearest food with preference for valuable food
    if (!bot.targetFood || Math.sqrt((bot.head.x - bot.targetFood.x) ** 2 + (bot.head.y - bot.targetFood.y) ** 2) > 200) {
      let bestFood: Food | null = null;
      let bestScore = -1;
      
      foods.forEach(food => {
        const dist = Math.sqrt((bot.head.x - food.x) ** 2 + (bot.head.y - food.y) ** 2);
        // Score based on food value and proximity (closer + more valuable = better)
        const foodValue = food.type === 'money' ? (food.value || 0) * 10 : (food.mass || 1);
        const score = foodValue / (dist + 1); // +1 to avoid division by zero
        
        if (score > bestScore && dist < 300) { // Only consider food within reasonable range
          bestScore = score;
          bestFood = food;
        }
      });
      
      bot.targetFood = bestFood;
    }
    
    // Movement toward food or exploration
    if (bot.targetFood) {
      const dx = bot.targetFood.x - bot.head.x;
      const dy = bot.targetFood.y - bot.head.y;
      bot.targetAngle = Math.atan2(dy, dx);
    } else {
      // More realistic exploration - change direction periodically
      if (currentTime - bot.lastDirectionChange > 1500 + Math.random() * 2000) {
        // Add some randomness but bias toward center if near edges
        const distFromCenter = Math.sqrt((bot.head.x - MAP_CENTER_X) ** 2 + (bot.head.y - MAP_CENTER_Y) ** 2);
        if (distFromCenter > MAP_RADIUS * 0.7) {
          // Bias toward center when near edges
          const angleToCenter = Math.atan2(MAP_CENTER_Y - bot.head.y, MAP_CENTER_X - bot.head.x);
          bot.targetAngle = angleToCenter + (Math.random() - 0.5) * Math.PI * 0.5; // ±45 degrees from center
        } else {
          // Random exploration in center area
          bot.targetAngle = Math.random() * Math.PI * 2;
        }
        bot.lastDirectionChange = currentTime;
      }
    }
  }
  
  // Smooth angle interpolation with more realistic turning
  let angleDiff = bot.targetAngle - bot.currentAngle;
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  
  // Variable turn speed based on urgency
  const urgency = nearestThreat ? Math.max(0.1, 1 - (nearestThreat.distance / 100)) : 0.3;
  const turnSpeed = 0.02 + (urgency * 0.08); // Faster turning when in danger
  
  bot.currentAngle += angleDiff * turnSpeed;
  
  // Keep angle in range
  if (bot.currentAngle > Math.PI) bot.currentAngle -= 2 * Math.PI;
  if (bot.currentAngle < -Math.PI) bot.currentAngle += 2 * Math.PI;
  
  // Variable speed based on situation
  let currentSpeed = bot.speed;
  if (nearestThreat && nearestThreat.distance < 40) {
    currentSpeed *= 1.3; // Speed up when in immediate danger
  } else if (bot.targetFood) {
    const distToFood = Math.sqrt((bot.head.x - bot.targetFood.x) ** 2 + (bot.head.y - bot.targetFood.y) ** 2);
    if (distToFood > 150) {
      currentSpeed *= 1.1; // Speed up when far from food
    }
  }
  
  // Move bot
  const dx = Math.cos(bot.currentAngle) * currentSpeed;
  const dy = Math.sin(bot.currentAngle) * currentSpeed;
  
  bot.head.x += dx;
  bot.head.y += dy;
  
  // Keep bot within circular map bounds with smoother boundary handling
  const distFromCenter = Math.sqrt((bot.head.x - MAP_CENTER_X) ** 2 + (bot.head.y - MAP_CENTER_Y) ** 2);
  if (distFromCenter > MAP_RADIUS - 100) {
    // Gradually turn toward center as approaching boundary
    const angleToCenter = Math.atan2(MAP_CENTER_Y - bot.head.y, MAP_CENTER_X - bot.head.x);
    const boundaryUrgency = (distFromCenter - (MAP_RADIUS - 100)) / 100;
    bot.targetAngle = bot.currentAngle + angleDiff * (1 - boundaryUrgency) + angleToCenter * boundaryUrgency;
  }
  
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
        // Visual effect: Make the last segment move into the second-to-last segment
        if (this.visibleSegments.length >= 2) {
          const lastSegment = this.visibleSegments[this.visibleSegments.length - 1];
          const secondToLastSegment = this.visibleSegments[this.visibleSegments.length - 2];
          
          // Animate the last segment moving into the second-to-last position
          const dx = secondToLastSegment.x - lastSegment.x;
          const dy = secondToLastSegment.y - lastSegment.y;
          const moveSpeed = 0.3; // How fast the segment moves (0-1)
          
          lastSegment.x += dx * moveSpeed;
          lastSegment.y += dy * moveSpeed;
          
          // Make the last segment fade out as it moves
          lastSegment.opacity = Math.max(0.2, lastSegment.opacity - 0.05);
        }
        
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
          mass: 0.5 // Worth 0.5 mass so when eaten (0.5 * 0.5 = 0.25) it equals the 0.25 mass lost
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
  
  // Get eye positions for collision detection
  getEyePositions() {
    if (this.visibleSegments.length === 0) return [];
    
    const snakeHead = this.visibleSegments[0];
    const scaleFactor = this.getScaleFactor();
    const eyeDistance = 5 * scaleFactor; // Same as in drawing code
    const eyeSize = 3 * scaleFactor; // Same as in drawing code
    
    // Eye positions perpendicular to movement direction
    const eye1X = snakeHead.x + Math.cos(this.currentAngle + Math.PI/2) * eyeDistance;
    const eye1Y = snakeHead.y + Math.sin(this.currentAngle + Math.PI/2) * eyeDistance;
    const eye2X = snakeHead.x + Math.cos(this.currentAngle - Math.PI/2) * eyeDistance;
    const eye2Y = snakeHead.y + Math.sin(this.currentAngle - Math.PI/2) * eyeDistance;
    
    return [
      { x: eye1X, y: eye1Y, size: eyeSize },
      { x: eye2X, y: eye2Y, size: eyeSize }
    ];
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
  const [zoom, setZoom] = useState(2); // Start at 2× zoomed-in
  const [lastFrameTime, setLastFrameTime] = useState(Date.now());
  
  // Zoom parameters
  const minZoom = 0.3; // Maximum zoom-out (0.3×)
  const zoomSmoothing = 0.05; // How smooth the zoom transition is
  
  // Game constants - fullscreen
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [gameIsVisible, setGameIsVisible] = useState(!document.hidden);
  const [hiddenAt, setHiddenAt] = useState<number | null>(null);

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

  // Function to drop money crates when snake dies (spread along entire snake body)
  const dropMoneyCrates = () => {
    const segments = snake.visibleSegments;
    const segmentCount = segments.length;
    const currentTime = Date.now();
    
    // Each crate is worth 1 mass and money is divided evenly among segments
    const totalMoney = snake.money;
    const moneyPerCrate = segmentCount > 0 ? totalMoney / segmentCount : 0;
    const newCrates: Food[] = [];
    
    // Create one money crate per segment
    for (let i = 0; i < segmentCount; i++) {
      let x, y;
      
      if (segments.length > 0) {
        // Place crate at each segment position
        const segment = segments[i];
        
        // Add randomness around segment position
        x = segment.x + (Math.random() - 0.5) * 15;
        y = segment.y + (Math.random() - 0.5) * 15;
      } else {
        // Fallback to snake head position with spread
        const angle = (i / segmentCount) * Math.PI * 2;
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
        mass: 1, // Each crate worth 1 mass
        color: '#00ff00', // Green color for money crates
        type: 'money',
        value: moneyPerCrate, // Money divided evenly among all segments
        spawnTime: currentTime
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
      
      if (foodType < 0.05) { // 5% big orange test food
        food = {
          x: x,
          y: y,
          size: 20,
          mass: 25, // Big test food gives 25 mass
          color: '#ff8c00', // Orange color
          type: 'normal'
        };
      } else if (foodType < 0.15) { // 10% big food (reduced from 10% to make room for test food)
        food = {
          x: x,
          y: y,
          size: 10,
          mass: 0.8, // Was 0.4, now doubled to 0.8
          color: getRandomFoodColor(),
          type: 'normal'
        };
      } else if (foodType < 0.50) { // 35% medium food
        food = {
          x: x,
          y: y,
          size: 6,
          mass: 0.4, // Was 0.2, now doubled to 0.4
          color: getRandomFoodColor(),
          type: 'normal'
        };
      } else { // 50% small food
        food = {
          x: x,
          y: y,
          size: 4,
          mass: 0.2, // Was 0.1, now doubled to 0.2
          color: getRandomFoodColor(),
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
    
    // Apply snake catch-up movement when tab becomes visible again
    const applySnakeCatchUp = (deltaSeconds: number) => {
      if (gameOver) return;
      
      const speed = snake.isBoosting ? (snake.baseSpeed * snake.boostMultiplier) : snake.baseSpeed;
      const distance = speed * deltaSeconds;
      
      // Move snake forward based on time that passed while tab was hidden
      snake.head.x += Math.cos(snake.currentAngle) * distance;
      snake.head.y += Math.sin(snake.currentAngle) * distance;
      
      // Add trail points for the movement that happened while away
      const numTrailPoints = Math.floor(deltaSeconds * 60); // Approximate trail points
      for (let i = 0; i < numTrailPoints; i++) {
        const progress = i / numTrailPoints;
        const x = snake.head.x - Math.cos(snake.currentAngle) * distance * (1 - progress);
        const y = snake.head.y - Math.sin(snake.currentAngle) * distance * (1 - progress);
        snake.segmentTrail.unshift({ x, y });
      }
      
      // Update visible segments after catch-up movement
      snake.updateVisibleSegments();
    };
    
    // Track when tab becomes hidden/visible for catch-up movement (real Slither.io method)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setHiddenAt(performance.now());
        console.log('Tab visibility changed:', 'hidden');
      } else {
        if (hiddenAt !== null) {
          const now = performance.now();
          const delta = (now - hiddenAt) / 1000; // seconds tab was hidden
          applySnakeCatchUp(delta);
          setHiddenAt(null);
          console.log('Tab visibility changed:', 'visible');
        }
      }
      setGameIsVisible(!document.hidden);
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    const gameLoop = () => {
      // Calculate delta time for smooth growth processing
      const currentTime = Date.now();
      const deltaTime = Math.min((currentTime - lastFrameTime) / 1000, 0.033); // Cap at 33ms (30fps minimum)
      setLastFrameTime(currentTime);
      
      // Process growth at 10 mass per second rate
      snake.processGrowth(deltaTime);
      
      // Move snake normally - this ensures visibility and game mechanics work
      snake.move(mouseDirection.x, mouseDirection.y, (droppedFood: Food) => {
        // Add dropped food from boosting to the food array
        setFoods(prevFoods => [...prevFoods, droppedFood]);
      });

      // Update bot snakes
      setBotSnakes(prevBots => {
        return prevBots.map(bot => updateBotSnake(bot, foods, snake, prevBots));
      });

      // Remove expired money crates (fade out over 10 seconds)
      const MONEY_CRATE_LIFETIME = 10000; // 10 seconds in milliseconds
      setFoods(prevFoods => {
        return prevFoods.filter(food => {
          if (food.type === 'money' && food.spawnTime) {
            const age = currentTime - food.spawnTime;
            return age < MONEY_CRATE_LIFETIME;
          }
          return true; // Keep all non-money food
        });
      });

      // Check circular map boundaries (death barrier) - using eye positions
      const eyePositions = snake.getEyePositions();
      let hitBoundary = false;
      
      for (const eye of eyePositions) {
        const distanceFromCenter = Math.sqrt(
          (eye.x - MAP_CENTER_X) ** 2 + (eye.y - MAP_CENTER_Y) ** 2
        );
        if (distanceFromCenter > MAP_RADIUS) {
          hitBoundary = true;
          break;
        }
      }
      
      if (hitBoundary) {
        // Drop food and money crates when snake dies
        dropDeathFood(snake.head.x, snake.head.y, snake.totalMass);
        dropMoneyCrates();
        snake.money = 0; // Reset snake's money on death
        setGameOver(true);
        return;
      }

      // Check collision between player snake eyes and bot snakes
      const playerEyePositions = snake.getEyePositions();
      let hitBot = false;
      
      for (const bot of botSnakes) {
        // Calculate bot's current radius based on mass (caps at 5x width)
        const botBaseRadius = 8;
        const maxScale = 5;
        const botScaleFactor = Math.min(1 + (bot.totalMass - 10) / 100, maxScale);
        const botRadius = botBaseRadius * botScaleFactor;
        
        for (const segment of bot.visibleSegments) {
          // Check each eye against bot segments
          for (const eye of playerEyePositions) {
            const dist = Math.sqrt((eye.x - segment.x) ** 2 + (eye.y - segment.y) ** 2);
            if (dist < eye.size + botRadius) {
              hitBot = true;
              break;
            }
          }
          if (hitBot) break;
        }
        if (hitBot) break;
      }
      
      if (hitBot) {
        // Drop food and money crates when snake dies from collision
        dropDeathFood(snake.head.x, snake.head.y, snake.totalMass);
        dropMoneyCrates();
        snake.money = 0; // Reset snake's money on death
        setGameOver(true);
        return;
      }

      // Check for head-on collisions between player and bot snakes
      for (let i = botSnakes.length - 1; i >= 0; i--) {
        const bot = botSnakes[i];
        const playerEyePositions = snake.getEyePositions();
        
        // Calculate bot's current radius based on mass
        const botBaseRadius = 8;
        const maxScale = 5;
        const botScaleFactor = Math.min(1 + (bot.totalMass - 10) / 100, maxScale);
        const botRadius = botBaseRadius * botScaleFactor;
        
        // Check if player's eyes collide with bot's head (head-on collision)
        let headOnCollision = false;
        for (const eye of playerEyePositions) {
          const dist = Math.sqrt((eye.x - bot.head.x) ** 2 + (eye.y - bot.head.y) ** 2);
          if (dist < eye.size + botRadius) {
            headOnCollision = true;
            break;
          }
        }
        
        if (headOnCollision) {
          // Both snakes die in head-on collision
          // Player snake dies
          dropDeathFood(snake.head.x, snake.head.y, snake.totalMass);
          dropMoneyCrates();
          snake.money = 0;
          
          // Bot snake also dies
          dropDeathFood(bot.head.x, bot.head.y, bot.totalMass);
          
          // Drop money crates for bot death too
          const originalSegments = snake.visibleSegments;
          const originalMoney = snake.money;
          snake.visibleSegments = bot.visibleSegments;
          snake.money = bot.money; // Use bot's money value
          dropMoneyCrates();
          snake.visibleSegments = originalSegments;
          snake.money = originalMoney; // Restore player money
          
          // Remove the bot
          setBotSnakes(prevBots => prevBots.filter((_, index) => index !== i));
          
          // Spawn a new bot to replace the killed one
          setTimeout(() => {
            setBotSnakes(prevBots => [...prevBots, createBotSnake(`bot_${Date.now()}`)]);
          }, 3000);
          
          setGameOver(true);
          return;
        }
      }
      
      // Check if player snake kills any bot snakes (excluding head segment)
      for (let i = botSnakes.length - 1; i >= 0; i--) {
        const bot = botSnakes[i];
        const botBaseRadius = 8;
        const maxScale = 5;
        const botScaleFactor = Math.min(1 + (bot.totalMass - 10) / 100, maxScale);
        const botRadius = botBaseRadius * botScaleFactor;
        
        // Check collision with snake body segments (skip first segment/head at index 0)
        for (let j = 1; j < snake.visibleSegments.length; j++) {
          const segment = snake.visibleSegments[j];
          const dist = Math.sqrt((segment.x - bot.head.x) ** 2 + (segment.y - bot.head.y) ** 2);
          if (dist < snake.getSegmentRadius() + botRadius) {
            // Player killed a bot - drop food and money squares
            dropDeathFood(bot.head.x, bot.head.y, bot.totalMass);
            
            // Drop money crates when bot dies - use bot's actual money value
            // Create temporary function call for bot death
            const originalSegments = snake.visibleSegments;
            const originalMoney = snake.money;
            snake.visibleSegments = bot.visibleSegments; // Temporarily use bot segments
            snake.money = bot.money; // Use bot's money value
            dropMoneyCrates();
            snake.visibleSegments = originalSegments; // Restore player segments
            snake.money = originalMoney; // Restore player money
            
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
                
                if (foodType < 0.05) { // 5% big orange test food
                  newFood = { x: newX, y: newY, size: 20, mass: 25, color: '#ff8c00', type: 'normal' }; // Big orange test food
                } else if (foodType < 0.15) { // 10% big food
                  newFood = { x: newX, y: newY, size: 10, mass: 0.48, color: getRandomFoodColor(), type: 'normal' }; // Was 0.24, now doubled to 0.48
                } else if (foodType < 0.50) { // 35% medium food
                  newFood = { x: newX, y: newY, size: 6, mass: 0.16, color: getRandomFoodColor(), type: 'normal' }; // Was 0.08, now doubled to 0.16
                } else { // 50% small food
                  newFood = { x: newX, y: newY, size: 4, mass: 0.08, color: getRandomFoodColor(), type: 'normal' }; // Was 0.04, now doubled to 0.08
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
          const dx = snake.head.x - food.x;
          const dy = snake.head.y - food.y;
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
          const dist = Math.sqrt((snake.head.x - food.x) ** 2 + (snake.head.y - food.y) ** 2);
          
          // Use appropriate collision detection based on food type
          const collisionRadius = food.type === 'money' ? 10 : food.size; // Money squares are 20x20px (10px radius)
          if (dist < snake.getSegmentRadius() + collisionRadius) {
            // Handle different food types
            if (food.type === 'money') {
              // Money pickup - add to snake's money balance and mass
              snake.money += food.value || 0; // Add money value
              snake.totalMass += food.mass || 1; // Add mass (each crate worth 1 mass)
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
            
            if (foodType < 0.05) { // 5% big orange test food
              newFood = {
                x: newX,
                y: newY,
                size: 20,
                mass: 25, // Big test food gives 25 mass
                color: '#ff8c00', // Orange color
                type: 'normal'
              };
            } else if (foodType < 0.15) { // 10% big food
              newFood = {
                x: newX,
                y: newY,
                size: 10,
                mass: 0.48, // Was 0.24, now doubled to 0.48
                color: getRandomFoodColor(),
                type: 'normal'
              };
            } else if (foodType < 0.50) { // 35% medium food
              newFood = {
                x: newX,
                y: newY,
                size: 6,
                mass: 0.16, // Was 0.08, now doubled to 0.16
                color: getRandomFoodColor(),
                type: 'normal'
              };
            } else { // 50% small food
              newFood = {
                x: newX,
                y: newY,
                size: 4,
                mass: 0.08, // Was 0.04, now doubled to 0.08
                color: getRandomFoodColor(),
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

      // Calculate target zoom based on snake segments (capped at 130 segments)
      const segmentCount = snake.visibleSegments.length;
      const maxSegmentZoom = 130;
      const cappedSegmentCount = Math.min(segmentCount, maxSegmentZoom);
      const zoomSteps = Math.floor(cappedSegmentCount / 5);
      const targetZoom = Math.max(minZoom, 2.0 - zoomSteps * 0.03);
      
      // Smoothly interpolate toward target zoom
      setZoom(prevZoom => prevZoom + (targetZoom - prevZoom) * zoomSmoothing);

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

      // Draw food items
      foods.forEach((food, index) => {
        if (food.type === 'money') {
          // Calculate fade effect for money crates (fade over last 5 seconds of 10 second lifetime)
          const currentTime = Date.now();
          const MONEY_CRATE_LIFETIME = 10000; // 10 seconds
          const FADE_DURATION = 5000; // Fade over last 5 seconds
          let alpha = 1.0;
          
          if (food.spawnTime) {
            const age = currentTime - food.spawnTime;
            const fadeStartTime = MONEY_CRATE_LIFETIME - FADE_DURATION;
            
            if (age > fadeStartTime) {
              const fadeProgress = (age - fadeStartTime) / FADE_DURATION;
              alpha = Math.max(0, 1 - fadeProgress);
            }
          }
          
          // Draw money crates with dollar sign image, shadow, wobble, and fade
          const time = Date.now() * 0.003; // Time for animation
          const wobbleX = Math.sin(time + index * 0.5) * 2; // Wobble offset X
          const wobbleY = Math.cos(time * 1.2 + index * 0.7) * 1.5; // Wobble offset Y
          
          const drawX = food.x + wobbleX;
          const drawY = food.y + wobbleY;
          
          // Apply alpha for fade effect
          ctx.globalAlpha = alpha;
          
          // Draw shadow first
          ctx.shadowColor = `rgba(0, 0, 0, ${0.3 * alpha})`;
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 3;
          ctx.shadowOffsetY = 3;
          ctx.fillStyle = `rgba(0, 0, 0, ${0.2 * alpha})`;
          ctx.fillRect(drawX - 10 + 2, drawY - 10 + 2, 20, 20);
          
          // Reset shadow for main square
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          // Draw green background square (20x20px)
          ctx.fillStyle = food.color;
          ctx.fillRect(drawX - 10, drawY - 10, 20, 20);
          
          // Draw dollar sign image if loaded (20x20px)
          if (dollarSignImage && dollarSignImage.complete) {
            ctx.drawImage(
              dollarSignImage,
              drawX - 10,
              drawY - 10,
              20,
              20
            );
          }
          
          // Reset alpha for other elements
          ctx.globalAlpha = 1.0;
        } else {
          // Draw regular food as circles with glow effect
          ctx.shadowColor = food.color;
          ctx.shadowBlur = 15;
          ctx.fillStyle = food.color;
          ctx.beginPath();
          ctx.arc(food.x, food.y, food.size, 0, Math.PI * 2);
          ctx.fill();
          
          // Draw the solid circle on top (no shadow)
          ctx.shadowBlur = 0;
          ctx.fillStyle = food.color;
          ctx.beginPath();
          ctx.arc(food.x, food.y, food.size, 0, Math.PI * 2);
          ctx.fill();
        }
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
        
        // Draw bot eyes using player's eye system (perpendicular to movement direction)
        if (bot.visibleSegments.length > 0) {
          const head = bot.visibleSegments[0];
          ctx.globalAlpha = 1.0;
          
          // Calculate eye positions like player - perpendicular to movement direction
          const eyeDistance = 5 * botScaleFactor; // Scale with bot size
          const eyeSize = 3 * botScaleFactor; // Scale with bot size
          
          // Eye positions perpendicular to movement direction (like player)
          const eye1X = head.x + Math.cos(bot.currentAngle + Math.PI/2) * eyeDistance;
          const eye1Y = head.y + Math.sin(bot.currentAngle + Math.PI/2) * eyeDistance;
          const eye2X = head.x + Math.cos(bot.currentAngle - Math.PI/2) * eyeDistance;
          const eye2Y = head.y + Math.sin(bot.currentAngle - Math.PI/2) * eyeDistance;
          
          // Draw square eyes (white background, black centers)
          ctx.fillStyle = 'white';
          
          // Eye 1
          ctx.fillRect(eye1X - eyeSize, eye1Y - eyeSize, eyeSize * 2, eyeSize * 2);
          
          // Eye 2  
          ctx.fillRect(eye2X - eyeSize, eye2Y - eyeSize, eyeSize * 2, eyeSize * 2);
          
          // Black eye centers (pupils)
          ctx.fillStyle = 'black';
          const pupilSize = eyeSize * 0.6;
          
          // Pupil 1
          ctx.fillRect(eye1X - pupilSize, eye1Y - pupilSize, pupilSize * 2, pupilSize * 2);
          
          // Pupil 2
          ctx.fillRect(eye2X - pupilSize, eye2Y - pupilSize, pupilSize * 2, pupilSize * 2);
        }
        
        // Draw money balance above bot head
        if (bot.visibleSegments.length > 0) {
          const head = bot.visibleSegments[0];
          const moneyText = `$${bot.money.toFixed(2)}`;
          
          // Calculate text position above head
          const textY = head.y - botRadius - 25; // Position above the bot
          
          // Set text style
          ctx.font = `${Math.max(12, 8 * botScaleFactor)}px Arial`; // Scale with bot size
          ctx.textAlign = 'center';
          ctx.fillStyle = 'white';
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 2;
          
          // Draw text with outline for visibility
          ctx.strokeText(moneyText, head.x, textY);
          ctx.fillText(moneyText, head.x, textY);
        }
      });
      
      ctx.globalAlpha = 1.0;

      // Draw single glowing outline behind the whole snake when boosting
      if (snake.isBoosting && snake.visibleSegments.length > 0) {
        ctx.save();
        ctx.beginPath();
        
        const segmentRadius = snake.getSegmentRadius();
        const scaleFactor = snake.getScaleFactor();
        
        // Create a composite path for all segments
        for (let i = 0; i < snake.visibleSegments.length; i++) {
          const segment = snake.visibleSegments[i];
          ctx.moveTo(segment.x + segmentRadius, segment.y);
          ctx.arc(segment.x, segment.y, segmentRadius, 0, Math.PI * 2);
        }
        
        // Apply single glow effect to the entire snake outline
        ctx.shadowColor = "white";
        ctx.shadowBlur = 15;
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3 * scaleFactor;
        ctx.stroke();
        ctx.restore();
      }
      

      
      // Draw snake segments with appropriate shadow effects
      ctx.save();
      
      if (!snake.isBoosting) {
        // Add subtle drop shadow when not boosting
        ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      } else {
        // Ensure no shadow when boosting (glow effect is already applied)
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
      
      for (let i = snake.visibleSegments.length - 1; i >= 0; i--) {
        const segment = snake.visibleSegments[i];
        const segmentRadius = snake.getSegmentRadius();
        
        ctx.globalAlpha = segment.opacity;
        
        // Draw solid segment
        ctx.fillStyle = "#d55400";
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, segmentRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
      
      // Reset global alpha
      ctx.globalAlpha = 1.0;

      // Draw money balance above snake head
      if (snake.visibleSegments.length > 0) {
        const snakeHead = snake.visibleSegments[0];
        const scaleFactor = snake.getScaleFactor();
        
        ctx.font = `${14 * scaleFactor}px Arial, sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2 * scaleFactor;
        ctx.textAlign = "center";
        
        const moneyText = `$${snake.money.toFixed(2)}`;
        const offsetY = 35 * scaleFactor; // Scale the offset with snake size
        
        // Draw text outline for better visibility
        ctx.strokeText(moneyText, snakeHead.x, snakeHead.y - offsetY);
        ctx.fillText(moneyText, snakeHead.x, snakeHead.y - offsetY);
      }

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
    return () => {
      cancelAnimationFrame(animationId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mouseDirection, snake, foods, gameOver, canvasSize, score, hiddenAt]);

  const resetGame = () => {
    setGameOver(false);
    setScore(0);
    // Reset snake to initial state using new system
    snake.head = { x: MAP_CENTER_X, y: MAP_CENTER_Y };
    snake.currentAngle = 0;
    snake.segmentTrail = [{ x: MAP_CENTER_X, y: MAP_CENTER_Y }];
    snake.totalMass = snake.START_MASS;
    snake.growthRemaining = 0;
    snake.partialGrowth = 0; // Reset partialGrowth for faster mass conversion
    snake.distanceBuffer = 0;
    snake.currentSegmentCount = snake.START_MASS; // Reset animated segment count
    snake.money = 1.00; // Reset money to starting amount
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