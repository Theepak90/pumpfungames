import { createContext, useContext, useState, ReactNode } from "react";
import { GameState } from "@shared/schema";

interface GameContextType {
  currentGame: GameState | null;
  selectedBetAmount: number;
  setSelectedBetAmount: (amount: number) => void;
  selectedRegion: string;
  setSelectedRegion: (region: string) => void;
  playersInGame: number;
  globalWinnings: number;
  setCurrentGame: (game: GameState | null) => void;
  updateGameStats: (players: number, winnings: number) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [currentGame, setCurrentGame] = useState<GameState | null>(null);
  const [selectedBetAmount, setSelectedBetAmount] = useState(1);
  const [selectedRegion, setSelectedRegion] = useState("EU");
  const [playersInGame, setPlayersInGame] = useState(18);
  const [globalWinnings, setGlobalWinnings] = useState(38154);

  const updateGameStats = (players: number, winnings: number) => {
    setPlayersInGame(players);
    setGlobalWinnings(winnings);
  };

  return (
    <GameContext.Provider value={{
      currentGame,
      selectedBetAmount,
      setSelectedBetAmount,
      selectedRegion,
      setSelectedRegion,
      playersInGame,
      globalWinnings,
      setCurrentGame,
      updateGameStats
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}
