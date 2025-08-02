# replit.md

## Overview

This project is a real-time multiplayer snake game with integrated betting mechanics. Its core purpose is to provide an engaging and competitive gaming experience where players can customize snakes, manage virtual currency, interact with friends, and compete globally. The vision is to create a dynamic online arena for snake game enthusiasts, leveraging modern web technologies for a smooth and interactive user experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript.
- **Routing**: Wouter (lightweight React router).
- **Styling**: Tailwind CSS with shadcn/ui component library. Dark theme with neon color accents (yellow, green, blue). Responsive design.
- **State Management**: React Context API.
- **Data Fetching**: TanStack Query (React Query).
- **Build Tool**: Vite.
- **UI/UX Decisions**: Clean, minimal canvas-only display during gameplay with essential minimap and controls. Retro loading screen. Home screen snake appearance consistent with in-game. Proportional eye scaling for snakes.

### Backend Architecture
- **Runtime**: Node.js with Express.js server.
- **Language**: TypeScript.
- **Real-time Communication**: WebSocket server for live game updates and server-authoritative game state.
- **API Design**: RESTful endpoints.

### Database Layer
- **ORM**: Drizzle ORM for type-safe operations.
- **Database**: PostgreSQL with persistent storage.
- **Migrations**: Drizzle Kit.
- **Schema**: Strongly typed with Zod validation and relations, including tables for users, games, gameParticipants, friendships, dailyCrates, and gameStates.

### Core System Features
- **Authentication**: Username/password based, user profile management.
- **Game Engine**: Real-time multiplayer, WebSocket-based communication, server-controlled game state (food, player positions), betting system. Snake growth completely capped at exactly 100 segments and 100 mass - no growth in size or strength beyond this limit. Dynamic segment spacing system where small snakes have tight segments (12px) that gradually spread out to 18px for larger snakes, creating natural elongated appearance. Money counter with consistent styling and positioning. Snake death results in full disappearance and proper loot drop. Performance optimized for large snakes. Mass counter in top-right corner shows progress to 100 max.
- **Social Features**: Friend system, global leaderboard, user statistics tracking.
- **Virtual Economy**: Dual currency (game currency and SOL), daily crate rewards, betting mechanics, wallet management.
- **Bot AI**: State-based AI (wander, foodHunt, avoid, aggro), strategic boosting, realistic movement patterns.
- **Technical Implementations**: Time-based catch-up movement for inactive browser tabs. Dynamic turn speed for snakes when boosting. Death food drops along snake body segments. Visual effects include glow effects for food, snake shadows, and boosting outlines.

## External Dependencies

- **@neondatabase/serverless**: Serverless PostgreSQL connection.
- **@radix-ui/*** Headless UI primitives.
- **@tanstack/react-query**: Server state management and caching.
- **drizzle-orm**: Type-safe ORM with PostgreSQL support.
- **ws**: WebSocket library for real-time communication.
- **zod**: Runtime type validation and schema definition.
- **tailwindcss**: Utility-first CSS framework.