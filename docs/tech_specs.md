# Quoridor Game - Technical Specifications

## Tech Stack

### Frontend
- **React 18** + TypeScript + Vite
- **Tailwind CSS** - styling
- **Socket.io-client** - real-time communication
- **React Router** - simple routing
- **Axios** - HTTP requests

### Backend
- **Node.js** + Express + TypeScript
- **Socket.io** - real-time rooms
- **Passport.js** + JWT - authentication
- **bcrypt** - password hashing
- **Drizzle ORM** - database operations
- **SQLite** - database

### Deployment
- **Docker Compose** - local development
- **Dockerfile** - multi-stage builds
- **dotenv** - configuration

## Project Structure

```
quoridor-game/
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API calls, socket handling
│   │   └── types/          # TypeScript types
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/         # Express routes
│   │   ├── socket/         # Socket.io handlers
│   │   ├── db/            # Drizzle schema & migrations
│   │   ├── auth/          # Passport config
│   │   └── game/          # Game engine integration
│   └── package.json
├── shared/
│   └── types.ts           # Shared TypeScript interfaces
└── docker-compose.yml
```

## Core Interfaces

### Game Types
```typescript
// shared/types.ts
export interface Player {
  id: string;
  username: string;
  position: { x: number; y: number };
  wallsRemaining: number;
}

export interface Wall {
  position: { x: number; y: number };
  orientation: 'horizontal' | 'vertical';
}

export interface GameState {
  id: string;
  players: Player[];
  walls: Wall[];
  currentPlayerIndex: number;
  status: 'waiting' | 'playing' | 'finished';
  winner?: string;
  createdAt: Date;
}

export interface Move {
  type: 'pawn' | 'wall';
  playerId: string;
  position: { x: number; y: number };
  orientation?: 'horizontal' | 'vertical';
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  maxPlayers: 2 | 4;
  gameState?: GameState;
  status: 'lobby' | 'playing' | 'finished';
}
```

### API Interfaces
```typescript
// Authentication
POST /api/auth/register { username: string; password: string }
POST /api/auth/login { username: string; password: string }
GET /api/auth/me

// Rooms
POST /api/rooms { maxPlayers: 2 | 4 }
POST /api/rooms/join { code: string }
GET /api/rooms/:id

// Game
POST /api/games/:id/move { move: Move }
GET /api/games/:id/state
```

### Socket Events
```typescript
// Client -> Server
'join-room' { roomId: string; userId: string }
'player-ready' { roomId: string; ready: boolean }
'make-move' { roomId: string; move: Move }
'leave-room' { roomId: string }

// Server -> Client
'room-updated' { room: Room }
'game-started' { gameState: GameState }
'move-made' { gameState: GameState; move: Move }
'player-joined' { player: Player }
'player-left' { playerId: string }
'game-finished' { winner: string }
```

## Database Schema (Drizzle)

```typescript
// backend/src/db/schema.ts
import { pgTable, uuid, varchar, integer, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  gamesPlayed: integer('games_played').default(0),
  gamesWon: integer('games_won').default(0),
  createdAt: timestamp('created_at').defaultNow()
});

export const rooms = pgTable('rooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 6 }).unique().notNull(),
  hostId: uuid('host_id').references(() => users.id),
  maxPlayers: integer('max_players').notNull(),
  status: varchar('status', { length: 20 }).default('lobby'),
  createdAt: timestamp('created_at').defaultNow()
});

export const games = pgTable('games', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => rooms.id),
  gameState: jsonb('game_state').notNull(),
  status: varchar('status', { length: 20 }).default('playing'),
  winnerId: uuid('winner_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  finishedAt: timestamp('finished_at')
});
```

## Game Engine Interface

```typescript
// For your friend to implement
export interface GameEngine {
  createGame(playerIds: string[], playerCount: 2 | 4): GameState;
  validateMove(gameState: GameState, move: Move): boolean;
  applyMove(gameState: GameState, move: Move): GameState;
  checkWinner(gameState: GameState): string | null;
  getValidMoves(gameState: GameState, playerId: string): Move[];
}

// AI Interface (future)
export interface AIPlayer {
  getMove(gameState: GameState, playerId: string): Move;
  getDifficulty(): 'easy' | 'medium' | 'hard';
}
```

## Socket.io Room Architecture

```typescript
// backend/src/socket/roomHandler.ts
class RoomManager {
  private rooms = new Map<string, Room>();
  
  joinRoom(socket: Socket, roomId: string, userId: string) {
    socket.join(roomId);
    // Update room state
    // Broadcast to room
  }
  
  handleMove(socket: Socket, roomId: string, move: Move) {
    // Validate move with game engine
    // Update game state
    // Broadcast to all players in room
  }
}
```

## Authentication Flow

```typescript
// backend/src/auth/passport.ts
passport.use(new LocalStrategy(
  async (username: string, password: string, done) => {
    // Query user with Drizzle
    // Validate password with bcrypt
    // Return user or error
  }
));

// JWT middleware for protected routes
const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  // Verify JWT token
  // Attach user to request
};
```

## Docker Configuration

```yaml
# docker-compose.yml
version: '3.8'
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]
    
  backend:
    build: ./backend
    ports: ["3001:3001"]
    environment:
      DB_FILE_NAME: file:quoridor.db
      JWT_SECRET: super-secret-jwt-key
    depends_on: [db]
```

## Development Workflow

1. **Setup:** `docker-compose up` - everything runs
2. **Frontend:** Hot reload on file changes
3. **Backend:** Nodemon for auto-restart
4. **Database:** Drizzle migrations with `npm run db:migrate`
5. **Types:** Shared types auto-imported

## Key Libraries & Versions

```json
{
  "frontend": {
    "react": "^18.0.0",
    "socket.io-client": "^4.7.0",
    "axios": "^1.6.0",
    "tailwindcss": "^3.4.0"
  },
  "backend": {
    "express": "^4.18.0",
    "socket.io": "^4.7.0",
    "passport": "^0.7.0",
    "passport-local": "^1.0.0",
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0",
    "drizzle-orm": "^0.29.0",
    "drizzle-kit": "^0.20.0"
  }
}
```

This architecture prioritizes simplicity and functionality. Everything is straightforward, well-documented, and AI-assistant friendly. No fancy patterns, just working code that gets the job done.