import { useRef, useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { X, Volume2 } from 'lucide-react';
import dollarSignImageSrc from '@assets/$ (1)_1753992938537.png';
import moneyCrateImageSrc from '@assets/$ (1)_1754305354543.png';
import LoadingScreen from '@/components/LoadingScreen';

// Game constants
const MAP_CENTER_X = 2000;
const MAP_CENTER_Y = 2000;
const MAP_RADIUS = 1800; // Circular map radius
const FOOD_COUNT = 160; // Doubled food count for more abundant gameplay
const FOOD_GRAVITY = 0.147; // Reduced by another 30% (0.21 * 0.7) for gentler attraction
const FOOD_MAX_SPEED = 0.52; // 35% slower speed (0.8 * 0.65) for smoother attraction
const FOOD_ATTRACTION_RADIUS = 50; // Reduced to 50px attraction range
const FOOD_CONSUMPTION_RADIUS = 15; // Distance to consume food
const BOT_COUNT = 5;

interface Position {
  x: number;
  y: number;
}

// Food interface with gravitational physics
interface Food {
  id: string;
  x: number;
  y: number;
  vx: number; // velocity x
  vy: number; // velocity y
  color: string;
  radius: number;
  mass: number;
  wobbleOffset: number;
  expiresAt?: number; // Optional expiration timestamp for boost food
  opacity?: number; // Optional opacity for fading boost food
  isBoostFood?: boolean; // Flag to identify boost food for special rendering
  isMoneyCrate?: boolean; // Flag to identify money crates
  moneyValue?: number; // Money value for money crates
}

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
  targetFood: Food | null; // Food the bot is targeting
  isBoosting: boolean;
  boostTime: number;
  lastStateChange: number;
  aggroTarget: SmoothSnake | BotSnake | null;
}

// Utility functions for food system
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

function createFood(id: string): Food {
  // Spawn food evenly distributed across the entire map
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random()) * (MAP_RADIUS - 50); // Square root for even distribution
  const x = MAP_CENTER_X + Math.cos(angle) * radius;
  const y = MAP_CENTER_Y + Math.sin(angle) * radius;
  
  return {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    color: getRandomFoodColor(),
    radius: 6 + Math.random() * 4, // Size varies from 6-10px
    mass: 0.9, // 3x mass value (0.3 * 3)
    wobbleOffset: Math.random() * Math.PI * 2
  };
}

function updateFoodGravity(food: Food, allSnakes: Array<{ head: Position; totalMass: number }>): Food {
  const updated = { ...food };
  
  // Find nearest snake
  let nearestSnake = null;
  let nearestDistance = Infinity;
  
  for (const snake of allSnakes) {
    const dx = snake.head.x - food.x;
    const dy = snake.head.y - food.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestSnake = snake;
    }
  }
  
  if (nearestSnake && nearestDistance < FOOD_ATTRACTION_RADIUS) { // Only attract within 25px
    const dx = nearestSnake.head.x - food.x;
    const dy = nearestSnake.head.y - food.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      // Gentle attraction force
      const force = FOOD_GRAVITY; // Use base gravity for slower movement
      updated.vx += (dx / distance) * force;
      updated.vy += (dy / distance) * force;
      
      // Cap velocity
      const speed = Math.sqrt(updated.vx * updated.vx + updated.vy * updated.vy);
      if (speed > FOOD_MAX_SPEED) {
        updated.vx = (updated.vx / speed) * FOOD_MAX_SPEED;
        updated.vy = (updated.vy / speed) * FOOD_MAX_SPEED;
      }
      
      // Reduced debug logging
      if (Math.random() < 0.001) { // Much less frequent logging
        console.log(`🍎 Food ${food.id.slice(-3)} attracted: ${distance.toFixed(1)}px away, moving at ${speed.toFixed(2)} speed`);
      }
    }
  } else {
    // When not being attracted, gradually slow down more smoothly
    updated.vx *= 0.95;
    updated.vy *= 0.95;
  }
  
  // Apply velocity to update position
  const oldX = updated.x;
  const oldY = updated.y;
  updated.x += updated.vx;
  updated.y += updated.vy;
  
  // Debug position updates for testing
  if (Math.random() < 0.002 && (Math.abs(updated.vx) > 0.1 || Math.abs(updated.vy) > 0.1)) {
    console.log(`📍 Food moved: ${food.id.slice(-3)} from (${oldX.toFixed(1)}, ${oldY.toFixed(1)}) to (${updated.x.toFixed(1)}, ${updated.y.toFixed(1)}) | velocity: (${updated.vx.toFixed(2)}, ${updated.vy.toFixed(2)})`);
  }
  
  // Keep food within map bounds
  const distanceFromCenter = Math.sqrt(
    (updated.x - MAP_CENTER_X) ** 2 + (updated.y - MAP_CENTER_Y) ** 2
  );
  if (distanceFromCenter > MAP_RADIUS - 50) {
    const angle = Math.atan2(updated.y - MAP_CENTER_Y, updated.x - MAP_CENTER_X);
    updated.x = MAP_CENTER_X + Math.cos(angle) * (MAP_RADIUS - 50);
    updated.y = MAP_CENTER_Y + Math.sin(angle) * (MAP_RADIUS - 50);
    updated.vx = 0;
    updated.vy = 0;
  }
  
  return updated;
}

