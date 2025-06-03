// backend/src/db/schema.ts
import { int, text, sqliteTable, real, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users 
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text('username', { length: 50 }).unique().notNull(),
  passwordHash: text('password_hash', { length: 255 }).notNull(),
  gamesPlayed: int('games_played').default(0).notNull(),
  gamesWon: int('games_won').default(0).notNull(),
  
  // Shop functionality
  coinBalance: int('coin_balance').default(0).notNull(),
  selectedBoardTheme: text('selected_board_theme').default('default').notNull(),
  selectedPawnTheme: text('selected_pawn_theme').default('default').notNull(),
  
  createdAt: int('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: int('updated_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull(),
});

// Rooms table
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text('code', { length: 6 }).unique().notNull(),
  hostId: text('host_id').references(() => users.id).notNull(),
  maxPlayers: int('max_players').notNull(),
  status: text('status', { enum: ['lobby', 'playing', 'finished'] })
    .default('lobby')
    .notNull(),
  isPrivate: int('is_private', { mode: 'boolean' }).default(false).notNull(),
  hasTimeLimit: int('has_time_limit', { mode: 'boolean' }).default(false).notNull(),
  timeLimitSeconds: int('time_limit_seconds'),
  createdAt: int('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: int('updated_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull(),
});

// Games table
export const games = sqliteTable('games', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  roomId: text('room_id').references(() => rooms.id).notNull(),
  gameState: text('game_state', { mode: 'json' }).notNull(), // JSON field for GameState
  status: text('status', { enum: ['waiting', 'playing', 'finished', 'abandoned'] })
    .default('playing')
    .notNull(),
  winnerId: text('winner_id').references(() => users.id),
  createdAt: int('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull(),
  startedAt: int('started_at', { mode: 'timestamp' }),
  finishedAt: int('finished_at', { mode: 'timestamp' }),
});

// Game players table - tracks players in each game
export const gamePlayers = sqliteTable('game_players', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  gameId: text('game_id').references(() => games.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  playerIndex: int('player_index').notNull(), // 0, 1, 2, 3
  color: text('color', { enum: ['red', 'blue', 'green', 'yellow'] }).notNull(),
  finalPosition: text('final_position', { mode: 'json' }), // JSON field for Position
  wallsUsed: int('walls_used').default(0).notNull(),
  isWinner: int('is_winner', { mode: 'boolean' }).default(false).notNull(),
});

// Room members table - tracks current players in rooms
export const roomMembers = sqliteTable('room_members', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  roomId: text('room_id').references(() => rooms.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  isHost: int('is_host', { mode: 'boolean' }).default(false).notNull(),
  joinedAt: int('joined_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull(),
});

// Shop items table - defines all purchasable themes
export const shopItems = sqliteTable('shop_items', {
  id: text('id').primaryKey(), // e.g., 'board_forest', 'pawn_knights'
  name: text('name').notNull(), // e.g., 'Forest Theme', 'Medieval Knights'
  description: text('description'), // e.g., 'Mystical forest themed board'
  type: text('type', { enum: ['board', 'pawn'] }).notNull(),
  priceCoins: int('price_coins').notNull(),
  cssClass: text('css_class').notNull(), // e.g., 'theme-board-forest'
  previewImageUrl: text('preview_image_url'), // e.g., '/images/themes/forest-preview.jpg'
  isActive: int('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: int('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull(),
});

// User purchases table - tracks what themes users own
export const userPurchases = sqliteTable('user_purchases', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id).notNull(),
  shopItemId: text('shop_item_id').references(() => shopItems.id).notNull(),
  purchasedAt: int('purchased_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull(),
}, (table) => ({
  // Prevent duplicate purchases
  userItemUnique: unique().on(table.userId, table.shopItemId),
}));

// Transactions table - audit trail for all coin movements
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id).notNull(),
  type: text('type', { enum: ['coin_purchase', 'theme_purchase', 'game_reward'] }).notNull(),
  amount: int('amount').notNull(), // Positive = gain, negative = spend
  description: text('description'), // e.g., 'Purchased Forest Theme'
  shopItemId: text('shop_item_id').references(() => shopItems.id), // NULL for coin purchases
  stripeSessionId: text('stripe_session_id'), // For coin purchases via Stripe
  createdAt: int('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull(),
});

// Export types for use in application
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;

export type GamePlayer = typeof gamePlayers.$inferSelect;
export type NewGamePlayer = typeof gamePlayers.$inferInsert;

export type RoomMember = typeof roomMembers.$inferSelect;
export type NewRoomMember = typeof roomMembers.$inferInsert;

// Export new types for use in application
export type ShopItem = typeof shopItems.$inferSelect;
export type NewShopItem = typeof shopItems.$inferInsert;

export type UserPurchase = typeof userPurchases.$inferSelect;
export type NewUserPurchase = typeof userPurchases.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
