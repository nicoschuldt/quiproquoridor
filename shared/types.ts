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
  selectedPawnTheme: string;
  
  // AI fields
  isAI: boolean;
  aiDifficulty?: AIDifficulty;
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
  
  // AI fields
  isAI: boolean;
  aiDifficulty?: AIDifficulty;
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
  'player-ready': (data: { roomId: string; ready: boolean }) => void;
  
  // Game events (NEW)
  'start-game': (data: { roomId: string }) => void;
  'make-move': (data: { roomId: string; move: Omit<Move, 'id' | 'timestamp'> }) => void;
  'request-game-state': (data: { roomId: string }) => void;
  'forfeit-game': (data: { roomId: string }) => void;
  
  // Connection events
  'ping': () => void;
}

// Server -> Client Events
export interface ServerToClientEvents {
  // Room events
  'room-updated': (data: { room: Room }) => void;
  'player-joined': (data: { player: Player }) => void;
  'player-left': (data: { playerId: string }) => void;
  'player-ready-changed': (data: { playerId: string; ready: boolean }) => void;
  
  // Game events (NEW)
  'game-started': (data: { gameState: GameState }) => void;
  'move-made': (data: { move: Move; gameState: GameState }) => void;
  'game-finished': (data: { gameState: GameState; winner: Player }) => void;
  'invalid-move': (data: { error: string; originalMove: Omit<Move, 'id' | 'timestamp'> }) => void;
  'game-state-sync': (data: { gameState: GameState; validMoves?: Move[] }) => void;
  'player-forfeited': (data: { playerId: string; playerName: string; gameState: GameState }) => void;
  'disconnection-warning': (data: { playerId: string; playerName: string; timeoutSeconds: number }) => void;
  'reconnection-success': (data: { playerId: string; playerName: string; gameState: GameState }) => void;
  
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
// AI ENGINE INTERFACE
// ==========================================

export interface AIEngine {
  /**
   * Generates a move for an AI player
   */
  generateMove(gameState: GameState, playerId: string): Promise<Omit<Move, 'id' | 'timestamp'>>;
  
  /**
   * Gets the AI's difficulty level
   */
  getDifficulty(): AIDifficulty;
  
  /**
   * Gets a display name for this AI
   */
  getName(): string;
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

// ==========================================
// SHOP & THEME SYSTEM TYPES
// ==========================================

export type ThemeType = 'board' | 'pawn';
export type TransactionType = 'coin_purchase' | 'theme_purchase' | 'game_reward';

export interface ShopItem {
  id: string; // e.g., 'board_forest', 'pawn_knights'
  name: string; // e.g., 'Forest Theme', 'Medieval Knights'
  description?: string; // e.g., 'Mystical forest themed board'
  type: ThemeType;
  priceCoins: number;
  cssClass: string; // e.g., 'theme-board-forest'
  previewImageUrl?: string; // e.g., '/images/themes/forest-preview.jpg'
  isActive: boolean;
  createdAt: Date;
}

export interface UserPurchase {
  id: string;
  userId: string;
  shopItemId: string;
  purchasedAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number; // Positive = gain, negative = spend
  description?: string;
  shopItemId?: string;
  stripeSessionId?: string; // For coin purchases via Stripe
  createdAt: Date;
}

export interface UserThemes {
  selectedBoardTheme: string; // CSS class name
  selectedPawnTheme: string; // CSS class name
}

export interface GameThemes {
  [playerId: string]: {
    boardTheme: string; // CSS class for board (only visible to this player)
    pawnTheme: string; // CSS class for pawn (visible to all)
  };
}

// Shop API Request/Response Types
export interface ShopBrowseResponse {
  available: ShopItem[]; // Themes user doesn't own
  owned: ShopItem[]; // Themes user owns
  selected: UserThemes; // Current active themes
  coinBalance: number;
}

export interface PurchaseThemeRequest {
  shopItemId: string;
}

export interface PurchaseThemeResponse {
  success: boolean;
  newBalance: number;
  purchasedItem: ShopItem;
}

export interface SelectThemeRequest {
  themeType: ThemeType;
  cssClass: string; // Must be owned by user
}

export interface UserBalanceResponse {
  coinBalance: number;
  totalSpent: number;
  totalEarned: number;
}

export interface TransactionHistoryResponse {
  transactions: Transaction[];
  totalCount: number;
}

// Enhanced User Profile with Shop Data
export interface UserProfileWithShop extends UserProfile {
  coinBalance: number;
  selectedBoardTheme: string;
  selectedPawnTheme: string;
}

// ==========================================
// STRIPE PAYMENT TYPES
// ==========================================

export interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  priceUSD: number;
  stripePriceId: string;
  popularBadge?: boolean;
  bonusCoins?: number; // Extra coins for better value
}

export interface CreateCheckoutRequest {
  packageId: 'starter' | 'popular' | 'pro';
}

export interface CreateCheckoutResponse {
  checkoutUrl: string;
  sessionId: string;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
}

// ==========================================
// Profile API Types
// ==========================================

export interface GameHistoryEntry {
  gameId: string;
  playerIndex: number;
  color: PlayerColor;
  isWinner: boolean;
  wallsUsed: number;
  gameStatus: GameStatus;
  gameStartedAt: Date | null;
  gameFinishedAt: Date | null;
}

export interface TransactionHistoryEntry {
  id: string;
  type: TransactionType;
  amount: number;
  description: string | null;
  shopItemId: string | null;
  stripeSessionId: string | null;
  createdAt: Date;
}

export interface UserStatsResponse {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  totalCoinsEarned: number;
  totalCoinsSpent: number;
}

// ==========================================