# replit.md

## Overview

This is a multiplayer snake game application built with a modern web stack. The application features real-time gameplay where multiple players compete in snake matches with betting mechanics. Players can customize their snakes, manage virtual currency, maintain friend lists, and compete on global leaderboards.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Enhanced Bot AI System (Latest - January 2025)
- Rebuilt bot movement system to eliminate circular patterns
- Implemented state-based AI: hunting, exploring, escaping modes
- Added straight-line goal-based movement with distant waypoints
- Drastically reduced boost frequency with longer cooldowns (120-240 frames)
- Bots now actively hunt player when advantageous and collect food strategically
- Added stuck detection and anti-circular movement algorithms
- Enhanced threat avoidance with appropriate sensitivity levels
- All bots start with exactly $1.00, only increase from money crates

### Visual and Collision System Updates
- Bot eyes now use player's rotated square system with proper orientation
- Added drop shadows for bots when not boosting, outlines only when boosting
- Capped snake segments at maximum 250 for performance
- Enhanced eye-based collision detection for precise gameplay
- Big orange test food added back (5% spawn rate, 25 mass, size 20)

### Money Balance System
- Added money balance display above snake head starting at $1.00
- Money only increases when killing other snakes (minimum $0.50 or 5% of bot's mass)
- Money resets to $1.00 when game restarts
- Display scales with snake size and has outline for visibility

### Tab Switching System
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
- **Routing**: Wouter (lightweight React router)
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