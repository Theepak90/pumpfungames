import { useRef, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { X, Volume2 } from 'lucide-react';
import dollarSignImageSrc from '@assets/$ (1)_1753992938537.png';
import LoadingScreen from '@/components/LoadingScreen';

// Game constants
const MAP_CENTER_X = 2000;
const MAP_CENTER_Y = 2000;
const MAP_RADIUS = 1800; // Circular map radius
// Food system removed
const BOT_COUNT = 5;

interface Position {
  x: number;
  y: number;
}

// Food interface removed - all food systems eliminated

interface BotSnake {
  id: string;
  head: Position;
  visibleSegments: Array<{ x: number; y: number; opacity: number }>;
  segmentTrail: Position[];
  totalMass: number;
  currentAngle: number;
  speed: number;
  baseSpeed: number;
  color: string;
  targetAngle: number;
  lastDirectionChange: number;
  // targetFood removed
  money: number; // Bot's money balance
  state: 'wander' | 'foodHunt' | 'avoid' | 'aggro'; // Bot behavior state
  isBoosting: boolean;
  boostTime: number;
  lastStateChange: number;
  aggroTarget: SmoothSnake | BotSnake | null;
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
  const baseSpeed = 1.8 + Math.random() * 0.8; // Slightly slower than player
  
  return {
    id,
    head: { x, y },
    visibleSegments: [{ x, y, opacity: 1.0 }],
    segmentTrail: [{ x, y }],
    totalMass: 8 + Math.random() * 12, // Start with 8-20 mass
    currentAngle: Math.random() * Math.PI * 2,
    speed: baseSpeed,
    baseSpeed: baseSpeed,
    color: colors[Math.floor(Math.random() * colors.length)],
    targetAngle: Math.random() * Math.PI * 2,
    lastDirectionChange: 0,

    money: 1.00, // All bots start with exactly $1.00
    state: 'wander',
    isBoosting: false,
    boostTime: 0,
    lastStateChange: Date.now(),
    aggroTarget: null
  };
}

function updateBotSnake(bot: BotSnake, playerSnake: SmoothSnake, otherBots: BotSnake[]): BotSnake {
  // Enhanced AI Decision making with aggressive behavior
  const SEGMENT_SPACING = 10;
  const SEGMENT_RADIUS = 10;
  const currentTime = Date.now();
  

  
  // Check for nearby threats (less sensitive for more aggressive play)
  let nearestThreat: { x: number, y: number, distance: number } | null = null;
  let threatDistance = Infinity;
  
  // Check player snake segments for collision avoidance (reduced sensitivity)
  for (let i = 1; i < playerSnake.visibleSegments.length; i++) { // Skip head (index 0)
    const segment = playerSnake.visibleSegments[i];
    const dist = Math.sqrt((bot.head.x - segment.x) ** 2 + (bot.head.y - segment.y) ** 2);
    if (dist < 60 && dist < threatDistance) { // Reduced danger zone for more aggressive play
      threatDistance = dist;
      nearestThreat = { x: segment.x, y: segment.y, distance: dist };
    }
  }
  
  // Check other bot snakes for collision avoidance
  for (const otherBot of otherBots) {
    if (otherBot.id === bot.id) continue;
    for (const segment of otherBot.visibleSegments) {
      const dist = Math.sqrt((bot.head.x - segment.x) ** 2 + (bot.head.y - segment.y) ** 2);
      if (dist < 40 && dist < threatDistance) { // Smaller danger zone for other bots
        threatDistance = dist;
        nearestThreat = { x: segment.x, y: segment.y, distance: dist };
      }
    }
  }
  
  // Aggressive player hunting behavior
  const playerHeadDist = Math.sqrt((bot.head.x - playerSnake.head.x) ** 2 + (bot.head.y - playerSnake.head.y) ** 2);
  let shouldHuntPlayer = false;
  
  // Hunt player if bot is bigger or player is close and vulnerable
  if (bot.totalMass > playerSnake.totalMass * 0.8 && playerHeadDist < 200) {
    shouldHuntPlayer = true;
  }
  
  // Threat avoidance (less sensitive)
  if (nearestThreat && nearestThreat.distance < 40) { // Reduced avoidance threshold
    // Calculate escape angle (away from threat)
    const threatAngle = Math.atan2(nearestThreat.y - bot.head.y, nearestThreat.x - bot.head.x);
    bot.targetAngle = threatAngle + Math.PI; // Opposite direction
    bot.lastDirectionChange = currentTime;
    
    // Boost when escaping danger
    if (bot.totalMass > 4 && !bot.isBoosting && Math.random() < 0.05) {
      bot.isBoosting = true;
      bot.boostTime = currentTime;
    }
  } else if (shouldHuntPlayer) {
    // Hunt the player aggressively
    bot.targetAngle = Math.atan2(playerSnake.head.y - bot.head.y, playerSnake.head.x - bot.head.x);
    bot.lastDirectionChange = currentTime;
    
    // Boost when hunting if close enough
    if (playerHeadDist < 100 && bot.totalMass > 6 && !bot.isBoosting && Math.random() < 0.03) {
      bot.isBoosting = true;
      bot.boostTime = currentTime;
    }
  } else {
    // Random wandering behavior (food targeting removed)
    if (currentTime - bot.lastDirectionChange > 800 + Math.random() * 1200) {
      const distFromCenter = Math.sqrt((bot.head.x - MAP_CENTER_X) ** 2 + (bot.head.y - MAP_CENTER_Y) ** 2);
      if (distFromCenter > MAP_RADIUS * 0.6) {
        // Move toward center when near edges
        const angleToCenter = Math.atan2(MAP_CENTER_Y - bot.head.y, MAP_CENTER_X - bot.head.x);
        bot.targetAngle = angleToCenter + (Math.random() - 0.5) * Math.PI * 0.3;
      } else {
        // Random but more purposeful movement
        bot.targetAngle = Math.random() * Math.PI * 2;
      }
      bot.lastDirectionChange = currentTime;
    }
  }
  
  // Smooth angle interpolation
  let angleDiff = bot.targetAngle - bot.currentAngle;
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  
  // Faster turning for more responsive movement
  const turnSpeed = bot.isBoosting ? 0.06 : 0.04; // Faster turning when boosting
  bot.currentAngle += angleDiff * turnSpeed;
  
  // Keep angle in range
  if (bot.currentAngle > Math.PI) bot.currentAngle -= 2 * Math.PI;
  if (bot.currentAngle < -Math.PI) bot.currentAngle += 2 * Math.PI;
  
  // Update boost state timing
  if (bot.isBoosting && currentTime - bot.boostTime > 1200) {
    bot.isBoosting = false;
  }
  
  // Calculate speed with boosting
  let currentSpeed = bot.baseSpeed;
  if (bot.isBoosting && bot.totalMass > 4) {
    currentSpeed *= 1.8; // Boost multiplier
    // Lose mass when boosting (like player)
    bot.totalMass -= 0.03;
    if (bot.totalMass < 4) {
      bot.isBoosting = false; // Stop boosting if too small
    }
  }
  
  // Move bot
  const dx = Math.cos(bot.currentAngle) * currentSpeed;
  const dy = Math.sin(bot.currentAngle) * currentSpeed;
  
  bot.head.x += dx;
  bot.head.y += dy;
  
  // Keep bot within circular map bounds
  const distFromCenter = Math.sqrt((bot.head.x - MAP_CENTER_X) ** 2 + (bot.head.y - MAP_CENTER_Y) ** 2);
  if (distFromCenter > MAP_RADIUS - 50) {
    const angleToCenter = Math.atan2(MAP_CENTER_Y - bot.head.y, MAP_CENTER_X - bot.head.x);
    bot.targetAngle = angleToCenter;
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
    // HARD CAP: Segments absolutely cannot exceed 100 under any circumstances
    const MAX_SEGMENTS = 100;
    const massBasedSegments = Math.floor(this.totalMass / this.MASS_PER_SEGMENT);
    const targetSegmentCount = Math.min(massBasedSegments, MAX_SEGMENTS);
    
    // Smoothly animate currentSegmentCount toward target, but ENFORCE cap at MAX_SEGMENTS
    const transitionSpeed = 0.08;
    if (this.currentSegmentCount < targetSegmentCount && this.currentSegmentCount < MAX_SEGMENTS) {
      this.currentSegmentCount += transitionSpeed;
    } else if (this.currentSegmentCount > targetSegmentCount) {
      this.currentSegmentCount -= transitionSpeed;
    }
    
    // CRITICAL: Absolute hard cap - no segments beyond 100 ever
    this.currentSegmentCount = Math.max(1, Math.min(this.currentSegmentCount, MAX_SEGMENTS));
    
    // Use floor for solid segments, check if we need a fading segment
    const solidSegmentCount = Math.floor(this.currentSegmentCount);
    const fadeAmount = this.currentSegmentCount - solidSegmentCount;
    
    this.visibleSegments = [];
    let distanceSoFar = 0;
    let segmentIndex = 0;
    // ABSOLUTE CAP: Never place more than 100 segments regardless of any other calculation
    let totalSegmentsToPlace = Math.min(Math.ceil(this.currentSegmentCount), MAX_SEGMENTS);
    
    // Process all segments in one pass to avoid distance calculation issues
    for (let i = 1; i < this.segmentTrail.length && this.visibleSegments.length < totalSegmentsToPlace; i++) {
      const a = this.segmentTrail[i - 1];
      const b = this.segmentTrail[i];
      
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const segmentDist = Math.sqrt(dx * dx + dy * dy);
      
      // Calculate dynamic segment spacing based on snake size
      // Small snakes: tight spacing (12), Large snakes: spread out (18)
      const segmentProgress = Math.min(this.currentSegmentCount / MAX_SEGMENTS, 1.0);
      const dynamicSpacing = this.SEGMENT_SPACING + (segmentProgress * 6); // 12 to 18 spacing
      
      // Check if we need to place segments in this trail section
      // TRIPLE CHECK: Enforce 100 segment limit at every placement
      while (distanceSoFar + segmentDist >= segmentIndex * dynamicSpacing && 
             this.visibleSegments.length < totalSegmentsToPlace &&
             this.visibleSegments.length < MAX_SEGMENTS &&
             segmentIndex < MAX_SEGMENTS) {
        const targetDistance = segmentIndex * dynamicSpacing;
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
    // Cap width scaling at 100 segments, not mass
    const maxScale = 5;
    const MAX_SEGMENTS = 100;
    const currentSegments = Math.min(this.visibleSegments.length, MAX_SEGMENTS);
    const scaleFactor = Math.min(1 + (currentSegments - 10) / 100, maxScale);
    return this.SEGMENT_RADIUS * scaleFactor;
  }

  // Get scale factor for all visual elements
  getScaleFactor() {
    const maxScale = 5;
    return Math.min(1 + (this.totalMass - 10) / 100, maxScale);
  }
  
  move(mouseDirectionX: number, mouseDirectionY: number) {
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
    this.applyBoost();
    
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
  
  applyBoost() {
    if (this.isBoosting && this.totalMass > this.MIN_MASS_TO_BOOST) {
      this.speed = this.baseSpeed * this.boostMultiplier;
      this.boostCooldown++;
      
      // Food dropping removed - no mass loss during boosting
    } else {
      this.speed = this.baseSpeed;
      this.isBoosting = false;
    }
  }
  
  // Food system completely removed - snakes grow through other mechanics
  
  // Process growth at 10 mass per second rate
  processGrowth(deltaTime: number) {
    const growthRate = 10; // max 10 mass per second
    const maxGrowthThisFrame = growthRate * deltaTime;
    
    const growthThisFrame = Math.min(this.growthRemaining, maxGrowthThisFrame);
    this.partialGrowth += growthThisFrame;
    this.growthRemaining -= growthThisFrame;
    
    // Add mass when we have enough partial growth, but cap at 100 total mass
    const MAX_MASS = 100;
    while (this.partialGrowth >= 1 && this.totalMass < MAX_MASS) {
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
    console.log(`NEW SNAKE CREATED: mass=${newSnake.totalMass}, visibleSegments=${newSnake.visibleSegments.length}, trail=${newSnake.segmentTrail.length}`);
    return newSnake;
  });
  const [botSnakes, setBotSnakes] = useState<BotSnake[]>([]);
  const [serverBots, setServerBots] = useState<any[]>([]);
  const [serverPlayers, setServerPlayers] = useState<any[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const gameOverRef = useRef(false);

  // Sync ref with state
  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);
  const [score, setScore] = useState(0);
  const [isBoosting, setIsBoosting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);

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
  const [cashingOut, setCashingOut] = useState(false);
  const [cashOutProgress, setCashOutProgress] = useState(0);
  const [cashOutStartTime, setCashOutStartTime] = useState<number | null>(null);
  const [qKeyPressed, setQKeyPressed] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const [cashedOutAmount, setCashedOutAmount] = useState(0);
  const [otherPlayers, setOtherPlayers] = useState<Array<{
    id: string;
    segments: Array<{ x: number; y: number }>;
    color: string;
    money: number;
  }>>([]);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [myPlayerColor, setMyPlayerColor] = useState<string>('#d55400'); // Default orange
  const [currentRoomId, setCurrentRoomId] = useState<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Death food dropping removed

  // Function to drop money crates when snake dies (spread along entire snake body)
  // Money crate dropping removed

  // All death loot functions removed



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



  // Local game initialization disabled - everything comes from server
  useEffect(() => {
    if (!gameStarted) return;
    
    // Clear any local game state - server provides everything
    setBotSnakes([]);
    
    console.log("Game started - waiting for server world data");
  }, [gameStarted]);

  // HTTP Polling-based multiplayer connection (replacing WebSocket due to protocol issues)
  useEffect(() => {
    if (!gameStarted) return;

    console.log("Starting HTTP-based multiplayer...");
    setConnectionStatus('Connecting');
    
    // Get an available multiplayer room
    fetch('/api/multiplayer/room')
      .then(res => res.json())
      .then(data => {
        const roomId = data.roomId;
        setCurrentRoomId(roomId);
        
        // Generate player ID
        const playerId = `player_${Date.now()}_${Math.random()}`;
        setMyPlayerId(playerId);
        console.log(`Connected to room ${roomId} as player ${playerId}`);

        setConnectionStatus('Connected');
        
        // Start polling for room state every 100ms for real-time updates
        const startPolling = () => {
          pollingIntervalRef.current = setInterval(() => {
            fetch(`/api/multiplayer/state/${roomId}`)
              .then(res => res.json())
              .then(data => {
                if (data.players) {
                  // Filter out our own player and update others
                  const filteredPlayers = data.players.filter((p: any) => 
                    p.id !== playerId && p.segments.length > 0
                  );
                  setOtherPlayers(filteredPlayers);
                  console.log(`Room ${roomId}: ${data.players.length} total players, showing ${filteredPlayers.length} others`);
                }
              })
              .catch(err => {
                console.error('Polling error:', err);
                setConnectionStatus('Disconnected');
              });
          }, 100); // Poll every 100ms for smooth real-time updates
        };
        
        startPolling();
      })
      .catch(error => {
        console.error('Failed to get multiplayer room:', error);
        setConnectionStatus('Connection Error');
      });

    // Cleanup function
    return () => {
      console.log("Cleaning up HTTP multiplayer connection...");
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [gameStarted]);

  // Send player data to server via HTTP
  useEffect(() => {
    if (!gameStarted || !myPlayerId || !currentRoomId) {
      console.log(`Not sending HTTP updates: gameStarted=${gameStarted}, playerId=${!!myPlayerId}, roomId=${currentRoomId}`);
      return;
    }

    console.log(`Starting HTTP position updates - snake has ${snake.visibleSegments.length} segments`);
    
    const sendInterval = setInterval(() => {
      // Stop sending updates immediately if game is over
      if (gameOverRef.current) {
        console.log(`🛑 Stopped sending HTTP updates: gameOver=${gameOverRef.current}`);
        return;
      }
      
      if (snake.visibleSegments.length > 0) {
        const updateData = {
          roomId: currentRoomId,
          playerId: myPlayerId,
          segments: snake.visibleSegments.slice(0, 100).map(seg => ({ x: seg.x, y: seg.y })), // Send up to 100 segments max
          color: '#d55400',
          money: snake.money,
          totalMass: snake.totalMass,
          segmentRadius: snake.getSegmentRadius(),
          visibleSegmentCount: snake.visibleSegments.length
        };
        
        // Send update via HTTP POST
        fetch('/api/multiplayer/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        }).catch(err => {
          console.error('Failed to send player update:', err);
        });
      }
    }, 100); // Send updates every 100ms for HTTP polling

    return () => {
      console.log('Clearing HTTP position update interval');
      clearInterval(sendInterval);
    };
  }, [gameStarted, myPlayerId, currentRoomId, gameOver]);

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

  // Boost controls and cash-out
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent key repeat events
      if (e.repeat) return;
      
      if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        setIsBoosting(true);
        snake.setBoost(true);
      } else if (e.key.toLowerCase() === 'q') {
        setQKeyPressed(true);
        if (!cashingOut) {
          // Start cash-out process only if Q is pressed
          setCashingOut(true);
          setCashOutStartTime(Date.now());
          setCashOutProgress(0);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        setIsBoosting(false);
        snake.setBoost(false);
      } else if (e.key.toLowerCase() === 'q') {
        setQKeyPressed(false);
        // Cancel cash-out process when Q is released
        setCashingOut(false);
        setCashOutProgress(0);
        setCashOutStartTime(null);
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
    if (gameOver || !gameStarted) return; // Don't start game loop until loading is complete
    
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
      
      // Move snake - disable control when cashing out
      if (cashingOut) {
        // Snake moves in straight line when cashing out (no player control)
        snake.move(Math.cos(snake.currentAngle), Math.sin(snake.currentAngle));
      } else {
        // Normal mouse control
        snake.move(mouseDirection.x, mouseDirection.y);
      }

      // Bot AI disabled - bots controlled by server

      // Update cash-out progress - only if Q is still being held
      if (cashingOut && cashOutStartTime && qKeyPressed) {
        const elapsed = currentTime - cashOutStartTime;
        const progress = Math.min(elapsed / 3000, 1); // 3 seconds = 100%
        setCashOutProgress(progress);
        
        // Complete cash-out after 3 seconds
        if (progress >= 1) {
          const amount = snake.money;
          console.log(`Cashed out $${amount.toFixed(2)}!`);
          setCashedOutAmount(amount);
          setShowCongrats(true);
          snake.money = 1.00; // Reset to starting money
          setCashingOut(false);
          setCashOutProgress(0);
          setCashOutStartTime(null);
          setQKeyPressed(false);
        }
      } else if (cashingOut && !qKeyPressed) {
        // Q was released, cancel cash-out
        setCashingOut(false);
        setCashOutProgress(0);
        setCashOutStartTime(null);
      }

      // Food system removed

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
        // Clear snake body completely when hitting death barrier
        snake.visibleSegments = []; // Clear all body segments immediately
        snake.segmentTrail = []; // Clear trail
        snake.totalMass = 0; // Reset mass to 0
        snake.money = 0; // Reset snake's money on death
        setGameOver(true);
        gameOverRef.current = true;
        console.log(`💀 BOUNDARY DEATH: Snake body cleared, segments=${snake.visibleSegments.length}`);
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
        // Clear snake body completely when hitting bot
        snake.visibleSegments = []; // Clear all body segments immediately
        snake.segmentTrail = []; // Clear trail
        snake.totalMass = 0; // Reset mass to 0
        snake.money = 0; // Reset snake's money on death
        setGameOver(true);
        gameOverRef.current = true;
        console.log(`💀 BOT COLLISION DEATH: Snake body cleared, segments=${snake.visibleSegments.length}`);
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
          // Both snakes die in head-on collision - clear snake body completely
          snake.visibleSegments = []; // Clear all body segments immediately
          snake.segmentTrail = []; // Clear trail
          snake.totalMass = 0; // Reset mass to 0
          snake.money = 0;
          
          // Remove the bot
          setBotSnakes(prevBots => prevBots.filter((_, index) => index !== i));
          
          // Spawn a new bot to replace the killed one
          setTimeout(() => {
            setBotSnakes(prevBots => [...prevBots, createBotSnake(`bot_${Date.now()}`)]);
          }, 3000);
          
          setGameOver(true);
          gameOverRef.current = true;
          console.log(`💀 HEAD-ON COLLISION DEATH: Snake body cleared, segments=${snake.visibleSegments.length}`);
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
            // Death food and money crates removed
            
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

      // Bot food eating disabled - server handles all game logic
      // setBotSnakes(prevBots => {
      //   return prevBots.map(bot => {
      //     // Server now handles bot food eating and respawning
      //     return bot;
      //   });
      // });

      // Food gravitation toward snake head (50px radius, 2x faster)
      // Food system removed

      // Food collision system removed

      // Server food system removed

      // Check for collisions with other players' snakes
      for (const otherPlayer of otherPlayers) {
        if (!otherPlayer.segments || otherPlayer.segments.length === 0) continue;
        
        for (const segment of otherPlayer.segments) {
          const dist = Math.sqrt((snake.head.x - segment.x) ** 2 + (snake.head.y - segment.y) ** 2);
          const collisionRadius = snake.getSegmentRadius() + 10; // Use standard segment radius
          
          if (dist < collisionRadius) {
            // Player died - crash into another snake!
            console.log(`💀 CRASHED into player ${otherPlayer.id}! Setting gameOver = true`);
            gameOverRef.current = true; // Set ref immediately
            setGameOver(true);
            
            // FORCE immediate re-render by clearing canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#15161b';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            console.log(`💀 Game over state set and canvas cleared!`);
            
            // Death loot removed
            
            return; // Stop the game loop
          }
        }
      }

      // Check for collisions with server players' snakes
      for (const serverPlayer of serverPlayers) {
        if (!serverPlayer.segments || serverPlayer.segments.length === 0) continue;
        if (serverPlayer.id === myPlayerId) continue; // Skip self
        
        for (const segment of serverPlayer.segments) {
          const dist = Math.sqrt((snake.head.x - segment.x) ** 2 + (snake.head.y - segment.y) ** 2);
          const collisionRadius = snake.getSegmentRadius() + (serverPlayer.segmentRadius || 10);
          
          if (dist < collisionRadius) {
            // Player died - crash into another snake!
            console.log(`💀 CRASHED into server player ${serverPlayer.id}!`);
            gameOverRef.current = true; // Set ref immediately
            setGameOver(true);
            
            // Death loot removed
            
            return; // Stop the game loop
          }
        }
      }

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

      // All food rendering removed

      // Draw only OTHER server players (exclude yourself) - always render immediately
      const otherServerPlayers = serverPlayers.filter(player => player.id !== myPlayerId);
      console.log(`Drawing ${otherServerPlayers.length} other players (excluding self)`);
      otherServerPlayers.forEach((serverPlayer, playerIndex) => {
        console.log(`Other Player ${playerIndex}:`, serverPlayer.id, serverPlayer.segments?.length, serverPlayer.color);
        if (serverPlayer.segments && serverPlayer.segments.length > 0) {
          // Use server segments exactly as sent - no spacing modifications
          // This ensures other players see your snake exactly as you see it on your screen
          const fullSnakeBody = serverPlayer.segments;
          const spacedSegments = fullSnakeBody; // Use all segments as-is from server
          
          // Draw snake body with EXACT same styling as local snake
          ctx.save();
          
          // Add drop shadow when not boosting (like local snake)
          ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
          ctx.shadowBlur = 6;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          
          // Use spaced segments for natural appearance
          const segmentsToRender = spacedSegments.length;
          
          // Draw segments from tail to head for proper layering
          for (let i = segmentsToRender - 1; i >= 0; i--) {
            const segment = spacedSegments[i];
            const segmentRadius = serverPlayer.segmentRadius || 10;
            
            ctx.fillStyle = serverPlayer.color || '#ff0000';
            ctx.beginPath();
            ctx.arc(segment.x, segment.y, segmentRadius, 0, Math.PI * 2);
            ctx.fill();
          }
          
          console.log(`Rendered snake ${serverPlayer.id} with ${segmentsToRender}/${fullSnakeBody.length} exact server segments`);
          
          ctx.restore();
          
          // Draw rotated square eyes exactly like local snake
          if (spacedSegments.length > 0) {
            const head = spacedSegments[0];
            
            // Calculate movement direction from first two segments
            let movementAngle = 0;
            if (spacedSegments.length > 1) {
              const dx = head.x - spacedSegments[1].x;
              const dy = head.y - spacedSegments[1].y;
              movementAngle = Math.atan2(dy, dx);
            }
            
            // Cap eye scaling at 100 segments for multiplayer snakes with balanced proportions
            const MAX_SEGMENTS = 100;
            const currentSegments = Math.min(fullSnakeBody.length, MAX_SEGMENTS);
            const segmentProgress = currentSegments / MAX_SEGMENTS;
            const maxEyeScale = 2.2; // Balanced scaling for visibility
            const baseEyeScale = 1 + (segmentProgress * (maxEyeScale - 1));
            
            const baseRadius = 10;
            const cappedRadius = baseRadius * baseEyeScale;
            const eyeDistance = cappedRadius * 0.40; // Balanced distance from center
            const eyeSize = cappedRadius * 0.28; // Balanced size relative to head
            const pupilSize = cappedRadius * 0.13; // Balanced pupil size
            
            // Eye positions perpendicular to movement direction
            const eye1X = head.x + Math.cos(movementAngle + Math.PI/2) * eyeDistance;
            const eye1Y = head.y + Math.sin(movementAngle + Math.PI/2) * eyeDistance;
            const eye2X = head.x + Math.cos(movementAngle - Math.PI/2) * eyeDistance;
            const eye2Y = head.y + Math.sin(movementAngle - Math.PI/2) * eyeDistance;
            
            // Draw first eye with rotation
            ctx.save();
            ctx.translate(eye1X, eye1Y);
            ctx.rotate(movementAngle);
            ctx.fillStyle = 'white';
            ctx.fillRect(-eyeSize, -eyeSize, eyeSize * 2, eyeSize * 2);
            
            // Draw first pupil looking forward
            const pupilOffset = eyeSize * 0.4; // Scale pupil offset with eye size
            ctx.fillStyle = 'black';
            ctx.fillRect(
              pupilOffset - pupilSize,
              0 - pupilSize,
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
            
            // Draw second pupil looking forward
            ctx.fillStyle = 'black';
            ctx.fillRect(
              pupilOffset - pupilSize,
              0 - pupilSize,
              pupilSize * 2, 
              pupilSize * 2
            );
            ctx.restore();
          }
          
          // Draw player money above head with proper scaling and font
          if (fullSnakeBody.length > 0) {
            const head = fullSnakeBody[0];
            const segmentRadius = serverPlayer.segmentRadius || 10;
            
            // Calculate scale factor based on segment radius, capped at 4 mass equivalent
            const baseRadius = 10;
            const maxRadius = 10.2; // Equivalent to ~4 mass
            const cappedRadius = Math.min(segmentRadius, maxRadius);
            const scaleFactor = Math.max(0.8, cappedRadius / baseRadius);
            
            ctx.save();
            ctx.font = `${Math.floor(10 * scaleFactor)}px 'Press Start 2P', monospace`;
            ctx.fillStyle = "#ffffff";
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 3 * scaleFactor;
            ctx.textAlign = "center";
            
            const moneyText = `$${serverPlayer.money?.toFixed(2) || '1.00'}`;
            const offsetY = 20 * scaleFactor; // Scale the offset with snake size
            
            // Draw text outline for better visibility
            ctx.strokeText(moneyText, head.x, head.y - offsetY);
            ctx.fillText(moneyText, head.x, head.y - offsetY);
            ctx.restore();
          }
        }
      });

      // Draw your own snake locally using EXACT same rendering as remote players
      // Only render if game is active AND snake has segments (disappears completely on death)
      if (gameStarted && snake.visibleSegments.length > 0 && !gameOver) {
        const fullSnakeBody = snake.visibleSegments;
        
        // Draw snake body with EXACT same styling as remote players
        ctx.save();
        
        // Add drop shadow when not boosting (like remote snakes)
        ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // Cap rendering at exactly 100 segments to match game limits
        const maxRenderSegments = 100; // Hard cap at 100 segments max
        const segmentsToRender = Math.min(fullSnakeBody.length, maxRenderSegments);
        
        // Draw segments from tail to head for proper layering
        for (let i = segmentsToRender - 1; i >= 0; i--) {
          const segment = fullSnakeBody[i];
          const segmentRadius = snake.getSegmentRadius();
          
          ctx.fillStyle = '#d55400'; // Your snake color
          ctx.beginPath();
          ctx.arc(segment.x, segment.y, segmentRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.restore();
        
        // Draw rotated square eyes exactly like remote snakes
        if (fullSnakeBody.length > 0) {
          const head = fullSnakeBody[0];
          
          // Calculate movement direction from first two segments
          let movementAngle = 0;
          if (fullSnakeBody.length > 1) {
            const dx = head.x - fullSnakeBody[1].x;
            const dy = head.y - fullSnakeBody[1].y;
            movementAngle = Math.atan2(dy, dx);
          }
          
          // Scale eyes with snake size (exact same as remote snakes)
          const segmentRadius = snake.getSegmentRadius();
          const eyeDistance = segmentRadius * 0.5; // Scale eye distance with snake size
          const eyeSize = segmentRadius * 0.3; // Scale eye size with snake size
          const pupilSize = segmentRadius * 0.15; // Scale pupil with snake size
          
          // Eye positions perpendicular to movement direction
          const eye1X = head.x + Math.cos(movementAngle + Math.PI/2) * eyeDistance;
          const eye1Y = head.y + Math.sin(movementAngle + Math.PI/2) * eyeDistance;
          const eye2X = head.x + Math.cos(movementAngle - Math.PI/2) * eyeDistance;
          const eye2Y = head.y + Math.sin(movementAngle - Math.PI/2) * eyeDistance;
          
          // Draw first eye with rotation
          ctx.save();
          ctx.translate(eye1X, eye1Y);
          ctx.rotate(movementAngle);
          ctx.fillStyle = 'white';
          ctx.fillRect(-eyeSize, -eyeSize, eyeSize * 2, eyeSize * 2);
          
          // Draw first pupil looking forward
          const pupilOffset = eyeSize * 0.4; // Scale pupil offset with eye size
          ctx.fillStyle = 'black';
          ctx.fillRect(
            pupilOffset - pupilSize,
            0 - pupilSize,
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
          
          // Draw second pupil looking forward
          ctx.fillStyle = 'black';
          ctx.fillRect(
            pupilOffset - pupilSize,
            0 - pupilSize,
            pupilSize * 2, 
            pupilSize * 2
          );
          ctx.restore();
        }
        

      }

      // REMOVED: Legacy other players rendering to prevent duplicate snake bodies

      // No bots in multiplayer - removed all bot rendering

      // REMOVED: Bot snake rendering to prevent duplicate snake bodies in multiplayer
      
      ctx.globalAlpha = 1.0;

      // Only render snake if game is not over (use ref for immediate response)
      if (!gameOverRef.current) {
        // Draw single glowing outline behind the whole snake when boosting
        if (snake.isBoosting && snake.visibleSegments.length > 0) {
          ctx.save();
          ctx.beginPath();
          
          const segmentRadius = snake.getSegmentRadius();
          
          // Cap glow scaling at 100 segments
          const MAX_SEGMENTS = 100;
          const currentSegments = Math.min(snake.visibleSegments.length, MAX_SEGMENTS);
          const segmentProgress = currentSegments / MAX_SEGMENTS;
          const maxGlowScale = 2.2; // Same cap as eyes
          const glowScaleFactor = 1 + (segmentProgress * (maxGlowScale - 1));
          
          // Create a composite path for all segments
          for (let i = 0; i < snake.visibleSegments.length; i++) {
            const segment = snake.visibleSegments[i];
            ctx.moveTo(segment.x + segmentRadius, segment.y);
            ctx.arc(segment.x, segment.y, segmentRadius, 0, Math.PI * 2);
          }
          
          // Apply single glow effect to the entire snake outline with capped scaling
          ctx.shadowColor = "white";
          ctx.shadowBlur = 15;
          ctx.strokeStyle = "white";
          ctx.lineWidth = 3 * glowScaleFactor;
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
          
          // Cap the scaling at 4 mass equivalent
          const baseMass = 6; // Starting mass
          const maxMass = 10; // Cap at 4 mass (starting at 6, so 6+4=10)
          const cappedMass = Math.min(snake.visibleSegments.length, maxMass);
          const scaleFactor = Math.max(0.8, cappedMass / baseMass);
          
          ctx.font = `${Math.floor(10 * scaleFactor)}px 'Press Start 2P', monospace`;
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 3 * scaleFactor;
          ctx.textAlign = "center";
          
          const moneyText = `$${snake.money.toFixed(2)}`;
          const offsetY = 20 * scaleFactor; // Scale the offset with snake size
          
          // Draw text outline for better visibility
          ctx.strokeText(moneyText, snakeHead.x, snakeHead.y - offsetY);
          ctx.fillText(moneyText, snakeHead.x, snakeHead.y - offsetY);
          
          // Draw cash-out progress bar under money counter
          if (cashingOut) {
            const barWidth = 40 * scaleFactor; // Smaller width
            const barHeight = 3 * scaleFactor; // Smaller height
            const barX = snakeHead.x - barWidth / 2;
            const barY = snakeHead.y - offsetY + 15; // Closer to money counter
            
            // Background bar
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            
            // Progress bar
            ctx.fillStyle = '#53d493'; // Green progress
            ctx.fillRect(barX, barY, barWidth * cashOutProgress, barHeight);
            
            // Border
            ctx.strokeStyle = '#134242';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
          }
        }

        // Draw eyes that track the cursor smoothly (after head is drawn)
        if (snake.visibleSegments.length > 0) {
          const snakeHead = snake.visibleSegments[0];
          const movementAngle = snake.currentAngle;
          // Cap eye scaling at 100 segments with balanced proportions
          const MAX_SEGMENTS = 100;
          const currentSegments = Math.min(snake.visibleSegments.length, MAX_SEGMENTS);
          const segmentProgress = currentSegments / MAX_SEGMENTS;
          const maxEyeScale = 2.2; // Balanced scaling for visibility
          const scaleFactor = 1 + (segmentProgress * (maxEyeScale - 1));
          const eyeDistance = 4.0 * scaleFactor; // Balanced distance from center
          const eyeSize = 2.8 * scaleFactor; // Balanced eye size
          const pupilSize = 1.3 * scaleFactor; // Balanced pupil size
          
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
      } // Close gameOver check

      // No UI display needed
      

      // Only continue game loop if game is not over (use ref for immediate response)
      if (!gameOverRef.current) {
        animationId = requestAnimationFrame(gameLoop);
      } else {
        console.log(`🛑 GAME LOOP STOPPED - gameOverRef = ${gameOverRef.current}`);
      }
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => {
      cancelAnimationFrame(animationId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mouseDirection, snake, gameOver, canvasSize, score, hiddenAt, gameStarted]);

  const resetGame = () => {
    setGameOver(false);
    setScore(0);
    setShowCongrats(false);
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

  const handleLoadingComplete = () => {
    setIsLoading(false);
    setGameStarted(true);
    
    // Force immediate multiple renders to ensure all snake eyes appear instantly
    if (canvasRef.current) {
      for (let i = 0; i < 10; i++) {
        setTimeout(() => {
          window.requestAnimationFrame(() => {
            // Force complete rendering of all snake elements including eyes
          });
        }, i * 16); // Render every frame for 10 frames
      }
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-dark-bg">
      {/* Loading Screen */}
      {isLoading && <LoadingScreen onLoadingComplete={handleLoadingComplete} />}
      
      {/* Minimap */}
      <div className="absolute top-4 left-4 z-10">
        <svg width="96" height="96" className="w-full h-full">
          {/* Map boundary circle */}
          <circle
            cx="48"
            cy="48"
            r="44"
            fill="black"
            stroke="#53d392"
            strokeWidth="2"
          />
            
            {/* Player snake dot (red) */}
            {snake.visibleSegments.length > 0 && (
              <circle
                cx={48 + ((snake.head.x - MAP_CENTER_X) / MAP_RADIUS) * 44}
                cy={48 + ((snake.head.y - MAP_CENTER_Y) / MAP_RADIUS) * 44}
                r="2"
                fill="#ff4444"
              />
            )}
            
            {/* Bot snake dots */}
            {botSnakes.map(bot => (
              <circle
                key={bot.id}
                cx={48 + ((bot.head.x - MAP_CENTER_X) / MAP_RADIUS) * 44}
                cy={48 + ((bot.head.y - MAP_CENTER_Y) / MAP_RADIUS) * 44}
                r="1.5"
                fill={bot.color}
              />
            ))}
        </svg>
      </div>

      {/* Connection Status */}
      <div className="absolute top-4 right-4 z-10">
        <div className="bg-black/60 border border-gray-500 rounded px-3 py-2">
          <div className={`text-sm font-mono ${
            connectionStatus === 'Connected' ? 'text-green-400' : 
            connectionStatus === 'Connecting...' ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {connectionStatus}
          </div>
          <div className="text-white text-xs font-mono">
            Players: {otherPlayers.length + 1}
          </div>
        </div>
      </div>

      {/* Mass Counter */}
      <div className="absolute top-20 right-4 z-10">
        <div className="bg-black/60 border border-gray-500 rounded px-3 py-2">
          <div className="text-white text-sm font-mono">
            Mass: {Math.floor(snake.totalMass).toFixed(0)}
          </div>
          <div className="text-gray-300 text-xs font-mono">
            Segments: {snake.visibleSegments.length}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-black/60 border border-gray-500 rounded px-3 py-2">
          <div className="text-white text-sm font-mono">Hold Q to cash out</div>
          <div className="text-white text-sm font-mono">Left click to boost</div>
        </div>
      </div>
      
      {gameOver && (
        <div className="absolute inset-0 z-20" style={{ backgroundColor: '#15161b' }}>
          <div className="w-full h-full flex flex-col items-center justify-center">
            {/* Game Over Title */}
            <div className="text-red-500 text-8xl font-bold mb-12" style={{ 
              fontFamily: "'Press Start 2P', monospace",
              textShadow: '4px 4px 0px #000000, 8px 8px 20px rgba(255, 0, 0, 0.5)'
            }}>
              GAME OVER
            </div>
            
            {/* Buttons */}
            <div className="flex gap-8">
              <button
                onClick={resetGame}
                className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xl font-bold transition-all duration-200 transform hover:scale-105"
                style={{ 
                  fontFamily: "'Press Start 2P', monospace",
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                }}
              >
                RESPAWN
              </button>
              
              <button
                onClick={exitGame}
                className="px-8 py-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-xl font-bold transition-all duration-200 transform hover:scale-105"
                style={{ 
                  fontFamily: "'Press Start 2P', monospace",
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                }}
              >
                CONTINUE
              </button>
            </div>
          </div>
        </div>
      )}

      {showCongrats && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="bg-dark-card/90 backdrop-blur-sm border border-dark-border rounded-lg p-8 text-center">
            <div className="text-green-500 text-4xl font-bold mb-4">Congratulations!</div>
            <div className="text-white text-2xl mb-2">You cashed out!</div>
            <div className="text-neon-yellow text-xl mb-6">${cashedOutAmount.toFixed(2)}</div>
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
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCongrats && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="bg-dark-card/90 backdrop-blur-sm border border-neon-green rounded-lg p-8 text-center">
            <div className="text-neon-green text-4xl font-bold mb-4">Congratulations!</div>
            <div className="text-white text-2xl mb-2">You cashed out:</div>
            <div className="text-neon-yellow text-3xl font-bold mb-6">${cashedOutAmount.toFixed(2)}</div>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={resetGame}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold"
              >
                Play Again
              </Button>
              <Button
                onClick={exitGame}
                className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Continue
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