import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { SlitherServer } from "./slitherServer";

export function registerSlitherRoutes(app: Express): Server {
  const httpServer = createServer(app);
  
  // Create WebSocket server
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: "/ws" 
  });
  
  // Create Slither game server
  const slitherServer = new SlitherServer();
  
  console.log("🐍 Slither.io WebSocket server started");
  
  // Handle WebSocket connections
  wss.on('connection', (socket: WebSocket) => {
    console.log('New WebSocket connection');
    
    socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('Received message:', message.type);
        
        switch (message.type) {
          case 'CREATE_GAME':
            handleCreateGame(socket, message.data, slitherServer);
            break;
            
          case 'JOIN_GAME':
            handleJoinGame(socket, message.data, slitherServer);
            break;
            
          case 'UPDATE_POSITION':
            handleUpdatePosition(socket, message.data, slitherServer);
            break;
            
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        socket.send(JSON.stringify({
          type: 'JOIN_ERROR',
          data: { message: 'Invalid message format' }
        }));
      }
    });
    
    socket.on('close', () => {
      console.log('WebSocket connection closed');
    });
    
    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
  
  return httpServer;
}

// Handle create game request
function handleCreateGame(socket: WebSocket, data: any, slitherServer: SlitherServer) {
  try {
    const { username } = data;
    if (!username || typeof username !== 'string') {
      socket.send(JSON.stringify({
        type: 'JOIN_ERROR',
        data: { message: 'Username is required' }
      }));
      return;
    }
    
    const room = slitherServer.addPlayerToRoom(socket, username);
    if (!room) {
      socket.send(JSON.stringify({
        type: 'JOIN_ERROR',
        data: { message: 'Failed to create game' }
      }));
      return;
    }
    
    // Send success response
    socket.send(JSON.stringify({
      type: 'JOIN_SUCCESS',
      data: { roomId: room.gameCode }
    }));
    
    // Send game code
    socket.send(JSON.stringify({
      type: 'SET_GAME_CODE',
      data: { gameCode: room.gameCode }
    }));
    
    console.log(`✅ Created game for ${username}, room: ${room.gameCode}`);
    
  } catch (error) {
    console.error('Error creating game:', error);
    socket.send(JSON.stringify({
      type: 'JOIN_ERROR',
      data: { message: 'Failed to create game' }
    }));
  }
}

// Handle join game request
function handleJoinGame(socket: WebSocket, data: any, slitherServer: SlitherServer) {
  try {
    const { username, gameCode } = data;
    if (!username || typeof username !== 'string') {
      socket.send(JSON.stringify({
        type: 'JOIN_ERROR',
        data: { message: 'Username is required' }
      }));
      return;
    }
    
    if (!gameCode || typeof gameCode !== 'string') {
      socket.send(JSON.stringify({
        type: 'JOIN_ERROR',
        data: { message: 'Game code is required' }
      }));
      return;
    }
    
    const room = slitherServer.addPlayerToRoom(socket, username, gameCode);
    if (!room) {
      socket.send(JSON.stringify({
        type: 'JOIN_ERROR',
        data: { message: 'Game not found or room is full' }
      }));
      return;
    }
    
    // Send success response
    socket.send(JSON.stringify({
      type: 'JOIN_SUCCESS',
      data: { roomId: room.gameCode }
    }));
    
    // Send game code
    socket.send(JSON.stringify({
      type: 'SET_GAME_CODE',
      data: { gameCode: room.gameCode }
    }));
    
    console.log(`✅ ${username} joined game: ${room.gameCode}`);
    
  } catch (error) {
    console.error('Error joining game:', error);
    socket.send(JSON.stringify({
      type: 'JOIN_ERROR',
      data: { message: 'Failed to join game' }
    }));
  }
}

// Handle position update
function handleUpdatePosition(socket: WebSocket, data: any, slitherServer: SlitherServer) {
  try {
    const { newHead, removeTail } = data;
    
    if (!newHead || !removeTail) {
      return; // Invalid position data
    }
    
    // Find the player and room for this socket
    const rooms = slitherServer.getRooms();
    for (const room of rooms) {
      for (const [playerId, player] of room.players) {
        if (player.socket === socket) {
          slitherServer.updatePlayerPosition(playerId, room, newHead, removeTail);
          return;
        }
      }
    }
    
  } catch (error) {
    console.error('Error updating position:', error);
  }
}

// API Routes for game statistics (optional)
export function registerSlitherAPI(app: Express, slitherServer: SlitherServer) {
  app.get('/api/slither/rooms', (req, res) => {
    const rooms = slitherServer.getRooms().map(room => ({
      gameCode: room.gameCode,
      playerCount: room.players.size,
      maxPlayers: room.maxPlayers,
    }));
    res.json(rooms);
  });
  
  app.get('/api/slither/room/:code', (req, res) => {
    const room = slitherServer.getRoom(req.params.code);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    const playerList = Array.from(room.players.values()).map(player => ({
      username: player.username,
      score: player.snake.score,
      segments: player.snake.body.length,
    }));
    
    res.json({
      gameCode: room.gameCode,
      players: playerList,
      orbCount: room.orbs.size,
    });
  });
}