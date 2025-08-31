import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { UserPlus, Users, X, Check, UserX } from 'lucide-react';

interface Friend {
  id: string;
  username: string;
  isOnline: boolean;
  isPlaying: boolean;
}

interface FriendRequest {
  id: string;
  username: string;
  timestamp: string;
}

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FriendsModal({ isOpen, onClose }: FriendsModalProps) {
  const [friends, setFriends] = useState<Friend[]>([
    { id: '1', username: 'SnakeGamer123', isOnline: true, isPlaying: false },
    { id: '2', username: 'ProPlayer', isOnline: true, isPlaying: true },
    { id: '3', username: 'CoolDude', isOnline: false, isPlaying: false },
  ]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([
    { id: '1', username: 'NewPlayer99', timestamp: '2 min ago' },
    { id: '2', username: 'GameMaster', timestamp: '5 min ago' },
  ]);
  const [newFriendUsername, setNewFriendUsername] = useState('');
  const [isAddingFriend, setIsAddingFriend] = useState(false);

  const handleAddFriend = async () => {
    if (!newFriendUsername.trim()) return;
    
    setIsAddingFriend(true);
    // TODO: Implement actual friend adding logic here
    setTimeout(() => {
      const newFriend: Friend = {
        id: Date.now().toString(),
        username: newFriendUsername,
        isOnline: false,
        isPlaying: false,
      };
      setFriends(prev => [...prev, newFriend]);
      setNewFriendUsername('');
      setIsAddingFriend(false);
    }, 1000);
  };

  const handleAcceptFriendRequest = (requestId: string) => {
    const request = friendRequests.find(req => req.id === requestId);
    if (request) {
      // Add to friends list
      const newFriend: Friend = {
        id: Date.now().toString(),
        username: request.username,
        isOnline: Math.random() > 0.5, // Random online status for demo
        isPlaying: false,
      };
      setFriends(prev => [...prev, newFriend]);
      
      // Remove from requests
      setFriendRequests(prev => prev.filter(req => req.id !== requestId));
    }
  };

  const handleDeclineFriendRequest = (requestId: string) => {
    setFriendRequests(prev => prev.filter(req => req.id !== requestId));
  };

  const getStatusColor = (friend: Friend) => {
    if (friend.isPlaying) return '#ffd700'; // Golden yellow for playing
    if (friend.isOnline) return '#00ff88'; // Bright green for online  
    return '#6b7280'; // Gray for offline
  };

  const getStatusText = (friend: Friend) => {
    if (friend.isPlaying) return 'Playing';
    if (friend.isOnline) return 'Online';
    return 'Offline';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="bg-gray-900 border-2 border-green-500 text-white max-w-lg w-full mx-4 rounded-xl shadow-2xl [&>button]:hidden"
      >
        {/* Header */}
        <DialogHeader className="pb-4 border-b border-green-500/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3 font-retro text-xl text-green-400">
              <Users className="w-6 h-6" />
              Friends
            </DialogTitle>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors border-2 border-gray-600 hover:border-green-500"
            >
              <X className="w-5 h-5 text-gray-400 hover:text-green-400" />
            </button>
          </div>
        </DialogHeader>
        
        <div className="space-y-6 pt-2">
          {/* Add Friend Section */}
          <div className="space-y-3">
            <h3 className="text-lg font-retro text-green-400">Add Friend</h3>
            <div className="flex gap-3">
              <Input
                value={newFriendUsername}
                onChange={(e) => setNewFriendUsername(e.target.value)}
                placeholder="Enter username..."
                className="flex-1 bg-gray-800 border-2 border-gray-600 text-white placeholder-gray-400 font-retro rounded-lg px-4 py-3 focus:border-green-500 focus:ring-0"
                onKeyPress={(e) => e.key === 'Enter' && handleAddFriend()}
              />
              <Button
                onClick={handleAddFriend}
                disabled={isAddingFriend || !newFriendUsername.trim()}
                className="bg-green-600 hover:bg-green-700 font-retro px-4 py-3 rounded-lg border-2 border-green-500 disabled:opacity-50"
              >
                <UserPlus className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Incoming Friend Requests */}
          {friendRequests.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-retro text-green-400">
                Incoming Friend Requests ({friendRequests.length})
              </h3>
              <div className="space-y-2">
                {friendRequests.map(request => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 bg-yellow-900/30 border-2 border-yellow-600/50 rounded-xl hover:bg-yellow-900/40 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg animate-pulse" />
                      <div>
                        <span className="font-retro text-white text-base">{request.username}</span>
                        <p className="text-xs text-gray-400 mt-1">{request.timestamp}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAcceptFriendRequest(request.id)}
                        className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg border-2 border-green-500"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => handleDeclineFriendRequest(request.id)}
                        className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg border-2 border-red-500"
                      >
                        <UserX className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends List */}
          <div className="space-y-3">
            <h3 className="text-lg font-retro text-green-400">
              Friends ({friends.length})
            </h3>
            <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
              {friends.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="font-retro text-lg mb-2">No friends yet</p>
                  <p className="text-sm opacity-70">Add some friends to play together!</p>
                </div>
              ) : (
                friends.map(friend => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-4 bg-gray-700 rounded-xl border-2 border-gray-600 hover:border-gray-500 transition-all hover:bg-gray-650"
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-3 h-3 rounded-full shadow-lg"
                        style={{ backgroundColor: getStatusColor(friend) }}
                      />
                      <span className="font-retro text-white text-base">{friend.username}</span>
                    </div>
                    <span 
                      className="text-sm font-retro font-bold"
                      style={{ color: getStatusColor(friend) }}
                    >
                      {getStatusText(friend)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <Button
              onClick={onClose}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-retro py-3 rounded-lg border-2 border-gray-500"
            >
              Close
            </Button>
            {friends.some(f => f.isOnline) && (
              <Button
                onClick={() => {/* TODO: Implement invite to game */}}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-retro py-3 rounded-lg border-2 border-blue-500"
              >
                Invite Online Friends
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}