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

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [soundEnabled, setSoundEnabled] = useState(true);

  // Auth form handler
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLoginMode) {
        await login(username, password);
      } else {
        await register(username, password);
      }
      toast({
        title: isLoginMode ? "Welcome back!" : "Account created!",
        description: `Successfully ${isLoginMode ? "logged in" : "registered"}.`,
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
    if (!user) return;

    const betAmount = selectedBetAmount;
    const userBalance = parseFloat(user.balance);

    // For testing - give unlimited balance
    if (userBalance < betAmount) {
      // Auto-add funds for testing
      const newBalance = Math.max(userBalance + 1000, betAmount * 10);
      updateUser({ balance: newBalance.toFixed(4) });
    }

    try {
      // Create a new game
      const gameResponse = await apiRequest("POST", "/api/games/create", {
        region: selectedRegion,
        betAmount: betAmount.toFixed(2),
        playersCount: 0,
        maxPlayers: 20,
        status: 'waiting'
      });
      const game = await gameResponse.json();

      // Join the game
      const joinResponse = await apiRequest("POST", `/api/games/${game.id}/join`, {
        userId: user.id
      });

      if (joinResponse.ok) {
        // Update user balance locally
        updateUser({ balance: (userBalance - betAmount).toFixed(4) });
        
        toast({
          title: "Game Started!",
          description: `Starting snake game with $${betAmount} bet.`,
        });
        
        // Navigate to fullscreen game
        setLocation('/game');
      }
    } catch (error) {
      toast({
        title: "Failed to Start Game",
        description: error instanceof Error ? error.message : "Could not start the game.",
        variant: "destructive",
      });
    }
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

  // Show auth form if not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-dark-card border-dark-border">
          <CardHeader className="text-center">
            <div className="text-4xl mb-2">🎃</div>
            <CardTitle className="text-2xl neon-yellow">DAMNBRUH</CardTitle>
            <p className="text-gray-400">Skill-Based Crypto Snake Game</p>
          </CardHeader>
          <CardContent>
            <Tabs value={isLoginMode ? "login" : "register"} onValueChange={(value) => setIsLoginMode(value === "login")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleAuth} className="space-y-4">
                  <Input
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-dark-bg border-dark-border"
                    required
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-dark-bg border-dark-border"
                    required
                  />
                  <Button type="submit" className="w-full bg-neon-yellow text-black hover:bg-yellow-400">
                    Login
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="register" className="space-y-4">
                <form onSubmit={handleAuth} className="space-y-4">
                  <Input
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-dark-bg border-dark-border"
                    required
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-dark-bg border-dark-border"
                    required
                  />
                  <Button type="submit" className="w-full bg-neon-yellow text-black hover:bg-yellow-400">
                    Register
                  </Button>
                </form>
                <p className="text-sm text-gray-400 text-center">
                  New accounts start with $10.00 and 0.05 SOL
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-retro" style={{backgroundColor: '#1a1a1a'}}>
      {/* Top Bar - Welcome with gaming controller icon */}
      <div className="flex items-center p-4">
        <div className="text-green-400 text-2xl mr-3">🎮</div>
        <span className="text-white text-lg">Welcome, </span>
        <span className="text-green-400 text-lg font-bold">Player one</span>
      </div>

      {/* Main Content Container */}
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <div className="w-full max-w-4xl px-4">
          
          {/* Title Section */}
          <div className="text-center mb-8">
            <h1 className="text-white text-4xl font-bold mb-2 font-retro tracking-wider">
              PumpGames<span className="text-green-400">.fun</span>
            </h1>
            <p className="text-gray-300 text-lg font-retro">Skill Based Betting</p>
          </div>

          {/* Main Game Area - Three Column Layout */}
          <div className="grid grid-cols-3 gap-6 max-w-5xl mx-auto">
            
            {/* Left Panel - Leaderboard */}
            <div className="bg-gray-800 p-4 border border-gray-600 rounded-sm">
              <h3 className="text-yellow-400 text-sm mb-3 font-retro flex items-center">
                🏆 Leaderboard
              </h3>
              <div className="text-white text-xs space-y-1 mb-6 font-retro">
                <div>1.</div>
                <div>2.</div>
                <div>3.</div>
              </div>
              <div className="border-t border-gray-600 pt-4">
                <button className="bg-gray-700 text-white px-3 py-1 text-xs border border-gray-600 hover:bg-gray-600 font-retro w-full">
                  View Full Board
                </button>
              </div>
            </div>

            {/* Center Panel - Game Controls */}
            <div className="bg-gray-800 p-4 border border-gray-600 rounded-sm">
              
              {/* Username with edit icon */}
              <div className="flex items-center justify-between mb-4 bg-gray-700 px-3 py-2 border border-gray-600">
                <span className="text-gray-300 font-retro text-xs">〈Your Username〉</span>
                <Edit3 className="w-3 h-3 text-gray-400 hover:text-white cursor-pointer" />
              </div>
              
              {/* Bet Amount */}
              <div className="bg-white text-black p-2 text-center font-bold text-lg mb-4 font-retro border border-gray-400">
                {selectedBetAmount}$
              </div>
              
              {/* Play Button */}
              <button 
                onClick={handleStartGame}
                className="bg-green-500 text-white font-bold text-lg py-3 w-full mb-4 font-retro hover:bg-green-600 transition-colors border border-green-400"
              >
                PLAY
              </button>
              
              {/* Region and Friends buttons */}
              <div className="grid grid-cols-2 gap-1 mb-4">
                <button 
                  onClick={() => setSelectedRegion("EU")}
                  className={`py-1 px-3 text-xs border font-retro ${
                    selectedRegion === "EU" 
                      ? 'bg-blue-600 text-white border-blue-500' 
                      : 'bg-gray-700 text-white border-gray-600 hover:bg-gray-600'
                  }`}
                >
                  EU
                </button>
                <button className="bg-gray-700 text-white py-1 px-3 text-xs border border-gray-600 hover:bg-gray-600 font-retro">
                  Friends
                </button>
              </div>
              
              {/* Stats at bottom */}
              <div className="grid grid-cols-2 gap-2 text-center border-t border-gray-600 pt-3">
                <div>
                  <div className="text-white font-bold text-sm font-retro">{playersInGame || 54}</div>
                  <div className="text-gray-400 text-xs font-retro">Players Online</div>
                </div>
                <div>
                  <div className="text-white font-bold text-sm font-retro">+${(globalWinnings || 240331).toLocaleString()}</div>
                  <div className="text-gray-400 text-xs font-retro">Global Player Winnings</div>
                </div>
              </div>
            </div>

            {/* Right Panel - Wallet */}
            <div className="bg-gray-800 p-4 border border-gray-600 rounded-sm">
              <h3 className="text-white text-sm mb-4 font-retro">Wallet</h3>
              
              {/* Balance Display */}
              <div className="text-green-400 font-bold text-lg mb-4 text-center bg-gray-900 py-3 border border-gray-600 font-retro">
                ${parseFloat(user.balance).toFixed(2)}
              </div>
              
              {/* Wallet buttons */}
              <div className="grid grid-cols-2 gap-1">
                <button className="bg-gray-700 text-white py-1 px-2 text-xs border border-gray-600 hover:bg-gray-600 font-retro">
                  Top Up
                </button>
                <button className="bg-gray-700 text-white py-1 px-2 text-xs border border-gray-600 hover:bg-gray-600 font-retro">
                  Withdraw
                </button>
              </div>
            </div>

          </div>

          {/* Bet Amount Selection */}
          <div className="flex justify-center mt-8 space-x-4">
            {[1, 5, 20].map((amount) => (
              <button
                key={amount}
                onClick={() => setSelectedBetAmount(amount)}
                className={`px-6 py-2 font-bold rounded ${
                  selectedBetAmount === amount
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-700 text-white border border-gray-600 hover:bg-gray-600'
                }`}
              >
                ${amount}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex justify-center space-x-8 p-4">
        <Button
          onClick={handleClaimDailyCrate}
          className="bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 hover:bg-gray-600"
        >
          <Gift className="w-4 h-4 mr-2" />
          Daily Crate
        </Button>
        
        <Button
          onClick={logout}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
}
