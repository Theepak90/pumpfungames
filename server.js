import { WebSocketServer } from "ws";
const wss = new WebSocketServer({ port: 3000 });

const players = new Map();
let gameRoom = null;

// Broadcast to all connected clients
function broadcastToAll(data) {
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify(data));
    }
  });
}

wss.on("connection", function connection(ws) {
  const playerId = Date.now() + Math.random();
  console.log(`Player ${playerId} connected. Total players: ${wss.clients.size}`);
  
  // Initialize player with empty segments array
  players.set(playerId, { 
    id: playerId,
    segments: [], 
    color: '#d55400',
    money: 1.00 
  });

  ws.playerId = playerId;

  ws.on("message", function incoming(message) {
    try {
      const data = JSON.parse(message);
      // Update player's full snake data (segments, money, etc)
      players.set(playerId, {
        id: playerId,
        segments: data.segments || [],
        color: data.color || '#d55400',
        money: data.money || 1.00
      });
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  });

  ws.on("close", () => {
    console.log(`Player ${playerId} disconnected. Remaining players: ${wss.clients.size - 1}`);
    players.delete(playerId);
  });
});

// Broadcast game state to all players every 50ms
setInterval(() => {
  if (wss.clients.size > 0) {
    const allPlayers = Array.from(players.values());
    broadcastToAll({ type: "players", players: allPlayers });
  }
}, 50);

console.log("Simple WebSocket server running on port 3000");