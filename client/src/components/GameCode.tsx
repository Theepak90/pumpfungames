import './GameCode.css';

interface GameCodeProps {
  gameCode: string;
}

export default function GameCode({ gameCode }: GameCodeProps) {
  if (!gameCode) return null;

  return (
    <div className="game-code">
      <div className="game-code-header">
        <h4>Game Code</h4>
      </div>
      <div className="game-code-value">
        {gameCode}
      </div>
      <div className="game-code-subtitle">
        Share with friends to play together!
      </div>
    </div>
  );
}