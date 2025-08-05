import './Leaderboard.css';

interface LeaderboardProps {
  leaderboard: Map<string, number>;
}

export default function Leaderboard({ leaderboard }: LeaderboardProps) {
  const sortedEntries = Array.from(leaderboard.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Show top 10

  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <h3>Leaderboard</h3>
      </div>
      <div className="leaderboard-entries">
        {sortedEntries.map(([username, score], index) => (
          <div key={username} className="leaderboard-entry">
            <span className="rank">#{index + 1}</span>
            <span className="username">{username}</span>
            <span className="score">{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}