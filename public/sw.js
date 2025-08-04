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
      console.log('📱 SW: Visibility change:', data.hidden ? 'hidden' : 'visible');
      console.log('📱 SW: Game active:', gameState.isGameActive);
      if (data.hidden && gameState.isGameActive) {
        console.log('📱 SW: Tab became inactive, starting background movement');
        // Update game state with latest values
        if (data.snakePosition) gameState.snakePosition = data.snakePosition;
        if (data.snakeAngle !== undefined) gameState.snakeAngle = data.snakeAngle;
        if (data.snakeSpeed !== undefined) gameState.snakeSpeed = data.snakeSpeed;
        if (data.isBoosting !== undefined) gameState.isBoosting = data.isBoosting;
        gameState.lastUpdate = Date.now();
        
        startBackgroundSync();
        initBackgroundWebSocket();
      } else if (!data.hidden) {
        console.log('📱 SW: Tab became active, stopping background movement');
        stopBackgroundSync();
        closeBackgroundWS();
      }
      break;
  }
});

// Start background sync when tab is inactive
function startBackgroundSync() {
  if (backgroundSyncInterval) {
    console.log('🔄 SW: Background sync already running');
    return; // Already running
  }
  
  console.log('🔄 SW: Starting background sync interval');
  console.log('🔄 SW: Game state:', gameState);
  
  backgroundSyncInterval = setInterval(() => {
    if (!gameState.isGameActive) {
      console.log('🛑 SW: Game not active, stopping background sync');
      stopBackgroundSync();
      return;
    }
    
    // Simulate snake movement based on last known state
    updateSnakePosition();
    
    // Send position update to server if WebSocket is available
    sendBackgroundUpdate();
    
  }, SYNC_INTERVAL);
  
  console.log('🔄 SW: Background sync started with interval:', SYNC_INTERVAL);
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
    console.log('🔌 SW: Background WebSocket not ready, initializing...');
    initBackgroundWebSocket();
    return;
  }
  
  // Create position update in the same format as the main game
  const updateData = {
    type: 'update', // Use same type as main game
    segments: [gameState.snakePosition], // Single segment for simplicity
    color: '#d55400',
    money: 0,
    totalMass: 6.0,
    segmentRadius: 8,
    visibleSegmentCount: 1
  };
  
  try {
    backgroundWS.send(JSON.stringify(updateData));
    console.log('📤 SW: Sent background update:', gameState.snakePosition);
  } catch (error) {
    console.error('🚨 SW: Failed to send background update:', error);
    closeBackgroundWS();
  }
}

// Initialize background WebSocket connection
function initBackgroundWebSocket() {
  if (!gameState.wsUrl) {
    console.log('🚨 SW: No WebSocket URL available');
    return;
  }
  
  if (backgroundWS && (backgroundWS.readyState === WebSocket.CONNECTING || backgroundWS.readyState === WebSocket.OPEN)) {
    console.log('🔌 SW: Background WebSocket already connected or connecting');
    return;
  }
  
  try {
    console.log('🔌 SW: Connecting background WebSocket to:', gameState.wsUrl);
    backgroundWS = new WebSocket(gameState.wsUrl);
    
    backgroundWS.onopen = () => {
      console.log('✅ SW: Background WebSocket connected successfully');
    };
    
    backgroundWS.onmessage = (event) => {
      // Handle messages from server if needed
      console.log('📨 SW: Received message:', event.data);
    };
    
    backgroundWS.onclose = (event) => {
      console.log('❌ SW: Background WebSocket disconnected:', event.code, event.reason);
      backgroundWS = null;
      
      // Attempt to reconnect after a delay if game is still active
      if (gameState.isGameActive && backgroundSyncInterval) {
        setTimeout(() => {
          console.log('🔄 SW: Attempting WebSocket reconnection...');
          initBackgroundWebSocket();
        }, 2000);
      }
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