// Bot snake utility functions
function createBotSnake(id: string): BotSnake {
  // Spawn bot at random location within map
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * (MAP_RADIUS - 200);
  const x = MAP_CENTER_X + Math.cos(angle) * radius;
  const y = MAP_CENTER_Y + Math.sin(angle) * radius;
  
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'];
  const baseSpeed = 0.9 + Math.random() * 0.4; // Slightly slower than player
  
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
    targetFood: null,
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
  
  // Snake appearance
  color: string;
  
  // Callback for dropping boost food
  onDropFood?: (food: any) => void;
  
  constructor(x: number, y: number, color: string = '#d55400') {
    // Movement properties
    this.head = { x, y };
    this.currentAngle = 0;
    this.turnSpeed = 0.032; // Reduced by 20% (0.04 * 0.8) for smoother turning
    this.baseSpeed = 1.2;
    this.boostMultiplier = 2.0;
    this.speed = this.baseSpeed;
    this.isBoosting = false;
    this.boostCooldown = 0;
    
    // Set snake color
    this.color = color;
    
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
      
      // Lose mass and drop food while boosting (every ~16 frames = 0.75-1 times per second)
      if (this.boostCooldown % 16 === 0) {
        this.totalMass = Math.max(this.MIN_MASS_TO_BOOST, this.totalMass - 0.075); // 3x faster mass drain (0.025 * 3)
        
        // Get tail position for food drop
        let dropX = this.head.x;
        let dropY = this.head.y;
        
        // Drop from the last visible segment (tail) if available
        if (this.visibleSegments.length > 0) {
          const tailSegment = this.visibleSegments[this.visibleSegments.length - 1];
          dropX = tailSegment.x;
          dropY = tailSegment.y;
        } else if (this.segmentTrail.length > 10) {
          // Fallback to trail position if no visible segments
          const tailIndex = Math.min(this.segmentTrail.length - 1, 20);
          dropX = this.segmentTrail[tailIndex].x;
          dropY = this.segmentTrail[tailIndex].y;
        }
        
        // Create small food particle with 10-second expiration
        const boostFood = {
          id: `boost_${Date.now()}_${Math.random()}`,
          x: dropX,
          y: dropY,
          radius: 3, // Slightly larger for better visibility
          mass: 0.025, // Half the previous value
          color: this.color, // Use snake's color
          vx: 0,
          vy: 0,
          wobbleOffset: Math.random() * Math.PI * 2,
          expiresAt: Date.now() + 10000, // Expires after 10 seconds
          isBoostFood: true // Flag to identify boost food for special rendering
        };
        
        // Add to foods array (will need to be passed from game loop)
        this.onDropFood?.(boostFood);
      }
    } else {
      this.speed = this.baseSpeed;
      this.isBoosting = false;
    }
  }
  
  // Food consumption mechanic - grow when eating food
  eatFood(foodMass: number) {
    // Add growth based on food mass consumed
    this.growthRemaining += foodMass;
    console.log(`Snake ate food worth ${foodMass} mass, growth remaining: ${this.growthRemaining}`);
  }
  
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
  
  // Method to completely clear snake when it dies
  clearSnakeOnDeath() {
    this.visibleSegments = []; // Clear all body segments immediately
    this.segmentTrail = []; // Clear trail
    this.totalMass = 0; // Reset mass to 0
    this.money = 0; // Reset snake's money on death
    this.growthRemaining = 0;
    this.partialGrowth = 0;
    this.currentSegmentCount = 0;
    console.log(`💀 SNAKE DEATH: All segments cleared, body completely invisible`);
  }
  
  // Method to get positions along the snake body for dropping money crates
  getSnakeBodyPositions(crateCount: number): Position[] {
    if (this.visibleSegments.length === 0) return [];
    
    const positions: Position[] = [];
    const segmentCount = this.visibleSegments.length;
    
    // Distribute money crates evenly along the snake body
    for (let i = 0; i < crateCount && i < segmentCount; i++) {
      const segmentIndex = Math.floor((i / crateCount) * segmentCount);
      const segment = this.visibleSegments[segmentIndex];
      if (segment) {
        // Add some random offset to spread crates out
        const offsetX = (Math.random() - 0.5) * 20;
        const offsetY = (Math.random() - 0.5) * 20;
        positions.push({
          x: segment.x + offsetX,
          y: segment.y + offsetY
        });
      }
    }
    
    return positions;
  }
}

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setLocation] = useLocation();
  const params = useParams();
  const roomId = params?.roomId || '1'; // Default to room 1 if no room specified
  const region = params?.region || 'us'; // Default to US region if no region specified
  const [mouseDirection, setMouseDirection] = useState<Position>({ x: 1, y: 0 });
  const [myPlayerColor, setMyPlayerColor] = useState<string>('#d55400'); // Default orange
  const [snake] = useState(() => {
    const newSnake = new SmoothSnake(MAP_CENTER_X, MAP_CENTER_Y, '#d55400');
    console.log(`NEW SNAKE CREATED: mass=${newSnake.totalMass}, visibleSegments=${newSnake.visibleSegments.length}, trail=${newSnake.segmentTrail.length}`);
    return newSnake;
  });
  
  // Update snake color when myPlayerColor changes
  useEffect(() => {
    snake.color = myPlayerColor;
  }, [myPlayerColor, snake]);

  // Set up callback for boost food dropping
  useEffect(() => {
    snake.onDropFood = (boostFood: any) => {
      // Add boost food to local food array
      setFoods(currentFoods => [...currentFoods, boostFood]);
      
      // Send boost food to server for broadcasting to other players
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log(`🍕 Sending boost food to server:`, boostFood);
        wsRef.current.send(JSON.stringify({
          type: 'boostFood',
          food: boostFood
        }));
      } else {
        console.log(`⚠️ Cannot send boost food - WebSocket not connected`);
      }
    };
  }, [snake]);
  const [botSnakes, setBotSnakes] = useState<BotSnake[]>([]);
  const [serverBots, setServerBots] = useState<any[]>([]);
  const [serverPlayers, setServerPlayers] = useState<any[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const gameOverRef = useRef(false);
  const [snakeVisible, setSnakeVisible] = useState(true);
  const snakeVisibleRef = useRef(true);
  const [snakeFading, setSnakeFading] = useState(false);
  const snakeFadingRef = useRef(false);
  const [fadeOpacity, setFadeOpacity] = useState(1.0);
  const fadeOpacityRef = useRef(1.0);
  const fadeStartTimeRef = useRef(0);

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
  const [moneyCrateImage, setMoneyCrateImage] = useState<HTMLImageElement | null>(null);
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
  const wsRef = useRef<WebSocket | null>(null);

  // Function to drop money crates when snake dies (1 crate per mass unit)
  const dropMoneyCrates = (playerMoney: number, snakeMass: number) => {
    const crateCount = Math.floor(snakeMass); // 1 crate per mass unit
    
    if (crateCount <= 0) return;
    
    const crateValue = playerMoney / crateCount; // Split money evenly across all crates
    
    console.log(`💰 Dropping ${crateCount} money crates worth $${crateValue.toFixed(3)} each (total: $${playerMoney}, mass: ${snakeMass})`);
    
    // Get positions along the snake body
    const positions = snake.getSnakeBodyPositions(crateCount);
    
    // Create money crates at each position
    const newCrates: Food[] = [];
    for (let i = 0; i < Math.min(crateCount, positions.length); i++) {
      const pos = positions[i];
      const crate: Food = {
        id: `money_crate_${Date.now()}_${i}`,
        x: pos.x,
        y: pos.y,
        radius: 6, // Larger to accommodate image
        mass: 0, // No mass growth, just money
        color: '#ffd700', // Gold color for money
        vx: 0,
        vy: 0,
        wobbleOffset: Math.random() * Math.PI * 2,
        isMoneyCrate: true,
        moneyValue: crateValue
      };
      newCrates.push(crate);
    }
    
    // Add all crates to the foods array
    setFoods(currentFoods => [...currentFoods, ...newCrates]);
    
    // Send money crates to server for broadcasting to other players
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      newCrates.forEach(crate => {
        wsRef.current!.send(JSON.stringify({
          type: 'moneyCrate',
          crate: crate
        }));
      });
    }
  };



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

  // Load money crate image
  useEffect(() => {
    const img = new Image();
    img.src = moneyCrateImageSrc;
    img.onload = () => {
      console.log('Money crate image loaded successfully');
      setMoneyCrateImage(img);
    };
    img.onerror = (e) => {
      console.error('Failed to load money crate image:', e);
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



  // Initialize food system when game starts
  useEffect(() => {
    if (!gameStarted) return;
    
    // Clear any local game state - server provides everything except food (client-side)
    setBotSnakes([]);
    
    // Initialize food particles
    const initialFoods: Food[] = [];
    for (let i = 0; i < FOOD_COUNT; i++) {
      initialFoods.push(createFood(`food_${i}`));
    }
    setFoods(initialFoods);
    
    console.log("Game started - initialized", FOOD_COUNT, "food particles");
  }, [gameStarted]);

  // WebSocket connection for real multiplayer
  useEffect(() => {
    if (!gameStarted) return;

    console.log(`Connecting to multiplayer server room ${roomId}...`);
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const socket = new WebSocket(`${wsProtocol}//${wsHost}/ws?room=${roomId}&region=${region}`);
    
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("Connected to multiplayer server!");
      console.log("WebSocket readyState:", socket.readyState);
      setConnectionStatus('Connected');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'players') {
          // Filter out our own player data and update others
          const filteredPlayers = data.players.filter((p: any) => 
            p.id !== myPlayerId && p.segments.length > 0
          );
          // Use server data directly to avoid position mismatch
          setOtherPlayers(filteredPlayers);
          console.log(`Received ${data.players.length} total players, showing ${filteredPlayers.length} others`);
        } else if (data.type === 'welcome') {
          setMyPlayerId(data.playerId);
          console.log(`My player ID: ${data.playerId} in room ${data.roomId || roomId}`);
        } else if (data.type === 'gameWorld') {
          setServerBots(data.bots || []);
          setServerPlayers(data.players || []);
          // Food is handled client-side, not synced across players
          console.log(`Room ${data.roomId || roomId}: Received shared world: ${data.bots?.length} bots, ${data.players?.length} players, ${foods.length} food`);
          if (data.players && data.players.length > 0) {
            data.players.forEach((player: any, idx: number) => {
              console.log(`Player ${idx}: id=${player.id}, segments=${player.segments?.length || 0}, color=${player.color}`);
            });
          }
          
          // Force immediate re-render for proper snake body display with eyes
          if (canvasRef.current) {
            // Trigger multiple renders to ensure eyes appear immediately
            for (let i = 0; i < 3; i++) {
              window.requestAnimationFrame(() => {
                // Multiple redraws ensure all elements render properly
              });
            }
          }
        } else if (data.type === 'boostFood') {
          // Received boost food from another player - add it to our local food array
          console.log(`🍕 Received boost food from player ${data.playerId}:`, data.food);
          // Ensure the boost food has an expiration time if not already set
          const boostFood = { 
            ...data.food, 
            expiresAt: data.food.expiresAt || (Date.now() + 10000),
            opacity: data.food.opacity || 1.0 // Start with full opacity
          };
          setFoods(currentFoods => {
            console.log(`🍕 Adding boost food to foods array. Current count: ${currentFoods.length}`);
            return [...currentFoods, boostFood];
          });
        } else if (data.type === 'moneyCrate') {
          // Received money crate from another player's death
          console.log(`💰 Received money crate from player ${data.playerId}:`, data.crate);
          setFoods(currentFoods => {
            console.log(`💰 Adding money crate to foods array. Current count: ${currentFoods.length}`);
            return [...currentFoods, data.crate];
          });
        } else if (data.type === 'moneyCrateRemoved') {
          console.log(`💰 CLIENT: Money crate ${data.crateId} was collected by ${data.collectedBy}`);
          // Remove money crate from foods array
          setFoods(currentFoods => {
            const filtered = currentFoods.filter(food => food.id !== data.crateId);
            console.log(`💰 Removed money crate ${data.crateId}. Foods count: ${currentFoods.length} -> ${filtered.length}`);
            return filtered;
          });
        } else if (data.type === 'death') {
          console.log(`💀 CLIENT RECEIVED DEATH MESSAGE: ${data.reason} - crashed into ${data.crashedInto}`);
          // Server detected our collision - instantly return to home screen
          console.log(`💀 SERVER DEATH - Instant return to home`);
          
          // Hide snake first
          snakeVisibleRef.current = false;
          setSnakeVisible(false);
          
          // Instantly return to home screen - no fade, no game over screen
          console.log(`🏠 Instantly returning to home screen after server death`);
          setGameStarted(false);
          setGameOver(false);
          gameOverRef.current = false;
          snakeFadingRef.current = false;
          setSnakeFading(false);
          
          // Navigate back to home page
          window.history.pushState({}, '', '/');
          window.dispatchEvent(new PopStateEvent('popstate'));
          
          // Clear snake data after state updates
          setTimeout(() => {
            snake.visibleSegments = [];
            snake.segmentTrail = [];
            snake.totalMass = 0;
            snake.clearSnakeOnDeath();
          }, 0);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    socket.onclose = (event) => {
      console.log("Disconnected from multiplayer server");
      console.log("Close event:", event.code, event.reason);
      setConnectionStatus('Disconnected');
      wsRef.current = null;
      
      // Auto-reconnect after 2 seconds if not a normal closure
      if (event.code !== 1000 && gameStarted) {
        console.log("Attempting auto-reconnect in 2 seconds...");
        setConnectionStatus('Reconnecting');
        setTimeout(() => {
          if (gameStarted && !wsRef.current) {
            console.log("Auto-reconnecting to multiplayer server...");
            // Create new WebSocket connection
            const newSocket = new WebSocket(`${wsProtocol}//${wsHost}/ws?room=${roomId}`);
            wsRef.current = newSocket;
            
            // Set up handlers for new connection
            newSocket.onopen = () => {
              console.log("Reconnected to multiplayer server!");
              setConnectionStatus('Connected');
            };
            newSocket.onmessage = socket.onmessage;
            newSocket.onclose = socket.onclose;
            newSocket.onerror = socket.onerror;
          }
        }, 2000);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('Connection Error');
    };

    return () => {
      console.log("Cleaning up WebSocket connection...");
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [gameStarted, roomId]); // Include roomId to reconnect when room changes

  // Send player data to server
  useEffect(() => {
    if (!gameStarted || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log(`Not sending updates: gameStarted=${gameStarted}, wsRef=${!!wsRef.current}, readyState=${wsRef.current?.readyState}`);
      return;
    }

    console.log(`Starting position updates - snake has ${snake.visibleSegments.length} segments`);
    
    const sendInterval = setInterval(() => {
      // Stop sending updates immediately if game is over
      if (gameOverRef.current) {
        console.log(`🛑 Stopped sending updates: gameOver=${gameOverRef.current}`);
        return;
      }
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && snake.visibleSegments.length > 0) {
        const updateData = {
          type: 'update',
          segments: snake.visibleSegments.slice(0, 100).map(seg => ({ x: seg.x, y: seg.y })), // Send up to 100 segments max
          color: '#d55400',
          money: snake.money,
          totalMass: snake.totalMass,
          segmentRadius: snake.getSegmentRadius(),
          visibleSegmentCount: snake.visibleSegments.length
        };
        // Reduced logging for performance - only log every 30th update
        if (Date.now() % 2000 < 67) {
          console.log(`Sending update with ${updateData.segments.length} segments to server (snake total visible: ${snake.visibleSegments.length}, mass: ${snake.totalMass.toFixed(1)}, trail: ${snake.segmentTrail.length})`);
        }
        wsRef.current.send(JSON.stringify(updateData));
      } else {
        console.log(`Skipping update: wsReadyState=${wsRef.current?.readyState}, segments=${snake.visibleSegments.length}`);
      }
    }, 67); // Send updates every 67ms (~15 FPS) for better performance

    return () => {
      console.log('Clearing position update interval');
      clearInterval(sendInterval);
    };
  }, [gameStarted, wsRef.current?.readyState, gameOver]);

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
    if (!gameStarted) return; // Don't start game loop until loading is complete
    
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
    
    // Background timer to keep snake moving even when tab is inactive
    let lastUpdateTime = performance.now();
    const backgroundTimer = setInterval(() => {
      if (gameOver || !gameStarted) return;
      
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastUpdateTime) / 1000; // Convert to seconds
      lastUpdateTime = currentTime;
      
      // Move snake based on time elapsed
      const speed = snake.isBoosting ? (snake.baseSpeed * snake.boostMultiplier) : snake.baseSpeed;
      const distance = speed * deltaTime;
      
      // Update snake position
      snake.head.x += Math.cos(snake.currentAngle) * distance;
      snake.head.y += Math.sin(snake.currentAngle) * distance;
      
      // Add trail point for movement
      snake.segmentTrail.unshift({ x: snake.head.x, y: snake.head.y });
      
      // Limit trail length
      const maxTrailLength = Math.floor(snake.totalMass * SEGMENT_SPACING * 2);
      if (snake.segmentTrail.length > maxTrailLength) {
        snake.segmentTrail.length = maxTrailLength;
      }
      
      // Update visible segments
      snake.updateVisibleSegments();
      
      // Send position updates to server if WebSocket is connected
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const updateData = {
          type: 'playerUpdate',
          playerId: myPlayerId,
          x: snake.head.x,
          y: snake.head.y,
          angle: snake.currentAngle,
          segments: snake.visibleSegments.map(seg => ({ x: seg.x, y: seg.y })),
          totalMass: snake.totalMass,
          segmentRadius: snake.getSegmentRadius(),
          isBoosting: snake.isBoosting,
          money: snake.money
        };
        wsRef.current.send(JSON.stringify(updateData));
      }
    }, 16); // ~60 FPS background updates
    
    const gameLoop = () => {
      // Calculate delta time for smooth growth processing
      const currentTime = Date.now();
      const deltaTime = Math.min((currentTime - lastFrameTime) / 1000, 0.05); // Cap at 50ms (20fps minimum)
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

      // Update food physics and check consumption
      const allSnakes = [
        { head: snake.head, totalMass: snake.totalMass },
        ...botSnakes.map(bot => ({ head: bot.head, totalMass: bot.totalMass })),
        ...serverBots.map(bot => ({ head: bot.head, totalMass: bot.totalMass || 10 })),
        ...serverPlayers.map(player => ({ 
          head: player.segments?.[0] || { x: 0, y: 0 }, 
          totalMass: player.totalMass || 10 
        }))
      ].filter(s => s.head.x !== undefined && s.head.y !== undefined);

      // Update food gravitational physics every frame for better responsiveness
      setFoods(currentFoods => {
        // Reduced debug frequency
        if (Math.random() < 0.001) {
          console.log(`🔄 Updating ${currentFoods.length} food particles`);
        }
        
        // Focus only on player snake for attraction (ignore multiplayer snakes for now)
        const playerOnlySnakes = [{ head: snake.head, totalMass: snake.totalMass }];
        
        // Update opacity for boost food and remove expired ones
        const currentTime = Date.now();
        const nonExpiredFoods = currentFoods.filter(food => {
          if (food.expiresAt && currentTime > food.expiresAt) {
            console.log(`🕒 Boost food ${food.id} expired and removed`);
            return false;
          }
          return true;
        }).map(food => {
          // Calculate fading opacity for boost food
          if (food.expiresAt) {
            const timeRemaining = food.expiresAt - currentTime;
            const totalLifetime = 10000; // 10 seconds
            const opacity = Math.max(0.1, timeRemaining / totalLifetime); // Fade from 1.0 to 0.1
            return { ...food, opacity };
          }
          return food;
        });
        
        const updatedFoods = nonExpiredFoods.map(food => 
          updateFoodGravity(food, playerOnlySnakes)
        );
        
        // Check food consumption by player snake only
        const consumedFoodIds: string[] = [];
        for (const food of updatedFoods) {
          const distToSnake = Math.sqrt(
            (food.x - snake.head.x) ** 2 + (food.y - snake.head.y) ** 2
          );
          
          if (distToSnake < FOOD_CONSUMPTION_RADIUS) {
            // Handle different types of food
            if (food.isMoneyCrate && food.moneyValue) {
              // Snake eats money crate - add both money AND mass from dead snake
              snake.money += food.moneyValue;
              const massGain = 0.3; // Same mass gain as regular food particles
              snake.eatFood(massGain);
              console.log(`💰 Collected money crate worth $${food.moneyValue} + ${massGain} mass! Total money: $${snake.money.toFixed(2)}`);
              
              // Notify server about money crate collection for multiplayer sync
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  type: 'moneyCrateCollected',
                  crateId: food.id
                }));
                console.log(`💰 Notified server about collecting money crate ${food.id}`);
              }
            } else {
              // Regular food or boost food - add mass
              snake.eatFood(food.mass);
            }
            consumedFoodIds.push(food.id);
          }
        }
        
        // Remove consumed food and create new ones
        let filteredFoods = updatedFoods.filter(food => !consumedFoodIds.includes(food.id));
        
        // Spawn new food to maintain constant count
        const newFoodCount = FOOD_COUNT - filteredFoods.length;
        for (let i = 0; i < newFoodCount; i++) {
          filteredFoods.push(createFood(`food_${Date.now()}_${i}`));
        }
        
        return filteredFoods;
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
        console.log(`💀 HIT DEATH BARRIER - Instant return to home`);
        // Drop money crates before clearing snake
        dropMoneyCrates(snake.money, snake.totalMass);
        
        // Hide snake first, then clear data
        snakeVisibleRef.current = false;
        setSnakeVisible(false);
        
        // Instantly return to home screen - no fade, no game over screen
        console.log(`🏠 Instantly returning to home screen after hitting barrier`);
        setGameStarted(false);
        setGameOver(false);
        gameOverRef.current = false;
        snakeFadingRef.current = false;
        setSnakeFading(false);
        
        // Navigate back to home page
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
        
        // Clear snake data after state updates
        setTimeout(() => {
          snake.visibleSegments = [];
          snake.segmentTrail = [];
          snake.totalMass = 0;
          snake.clearSnakeOnDeath();
        }, 0);
        
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
        console.log(`💀 HIT BOT SNAKE - Instant return to home`);
        // Drop money crates before clearing snake
        dropMoneyCrates(snake.money, snake.totalMass);
        
        // Hide snake first, then clear data
        snakeVisibleRef.current = false;
        setSnakeVisible(false);
        
        // Instantly return to home screen - no fade, no game over screen
        console.log(`🏠 Instantly returning to home screen after hitting bot`);
        setGameStarted(false);
        setGameOver(false);
        gameOverRef.current = false;
        snakeFadingRef.current = false;
        setSnakeFading(false);
        
        // Navigate back to home page
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
        
        // Clear snake data after state updates
        setTimeout(() => {
          snake.visibleSegments = [];
          snake.segmentTrail = [];
          snake.totalMass = 0;
          snake.clearSnakeOnDeath();
        }, 0);
        
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
          console.log(`💀 HEAD-ON COLLISION WITH BOT - Instant return to home`);
          // Drop money crates before clearing snake
          dropMoneyCrates(snake.money, snake.totalMass);
          
          // Remove the bot
          setBotSnakes(prevBots => prevBots.filter((_, index) => index !== i));
          
          // Spawn a new bot to replace the killed one
          setTimeout(() => {
            setBotSnakes(prevBots => [...prevBots, createBotSnake(`bot_${Date.now()}`)]);
          }, 3000);
          
          // Hide snake first, then clear data
          snakeVisibleRef.current = false;
          setSnakeVisible(false);
          
          // Instantly return to home screen - no fade, no game over screen
          console.log(`🏠 Instantly returning to home screen after head-on collision`);
          setGameStarted(false);
          setGameOver(false);
          gameOverRef.current = false;
          snakeFadingRef.current = false;
          setSnakeFading(false);
          
          // Navigate back to home page
          window.history.pushState({}, '', '/');
          window.dispatchEvent(new PopStateEvent('popstate'));
          
          // Clear snake data after state updates
          setTimeout(() => {
            snake.visibleSegments = [];
            snake.segmentTrail = [];
            snake.totalMass = 0;
            snake.clearSnakeOnDeath();
          }, 0);
          
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
        // Skip collision with dead players (check if they have any meaningful segments)
        if (otherPlayer.isDead || otherPlayer.gameOver) continue;
        // Skip players with very few segments (likely dead/disconnected)
        if (otherPlayer.segments.length < 2) continue;
        
        for (const segment of otherPlayer.segments) {
          const dist = Math.sqrt((snake.head.x - segment.x) ** 2 + (snake.head.y - segment.y) ** 2);
          const collisionRadius = snake.getSegmentRadius() + 10; // Use standard segment radius
          
          if (dist < collisionRadius) {
            // Player died - crash into another snake! Drop money crates first
            console.log(`💀 CRASHED into player ${otherPlayer.id}! (segments: ${otherPlayer.segments.length}) - Instant return to home`);
            
            // Drop money crates BEFORE clearing
            const currentMoney = snake.money || 1.0;
            const currentMass = snake.totalMass || 6;
            console.log(`💰 Dropping money crates: $${currentMoney}, mass: ${currentMass}`);
            dropMoneyCrates(currentMoney, Math.max(currentMass, 1));
            
            // Hide snake first, then clear data
            snakeVisibleRef.current = false;
            setSnakeVisible(false);
            
            // Instantly return to home screen - no fade, no game over screen
            console.log(`🏠 Instantly returning to home screen after death`);
            setGameStarted(false);
            setGameOver(false);
            gameOverRef.current = false;
            snakeFadingRef.current = false;
            setSnakeFading(false);
            
            // Navigate back to home page
            window.history.pushState({}, '', '/');
            window.dispatchEvent(new PopStateEvent('popstate'));
            
            // Clear snake data after state updates
            setTimeout(() => {
              snake.visibleSegments = [];
              snake.segmentTrail = [];
              snake.totalMass = 0;
              snake.clearSnakeOnDeath();
            }, 0);
            
            return; // Stop the game loop
          }
        }
      }

      // Check for collisions with server players' snakes
      for (const serverPlayer of serverPlayers) {
        if (!serverPlayer.segments || serverPlayer.segments.length === 0) continue;
        if (serverPlayer.id === myPlayerId) continue; // Skip self
        // Skip collision with dead players
        if (serverPlayer.isDead || serverPlayer.gameOver) continue;
        // Skip players with very few segments (likely dead/disconnected) 
        if (serverPlayer.segments.length < 2) continue;
        
        for (const segment of serverPlayer.segments) {
          const dist = Math.sqrt((snake.head.x - segment.x) ** 2 + (snake.head.y - segment.y) ** 2);
          const collisionRadius = snake.getSegmentRadius() + (serverPlayer.segmentRadius || 10);
          
          if (dist < collisionRadius) {
            // Player died - crash into another snake!
            console.log(`💀 CRASHED into server player ${serverPlayer.id}! (segments: ${serverPlayer.segments.length}) - Instant return to home`);
            
            // Drop money crates BEFORE clearing
            const currentMoney = snake.money || 1.0;
            const currentMass = snake.totalMass || 6;
            console.log(`💰 Dropping money crates: $${currentMoney}, mass: ${currentMass}`);
            dropMoneyCrates(currentMoney, Math.max(currentMass, 1));
            
            // Hide snake first, then clear data
            snakeVisibleRef.current = false;
            setSnakeVisible(false);
            
            // Instantly return to home screen - no fade, no game over screen
            console.log(`🏠 Instantly returning to home screen after death`);
            setGameStarted(false);
            setGameOver(false);
            gameOverRef.current = false;
            snakeFadingRef.current = false;
            setSnakeFading(false);
            
            // Navigate back to home page
            window.history.pushState({}, '', '/');
            window.dispatchEvent(new PopStateEvent('popstate'));
            
            // Clear snake data after state updates
            setTimeout(() => {
              snake.visibleSegments = [];
              snake.segmentTrail = [];
              snake.totalMass = 0;
              snake.clearSnakeOnDeath();
            }, 0);
            
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

      // Draw food particles as solid circles with attraction indicators
      ctx.save();
      foods.forEach(food => {
        // Only draw food within view distance for performance
        const distanceToCamera = Math.sqrt(
          (food.x - snake.head.x) ** 2 + (food.y - snake.head.y) ** 2
        );
        
        if (distanceToCamera < 800) { // Only render food within 800px of snake
          // Check if food should be attracted to player
          const distanceToPlayer = Math.sqrt(
            (food.x - snake.head.x) ** 2 + (food.y - snake.head.y) ** 2
          );
          const isAttracted = distanceToPlayer < FOOD_ATTRACTION_RADIUS;
          
          // Draw food with glow effect and optional opacity for fading boost food
          ctx.save();
          
          // Apply opacity for boost food fading
          if (food.opacity !== undefined) {
            ctx.globalAlpha = food.opacity;
          }
          
          // Special rendering for money crates with gentle wobbling
          if (food.isMoneyCrate) {
            // Gentle wobbling motion - much slower than boost food
            const wobbleTime = Date.now() * 0.001 + food.wobbleOffset;
            const wobbleX = Math.sin(wobbleTime) * 1.5; // Small horizontal wobble
            const wobbleY = Math.cos(wobbleTime * 0.8) * 1; // Smaller vertical wobble
            
            const drawX = food.x + wobbleX;
            const drawY = food.y + wobbleY;
            
            // Draw the money crate image if loaded (no glow, no pulsing)
            if (moneyCrateImage) {
              const imageSize = food.radius * 2 * 1.5; // 1.5x bigger visually (40% smaller than before)
              ctx.drawImage(
                moneyCrateImage,
                drawX - imageSize / 2,
                drawY - imageSize / 2,
                imageSize,
                imageSize
              );
            } else {
              // Fallback: Draw main money crate (square-ish) with dollar sign - 1.5x bigger
              const visualRadius = food.radius * 1.5;
              ctx.fillStyle = '#ffd700';
              ctx.fillRect(drawX - visualRadius, drawY - visualRadius, visualRadius * 2, visualRadius * 2);
              
              // Add dollar sign in the center - scale font size too
              ctx.fillStyle = '#000000';
              ctx.font = `${visualRadius}px Arial`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('$', drawX, drawY);
            }
          }
          // Special rendering for boost food with pulsing effect
          else if (food.isBoostFood || food.expiresAt) {
            const pulseTime = Date.now() * 0.008;
            const pulseScale = 1 + Math.sin(pulseTime) * 0.3;
            const currentRadius = food.radius * pulseScale;
            
            // Create stronger glowing effect for boost food
            ctx.shadowColor = food.color;
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Draw outer glow ring
            ctx.fillStyle = food.color + '40'; // Semi-transparent
            ctx.beginPath();
            ctx.arc(food.x, food.y, currentRadius * 1.8, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw main food circle with pulse
            ctx.fillStyle = food.color;
            ctx.beginPath();
            ctx.arc(food.x, food.y, currentRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Add bright inner core
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(food.x, food.y, currentRadius * 0.4, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Regular food rendering
            // Create glowing effect with shadow
            ctx.shadowColor = food.color;
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Draw main food circle
            ctx.fillStyle = food.color;
            ctx.beginPath();
            ctx.arc(food.x, food.y, food.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Add inner bright glow for more intensity
            ctx.shadowBlur = 4;
            ctx.fillStyle = food.color;
            ctx.beginPath();
            ctx.arc(food.x, food.y, food.radius * 0.7, 0, Math.PI * 2);
            ctx.fill();
          }
          
          ctx.restore();
        }
      });
      ctx.restore();

      // Draw only OTHER server players (exclude yourself) - limit rendering for performance
      const otherServerPlayers = serverPlayers.filter(player => player.id !== myPlayerId);
      // Only log every 30th frame to reduce console spam
      if (currentTime % 30 === 0) {
        console.log(`Drawing ${otherServerPlayers.length} other players (excluding self)`);
      }
      otherServerPlayers.forEach((serverPlayer, playerIndex) => {
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
          
          // Reduced logging for performance
          if (currentTime % 60 === 0) {
            console.log(`Rendered snake ${serverPlayer.id} with ${segmentsToRender}/${fullSnakeBody.length} exact server segments`);
          }
          
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

      // No fade animation - removed completely

      // Draw your own snake locally using EXACT same rendering as remote players
      // Render if game is active AND visible AND has segments
      const shouldRender = gameStarted && snakeVisibleRef.current && snake.visibleSegments.length > 0;
      
      if (shouldRender) {
        console.log(`✅ RENDERING SNAKE`);
        
        // Save current context
        ctx.save();
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
        
        // Restore opacity
        ctx.restore();
      } else {
        console.log(`🚫 SNAKE HIDDEN - NOT RENDERING (gameStarted=${gameStarted}, visible=${snakeVisibleRef.current}, segments=${snake.visibleSegments.length})`);
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
      clearInterval(backgroundTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mouseDirection, snake, gameOver, canvasSize, score, hiddenAt, gameStarted]);

  const resetGame = () => {
    setGameOver(false);
    gameOverRef.current = false;
    setSnakeVisible(true);
    snakeVisibleRef.current = true;
    setSnakeFading(false);
    snakeFadingRef.current = false;
    setFadeOpacity(1.0);
    fadeOpacityRef.current = 1.0;
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
            Players: {serverPlayers.length}
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