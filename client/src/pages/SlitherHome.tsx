import { useState } from 'react';
import { MessageType, JoinGameMessage, CreateGameMessage } from '../types/MessageTypes';
import './SlitherHome.css';

interface SlitherHomeProps {
  onGameStart: (socket: WebSocket, username: string) => void;
}

export default function SlitherHome({ onGameStart }: SlitherHomeProps) {
  const [username, setUsername] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  const connectToGame = (createNew: boolean) => {
    if (!username.trim()) {
      setErrorMessage('Please enter a username');
      return;
    }

    if (!createNew && !gameCode.trim()) {
      setErrorMessage('Please enter a game code');
      return;
    }

    setIsConnecting(true);
    setErrorMessage('');

    // Create WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket connected');
      
      const message = createNew 
        ? {
            type: MessageType.CREATE_GAME,
            data: { username: username.trim() }
          } as CreateGameMessage
        : {
            type: MessageType.JOIN_GAME,
            data: { username: username.trim(), gameCode: gameCode.trim() }
          } as JoinGameMessage;
          
      socket.send(JSON.stringify(message));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === MessageType.JOIN_SUCCESS) {
        setIsConnecting(false);
        onGameStart(socket, username.trim());
      } else if (message.type === MessageType.JOIN_ERROR) {
        setIsConnecting(false);
        setErrorMessage(message.data?.message || 'Failed to join game');
        socket.close();
      }
    };

    socket.onerror = () => {
      setIsConnecting(false);
      setErrorMessage('Failed to connect to server');
    };

    socket.onclose = () => {
      if (isConnecting) {
        setIsConnecting(false);
        setErrorMessage('Connection lost');
      }
    };
  };

  return (
    <div className="slither-home">
      <div className="background-animation">
        {/* Animated background elements */}
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className={`floating-orb orb-${i}`} />
        ))}
      </div>

      <div className="home-container">
        <div className="title-section">
          <h1 className="game-title">
            Slither<span className="title-plus">+</span>
          </h1>
          <p className="game-subtitle">Multiplayer Snake Battle Arena</p>
        </div>

        <div className="controls-section">
          <div className="input-group">
            <label htmlFor="username">Enter your username:</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
              maxLength={20}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (gameCode) {
                    connectToGame(false);
                  } else {
                    connectToGame(true);
                  }
                }
              }}
            />
          </div>

          {errorMessage && (
            <div className="error-message">{errorMessage}</div>
          )}

          <div className="game-options">
            <div className="new-game-section">
              <button
                className="btn btn-primary"
                onClick={() => connectToGame(true)}
                disabled={isConnecting}
              >
                {isConnecting ? 'Creating...' : 'Create New Game'}
              </button>
            </div>

            <div className="divider">
              <span>OR</span>
            </div>

            <div className="join-game-section">
              <h3>Join with Game Code</h3>
              <div className="input-group">
                <input
                  type="text"
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                  placeholder="Enter game code"
                  maxLength={6}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      connectToGame(false);
                    }
                  }}
                />
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => connectToGame(false)}
                disabled={isConnecting}
              >
                {isConnecting ? 'Joining...' : 'Join Game'}
              </button>
            </div>
          </div>
        </div>

        <div className="footer-section">
          <button
            className="btn btn-outline"
            onClick={() => setShowHowToPlay(true)}
          >
            How to Play
          </button>
        </div>
      </div>

      {/* How to Play Modal */}
      {showHowToPlay && (
        <div className="modal-overlay" onClick={() => setShowHowToPlay(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>How to Play</h2>
              <button
                className="close-btn"
                onClick={() => setShowHowToPlay(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="instruction">
                <h3>🎯 Objective</h3>
                <p>Grow your snake by eating orbs and avoid hitting other snakes!</p>
              </div>
              <div className="instruction">
                <h3>🖱️ Controls</h3>
                <p>Move your mouse to control your snake's direction</p>
              </div>
              <div className="instruction">
                <h3>🏆 Scoring</h3>
                <p>Eat orbs to grow longer and increase your score</p>
              </div>
              <div className="instruction">
                <h3>⚡ Strategy</h3>
                <p>Use your size advantage to trap smaller snakes, but watch out for bigger ones!</p>
              </div>
              <div className="instruction">
                <h3>🎮 Multiplayer</h3>
                <p>Create a game to get a code, or join friends using their game code</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}