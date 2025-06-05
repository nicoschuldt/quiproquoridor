"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactions = exports.userPurchases = exports.shopItems = exports.roomMembers = exports.gamePlayers = exports.games = exports.rooms = exports.users = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
const drizzle_orm_1 = require("drizzle-orm");
exports.users = (0, sqlite_core_1.sqliteTable)('users', {
    id: (0, sqlite_core_1.text)('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    username: (0, sqlite_core_1.text)('username', { length: 50 }).unique().notNull(),
    passwordHash: (0, sqlite_core_1.text)('password_hash', { length: 255 }).notNull(),
    gamesPlayed: (0, sqlite_core_1.int)('games_played').default(0).notNull(),
    gamesWon: (0, sqlite_core_1.int)('games_won').default(0).notNull(),
    coinBalance: (0, sqlite_core_1.int)('coin_balance').default(0).notNull(),
    selectedBoardTheme: (0, sqlite_core_1.text)('selected_board_theme').default('theme-board-default').notNull(),
    selectedPawnTheme: (0, sqlite_core_1.text)('selected_pawn_theme').default('theme-pawn-default').notNull(),
    isAI: (0, sqlite_core_1.int)('is_ai', { mode: 'boolean' }).default(false).notNull(),
    aiDifficulty: (0, sqlite_core_1.text)('ai_difficulty', { enum: ['easy', 'medium', 'hard'] }),
    createdAt: (0, sqlite_core_1.int)('created_at', { mode: 'timestamp' })
        .default((0, drizzle_orm_1.sql) `(unixepoch())`)
        .notNull(),
    updatedAt: (0, sqlite_core_1.int)('updated_at', { mode: 'timestamp' })
        .default((0, drizzle_orm_1.sql) `(unixepoch())`)
        .notNull(),
});
exports.rooms = (0, sqlite_core_1.sqliteTable)('rooms', {
    id: (0, sqlite_core_1.text)('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    code: (0, sqlite_core_1.text)('code', { length: 6 }).unique().notNull(),
    hostId: (0, sqlite_core_1.text)('host_id').references(() => exports.users.id).notNull(),
    maxPlayers: (0, sqlite_core_1.int)('max_players').notNull(),
    status: (0, sqlite_core_1.text)('status', { enum: ['lobby', 'playing', 'finished'] })
        .default('lobby')
        .notNull(),
    isPrivate: (0, sqlite_core_1.int)('is_private', { mode: 'boolean' }).default(false).notNull(),
    hasTimeLimit: (0, sqlite_core_1.int)('has_time_limit', { mode: 'boolean' }).default(false).notNull(),
    timeLimitSeconds: (0, sqlite_core_1.int)('time_limit_seconds'),
    createdAt: (0, sqlite_core_1.int)('created_at', { mode: 'timestamp' })
        .default((0, drizzle_orm_1.sql) `(unixepoch())`)
        .notNull(),
    updatedAt: (0, sqlite_core_1.int)('updated_at', { mode: 'timestamp' })
        .default((0, drizzle_orm_1.sql) `(unixepoch())`)
        .notNull(),
});
exports.games = (0, sqlite_core_1.sqliteTable)('games', {
    id: (0, sqlite_core_1.text)('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    roomId: (0, sqlite_core_1.text)('room_id').references(() => exports.rooms.id).notNull(),
    gameState: (0, sqlite_core_1.text)('game_state', { mode: 'json' }).notNull(), // JSON field for GameState
    status: (0, sqlite_core_1.text)('status', { enum: ['waiting', 'playing', 'finished', 'abandoned'] })
        .default('playing')
        .notNull(),
    winnerId: (0, sqlite_core_1.text)('winner_id').references(() => exports.users.id),
    createdAt: (0, sqlite_core_1.int)('created_at', { mode: 'timestamp' })
        .default((0, drizzle_orm_1.sql) `(unixepoch())`)
        .notNull(),
    startedAt: (0, sqlite_core_1.int)('started_at', { mode: 'timestamp' }),
    finishedAt: (0, sqlite_core_1.int)('finished_at', { mode: 'timestamp' }),
});
exports.gamePlayers = (0, sqlite_core_1.sqliteTable)('game_players', {
    id: (0, sqlite_core_1.text)('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    gameId: (0, sqlite_core_1.text)('game_id').references(() => exports.games.id).notNull(),
    userId: (0, sqlite_core_1.text)('user_id').references(() => exports.users.id).notNull(),
    playerIndex: (0, sqlite_core_1.int)('player_index').notNull(), // 0, 1, 2, 3
    color: (0, sqlite_core_1.text)('color', { enum: ['red', 'blue', 'green', 'yellow'] }).notNull(),
    finalPosition: (0, sqlite_core_1.text)('final_position', { mode: 'json' }), // JSON field for Position
    wallsUsed: (0, sqlite_core_1.int)('walls_used').default(0).notNull(),
    isWinner: (0, sqlite_core_1.int)('is_winner', { mode: 'boolean' }).default(false).notNull(),
});
exports.roomMembers = (0, sqlite_core_1.sqliteTable)('room_members', {
    id: (0, sqlite_core_1.text)('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    roomId: (0, sqlite_core_1.text)('room_id').references(() => exports.rooms.id).notNull(),
    userId: (0, sqlite_core_1.text)('user_id').references(() => exports.users.id).notNull(),
    isHost: (0, sqlite_core_1.int)('is_host', { mode: 'boolean' }).default(false).notNull(),
    joinedAt: (0, sqlite_core_1.int)('joined_at', { mode: 'timestamp' })
        .default((0, drizzle_orm_1.sql) `(unixepoch())`)
        .notNull(),
});
exports.shopItems = (0, sqlite_core_1.sqliteTable)('shop_items', {
    id: (0, sqlite_core_1.text)('id').primaryKey(), // e.g., 'board_forest', 'pawn_knights'
    name: (0, sqlite_core_1.text)('name').notNull(), // e.g., 'Forest Theme', 'Medieval Knights'
    description: (0, sqlite_core_1.text)('description'), // e.g., 'Mystical forest themed board'
    type: (0, sqlite_core_1.text)('type', { enum: ['board', 'pawn'] }).notNull(),
    priceCoins: (0, sqlite_core_1.int)('price_coins').notNull(),
    cssClass: (0, sqlite_core_1.text)('css_class').notNull(), // e.g., 'theme-board-forest'
    previewImageUrl: (0, sqlite_core_1.text)('preview_image_url'), // e.g., '/images/themes/forest-preview.jpg'
    isActive: (0, sqlite_core_1.int)('is_active', { mode: 'boolean' }).default(true).notNull(),
    createdAt: (0, sqlite_core_1.int)('created_at', { mode: 'timestamp' })
        .default((0, drizzle_orm_1.sql) `(unixepoch())`)
        .notNull(),
});
exports.userPurchases = (0, sqlite_core_1.sqliteTable)('user_purchases', {
    id: (0, sqlite_core_1.text)('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: (0, sqlite_core_1.text)('user_id').references(() => exports.users.id).notNull(),
    shopItemId: (0, sqlite_core_1.text)('shop_item_id').references(() => exports.shopItems.id).notNull(),
    purchasedAt: (0, sqlite_core_1.int)('purchased_at', { mode: 'timestamp' })
        .default((0, drizzle_orm_1.sql) `(unixepoch())`)
        .notNull(),
}, (table) => ({
    userItemUnique: (0, sqlite_core_1.unique)().on(table.userId, table.shopItemId),
}));
exports.transactions = (0, sqlite_core_1.sqliteTable)('transactions', {
    id: (0, sqlite_core_1.text)('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: (0, sqlite_core_1.text)('user_id').references(() => exports.users.id).notNull(),
    type: (0, sqlite_core_1.text)('type', { enum: ['coin_purchase', 'theme_purchase', 'game_reward'] }).notNull(),
    amount: (0, sqlite_core_1.int)('amount').notNull(), // Positive = gain, negative = spend
    description: (0, sqlite_core_1.text)('description'), // e.g., 'Purchased Forest Theme'
    shopItemId: (0, sqlite_core_1.text)('shop_item_id').references(() => exports.shopItems.id), // NULL for coin purchases
    stripeSessionId: (0, sqlite_core_1.text)('stripe_session_id'), // For coin purchases via Stripe
    createdAt: (0, sqlite_core_1.int)('created_at', { mode: 'timestamp' })
        .default((0, drizzle_orm_1.sql) `(unixepoch())`)
        .notNull(),
});
