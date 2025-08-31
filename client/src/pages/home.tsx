import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useGame } from "@/contexts/game-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Wallet } from "@/components/ui/wallet";
import FriendsModal from "@/components/FriendsModal";
import LoginModal from "@/components/LoginModal";
import BalanceWarningModal from "@/components/BalanceWarningModal";
import DailyRewardModal from "@/components/DailyRewardModal";
import TopUpModal from "@/components/TopUpModal";
import WithdrawModal from "@/components/WithdrawModal";

import { fullUrl } from "@/lib/queryClient";
import { 
  Settings, 
  Volume2, 
  LogOut, 
  Edit3, 
  Wallet as WalletIcon,
  Users,
  Gift,
  Trophy,
  X
} from "lucide-react";

// Decorative snake for background animation
class DecorativeSnake {
  head: { x: number; y: number };
  currentAngle: number;
  segmentTrail: Array<{ x: number; y: number }>;
  speed: number;
  turnSpeed: number;
  targetAngle: number;
  nextTurnTime: number;
  visibleSegments: Array<{ x: number; y: number }>;
  
  constructor(x: number, y: number) {
    this.head = { x, y };
    this.currentAngle = Math.random() * Math.PI * 2;
    this.segmentTrail = [{ x, y }];
    this.speed = 0.5;
    this.turnSpeed = 0.02;
    this.targetAngle = this.currentAngle;
    this.nextTurnTime = Date.now() + 2000;
    this.visibleSegments = [];
    
    // Create initial trail points for smooth following
    for (let i = 0; i < 100; i++) {
      this.segmentTrail.push({
        x: x - Math.cos(this.currentAngle) * i * 2,
        y: y - Math.sin(this.currentAngle) * i * 2
      });
    }
    
    this.updateVisibleSegments();
  }
  
  updateVisibleSegments() {
    this.visibleSegments = [];
    const segmentCount = 12;
    const segmentSpacing = 18; // Increased to 18 for proper spacing like in-game snakes
    
    for (let i = 0; i < segmentCount; i++) {
      const trailIndex = Math.floor(i * segmentSpacing);
      if (trailIndex < this.segmentTrail.length) {
        this.visibleSegments.push(this.segmentTrail[trailIndex]);
      }
    }
  }
  
  update(canvasWidth: number, canvasHeight: number, foods: Array<{ x: number; y: number; wobbleX: number; wobbleY: number }>) {
    const currentTime = Date.now();
    
    // Random direction changes
    if (currentTime > this.nextTurnTime) {
      this.targetAngle = Math.random() * Math.PI * 2;
      this.nextTurnTime = currentTime + 1000 + Math.random() * 3000;
    }
    
    // Look for nearby food
    const nearbyFood = foods.find(food => {
      const distance = Math.sqrt((food.x - this.head.x) ** 2 + (food.y - this.head.y) ** 2);
      return distance < 100;
    });
    
    if (nearbyFood) {
      this.targetAngle = Math.atan2(nearbyFood.y - this.head.y, nearbyFood.x - this.head.x);
    }
    
    // Smooth angle interpolation
    let angleDiff = this.targetAngle - this.currentAngle;
    if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.currentAngle += angleDiff * this.turnSpeed;
    
    // Move forward
    this.head.x += Math.cos(this.currentAngle) * this.speed;
    this.head.y += Math.sin(this.currentAngle) * this.speed;
    
    // Wrap around screen edges
    if (this.head.x < 0) this.head.x = canvasWidth;
    if (this.head.x > canvasWidth) this.head.x = 0;
    if (this.head.y < 0) this.head.y = canvasHeight;
    if (this.head.y > canvasHeight) this.head.y = 0;
    
    // Add new trail point
    this.segmentTrail.unshift({ x: this.head.x, y: this.head.y });
    
    // Keep trail length manageable
    if (this.segmentTrail.length > 300) {
      this.segmentTrail.pop();
    }
    
    this.updateVisibleSegments();
  }
  
