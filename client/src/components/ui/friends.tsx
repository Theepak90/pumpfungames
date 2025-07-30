import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { RefreshCw, UserPlus, Users } from "lucide-react";
import { User } from "@shared/schema";

export function Friends() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [friendUsername, setFriendUsername] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: friends = [], refetch } = useQuery<User[]>({
    queryKey: ['/api/users', user?.id, 'friends'],
    enabled: !!user,
    refetchInterval: 10000, // Update every 10 seconds
  });

  if (!user) return null;

  const handleRefreshFriends = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Friends List Refreshed",
        description: "Friend list has been updated",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddFriend = async () => {
    if (!friendUsername.trim()) {
      toast({
        title: "Invalid Username",
        description: "Please enter a valid username",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiRequest("POST", `/api/users/${user.id}/add-friend`, {
        friendUsername: friendUsername.trim()
      });
      
      setIsAddFriendOpen(false);
      setFriendUsername("");
      refetch();
      
      toast({
        title: "Friend Request Sent",
        description: `Friend request sent to ${friendUsername}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add friend",
        variant: "destructive",
      });
    }
  };

  const onlineFriends = friends.filter(friend => friend.isOnline);

  return (
    <>
      <Card className="bg-dark-card border-dark-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-white">Friends</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefreshFriends}
              disabled={isRefreshing}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Friends list or empty state */}
          {friends.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">No friends… add some!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {friends.map((friend) => (
                <div key={friend.id} className="flex items-center justify-between p-2 bg-dark-bg/50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${friend.isOnline ? 'bg-neon-green' : 'bg-gray-500'}`} />
                    <span className="text-white text-sm">{friend.username}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    ${parseFloat(friend.totalEarnings).toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Status</span>
            <span className="text-sm bg-dark-bg px-2 py-1 rounded text-gray-300">
              {onlineFriends.length} playing
            </span>
          </div>

          <Dialog open={isAddFriendOpen} onOpenChange={setIsAddFriendOpen}>
            <DialogTrigger asChild>
              <Button className="w-full bg-neon-blue text-white hover:bg-blue-600 transition-colors">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Friends
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-dark-card border-dark-border text-white">
              <DialogHeader>
                <DialogTitle>Add Friend</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Enter username"
                  value={friendUsername}
                  onChange={(e) => setFriendUsername(e.target.value)}
                  className="bg-dark-bg border-dark-border"
                />
                <div className="text-sm text-gray-400">
                  Enter the username of the player you want to add as a friend.
                </div>
                <Button 
                  onClick={handleAddFriend}
                  className="w-full bg-neon-blue text-white hover:bg-blue-600"
                >
                  Send Friend Request
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </>
  );
}
