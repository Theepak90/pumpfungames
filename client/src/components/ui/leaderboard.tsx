import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trophy } from "lucide-react";
import { User } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

export function Leaderboard() {
  const { data: leaderboard = [] } = useQuery<User[]>({
    queryKey: ['/api/leaderboard'],
    refetchInterval: 5000, // Update every 5 seconds
  });

  const [showFullLeaderboard, setShowFullLeaderboard] = useState(false);

  const topThree = leaderboard.slice(0, 3);
  const getRankIcon = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `${index + 1}`;
  };

  return (
    <>
      <Card className="bg-dark-card border-dark-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Trophy className="w-6 h-6 neon-yellow" />
              <CardTitle className="text-lg font-bold text-white">Leaderboard</CardTitle>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-neon-green rounded-full pulse-slow"></div>
              <span className="text-xs neon-green font-medium">Live</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Top 3 Players */}
          <div className="space-y-3">
            {topThree.map((player, index) => (
              <div key={player.id} className="flex items-center justify-between p-3 bg-dark-bg/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className={`font-bold text-lg ${
                    index === 0 ? 'neon-yellow' : 
                    index === 1 ? 'text-gray-300' : 
                    'text-amber-600'
                  }`}>
                    {getRankIcon(index)}
                  </span>
                  <span className="text-white font-medium">{player.username}</span>
                </div>
                <span className="neon-yellow font-bold">
                  ${parseFloat(player.totalEarnings).toFixed(0)}
                </span>
              </div>
            ))}
          </div>

          {leaderboard.length === 0 && (
            <div className="text-center py-4 text-gray-400">
              No players yet. Be the first!
            </div>
          )}

          <Dialog open={showFullLeaderboard} onOpenChange={setShowFullLeaderboard}>
            <DialogTrigger asChild>
              <Button 
                className="w-full bg-dark-bg border border-dark-border text-white hover:border-neon-yellow transition-colors"
                variant="outline"
              >
                View Full Leaderboard
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-dark-card border-dark-border text-white max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <Trophy className="w-6 h-6 neon-yellow" />
                  <span>Full Leaderboard</span>
                </DialogTitle>
              </DialogHeader>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {leaderboard.map((player, index) => (
                  <div key={player.id} className="flex items-center justify-between p-3 bg-dark-bg/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-lg w-8 text-center">
                        {index < 3 ? getRankIcon(index) : index + 1}
                      </span>
                      <div>
                        <div className="text-white font-medium">{player.username}</div>
                        <div className="text-xs text-gray-400">
                          {player.kills} kills • {player.gamesPlayed} games
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="neon-yellow font-bold">
                        ${parseFloat(player.totalEarnings).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-400">
                        ${parseFloat(player.balance).toFixed(2)} balance
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </>
  );
}
