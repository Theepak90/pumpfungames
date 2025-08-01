import { createContext, useContext, useState, ReactNode } from "react";

interface GameContextType {
  selectedBetAmount: number;
  setSelectedBetAmount: (amount: number) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [selectedBetAmount, setSelectedBetAmount] = useState(1);

  return (
    <GameContext.Provider value={{
      selectedBetAmount,
      setSelectedBetAmount
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
