interface Position {
  x: number;
  y: number;
}

export class SmoothSnake {
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
    this.START_MASS = 6; // Start with exactly 6 segments for consistent multiplayer
    this.MASS_PER_SEGMENT = 1;
    this.SEGMENT_SPACING = 10; // Heavy overlap (radius=10, so 10px overlap for maximum density)
    this.SEGMENT_RADIUS = 10;
    this.MIN_MASS_TO_BOOST = 4;
    
    // Initialize trail and segments with longer starting trail
    this.segmentTrail = [];
    // Create initial trail going backwards from start position
    for (let i = 0; i < 30; i++) {
      this.segmentTrail.push({ 
        x: x - i * this.SEGMENT_SPACING * 0.8, 
        y: y 
      });
    }
    this.visibleSegments = [];
    this.totalMass = this.START_MASS;
    this.growthRemaining = 0;
    this.partialGrowth = 0; // Initialize partialGrowth for faster mass conversion
    this.distanceBuffer = 0;
    this.currentSegmentCount = this.START_MASS; // Start with exactly START_MASS segments
    console.log(`NEW SNAKE CREATED: mass=${this.totalMass}, visibleSegments=${this.visibleSegments.length}, trail=${this.segmentTrail.length}`);
    
    // Initialize money
    this.money = 1.00;
    
    // Force immediate segment generation
    console.log(`Before updateVisibleSegments: currentSegmentCount=${this.currentSegmentCount}`);
    this.updateVisibleSegments();
    console.log(`After updateVisibleSegments: visibleSegments=${this.visibleSegments.length}`);
    
    this.updateVisibleSegments();
    console.log(`After updateVisibleSegments: visibleSegments.length=${this.visibleSegments.length}`);
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
      while (distanceSoFar + dynamicSpacing <= (distanceSoFar + segmentDist) && 
             this.visibleSegments.length < totalSegmentsToPlace && 
             this.visibleSegments.length < MAX_SEGMENTS &&
             segmentIndex < MAX_SEGMENTS) {
        
        const progress = distanceSoFar / (distanceSoFar + segmentDist);
        const segmentX = a.x + (b.x - a.x) * progress;
        const segmentY = a.y + (b.y - a.y) * progress;
        
        // Determine opacity for this segment
        let opacity = 1.0;
        if (segmentIndex >= solidSegmentCount) {
          // This is the fading segment
          opacity = fadeAmount;
        }
        
        this.visibleSegments.push({ x: segmentX, y: segmentY, opacity });
        
        distanceSoFar += dynamicSpacing;
        segmentIndex++;
      }
      
      distanceSoFar += segmentDist;
    }
  }
  
  move(directionX: number, directionY: number) {
    // Handle turn multiplier when boosting
    const dynamicTurnSpeed = this.isBoosting ? this.turnSpeed * 2 : this.turnSpeed;
    
    // Calculate target angle towards mouse direction
    const targetAngle = Math.atan2(directionY, directionX);
    
    // Smoothly interpolate current angle towards target
    let angleDiff = targetAngle - this.currentAngle;
    
    // Normalize angle difference to [-π, π]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    // Apply turning
    this.currentAngle += angleDiff * dynamicTurnSpeed;
    
    // Normalize current angle
    while (this.currentAngle > Math.PI) this.currentAngle -= 2 * Math.PI;
    while (this.currentAngle < -Math.PI) this.currentAngle += 2 * Math.PI;
    
    // Handle boosting mechanics
    if (this.isBoosting && this.totalMass > this.MIN_MASS_TO_BOOST && this.boostCooldown <= 0) {
      this.speed = this.baseSpeed * this.boostMultiplier;
      this.boostCooldown++;
      
      // Sprint mechanics without food drops
      if (this.boostCooldown % 10 === 0) {
        this.totalMass -= 0.25; // Reduce mass when boosting
      }
      
      // Lose mass when boosting
      this.totalMass = Math.max(this.MIN_MASS_TO_BOOST, this.totalMass - 0.08);
    } else {
      this.speed = this.baseSpeed;
      this.isBoosting = false; // Stop boosting if not enough mass
    }
    
    // Update boost cooldown
    if (this.boostCooldown > 0) {
      this.boostCooldown--;
    }
    
    // Calculate new head position
    this.head.x += Math.cos(this.currentAngle) * this.speed;
    this.head.y += Math.sin(this.currentAngle) * this.speed;
    
    // Add new trail point
    this.segmentTrail.unshift({ x: this.head.x, y: this.head.y });
    
    // Keep trail at reasonable length (increased for longer trails)
    if (this.segmentTrail.length > 2000) {
      this.segmentTrail = this.segmentTrail.slice(0, 1500);
    }
    
    this.updateVisibleSegments();
  }
  
  setBoost(boosting: boolean) {
    if (boosting && this.totalMass > this.MIN_MASS_TO_BOOST && this.boostCooldown <= 0) {
      this.isBoosting = true;
    } else {
      this.isBoosting = false;
    }
  }
  
  grow(mass: number) {
    // Cap mass growth at 100 - no strength increase beyond this point
    const MAX_MASS = 100;
    
    if (this.totalMass >= MAX_MASS) {
      return; // No growth if already at max mass
    }
    
    const actualMassToAdd = Math.min(mass, MAX_MASS - this.totalMass);
    if (actualMassToAdd > 0) {
      this.totalMass += actualMassToAdd;
      this.growthRemaining += actualMassToAdd;
    }
  }
  
  getScaleFactor(): number {
    return Math.min(1 + (this.totalMass - this.START_MASS) / 100, 3);
  }

  getSegmentRadius(): number {
    const baseRadius = 8;
    const maxScale = 5;
    // Cap width scaling at 100 segments, not mass
    const MAX_SEGMENTS = 100;
    const currentSegments = Math.min(this.visibleSegments.length, MAX_SEGMENTS);
    const scaleFactor = Math.min(1 + (currentSegments - 10) / 100, maxScale);
    return baseRadius * scaleFactor;
  }
  
  addMoney(amount: number) {
    this.money += amount;
  }
  
  reset(x: number, y: number) {
    this.head = { x, y };
    this.currentAngle = 0;
    this.speed = this.baseSpeed;
    this.isBoosting = false;
    this.boostCooldown = 0;
    this.segmentTrail = [{ x, y }];
    this.visibleSegments = [];
    this.totalMass = this.START_MASS;
    this.growthRemaining = 0;
    this.partialGrowth = 0;
    this.distanceBuffer = 0;
    this.currentSegmentCount = this.START_MASS;
    this.money = 1.00;
    this.updateVisibleSegments();
  }
}