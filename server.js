import { WebSocketServer } from "ws";
const wss = new WebSocketServer({ port: 3000 });

const players = new Map();

wss.on("connection", function connection(ws) {
  const id = Date.now() + Math.random();
  players.set(id, { x: 0, y: 0, angle: 0 });

  ws.on("message", function incoming(message) {
    try {
      const data = JSON.parse(message);
      players.set(id, data);
    } catch {}
  });

  ws.on("close", () => {
    players.delete(id);
  });

  setInterval(() => {
    const allPlayers = Array.from(players.values());
    ws.send(JSON.stringify({ type: "players", players: allPlayers }));
  }, 50);
});

console.log("Simple WebSocket server running on port 3000");