// shared/types.ts
// Core Types - Foundation of the entire project

// ==========================================
// BASIC GAME TYPES
// ==========================================

export interface Position {
  x: number; // 0-8 for 9x9 board
  y: number; // 0-8 for 9x9 board
}

export type WallOrientation = 'horizontal' | 'vertical';
export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow';
export type GameStatus = 'waiting' | 'playing' | 'finished' | 'abandoned';
export type RoomStatus = 'lobby' | 'playing' | 'finished';
export type MoveType = 'pawn' | 'wall';

// ==========================================
// GAME ENTITIES
// ==========================================

export interface Wall {
  id: string;
  position: Position; // Top-left corner of the wall
  orientation: WallOrientation;
  playerId: string; // Who placed this wall
}

export interface Player {
  id: string;
  username: string;
  color: PlayerColor;
  position: Position;
  wallsRemaining: number;
  isConnected: boolean; // For handling disconnections
  joinedAt: Date;
}

export interface Move {
  id: string;
  type: MoveType;
  playerId: string;
  timestamp: Date;
  
  // For pawn moves
  fromPosition?: Position;
  toPosition?: Position;
  
  // For wall placement
  wallPosition?: Position;
  wallOrientation?: WallOrientation;
}

export interface GameState {
  id: string;
  players: Player[];
  walls: Wall[];
  currentPlayerIndex: number;
  status: GameStatus;
  winner?: string;
  moves: Move[]; // Complete move history
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  
  // Game settings
  maxPlayers: 2 | 4;
  timeLimit?: number; // Optional time limit per move in seconds
}

// ==========================================
// ROOM & MULTIPLAYER TYPES
// ==========================================

export interface Room {
  id: string;
  code: string; // 6-character join code
  hostId: string;
  players: Player[];
  maxPlayers: 2 | 4;
  status: RoomStatus;
  gameState?: GameState;
  createdAt: Date;
  
  // Room settings
  isPrivate: boolean;
  hasTimeLimit: boolean;
  timeLimitSeconds?: number;
}

export interface RoomMember {
  userId: string;
  username: string;
  isHost: boolean;
  joinedAt: Date;
}

// ==========================================
// API REQUEST/RESPONSE TYPES (UPDATED)
// ==========================================

// Standard API Response Format (as per cursorrules)
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

// Authentication
export interface RegisterRequest {
  username: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthData {
  token: string;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  username: string;
  gamesPlayed: number;
  gamesWon: number;
  createdAt: Date;
  coins: number;
}

// Room Operations
export interface CreateRoomRequest {
  maxPlayers: 2 | 4;
  isPrivate?: boolean;
  hasTimeLimit?: boolean;
  timeLimitSeconds?: number;
}

export interface JoinRoomRequest {
  code: string;
}

export interface RoomData {
  room: Room;
  isHost: boolean;
}

// Game Operations
export interface MakeMoveRequest {
  move: Omit<Move, 'id' | 'timestamp'>;
}

export interface GameStateData {
  gameState: GameState;
  validMoves: Move[];
}

// User Reconnection Data
export interface UserRoomStatus {
  roomId: string;
  roomStatus: RoomStatus;
  isHost: boolean;
}

// ==========================================
// SOCKET EVENT TYPES
// ==========================================

// Client -> Server Events
export interface ClientToServerEvents {
  // Room events
  'join-room': (data: { roomId: string }) => void;
  'leave-room': (data: { roomId: string }) => void;
  'start-game': (data: { roomId: string }) => void;
  
  // Game events
  'make-move': (data: { roomId: string; move: Omit<Move, 'id' | 'timestamp'> }) => void;
  'request-game-state': (data: { roomId: string }) => void;
  
  // Connection events
  'ping': () => void;
}

// Server -> Client Events
export interface ServerToClientEvents {
  // Room events
  'room-updated': (data: { room: Room }) => void;
  'player-joined': (data: { player: Player; room: Room }) => void;
  'player-left': (data: { playerId: string; room: Room }) => void;
  'room-full': (data: { room: Room }) => void;
  'game-started': (data: { gameState: GameState }) => void;
  
  // Game events
  'move-made': (data: { move: Move; gameState: GameState }) => void;
  'game-finished': (data: { winner: string; gameState: GameState }) => void;
  'invalid-move': (data: { error: string; move: Move }) => void;
  'game-state-updated': (data: { gameState: GameState }) => void;
  
  // Connection events
  'player-disconnected': (data: { playerId: string }) => void;
  'player-reconnected': (data: { playerId: string }) => void;
  'error': (data: { error: ApiError }) => void;
  'pong': () => void;
}

// ==========================================
// GAME ENGINE INTERFACE
// ==========================================

export interface GameEngine {
  // Core game operations
  createGame(playerIds: string[], maxPlayers: 2 | 4): GameState;
  validateMove(gameState: GameState, move: Omit<Move, 'id' | 'timestamp'>): boolean;
  applyMove(gameState: GameState, move: Omit<Move, 'id' | 'timestamp'>): GameState;
  
