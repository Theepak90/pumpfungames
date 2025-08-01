import express, { type Request, Response, NextFunction } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);

  // Set up WebSocket server for multiplayer
  const wss = new WebSocketServer({ 
    server,
    path: '/game-ws'
  });

  const players = new Map();

  // Broadcast to all connected clients
  function broadcastToAll(data: any) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(data));
        } catch (error) {
          console.error('Error sending WebSocket message:', error);
        }
      }
    });
  }

  wss.on("connection", function connection(ws: any) {
    const playerId = Date.now() + Math.random();
    log(`Player ${playerId} connected. Total players: ${wss.clients.size}`);
    
    // Initialize player
    players.set(playerId, { 
      id: playerId,
      segments: [], 
      color: '#d55400',
      money: 1.00 
    });

    ws.playerId = playerId;

    ws.on("message", function incoming(message: any) {
      try {
        const data = JSON.parse(message.toString());
        // Update player's snake data
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
      log(`Player ${playerId} disconnected. Remaining players: ${wss.clients.size - 1}`);
      players.delete(playerId);
    });

    ws.on("error", (error: any) => {
      console.error("WebSocket error:", error);
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

  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    log(`Multiplayer WebSocket ready at /game-ws`);
  });
})();
