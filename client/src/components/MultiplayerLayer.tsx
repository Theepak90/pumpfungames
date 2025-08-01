import { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { useAuth } from '@/contexts/auth-context';

interface MultiplayerLayerProps {
  children: React.ReactNode;
  enableMultiplayer?: boolean;
}

// Phase 1: Multiplayer as optional layer that never breaks local gameplay
export default function MultiplayerLayer({ children, enableMultiplayer = false }: MultiplayerLayerProps) {
  const [isMultiplayerActive, setIsMultiplayerActive] = useState(false);
  
  // Safe fallbacks for when hooks aren't available
  let user = null;
  let isConnected = false;
  let gameState = null;
  let joinGame = () => {};
  let move = () => {};
  let leaveGame = () => {};
  
  try {
    const auth = useAuth();
    user = auth.user;
    
    // Only try to connect to multiplayer if explicitly enabled
    if (enableMultiplayer && user) {
      const websocket = useWebSocket(user.id);
      isConnected = websocket.isConnected;
      gameState = websocket.gameState;
      joinGame = websocket.joinGame;
      move = websocket.move;
      leaveGame = websocket.leaveGame;
    }
  } catch (error) {
    console.warn('Multiplayer features not available, running in local mode');
  }

  useEffect(() => {
    if (enableMultiplayer && isConnected) {
      setIsMultiplayerActive(true);
      console.log('Multiplayer layer activated');
    } else {
      setIsMultiplayerActive(false);
      if (enableMultiplayer) {
        console.log('Multiplayer layer inactive - running in local mode');
      }
    }
  }, [enableMultiplayer, isConnected]);

  // Phase 1: Always render local gameplay, multiplayer is just an overlay
  return (
    <div className="relative">
      {/* Local gameplay always works */}
      {children}
      
      {/* Optional multiplayer status indicator */}
      {enableMultiplayer && (
        <div className="absolute top-4 right-4 z-10">
          <div className={`px-3 py-1 rounded text-sm font-mono ${
            isMultiplayerActive 
              ? 'bg-green-600/80 text-white' 
              : 'bg-yellow-600/80 text-white'
          }`}>
            {isMultiplayerActive ? 'MULTIPLAYER' : 'LOCAL MODE'}
          </div>
        </div>
      )}
    </div>
  );
}