  // Game state queries
  isGameFinished(gameState: GameState): boolean;
  getWinner(gameState: GameState): string | null;
  getCurrentPlayer(gameState: GameState): Player;
  getValidMoves(gameState: GameState, playerId: string): Omit<Move, 'id' | 'timestamp'>[];
  
  // Validation helpers
  isValidPawnMove(gameState: GameState, fromPos: Position, toPos: Position, playerId: string): boolean;
  isValidWallPlacement(gameState: GameState, wallPos: Position, orientation: WallOrientation): boolean;
  hasValidPathToGoal(gameState: GameState, playerId: string): boolean;
  
  // Utility functions
  getPlayerById(gameState: GameState, playerId: string): Player | null;
  getPlayerStartPosition(playerIndex: number, maxPlayers: 2 | 4): Position;
  getPlayerGoalRow(playerIndex: number, maxPlayers: 2 | 4): number;
}

// ==========================================
// AI INTERFACE (Future)
// ==========================================

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export interface AIPlayer {
  id: string;
  difficulty: AIDifficulty;
  getMove(gameState: GameState, playerId: string): Promise<Omit<Move, 'id' | 'timestamp'>>;
  getName(): string;
}

export interface AIConfig {
  difficulty: AIDifficulty;
  thinkingTimeMs: number;
  randomnessFactor: number; // 0-1, how random the AI should be
}

// ==========================================
// DATABASE SCHEMA TYPES (for Drizzle)
// ==========================================

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  gamesPlayed: number;
  gamesWon: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomRecord {
  id: string;
  code: string;
  hostId: string;
  maxPlayers: number;
  status: RoomStatus;
  isPrivate: boolean;
  hasTimeLimit: boolean;
  timeLimitSeconds: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameRecord {
  id: string;
  roomId: string;
  gameState: GameState; // JSON field
  status: GameStatus;
  winnerId: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface GamePlayerRecord {
  id: string;
  gameId: string;
  userId: string;
  playerIndex: number;
  color: PlayerColor;
  finalPosition: Position; // JSON field
  wallsUsed: number;
  isWinner: boolean;
}

// ==========================================
// VALIDATION TYPES
// ==========================================

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  details?: any;
}

export interface MoveValidationResult extends ValidationResult {
  suggestedMoves?: Omit<Move, 'id' | 'timestamp'>[];
}

// ==========================================
// UTILITY TYPES
// ==========================================

export type Nullable<T> = T | null;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Common API patterns
export type CreateGameStateInput = Optional<GameState, 'id' | 'createdAt' | 'moves' | 'winner' | 'startedAt' | 'finishedAt'>;
export type CreatePlayerInput = Optional<Player, 'id' | 'joinedAt' | 'isConnected'>;
export type CreateRoomInput = Optional<Room, 'id' | 'code' | 'createdAt' | 'players' | 'gameState'>;

// Type guards for runtime checking
export const isPosition = (obj: any): obj is Position => {
  return typeof obj === 'object' && 
         typeof obj.x === 'number' && 
         typeof obj.y === 'number' &&
         obj.x >= 0 && obj.x <= 8 &&
         obj.y >= 0 && obj.y <= 8;
};

export const isMove = (obj: any): obj is Move => {
  return typeof obj === 'object' &&
         typeof obj.type === 'string' &&
         (obj.type === 'pawn' || obj.type === 'wall') &&
         typeof obj.playerId === 'string';
};

export const isPlayer = (obj: any): obj is Player => {
  return typeof obj === 'object' &&
         typeof obj.id === 'string' &&
         typeof obj.username === 'string' &&
         isPosition(obj.position) &&
         typeof obj.wallsRemaining === 'number';
};

// Constants
export const BOARD_SIZE = 9;
export const MAX_WALLS_2P = 10;
export const MAX_WALLS_4P = 5;
export const ROOM_CODE_LENGTH = 6;
export const MAX_USERNAME_LENGTH = 50;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_ROOM_IDLE_TIME = 30 * 60 * 1000; // 30 minutes

export const PLAYER_COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow'];

export const PLAYER_START_POSITIONS: Record<number, Position[]> = {
  2: [
    { x: 4, y: 0 }, // Player 1: bottom center
    { x: 4, y: 8 }  // Player 2: top center
  ],
  4: [
    { x: 4, y: 0 }, // Player 1: bottom center
    { x: 8, y: 4 }, // Player 2: right center
    { x: 4, y: 8 }, // Player 3: top center  
    { x: 0, y: 4 }  // Player 4: left center
  ]
};