import { useState } from 'react';
import SlitherHome from './pages/SlitherHome';
import SlitherGame from './pages/SlitherGame';
import './App.css';

function App() {
  const [gameState, setGameState] = useState<'home' | 'game'>('home');
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [username, setUsername] = useState<string>('');

  const handleGameStart = (newSocket: WebSocket, playerUsername: string) => {
    setSocket(newSocket);
    setUsername(playerUsername);
    setGameState('game');
  };

  const handleGameEnd = () => {
    if (socket) {
      socket.close();
      setSocket(null);
    }
    setUsername('');
    setGameState('home');
  };

  return (
    <div className="app">
      {gameState === 'home' ? (
        <SlitherHome onGameStart={handleGameStart} />
      ) : (
        socket && (
          <SlitherGame 
            socket={socket} 
            username={username} 
            onGameEnd={handleGameEnd} 
          />
        )
      )}
    </div>
  );
}

export default App;
