// Service Worker for Snake Game Background Sync
// Keeps the game state synchronized even when the browser tab is inactive

const CACHE_NAME = 'snake-game-v1';
const SW_VERSION = '1.0.0';

// Game state storage
let gameState = {
  isGameActive: false,
  snakePosition: { x: 0, y: 0 },
  snakeAngle: 0,
  snakeSpeed: 2.0,
  isBoosting: false,
  lastUpdate: 0,
  playerId: null,
  roomId: null,
  wsUrl: null
};

// Background sync interval
let backgroundSyncInterval = null;
const SYNC_INTERVAL = 33; // 30 FPS background updates

// WebSocket connection for background sync
let backgroundWS = null;

console.log(`🔧 Service Worker ${SW_VERSION} initializing...`);

// Install event
self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', event => {
  console.log('🔧 Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// Message handling from main thread
self.addEventListener('message', event => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'GAME_START':
      console.log('🎮 SW: Game started, initializing background sync');
      gameState = {
        ...gameState,
        isGameActive: true,
        playerId: data.playerId,
        roomId: data.roomId,
        wsUrl: data.wsUrl,
        snakePosition: data.snakePosition || { x: 0, y: 0 },
        snakeAngle: data.snakeAngle || 0,
        snakeSpeed: data.snakeSpeed || 2.0,
        lastUpdate: Date.now()
      };
      startBackgroundSync();
      break;
      
    case 'GAME_UPDATE':
      if (gameState.isGameActive) {
        gameState.snakePosition = data.snakePosition;
        gameState.snakeAngle = data.snakeAngle;
        gameState.snakeSpeed = data.snakeSpeed;
        gameState.isBoosting = data.isBoosting || false;
        gameState.lastUpdate = Date.now();
      }
      break;
      
    case 'GAME_STOP':
      console.log('🛑 SW: Game stopped, clearing background sync');
      gameState.isGameActive = false;
      stopBackgroundSync();
      closeBackgroundWS();
      break;
      
    case 'VISIBILITY_CHANGE':
      if (data.hidden && gameState.isGameActive) {
        console.log('📱 SW: Tab became inactive, starting background movement');
        startBackgroundSync();
      } else if (!data.hidden) {
        console.log('📱 SW: Tab became active, stopping background movement');
        stopBackgroundSync();
      }
      break;
  }
});

// Start background sync when tab is inactive
function startBackgroundSync() {
  if (backgroundSyncInterval) return; // Already running
  
  console.log('🔄 SW: Starting background sync interval');
  backgroundSyncInterval = setInterval(() => {
    if (!gameState.isGameActive) {
      stopBackgroundSync();
      return;
    }
    
    // Simulate snake movement based on last known state
    updateSnakePosition();
    
    // Send position update to server if WebSocket is available
    sendBackgroundUpdate();
    
  }, SYNC_INTERVAL);
}

// Stop background sync
function stopBackgroundSync() {
  if (backgroundSyncInterval) {
    console.log('🛑 SW: Stopping background sync interval');
    clearInterval(backgroundSyncInterval);
    backgroundSyncInterval = null;
  }
}

// Update snake position based on current angle and speed
function updateSnakePosition() {
  const now = Date.now();
  const deltaTime = now - gameState.lastUpdate;
  
  // Calculate movement based on time elapsed
  const moveDistance = (gameState.snakeSpeed * deltaTime) / 16.67; // Normalize to 60fps
  
  // Update position
  gameState.snakePosition.x += Math.cos(gameState.snakeAngle) * moveDistance;
  gameState.snakePosition.y += Math.sin(gameState.snakeAngle) * moveDistance;
  
  // Keep within map bounds (2000x2000 map centered at 2000,2000)
  const MAP_CENTER = 2000;
  const MAP_RADIUS = 1800;
  const distFromCenter = Math.sqrt(
    (gameState.snakePosition.x - MAP_CENTER) ** 2 + 
    (gameState.snakePosition.y - MAP_CENTER) ** 2
  );
  
  if (distFromCenter > MAP_RADIUS) {
    // Bounce off boundary by reversing direction
    gameState.snakeAngle += Math.PI;
    gameState.snakePosition.x = MAP_CENTER + Math.cos(gameState.snakeAngle) * (MAP_RADIUS - 50);
    gameState.snakePosition.y = MAP_CENTER + Math.sin(gameState.snakeAngle) * (MAP_RADIUS - 50);
  }
  
  gameState.lastUpdate = now;
}

// Send background position update to server
function sendBackgroundUpdate() {
  if (!backgroundWS || backgroundWS.readyState !== WebSocket.OPEN) {
    initBackgroundWebSocket();
    return;
  }
  
  const updateData = {
    type: 'backgroundUpdate',
    playerId: gameState.playerId,
    position: gameState.snakePosition,
    angle: gameState.snakeAngle,
    speed: gameState.snakeSpeed,
    isBoosting: gameState.isBoosting,
    timestamp: Date.now()
  };
  
  try {
    backgroundWS.send(JSON.stringify(updateData));
  } catch (error) {
    console.error('🚨 SW: Failed to send background update:', error);
    closeBackgroundWS();
  }
}

// Initialize background WebSocket connection
function initBackgroundWebSocket() {
  if (!gameState.wsUrl || backgroundWS) return;
  
  try {
    console.log('🔌 SW: Connecting background WebSocket...');
    backgroundWS = new WebSocket(gameState.wsUrl);
    
    backgroundWS.onopen = () => {
      console.log('✅ SW: Background WebSocket connected');
    };
    
    backgroundWS.onclose = () => {
      console.log('❌ SW: Background WebSocket disconnected');
      backgroundWS = null;
    };
    
    backgroundWS.onerror = (error) => {
      console.error('🚨 SW: Background WebSocket error:', error);
      backgroundWS = null;
    };
    
  } catch (error) {
    console.error('🚨 SW: Failed to create background WebSocket:', error);
  }
}

// Close background WebSocket
function closeBackgroundWS() {
  if (backgroundWS) {
    console.log('🔌 SW: Closing background WebSocket');
    backgroundWS.close();
    backgroundWS = null;
  }
}

// Handle fetch events (for caching if needed)
self.addEventListener('fetch', event => {
  // Only handle game-related requests
  if (event.request.url.includes('/api/') || event.request.url.includes('/ws')) {
    // Let these pass through for real-time functionality
    return;
  }
});

console.log('🔧 Service Worker setup complete');