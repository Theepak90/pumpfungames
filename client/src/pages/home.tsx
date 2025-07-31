import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useGame } from "@/contexts/game-context";
import { useWebSocket } from "@/hooks/use-websocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Wallet } from "@/components/ui/wallet";

import { apiRequest } from "@/lib/queryClient";
import { 
  Settings, 
  Volume2, 
  LogOut, 
  Edit3, 
  Wallet as WalletIcon,
  Users,
  Gift
} from "lucide-react";
import logoImage from "@assets/0b174992-98e7-4e65-b9d4-2e1f1794e0ca.png_1753912259610.png";

export default function Home() {
  const { user, login, register, logout, updateUser } = useAuth();
  const [, setLocation] = useLocation();
  const { 
    selectedBetAmount, 
    setSelectedBetAmount, 
    selectedRegion, 
    setSelectedRegion,
    playersInGame,
    globalWinnings,
    currentGame
  } = useGame();
  const { isConnected, gameState, joinGame, move, leaveGame } = useWebSocket(user?.id || null);
  const { toast } = useToast();

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


  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [animatedPlayerCount, setAnimatedPlayerCount] = useState(150);
  const [dailyWinnings, setDailyWinnings] = useState(0);

  // Auth form handler
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      toast({
        title: "Welcome back!",
        description: "Successfully logged in.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Authentication failed",
        variant: "destructive",
      });
    }
  };

  // Start game handler
  const handleStartGame = async () => {
    const betAmount = selectedBetAmount;
    
    toast({
      title: "Game Started!",
      description: `Starting snake game with $${betAmount} bet.`,
    });
    
    // Navigate to fullscreen game
    setLocation('/game');
  };

  // Handle daily crate claim
  const handleClaimDailyCrate = async () => {
    if (!user) return;

    try {
      const response = await apiRequest("POST", `/api/users/${user.id}/claim-daily-crate`, {});
      const crate = await response.json();
      
      const reward = parseFloat(crate.reward);
      const newBalance = parseFloat(user.balance) + reward;
      updateUser({ balance: newBalance.toFixed(4) });

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

  // Mouse controls are now handled in the SnakeGame component

  // Skip authentication for now - show homepage directly

  return (
    <div className="min-h-screen bg-gray-900 text-white font-retro" style={{backgroundColor: '#15161b'}}>
      {/* Top Bar - Welcome with gaming controller icon */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center">
          <img src={logoImage} alt="Game Logo" className="h-8 mr-3" style={{imageRendering: 'pixelated'}} />
          <span className="text-white text-lg">Welcome, </span>
          <span className="text-lg font-bold" style={{color: '#53d493'}}>Player one</span>
        </div>
        <button 
          className="bg-red-600 text-white px-3 py-1 text-sm hover:bg-red-700 border-2 border-red-500 font-retro"
        >
          Logout
        </button>
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
              <div className="grid grid-cols-3 gap-1 mb-3">
                <button 
                  onClick={() => setSelectedBetAmount(1)}
                  className={`py-2 px-3 text-sm border-2 font-retro ${
                    selectedBetAmount === 1 
                      ? 'text-white border-2' 
                      : 'bg-gray-700 text-white border-gray-600 hover:bg-gray-600'
                  }`}
                  style={selectedBetAmount === 1 ? {backgroundColor: '#53d493', borderColor: '#53d493'} : {}}
                >
                  $1
                </button>
                <div className="relative group">
                  <button 
                    disabled
                    className="py-2 px-3 text-sm border-2 font-retro bg-gray-700 text-white border-gray-600 cursor-not-allowed w-full group-hover:bg-gray-800 group-hover:text-gray-500 group-hover:border-gray-700 transition-colors"
                  >
                    $5
                  </button>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" style={{imageRendering: 'pixelated'}}>
                      <rect x="5" y="7" width="6" height="6" fill="currentColor"/>
                      <rect x="4" y="6" width="1" height="1" fill="currentColor"/>
                      <rect x="11" y="6" width="1" height="1" fill="currentColor"/>
                      <rect x="4" y="5" width="1" height="1" fill="currentColor"/>
                      <rect x="11" y="5" width="1" height="1" fill="currentColor"/>
                      <rect x="6" y="4" width="4" height="1" fill="currentColor"/>
                      <rect x="6" y="3" width="4" height="1" fill="currentColor"/>
                      <rect x="7" y="2" width="2" height="1" fill="currentColor"/>
                      <rect x="7" y="9" width="2" height="1" fill="currentColor"/>
                    </svg>
                  </div>
                </div>
                <div className="relative group">
                  <button 
                    disabled
                    className="py-2 px-3 text-sm border-2 font-retro bg-gray-700 text-white border-gray-600 cursor-not-allowed w-full group-hover:bg-gray-800 group-hover:text-gray-500 group-hover:border-gray-700 transition-colors"
                  >
                    $20
                  </button>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" style={{imageRendering: 'pixelated'}}>
                      <rect x="5" y="7" width="6" height="6" fill="currentColor"/>
                      <rect x="4" y="6" width="1" height="1" fill="currentColor"/>
                      <rect x="11" y="6" width="1" height="1" fill="currentColor"/>
                      <rect x="4" y="5" width="1" height="1" fill="currentColor"/>
                      <rect x="11" y="5" width="1" height="1" fill="currentColor"/>
                      <rect x="6" y="4" width="4" height="1" fill="currentColor"/>
                      <rect x="6" y="3" width="4" height="1" fill="currentColor"/>
                      <rect x="7" y="2" width="2" height="1" fill="currentColor"/>
                      <rect x="7" y="9" width="2" height="1" fill="currentColor"/>
                    </svg>
                  </div>
                </div>
              </div>
              
              {/* Play Button */}
              <button 
                onClick={handleStartGame}
                className="text-white font-bold text-lg py-3 w-full mb-3 font-retro transition-colors border-2"
                style={{backgroundColor: '#53d493', borderColor: '#53d493'}}
                onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#4ac785'}
                onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#53d493'}
              >
                PLAY
              </button>
              
              {/* Region and Friends buttons */}
              <div className="grid grid-cols-2 gap-1 mb-3">
                <button 
                  onClick={() => setSelectedRegion(selectedRegion === "EU" ? "US" : "EU")}
                  className={`py-1 px-3 text-sm border-2 font-retro ${
                    selectedRegion === "EU" 
                      ? 'bg-blue-600 text-white border-blue-500' 
                      : selectedRegion === "US"
                      ? 'bg-red-600 text-white border-red-500'
                      : 'bg-gray-700 text-white border-gray-600 hover:bg-gray-600'
                  } transition-colors`}
                >
                  {selectedRegion}
                </button>
                <button className="bg-gray-700 text-white py-1 px-3 text-sm border-2 border-gray-600 hover:bg-gray-600 font-retro">
                  Friends
                </button>
              </div>
              
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
                $984.37
              </div>
              
              {/* Wallet buttons */}
              <div className="grid grid-cols-2 gap-1">
                <button className="bg-gray-700 text-white py-1 px-2 text-sm border-2 border-gray-600 hover:bg-gray-600 font-retro">
                  Top Up
                </button>
                <button className="bg-gray-700 text-white py-1 px-2 text-sm border-2 border-gray-600 hover:bg-gray-600 font-retro">
                  Withdraw
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
