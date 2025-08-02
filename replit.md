# replit.md

## Overview

This is a multiplayer snake game application built with a modern web stack. The application features real-time gameplay where multiple players compete in snake matches with betting mechanics. Players can customize their snakes, manage virtual currency, maintain friend lists, and compete on global leaderboards.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Fixed Duplicate Money Counter UI Issue (Latest)
- **Removed duplicate money counter**: Eliminated bottom money counter that was creating double display above snake heads
- **Single visible money counter**: Only one properly styled money counter now appears, visible to all players
- **Clean UI experience**: No more confusing duplicate dollar amounts above snake heads
- **Maintained main styling**: Kept the top money counter with proper Press Start 2P font and scaling

### Fixed Snake Death Rendering Issue
- **Complete snake disappearance on death**: Snake body now fully disappears immediately when crashing into other players
- **Fixed game loop continuation bug**: Game loop now stops completely when gameOver=true, preventing re-rendering of dead snake
- **Immediate collision response**: Canvas clears instantly on collision with immediate visual feedback
- **Proper death loot system**: Money crates and food drop correctly along snake body segments
- **Clean visual transitions**: No more ghost snake appearing after death due to animation frame continuation
- **Server-side collision detection**: Server detects all player collisions and immediately removes crashed players
- **Death notification system**: Server sends death messages to crashed players with immediate local response
- **Stopped update race condition**: Crashed players immediately stop sending position updates to prevent re-appearing

### Implemented Server-Authoritative Multiplayer
- **Real-time multiplayer functionality**: Players can see each other simultaneously on `/game`
- **Server-controlled game state**: All bots completely removed, food managed centrally by server
- **Synchronized game world**: Every player sees identical food in same locations
- **WebSocket communication**: Real-time updates every 50ms with player position broadcasting
- **Multiple player support**: Each tab connects as unique player with different colors
- **Shared game session**: No more separate lobbies - all players join the same world instance
- **Full snake body rendering**: Players see complete snakes with interpolated segments for smooth trails
- **Position synchronization**: Each player's segments are broadcast and rendered as full snake bodies
- **Proper visual separation**: Local player sees detailed snake rendering while other players appear as smooth server-rendered trails
- **Eliminated rendering conflicts**: Fixed duplicate snake and money display issues by separating local vs remote player rendering
- **Food system enhancements**: Added glow effects, attraction physics, and collision detection for server food
- **Snake size synchronization**: Fixed size mismatch where players appeared different sizes on different screens
- **Complete visual consistency**: All snakes now appear identical in size and proportions across all player screens
- **Proportional eye scaling**: Eyes and pupils scale correctly with snake size for authentic appearance

### Fixed White Screen Flashing Issue
- **Removed WebSocket conflicts**: Eliminated WebSocket server that was interfering with Vite HMR
- **Stabilized Vite connection**: Fixed persistent connection lost/restart loop causing white flashing
- **Reverted to stable single-player**: Game now loads reliably without connection issues
- **Clean server setup**: Simplified Express server without conflicting WebSocket implementations
- **Improved user experience**: No more screen flashing or connection interruptions

### Home Screen Snake Improvements
- **Tighter segments**: Reduced segment spacing from 16 to 8 to match multiplayer game appearance
- **Enhanced food attraction**: Increased gravitational pull from 0.3 to 1.8 (6x stronger) for very dynamic interaction
- **Consistent visuals**: Home screen snake now identical to in-game snake with proper segment spacing
- **Improved animation**: Food moves toward snake very aggressively creating dramatic visual effects

