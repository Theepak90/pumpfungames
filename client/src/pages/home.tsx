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
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-dark-bg/90 backdrop-blur-sm border-b border-dark-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Left side - Welcome */}
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🎃</span>
              <div>
                <span className="text-white font-semibold">Welcome, </span>
                <span className="neon-yellow font-bold">{user.username}</span>
                <span className="text-white font-semibold">!</span>
              </div>
            </div>

            {/* Right side - User controls */}
            <div className="flex items-center space-x-4">
              {/* Wallet balance */}
              <div className="flex items-center space-x-2 bg-dark-card px-4 py-2 rounded-lg border border-dark-border">
                <WalletIcon className="w-5 h-5 neon-yellow" />
                <span className="neon-yellow font-bold">${parseFloat(user.balance).toFixed(2)}</span>
              </div>

              {/* Sound toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="hover:bg-dark-card"
              >
                <Volume2 className={`w-6 h-6 ${soundEnabled ? 'text-white' : 'text-gray-500'}`} />
              </Button>

              {/* Settings */}
              <Button variant="ghost" size="icon" className="hover:bg-dark-card">
                <Settings className="w-6 h-6 text-white" />
              </Button>

              {/* Logout */}
              <Button 
                onClick={logout}
                className="bg-neon-yellow text-black hover:bg-yellow-400 font-semibold"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-screen">

          {/* Center Panel */}
          <main className="lg:col-span-2 space-y-6">
            {/* Username Block */}
                <div className="flex items-center justify-center space-x-4">
                  {/* Score cube */}
                  <div className="bg-neon-yellow text-black w-12 h-12 rounded-lg flex items-center justify-center font-bold text-xl glow-hover">
                    <span>{user.kills || 0}</span>
                  </div>
                  
                  {/* Username field */}
                  <div className="flex items-center space-x-2 bg-dark-card px-4 py-2 rounded-lg border border-dark-border">
                    <span className="text-white font-medium">{user.username}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Edit3 className="w-4 h-4 text-gray-400 hover:text-white" />
                    </Button>
                  </div>
                </div>

                {/* Game Amount Buttons */}
                <div className="flex justify-center space-x-4">
                  {[1, 5, 20].map((amount) => (
                    <Button
                      key={amount}
                      onClick={() => setSelectedBetAmount(amount)}
                      className={`px-6 py-3 rounded-full font-bold transition-all ${
                        selectedBetAmount === amount
                          ? 'bg-neon-yellow text-black glow-hover'
                          : 'bg-dark-card text-white border border-dark-border hover:border-neon-yellow'
                      }`}
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>

                {/* Start Button */}
                <div className="text-center">
                  <Button
                    onClick={handleStartGame}
                    className="bg-dark-card text-white px-12 py-4 rounded-xl font-bold text-lg border-2 border-dark-border hover:border-neon-green glow-green transition-all duration-300 transform hover:scale-105"
                  >
                    PLAY GAME
                  </Button>
                </div>

                {/* Region & Lobby Buttons */}
                <div className="flex justify-center space-x-4">
                  <Button
                    onClick={() => setSelectedRegion("EU")}
                    className={`px-4 py-2 rounded-full font-medium transition-colors ${
                      selectedRegion === "EU"
                        ? 'bg-neon-blue text-white hover:bg-blue-600'
                        : 'bg-dark-card text-white border border-dark-border hover:border-neon-blue'
                    }`}
                  >
                    EU Region
                  </Button>
                  <Button
                    variant="outline"
                    className="px-4 py-2 bg-dark-card text-white rounded-full font-medium border border-dark-border hover:border-neon-blue"
                  >
                    Browse Lobbies
                  </Button>
                </div>

                {/* Stats Strip */}
                <Card className="bg-dark-card border-dark-border">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-2 gap-6 text-center">
                      <div>
                        <div className="neon-yellow text-3xl font-bold mb-1">{playersInGame}</div>
                        <div className="text-gray-400 text-sm">Players in Game</div>
                      </div>
                      <div>
                        <div className="neon-yellow text-3xl font-bold mb-1">${globalWinnings.toLocaleString()}</div>
                        <div className="text-gray-400 text-sm">Global Player Winnings</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
          </main>

          {/* Right Panel */}
          <aside className="lg:col-span-1 space-y-6">
            <Wallet />
          </aside>
        </div>
      </div>

      {/* Bottom Bar */}
      <footer className="mt-12 border-t border-dark-border bg-dark-bg/50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-center space-x-8">
            
            {/* Daily Crate */}
            <Button
              onClick={handleClaimDailyCrate}
              className="bg-dark-card rounded-xl p-4 border border-dark-border hover:border-neon-yellow transition-colors flex items-center space-x-3"
              variant="ghost"
            >
              <div className="w-8 h-8 bg-neon-yellow rounded-lg flex items-center justify-center bounce-slow">
                <Gift className="w-5 h-5 text-black" />
              </div>
              <span className="text-white font-medium">Daily Crate</span>
            </Button>

            {/* Affiliate (disabled) */}
            <div className="bg-dark-card rounded-xl p-4 border border-dark-border opacity-50 cursor-not-allowed flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-gray-400" />
              </div>
              <span className="text-gray-400 font-medium">Affiliate</span>
              <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-400">Soon</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
