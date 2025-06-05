export interface Position {
  x: number;
  y: number;
}

export type WallOrientation = 'horizontal' | 'vertical';
export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow';
export type GameStatus = 'waiting' | 'playing' | 'finished' | 'abandoned';
export type RoomStatus = 'lobby' | 'playing' | 'finished';
export type MoveType = 'pawn' | 'wall';

export interface Wall {
  id: string;
  position: Position;
  orientation: WallOrientation;
  playerId: string;
}

export interface Player {
  id: string;
  username: string;
  color: PlayerColor;
  position: Position;
  wallsRemaining: number;
  isConnected: boolean;
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
  
  fromPosition?: Position;
  toPosition?: Position;
  
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
  moves: Move[];
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  
  maxPlayers: 2 | 4;
  timeLimit?: number;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  maxPlayers: 2 | 4;
  status: RoomStatus;
  gameState?: GameState;
  createdAt: Date;
  
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
  
  isAI: boolean;
  aiDifficulty?: AIDifficulty;
}

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

export interface MakeMoveRequest {
  move: Omit<Move, 'id' | 'timestamp'>;
}

export interface GameStateData {
  gameState: GameState;
  validMoves: Move[];
}

export interface UserRoomStatus {
  roomId: string;
  roomStatus: RoomStatus;
  isHost: boolean;
}

export interface ClientToServerEvents {
  'join-room': (data: { roomId: string }) => void;
  'leave-room': (data: { roomId: string }) => void;
  'player-ready': (data: { roomId: string; ready: boolean }) => void;
  
  'start-game': (data: { roomId: string }) => void;
  'make-move': (data: { roomId: string; move: Omit<Move, 'id' | 'timestamp'> }) => void;
  'request-game-state': (data: { roomId: string }) => void;
  'forfeit-game': (data: { roomId: string }) => void;
  
  'ping': () => void;
}

export interface ServerToClientEvents {
  'room-updated': (data: { room: Room }) => void;
  'player-joined': (data: { player: Player }) => void;
  'player-left': (data: { playerId: string }) => void;
  'player-ready-changed': (data: { playerId: string; ready: boolean }) => void;
  
  'game-started': (data: { gameState: GameState }) => void;
  'move-made': (data: { move: Move; gameState: GameState }) => void;
  'game-finished': (data: { gameState: GameState; winner: Player }) => void;
  'invalid-move': (data: { error: string; originalMove: Omit<Move, 'id' | 'timestamp'> }) => void;
  'game-state-sync': (data: { gameState: GameState; validMoves?: Move[] }) => void;
  'player-forfeited': (data: { playerId: string; playerName: string; gameState: GameState }) => void;
  'disconnection-warning': (data: { playerId: string; playerName: string; timeoutSeconds: number }) => void;
  'reconnection-success': (data: { playerId: string; playerName: string; gameState: GameState }) => void;
  
  'player-disconnected': (data: { playerId: string }) => void;
  'player-reconnected': (data: { playerId: string }) => void;
  'error': (data: { error: ApiError }) => void;
  'pong': () => void;
}

export interface GameEngine {
  createGame(playerIds: string[], maxPlayers: 2 | 4): GameState;
  validateMove(gameState: GameState, move: Omit<Move, 'id' | 'timestamp'>): boolean;
  applyMove(gameState: GameState, move: Omit<Move, 'id' | 'timestamp'>): GameState;
  
  isGameFinished(gameState: GameState): boolean;
  getWinner(gameState: GameState): string | null;
  getCurrentPlayer(gameState: GameState): Player;
  getValidMoves(gameState: GameState, playerId: string): Omit<Move, 'id' | 'timestamp'>[];
  
  isValidPawnMove(gameState: GameState, fromPos: Position, toPos: Position, playerId: string): boolean;
  isValidWallPlacement(gameState: GameState, wallPos: Position, orientation: WallOrientation): boolean;
  hasValidPathToGoal(gameState: GameState, playerId: string): boolean;
  
  getPlayerById(gameState: GameState, playerId: string): Player | null;
  getPlayerStartPosition(playerIndex: number, maxPlayers: 2 | 4): Position;
  getPlayerGoalRow(playerIndex: number, maxPlayers: 2 | 4): number;
}

export interface AIEngine {
  generateMove(gameState: GameState, playerId: string): Promise<Omit<Move, 'id' | 'timestamp'>>;
  getDifficulty(): AIDifficulty;
  getName(): string;
}

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
  randomnessFactor: number;
}

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
  gameState: GameState;
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
  finalPosition: Position;
  wallsUsed: number;
  isWinner: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  details?: any;
}

export interface MoveValidationResult extends ValidationResult {
  suggestedMoves?: Omit<Move, 'id' | 'timestamp'>[];
}

export type Nullable<T> = T | null;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type CreateGameStateInput = Optional<GameState, 'id' | 'createdAt' | 'moves' | 'winner' | 'startedAt' | 'finishedAt'>;
export type CreatePlayerInput = Optional<Player, 'id' | 'joinedAt' | 'isConnected'>;
export type CreateRoomInput = Optional<Room, 'id' | 'code' | 'createdAt' | 'players' | 'gameState'>;

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

export const BOARD_SIZE = 9;
export const MAX_WALLS_2P = 10;
export const MAX_WALLS_4P = 5;
export const ROOM_CODE_LENGTH = 6;
export const MAX_USERNAME_LENGTH = 50;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_ROOM_IDLE_TIME = 30 * 60 * 1000;

export const PLAYER_COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow'];

export const PLAYER_START_POSITIONS: Record<number, Position[]> = {
  2: [
    { x: 4, y: 0 },
    { x: 4, y: 8 }
  ],
  4: [
    { x: 4, y: 0 },
    { x: 8, y: 4 },
    { x: 4, y: 8 },
    { x: 0, y: 4 }
  ]
};

export type ThemeType = 'board' | 'pawn';
export type TransactionType = 'coin_purchase' | 'theme_purchase' | 'game_reward';

export interface ShopItem {
  id: string;
  name: string;
  description?: string;
  type: ThemeType;
  priceCoins: number;
  cssClass: string;
  previewImageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  owned?: boolean; 
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
  amount: number;
  description?: string;
  shopItemId?: string;
  stripeSessionId?: string;
  createdAt: Date;
}

export interface UserThemes {
  selectedBoardTheme: string; // CSS class name
  selectedPawnTheme: string; // CSS class name
}

export interface GameThemes {
  [playerId: string]: {
    boardTheme: string;
    pawnTheme: string;
  };
}

export interface ShopBrowseResponse {
  available: ShopItem[];
  owned: ShopItem[];
  selected: UserThemes;
  coinBalance: number;
}

export interface PurchaseThemeRequest {
  shopItemId: string;
}

export interface PurchaseThemeResponse {
  success: boolean;
  newBalance: number;
  purchasedItem: ShopItem;
  message?: string; 
}

export interface SelectThemeRequest {
  themeType: ThemeType;
  cssClass: string;
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

export interface UserProfileWithShop extends UserProfile {
  coinBalance: number;
  selectedBoardTheme: string;
  selectedPawnTheme: string;
}

export interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  priceEUR: number;
  stripePriceId: string;
  popularBadge?: boolean;
  bonusCoins?: number;
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