### Loading Screen System
- **Retro loading screen**: Dark background (#15161b) with "SNAKE ARENA" title in Press Start 2P font
- **Fixed progress bar**: Now properly reaches 100% with defined stages (20%, 40%, 70%, 90%, 100%)
- **Proper initialization**: Game elements (food, bots, game loop) only spawn after loading completes
- **Smooth progression**: Eliminates jittering between 40-60% with stable step progression
- **Applied to both modes**: Both single-player (/game8999) and multiplayer (/multiplayer) versions

### Clean UI Overhaul
- **Removed all UI clutter**: Exit buttons, score displays, control instructions removed from all game modes
- **Eliminated audio system**: Complete removal of background music, sound effects, and volume controls
- **Added circular minimap**: Top-left corner showing snake positions with red dot for player and colored dots for AI bots
- **Clean instructions**: Bottom-left text showing "Hold Q to cash out" and "Left click to boost"
- **Minimal interface**: Games now have clean canvas-only display with essential minimap and controls

### Dual Game System
- **Multiplayer Game**: Home page "PLAY" button leads to `/multiplayer` with real-time WebSocket multiplayer
- **Single-player Game**: Available at `/game` for local gameplay with AI bots
- **Real-time synchronization**: WebSocket communication for multiplayer snake positions and movements
- **Simplified routing**: Clean two-game system without complex authentication or region selection

### Enhanced Bot AI System
- State-based AI with wander, foodHunt, avoid, and aggro behaviors
- Bots start with exactly $1.00 and only increase money through crate collection
- Bots avoid big orange test food but actively hunt regular food and money crates
- Aggressive player hunting when bots are larger than player
- Strategic boosting for escaping, hunting, and collecting valuable items
- Reduced dodging sensitivity for more aggressive gameplay
- Shadows like player snake when not boosting, white outline only when boosting
- Realistic movement patterns instead of circular wandering

### Money Balance System
- Added money balance display above snake head starting at $1.00
- Money only increases when killing other snakes (minimum $0.50 or 5% of bot's mass)
- Money resets to $1.00 when game restarts
- Display scales with snake size and has outline for visibility

### Tab Switching System (Latest)
- Implemented time-based catch-up movement for when browser tab is inactive
- Tracks exact time while tab is hidden using performance.now()
- When tab becomes active again, snake moves forward based on elapsed time
- Prevents JavaScript throttling issues that break background movement
- Snake appears exactly where it would have been if tab never switched

### Enhanced Turning System
- Snake turns 2x faster when boosting to maintain consistent turn radius
- Compensates for increased speed to prevent wide turns during boost
- Smooth angle interpolation with dynamic turn speed multiplier

### Enhanced Death Food System
- Death food drops along snake body segments (not just at death location)
- Regular death food is half size (7.5) and matches snake's color
- Food distribution spreads across entire snake path for realistic death mechanics
- Removed special medical cross items per user request

### Visual Effects System
- Food renders as solid colored circles with clean glow effects
- Snake has subtle drop shadow when not boosting for floating effect
- Clean white glow outline around entire snake when boosting (no overlapping segments)
- Boost effects scale properly with snake size

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router) with protected routes
- **Security**: Secret URL access (`/game8999`) with password protection
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: React Context API for global state (auth, game)
- **Data Fetching**: TanStack Query (React Query) for server state management
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript throughout the entire stack
- **Real-time Communication**: WebSocket server for live game updates
- **API Design**: RESTful endpoints for CRUD operations
- **Storage**: PostgreSQL database with Drizzle ORM (upgraded from in-memory storage)

### Database Layer
- **ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL with persistent storage
- **Migrations**: Drizzle Kit for schema management (`npm run db:push`)
- **Schema**: Strongly typed with Zod validation and relations
- **Tables**: users, games, gameParticipants, friendships, dailyCrates, gameStates

## Key Components

### Authentication System
- Username/password based authentication
- In-memory session storage for development
- User profile management with customizable snake appearance
- Balance tracking for both game currency and SOL tokens

### Game Engine
- Real-time multiplayer snake gameplay
- WebSocket-based communication for low-latency updates
- Game state management with player positions, scores, and eliminations
- Betting system with configurable bet amounts
- Regional server selection

### Social Features
- Friend system with friend requests and management
- Global leaderboard with live updates
- User statistics tracking (games played, kills, deaths, earnings)

### Virtual Economy
- Dual currency system (game currency and SOL)
- Daily crate rewards system
- Betting mechanics with winner-takes-all prize pools
- Wallet management with add/withdraw functionality

## Data Flow

1. **Authentication Flow**: User registers/logs in → Session created → User data cached in context
2. **Game Flow**: User joins lobby → WebSocket connection established → Real-time game state updates
3. **Social Flow**: Friend requests → Database updates → Real-time notifications via WebSocket
4. **Economy Flow**: Bet placement → Game participation → Winnings distribution → Balance updates

## External Dependencies

### Core Libraries
- **@neondatabase/serverless**: Serverless PostgreSQL connection
- **@radix-ui/***: Headless UI primitives for accessible components
- **@tanstack/react-query**: Server state management and caching
- **drizzle-orm**: Type-safe ORM with PostgreSQL support
- **ws**: WebSocket library for real-time communication
- **zod**: Runtime type validation and schema definition

### Development Tools
- **drizzle-kit**: Database schema management and migrations
- **tsx**: TypeScript execution for development server
- **esbuild**: Fast JavaScript bundler for production builds
- **tailwindcss**: Utility-first CSS framework

### UI Components
- Complete shadcn/ui component library implementation
- Dark theme with neon color accents (yellow, green, blue)
- Responsive design with mobile considerations
- Custom snake visualization components

## Deployment Strategy

### Development
- Vite dev server for frontend with HMR
- tsx for running TypeScript server directly
- PostgreSQL database for persistent data storage
- WebSocket server integrated with Express server

### Production
- Frontend: Vite build output served statically
- Backend: esbuild bundled server executable
- Database: Neon serverless PostgreSQL
- Environment: Designed for Replit deployment with specialized plugins

### Environment Configuration
- Database URL from environment variables
- Configurable WebSocket endpoints
- Development vs production asset serving
- Replit-specific development banner integration

The application is architected for easy scaling with the ability to add Redis for session storage, implement proper authentication tokens, and extend the game engine with more complex mechanics. The type-safe approach throughout the stack ensures reliability and maintainability.