  draw(ctx: CanvasRenderingContext2D) {
    // Draw snake segments exactly like the multiplayer game
    ctx.save();
    
    // Add subtle drop shadow (not boosting)
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    const segmentRadius = 10;
    ctx.fillStyle = '#d55400'; // Orange snake color
    
    // Draw all segments with shadow
    for (let i = this.visibleSegments.length - 1; i >= 0; i--) {
      const segment = this.visibleSegments[i];
      ctx.beginPath();
      ctx.arc(segment.x, segment.y, segmentRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
    
    // Draw rotated square eyes exactly like multiplayer game
    if (this.visibleSegments.length > 0) {
      const head = this.visibleSegments[0];
      const eyeDistance = 5;
      const eyeSize = 3;
      const pupilSize = 1.5;
      
      // Eye positions perpendicular to movement direction
      const eye1X = head.x + Math.cos(this.currentAngle + Math.PI/2) * eyeDistance;
      const eye1Y = head.y + Math.sin(this.currentAngle + Math.PI/2) * eyeDistance;
      const eye2X = head.x + Math.cos(this.currentAngle - Math.PI/2) * eyeDistance;
      const eye2Y = head.y + Math.sin(this.currentAngle - Math.PI/2) * eyeDistance;
      
      // Draw first eye with rotation (exact copy from multiplayer)
      ctx.save();
      ctx.translate(eye1X, eye1Y);
      ctx.rotate(this.currentAngle);
      ctx.fillStyle = 'white';
      ctx.fillRect(-eyeSize, -eyeSize, eyeSize * 2, eyeSize * 2);
      
      // Draw first pupil looking forward
      const pupilOffset = 1.2;
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
      ctx.rotate(this.currentAngle);
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
  
  eatFood(foods: Array<{ x: number; y: number; wobbleX: number; wobbleY: number }>) {
    return foods.filter(food => {
      const distance = Math.sqrt((food.x - this.head.x) ** 2 + (food.y - this.head.y) ** 2);
      if (distance < 15) {
        // Grow snake by extending trail
        for (let i = 0; i < 20; i++) {
          const lastSegment = this.segmentTrail[this.segmentTrail.length - 1];
          this.segmentTrail.push({ x: lastSegment.x, y: lastSegment.y });
        }
        this.updateVisibleSegments();
        return false; // Remove this food
      }
      return true; // Keep this food
    });
  }
}

export default function Home() {
  const { user, login, register, logout, updateUser, updateUsername, placeBet, winBet, loseBet } = useAuth();
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Local state for bet management
  const [selectedBetAmount, setSelectedBetAmount] = useState(1);
  const [customBetAmount, setCustomBetAmount] = useState("");
  const [isCustomBet, setIsCustomBet] = useState(false);
  
  const { setCurrentBetAmount, onGameWin, onGameLoss } = useGame();
  const { toast } = useToast();

  // Decorative snake animation state
  const [decorativeSnake, setDecorativeSnake] = useState<DecorativeSnake | null>(null);
  const [foods, setFoods] = useState<Array<{ x: number; y: number }>>([]);

  // Animated player count effect - fluctuates realistically
  useEffect(() => {
    let currentCount = 150;
    let upCount = 0; // Track consecutive ups to implement up-up-down pattern
    let hasReached600Today = false;
    
    const interval = setInterval(() => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const timeToday = now.getTime() - todayStart.getTime();
      const dayProgress = timeToday / (24 * 60 * 60 * 1000); // 0-1 through the day
      
      // Reset 600 flag at midnight
      if (dayProgress < 0.01) {
        hasReached600Today = false;
      }
      
      // Determine direction based on pattern and daily goal
      let shouldGoUp = false;
      
      if (!hasReached600Today && dayProgress > 0.8 && Math.random() < 0.3) {
        // Late in day, chance to reach 600
        shouldGoUp = currentCount < 600;
        if (currentCount >= 600) hasReached600Today = true;
      } else if (upCount < 2) {
        // Up twice pattern
        shouldGoUp = Math.random() < 0.7;
        if (shouldGoUp) upCount++;
      } else {
        // Down once after two ups
        shouldGoUp = false;
        upCount = 0;
      }
      
      // Apply bounds
      if (currentCount <= 150) shouldGoUp = true;
      if (currentCount >= 600 && hasReached600Today) shouldGoUp = false;
      
      // Update count
      if (shouldGoUp) {
        currentCount += Math.floor(Math.random() * 3) + 1; // 1-3 increase
      } else {
        currentCount -= Math.floor(Math.random() * 2) + 1; // 1-2 decrease
      }
      
      // Ensure bounds
      currentCount = Math.max(150, Math.min(600, currentCount));
      setAnimatedPlayerCount(currentCount);
    }, 3000 + Math.random() * 4000); // 3-7 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  // Daily winnings counter - $1 per second, 20k-30k target
  useEffect(() => {
    const updateWinnings = () => {
      const now = new Date();
      const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const todayStart = new Date(easternTime.getFullYear(), easternTime.getMonth(), easternTime.getDate());
      const timeToday = easternTime.getTime() - todayStart.getTime();
      const secondsToday = Math.floor(timeToday / 1000);
      
      // Random daily target between 20k-30k
      const seed = todayStart.getTime();
      const dailyTarget = 20000 + (Math.sin(seed) * 0.5 + 0.5) * 10000;
      
      // $1 per second, but cap at daily target
      const currentWinnings = Math.min(secondsToday, Math.floor(dailyTarget));
      setDailyWinnings(currentWinnings);
    };
    
    updateWinnings();
    const interval = setInterval(updateWinnings, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, []);

  // State variables
  const [animatedPlayerCount, setAnimatedPlayerCount] = useState(150);
  const [dailyWinnings, setDailyWinnings] = useState(0);
  
  // Celebration popup state
  const [showCelebration, setShowCelebration] = useState(false);
  const [cashOutAmount, setCashOutAmount] = useState(0);
  
  // Game over popup state
  const [showGameOver, setShowGameOver] = useState(false);
  const [gameOverData, setGameOverData] = useState({ finalMass: 0, timeAlive: 0 });

  // Check for celebration data from localStorage (set by cash-out completion)
  useEffect(() => {
    const celebrationData = localStorage.getItem('cashOutCelebration');
    if (celebrationData) {
      const { amount } = JSON.parse(celebrationData);
      setCashOutAmount(amount);
      setShowCelebration(true);
      localStorage.removeItem('cashOutCelebration'); // Clean up
    }
    
    // Check for game over data from localStorage (set by death)
    const gameOverData = localStorage.getItem('gameOverData');
    if (gameOverData) {
      const data = JSON.parse(gameOverData);
      setGameOverData(data);
      setShowGameOver(true);
      localStorage.removeItem('gameOverData'); // Clean up
    }
  }, []);



  // Region selection state
  const [selectedRegion, setSelectedRegion] = useState<'us' | 'eu' | null>(null);
  const [isDetectingRegion, setIsDetectingRegion] = useState(false);
  
  // Friends modal state
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  
  // Login modal state
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  
  // Balance warning modal state
  const [isBalanceWarningOpen, setIsBalanceWarningOpen] = useState(false);
  
  // Daily reward modal state
  const [isDailyRewardOpen, setIsDailyRewardOpen] = useState(false);
  
  // Wallet modal states
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  // Username editing states
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  // Start game handler with automatic random region selection
  const handleStartGameWithRegion = async (region: string) => {
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }

    const betAmount = getEffectiveBetAmount();
    
    if (user.balance < betAmount) {
      setIsBalanceWarningOpen(true);
      return;
    }

    try {
      // Place the bet first
      await placeBet(betAmount);
      
      // Set the bet amount in game context
      setCurrentBetAmount(betAmount);
      
      // Set the win/loss handlers that will be called by the game
      // We'll use a different approach - pass these as URL parameters
      const gameParams = new URLSearchParams({
        region,
        betAmount: betAmount.toString(),
        userId: user.id
      });

      toast({
        title: "Bet placed!",
        description: `$${betAmount} moved to hold wallet. Good luck!`,
      });

      // Navigate to game with parameters
      setLocation(`/game?${gameParams.toString()}`);
    } catch (error) {
      console.error('Failed to place bet:', error);
      toast({
        title: "Bet failed",
        description: "Could not place bet. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle daily crate claim
  const handleClaimDailyCrate = async () => {
    if (!user) return;

    try {
      const response = await fetch(fullUrl(`/api/users/${user.id}/claim-daily-crate`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      if (!response.ok) {
        throw new Error('Failed to claim daily crate');
      }
      
      const crate = await response.json();
      
      const reward = parseFloat(crate.reward);
      const newBalance = user.balance + reward;
      updateUser({ balance: newBalance });

      toast({
        title: "Daily Crate Claimed!",
        description: `You received $${reward.toFixed(2)}!`,
      });
    } catch (error) {
      toast({
        title: "Crate Already Claimed",
        description: "You've already claimed your daily crate today.",
        variant: "destructive",
      });
    }
  };

  // Check if daily reward is available
  const canClaimDailyReward = () => {
    if (!user || !user.lastDailyRewardClaim) return true;
    
    const lastClaim = new Date(user.lastDailyRewardClaim);
    const now = new Date();
    const hoursSinceLastClaim = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceLastClaim >= 24;
  };

  // Get hours until next reward is available
  const getHoursUntilNextReward = () => {
    if (!user || !user.lastDailyRewardClaim || canClaimDailyReward()) return 0;
    
    const lastClaim = new Date(user.lastDailyRewardClaim);
    const now = new Date();
    const hoursSinceLastClaim = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);
    
    return Math.ceil(24 - hoursSinceLastClaim);
  };

  // Handle daily reward claim
  const handleClaimDailyReward = async () => {
    if (!user) return;

    try {
      const response = await fetch(fullUrl('/api/auth/claim-daily-reward'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: user.username }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to claim daily reward');
      }
      
      const data = await response.json();
      
      if (data.user) {
        updateUser(data.user);
      }

      toast({
        title: "Daily Reward Claimed!",
        description: data.message || "You received $0.20 (100% bonus included)!",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to claim daily reward.";
      toast({
        title: "Reward Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Handle top-up completion
  const handleTopUpComplete = (amount: number) => {
    if (!user) return;
    
    const updatedUser = {
      ...user,
      balance: Number(user.balance) + amount
    };
    
    updateUser(updatedUser);
  };

  // Handle withdrawal completion
  const handleWithdrawComplete = (amount: number) => {
    if (!user) return;
    
    const updatedUser = {
      ...user,
      balance: Number(user.balance) - amount
    };
    
    updateUser(updatedUser);
  };

  // Handle username editing
  const handleStartEditUsername = () => {
    if (user) {
      setNewUsername(user.username);
      setIsEditingUsername(true);
    }
  };

  const handleSaveUsername = async () => {
    if (!user || !newUsername.trim()) return;
    
    try {
      await updateUsername(newUsername.trim());
      setIsEditingUsername(false);
      toast({
        title: "Username Updated!",
        description: `Your username has been changed to "${newUsername.trim()}"`,
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update username",
        variant: "destructive",
      });
    }
  };

  const handleCancelEditUsername = () => {
    setIsEditingUsername(false);
    setNewUsername('');
  };

  // Get effective bet amount (only $1 for now)
  const getEffectiveBetAmount = () => {
    // For now, only allow $1 bets
    return 1;
  };

  // Handle game win - move hold balance + winnings to main balance
  const handleGameWin = async (score: number, timeAlive: number) => {
    if (!user) return;
    
    const betAmount = getEffectiveBetAmount();
    
    // Calculate winnings based on score/time (simple formula for now)
    // Minimum 0.5x, maximum 5x multiplier based on performance
    const baseMultiplier = 0.5;
    const scoreMultiplier = Math.min(score / 1000, 4.5); // Max 4.5x from score
    const totalMultiplier = baseMultiplier + scoreMultiplier;
    const winnings = betAmount * totalMultiplier;
    
    try {
      await winBet(betAmount, winnings);
      
      toast({
        title: "🎉 You Won!",
        description: `${totalMultiplier.toFixed(2)}x multiplier! Won $${winnings.toFixed(2)} + bet back!`,
      });
    } catch (error) {
      console.error('Failed to process win:', error);
      toast({
        title: "Win Processing Error",
        description: "Your win couldn't be processed. Contact support.",
        variant: "destructive",
      });
    }
  };

  // Handle game loss - remove money from hold balance
  const handleGameLoss = async () => {
    if (!user) return;
    
    const betAmount = getEffectiveBetAmount();
    
    try {
      await loseBet(betAmount);
      
      toast({
        title: "💀 Game Over",
        description: `Lost $${betAmount.toFixed(2)} bet. Better luck next time!`,
        variant: "destructive",
      });
    } catch (error) {
      console.error('Failed to process loss:', error);
      toast({
        title: "Loss Processing Error",
        description: "Your loss couldn't be processed. Contact support.",
        variant: "destructive",
      });
    }
  };

  // Mouse controls are now handled in the SnakeGame component

  // Skip authentication for now - show homepage directly

  // Initialize decorative snake and food
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Create snake at random position
    const snake = new DecorativeSnake(
      Math.random() * canvas.width,
      Math.random() * canvas.height
    );
    setDecorativeSnake(snake);
    
    // Create initial food with wobble properties
    let currentFoods: Array<{ x: number; y: number; wobbleX: number; wobbleY: number }> = [];
    for (let i = 0; i < 20; i++) {
      currentFoods.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        wobbleX: Math.random() * Math.PI * 2,
        wobbleY: Math.random() * Math.PI * 2
      });
    }
    setFoods(currentFoods);
    
    // Animation loop
    const animate = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx || !snake) return;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update snake
      snake.update(canvas.width, canvas.height, currentFoods);
      
      // Check for food consumption
      currentFoods = snake.eatFood(currentFoods);
      
      // Update food wobble and attraction
      const time = Date.now() * 0.003;
      currentFoods.forEach(food => {
        // Update wobble - 50% slower
        food.wobbleX += 0.025;
        food.wobbleY += 0.015;
        
        // Check distance to snake
        const distanceToSnake = Math.sqrt((food.x - snake.head.x) ** 2 + (food.y - snake.head.y) ** 2);
        
        // Move towards snake if close (6x stronger gravitational pull)
        if (distanceToSnake < 80) {
          const attraction = 1.8; // Increased from 0.9 to 1.8 (2x stronger than before, 6x stronger than original)
          const angle = Math.atan2(snake.head.y - food.y, snake.head.x - food.x);
          food.x += Math.cos(angle) * attraction;
          food.y += Math.sin(angle) * attraction;
        }
      });
      
      // Add new food if some were eaten
      while (currentFoods.length < 20) {
        currentFoods.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          wobbleX: Math.random() * Math.PI * 2,
          wobbleY: Math.random() * Math.PI * 2
        });
      }
      
      // Draw food with wobble and glow effect
      currentFoods.forEach(food => {
        // Calculate wobble position
        const wobbleStrength = 2;
        const wobbleX = Math.sin(food.wobbleX) * wobbleStrength;
        const wobbleY = Math.cos(food.wobbleY) * wobbleStrength;
        const displayX = food.x + wobbleX;
        const displayY = food.y + wobbleY;
        
        // Create subtle glow effect
        const glowGradient = ctx.createRadialGradient(
          displayX, displayY, 0,
          displayX, displayY, 8
        );
        glowGradient.addColorStop(0, '#53d493');
        glowGradient.addColorStop(0.5, 'rgba(83, 212, 147, 0.4)');
        glowGradient.addColorStop(1, 'rgba(83, 212, 147, 0)');
        
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(displayX, displayY, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw solid food center
        ctx.fillStyle = '#53d493';
        ctx.beginPath();
        ctx.arc(displayX, displayY, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      
      // Draw snake
      snake.draw(ctx);
      
      requestAnimationFrame(animate);
    };
    
    animate();
    
    // Handle window resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-retro relative overflow-hidden" style={{backgroundColor: '#15161b'}}>
      {/* Background canvas for decorative snake */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
      />
      
      {/* Content wrapper with higher z-index */}
      <div className="relative" style={{ zIndex: 10 }}>
        {/* Top Bar - Welcome with gaming controller icon */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center">
          <span className="text-white text-lg">Welcome, </span>
          {isEditingUsername ? (
            <div className="flex items-center gap-2">
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="text-lg font-bold bg-gray-800 border-green-500 text-white font-retro px-2 py-1 h-8 w-32"
                placeholder="Enter username"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveUsername();
                  } else if (e.key === 'Escape') {
                    handleCancelEditUsername();
                  }
                }}
                autoFocus
              />
              <button
                onClick={handleSaveUsername}
                className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 text-xs border border-green-500 font-retro"
              >
                ✓
              </button>
              <button
                onClick={handleCancelEditUsername}
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 text-xs border border-red-500 font-retro"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold" style={{color: '#53d493'}}>
                {user ? user.username : 'Guest'}
              </span>
              {user && (
                <button
                  onClick={handleStartEditUsername}
                  className="text-gray-400 hover:text-green-400 transition-colors p-1"
                  title="Edit username"
                >
                  <Edit3 size={16} />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex flex-col gap-2">
              <button 
                onClick={async () => {
                  try {
                    await logout();
                    toast({
                      title: "See You Later!",
                      description: "Successfully logged out from PumpGames.Fun",
                    });
                  } catch (error) {
                    toast({
                      title: "Logout Error",
                      description: "Failed to logout properly, but you've been logged out locally.",
                      variant: "destructive",
                    });
                  }
                }}
                className="bg-red-600 text-white px-3 py-1 text-sm hover:bg-red-700 border-2 border-red-500 font-retro"
              >
                Logout
              </button>
              <button 
                onClick={() => setIsDailyRewardOpen(true)}
                disabled={!canClaimDailyReward()}
                className={`px-3 py-1 text-sm border-2 font-retro flex items-center gap-1 ${
                  canClaimDailyReward() 
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700 border-yellow-500' 
                    : 'bg-gray-600 text-gray-300 border-gray-500 cursor-not-allowed'
                }`}
              >
                <Gift className="w-4 h-4" />
                {canClaimDailyReward() 
                  ? 'Daily Reward' 
                  : `${getHoursUntilNextReward()}h left`
                }
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsLoginModalOpen(true)}
              className="bg-green-600 text-white px-3 py-1 text-sm hover:bg-green-700 border-2 border-green-500 font-retro"
            >
              Login
            </button>
          )}
        </div>
      </div>

      {/* Main Content Container */}
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <div className="w-full max-w-4xl px-4">
          
          {/* Title Section */}
          <div className="text-center mb-8">
            <h1 className="text-white text-4xl font-bold mb-2 font-retro tracking-wider">
              PumpGames<span style={{color: '#53d493'}}>.fun</span>
            </h1>
            <p className="text-gray-300 text-lg font-retro">Play,Earn,Have Fun!</p>
          </div>

          {/* Main Game Area - Three Column Layout */}
          <div className="grid grid-cols-3 gap-6 max-w-5xl mx-auto">
            
            {/* Left Panel - Leaderboard */}
            <div className="bg-gray-800 p-3 border-2 border-gray-600 flex flex-col self-start">
              <h3 className="text-yellow-400 text-sm mb-2 font-retro flex items-center">
                🏆 Leaderboard
              </h3>
              <div className="text-white text-xs space-y-1 font-retro mb-3">
                <div className="flex justify-between items-center">
                  <span className="truncate">1. TokyOnTop</span>
                  <span style={{color: '#53d493'}}>${1600}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="truncate">2. Sergio_Jew</span>
                  <span style={{color: '#53d493'}}>${1255}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="truncate">3. 1$_to_1k</span>
                  <span style={{color: '#53d493'}}>${964}</span>
                </div>
              </div>
              <button className="bg-gray-700 text-white px-2 py-1 text-sm border-2 border-gray-600 hover:bg-gray-600 font-retro w-full">
                View Full Board
              </button>
            </div>

            {/* Center Panel - Game Controls */}
            <div className="bg-gray-800 p-3 border-2 border-gray-600">
              
              {/* Username with edit icon */}
              <div className="flex items-center justify-between mb-3 bg-gray-700 px-3 py-2 border-2 border-gray-600">
                <span className="text-gray-300 font-retro text-xs">〈Username〉</span>
                <Edit3 className="w-3 h-3 text-gray-400 hover:text-white cursor-pointer" />
              </div>
              
              {/* Bet Amount Selection */}
              <div className="mb-2">
                <p className="text-green-400 text-xs font-retro text-center">
                  🎯 Only $1 bets available for now
                </p>
              </div>
              <div className="grid grid-cols-3 gap-1 mb-3">
                <button 
                  onClick={() => {
                    setSelectedBetAmount(1);
                    setIsCustomBet(false);
                  }}
                  className={`py-2 px-3 text-sm border-2 font-retro ${
                    selectedBetAmount === 1 && !isCustomBet
                      ? 'text-white border-2' 
                      : 'bg-gray-700 text-white border-gray-600 hover:bg-gray-600'
                  }`}
                  style={selectedBetAmount === 1 && !isCustomBet ? {backgroundColor: '#53d493', borderColor: '#53d493'} : {}}
                >
                  $1
                </button>
                <button 
                  disabled
                  className="py-2 px-3 text-sm border-2 font-retro bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed relative group"
                  title="Coming Soon"
                >
                  <div className="flex items-center justify-center">
                    <span className="text-gray-500">$5</span>
                    <svg className="w-4 h-4 ml-1 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="absolute inset-0 bg-gray-800 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                </button>
                <button 
                  disabled
                  className="py-2 px-3 text-sm border-2 font-retro bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed relative group"
                  title="Coming Soon"
                >
                  <div className="flex items-center justify-center">
                    <span className="text-gray-500">$20</span>
                    <svg className="w-4 h-4 ml-1 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="absolute inset-0 bg-gray-800 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                </button>
              </div>
              
              {/* Custom Bet Amount - Disabled for now */}
              <div className="mb-3">
                <div className="flex gap-1">
                  <button 
                    disabled
                    className="py-2 px-3 text-sm border-2 font-retro flex-shrink-0 bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed relative group"
                    title="Coming Soon"
                  >
                    <div className="flex items-center justify-center">
                      <span className="text-gray-500">Custom</span>
                      <svg className="w-4 h-4 ml-1 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="absolute inset-0 bg-gray-800 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                  </button>
                  <Input
                    disabled
                    type="number"
                    value=""
                    placeholder="Coming Soon"
                    className="px-2 py-2 bg-gray-800 border-2 border-gray-700 text-gray-500 font-retro text-sm flex-1 cursor-not-allowed [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                  />
                </div>
                <p className="text-gray-500 text-xs mt-1 font-retro">
                  Only $1 bets available for now
                </p>
              </div>
              
              {/* Auto Region and Friends */}
              <div className="mb-3">
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => {
                      if (user) {
                        handleStartGameWithRegion('us');
                      } else {
                        setIsLoginModalOpen(true);
                      }
                    }}
                    className={`py-2 px-2 text-xs border-2 font-retro transition-colors flex flex-col items-center justify-center ${
                      user 
                        ? 'border-gray-600 hover:bg-gray-600' 
                        : 'border-gray-700 cursor-not-allowed opacity-60'
                    }`}
                    style={{
                      backgroundColor: user ? '#53d493' : '#666', 
                      borderColor: user ? '#53d493' : '#666', 
                      color: 'white'
                    }}
                    disabled={isDetectingRegion || !user}
                  >
                    <span className="text-sm">🌍</span>
                    <span>{user ? 'Auto' : 'Login Required'}</span>
                  </button>
                  <button 
                    onClick={() => {
                      if (user) {
                        setIsFriendsModalOpen(true);
                      } else {
                        setIsLoginModalOpen(true);
                      }
                    }}
                    className={`py-2 px-2 text-xs border-2 font-retro transition-colors flex flex-col items-center justify-center relative ${
                      user 
                        ? 'bg-gray-700 text-white border-gray-600 hover:bg-gray-600' 
                        : 'bg-gray-800 text-gray-400 border-gray-700 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <span className="text-sm">👥</span>
                    <span>{user ? 'Friends' : 'Login Required'}</span>
                    {/* Friend Request Notification Badge */}
                    {user && (
                      <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold border-2 border-white shadow-lg">
                        2
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Play Button */}
              <button 
                onClick={() => {
                  if (user) {
                    // Check if user has sufficient balance for the bet amount
                    const effectiveBetAmount = getEffectiveBetAmount();
                    if (Number(user.balance) < effectiveBetAmount) {
                      setIsBalanceWarningOpen(true);
                    } else {
                      handleStartGameWithRegion('us');
                    }
                  } else {
                    setIsLoginModalOpen(true);
                  }
                }}
                className={`font-bold text-lg py-3 w-full mb-3 font-retro transition-colors border-2 ${
                  user 
                    ? 'text-white' 
                    : 'text-gray-300 cursor-pointer'
                }`}
                style={{
                  backgroundColor: user ? '#53d493' : '#666', 
                  borderColor: user ? '#53d493' : '#666'
                }}
                onMouseEnter={(e) => {
                  if (user) {
                    (e.target as HTMLButtonElement).style.backgroundColor = '#4ac785';
                  }
                }}
                onMouseLeave={(e) => {
                  if (user) {
                    (e.target as HTMLButtonElement).style.backgroundColor = '#53d493';
                  }
                }}
                disabled={isDetectingRegion}
              >
                {isDetectingRegion ? 'DETECTING...' : (user ? 'PLAY' : 'LOGIN TO PLAY')}
              </button>
              

              
              {/* Stats at bottom */}
              <div className="grid grid-cols-2 gap-2 text-center border-t border-gray-600 pt-2">
                <div>
                  <div className="text-white font-bold text-sm font-retro">{animatedPlayerCount}</div>
                  <div className="text-gray-400 text-xs font-retro">Players Online</div>
                </div>
                <div>
                  <div className="text-white font-bold text-sm font-retro">+${dailyWinnings.toLocaleString()}</div>
                  <div className="text-gray-400 text-xs font-retro">Global Winnings (24hr)</div>
                </div>
              </div>
            </div>

            {/* Right Panel - Wallet */}
            <div className="bg-gray-800 p-3 border-2 border-gray-600 flex flex-col self-start">
              <h3 className="text-white text-sm mb-3 font-retro">Wallet</h3>
              
              {/* Balance Display */}
              <div className="font-bold text-lg mb-3 text-center bg-gray-900 py-3 border-2 border-gray-600 font-retro" style={{color: '#53d493'}}>
                {user ? `$${Number(user.balance).toFixed(2)}` : '$0.00'}
              </div>
              
              {/* Wallet buttons */}
              <div className="grid grid-cols-2 gap-1">
                <button 
                  onClick={() => {
                    if (user) {
                      setIsTopUpModalOpen(true);
                    } else {
                      setIsLoginModalOpen(true);
                    }
                  }}
                  className="bg-gray-700 text-white py-1 px-1 text-xs border-2 border-gray-600 hover:bg-gray-600 font-retro"
                >
                  Top Up
                </button>
                <button 
                  onClick={() => {
                    if (user) {
                      setIsWithdrawModalOpen(true);
                    } else {
                      setIsLoginModalOpen(true);
                    }
                  }}
                  className="bg-gray-700 text-white py-1 px-1 text-xs border-2 border-gray-600 hover:bg-gray-600 font-retro"
                >
                  Withdraw
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>
      
      </div> {/* End content wrapper */}
      {/* Celebration Popup */}
      {showCelebration && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center">
          {/* Confetti Animation */}
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="absolute animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animation: `confetti-fall ${2 + Math.random() * 3}s linear infinite`,
                  animationDelay: `${Math.random() * 2}s`
                }}
              >
                <div
                  className="w-2 h-2 rotate-45"
                  style={{
                    backgroundColor: ['#ffd700', '#ff6b6b', '#4ecdc4', '#95e1d3', '#f38ba8'][Math.floor(Math.random() * 5)]
                  }}
                />
              </div>
            ))}
          </div>
          
          {/* Celebration Content */}
          <div className="relative bg-gray-900/95 border border-yellow-400/30 rounded-2xl p-8 text-center max-w-md mx-4 shadow-2xl">
            {/* Trophy Background */}
            <div className="absolute inset-0 flex items-center justify-center opacity-10">
              <Trophy className="w-64 h-64 text-yellow-400" />
            </div>
            
            {/* Content */}
            <div className="relative z-10">
              <div className="mb-6">
                <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-bounce" />
                <h2 className="text-3xl font-bold text-yellow-400 mb-2">
                  Cash Out Complete!
                </h2>
                <p className="text-gray-300 text-lg">
                  Congratulations on your profit!
                </p>
              </div>
              
              <div className="mb-8">
                <div className="text-5xl font-bold text-green-400 mb-2">
                  ${cashOutAmount.toFixed(2)}
                </div>
                <div className="text-gray-400">
                  Successfully cashed out
                </div>
              </div>
              
              <Button
                onClick={() => setShowCelebration(false)}
                className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-8 py-3 rounded-lg"
                data-testid="button-close-celebration"
              >
                <X className="w-4 h-4 mr-2" />
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Popup */}
      {showGameOver && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center">
          {/* Game Over Content */}
          <div className="relative bg-gray-900/95 border border-red-400/30 rounded-2xl p-8 text-center max-w-md mx-4 shadow-2xl">
            {/* Content */}
            <div className="relative z-10">
              <div className="mb-6">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                  <div className="text-4xl">💀</div>
                </div>
                <h2 className="text-3xl font-bold text-red-400 mb-2">
                  Game Over
                </h2>
                <p className="text-gray-300 text-lg">
                  Better luck next time!
                </p>
              </div>
              
              <div className="mb-8">
                <div className="bg-gray-800/50 rounded-lg p-6">
                  <div className="text-sm text-gray-400 mb-2">Time Survived</div>
                  <div className="text-4xl font-bold text-white">
                    {Math.floor(gameOverData.timeAlive / 60)}:{String(gameOverData.timeAlive % 60).padStart(2, '0')}
                  </div>
                </div>
              </div>
              
              <Button
                onClick={() => setShowGameOver(false)}
                className="bg-red-500 hover:bg-red-600 text-white font-bold px-8 py-3 rounded-lg"
                data-testid="button-close-game-over"
              >
                <X className="w-4 h-4 mr-2" />
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Friends Modal */}
      <FriendsModal
        isOpen={isFriendsModalOpen}
        onClose={() => setIsFriendsModalOpen(false)}
      />
      
      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
      
      {/* Balance Warning Modal */}
      <BalanceWarningModal
        isOpen={isBalanceWarningOpen}
        onClose={() => setIsBalanceWarningOpen(false)}
        currentBalance={user ? Number(user.balance) : 0}
        requiredBalance={getEffectiveBetAmount()}
      />
      
      {/* Daily Reward Modal */}
      <DailyRewardModal
        isOpen={isDailyRewardOpen}
        onClose={() => setIsDailyRewardOpen(false)}
        onClaim={handleClaimDailyReward}
        canClaim={canClaimDailyReward()}
        hoursUntilNext={getHoursUntilNextReward()}
      />
      
      {/* Top Up Modal */}
      <TopUpModal
        isOpen={isTopUpModalOpen}
        onClose={() => setIsTopUpModalOpen(false)}
        currentBalance={user ? Number(user.balance) : 0}
        onTopUpComplete={handleTopUpComplete}
      />
      
      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        currentBalance={user ? Number(user.balance) : 0}
        onWithdrawComplete={handleWithdrawComplete}
      />
    </div>
  );
}
