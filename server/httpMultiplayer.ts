import type { Express } from "express";

interface Player {
  id: string;
  segments: Array<{ x: number; y: number }>;
  color: string;
  money: number;
  totalMass: number;
  segmentRadius: number;
  visibleSegmentCount: number;
  lastUpdate: number;
}

interface GameRoom {
  players: Map<string, Player>;
  lastActivity: number;
}

export class HttpMultiplayerManager {
  private static readonly MAX_PLAYERS_PER_ROOM = 8;
  private static readonly ROOM_TIMEOUT = 30000; // 30 seconds
  private gameRooms = new Map<number, GameRoom>();
  private nextRoomId = 0;

  setupRoutes(app: Express) {
    // Get available room
    app.get('/api/multiplayer/room', (req, res) => {
      const room = this.getAvailableRoom();
      res.json({ roomId: room.id });
    });

    // Update player position
    app.post('/api/multiplayer/update', (req, res) => {
      const { roomId, playerId, segments, color, money, totalMass, segmentRadius, visibleSegmentCount } = req.body;
      
      if (!roomId || !playerId) {
        return res.status(400).json({ error: 'Missing roomId or playerId' });
      }

      const room = this.gameRooms.get(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      // Enforce 100-segment and 100-mass limits
      const MAX_SEGMENTS = 100;
      const MAX_MASS = 100;
      const limitedSegments = (segments || []).slice(0, MAX_SEGMENTS);
      const limitedMass = Math.min(totalMass || 6, MAX_MASS);

      const player: Player = {
        id: playerId,
        segments: limitedSegments,
        color: color || '#d55400',
        money: money || 1.00,
        totalMass: limitedMass,
        segmentRadius: segmentRadius || 8,
        visibleSegmentCount: Math.min(visibleSegmentCount || 0, MAX_SEGMENTS),
        lastUpdate: Date.now()
      };

      room.players.set(playerId, player);
      room.lastActivity = Date.now();

      res.json({ success: true });
    });

    // Get room state
    app.get('/api/multiplayer/state/:roomId', (req, res) => {
      const roomId = parseInt(req.params.roomId);
      const room = this.gameRooms.get(roomId);
      
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      // Remove stale players (haven't updated in 10 seconds)
      const now = Date.now();
      Array.from(room.players.entries()).forEach(([playerId, player]) => {
        if (now - player.lastUpdate > 10000) {
          room.players.delete(playerId);
        }
      });

      const players = Array.from(room.players.values());
      res.json({ players });
    });

    // Cleanup old rooms periodically
    setInterval(() => {
      const now = Date.now();
      Array.from(this.gameRooms.entries()).forEach(([roomId, room]) => {
        if (now - room.lastActivity > HttpMultiplayerManager.ROOM_TIMEOUT) {
          this.gameRooms.delete(roomId);
          console.log(`🧹 Cleaned up inactive room ${roomId}`);
        }
      });
    }, 15000); // Check every 15 seconds
  }

  private getAvailableRoom(): { id: number } {
    // Find room with available slots
    for (const [id, room] of Array.from(this.gameRooms.entries())) {
      if (room.players.size < HttpMultiplayerManager.MAX_PLAYERS_PER_ROOM) {
        return { id };
      }
    }

    // All rooms full, create new one
    const newRoomId = this.nextRoomId++;
    const newRoom: GameRoom = {
      players: new Map(),
      lastActivity: Date.now()
    };
    
    this.gameRooms.set(newRoomId, newRoom);
    console.log(`🚀 Created new multiplayer room ${newRoomId}`);
    
    return { id: newRoomId };
  }
}