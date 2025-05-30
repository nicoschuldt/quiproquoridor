"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomMembers = exports.gamePlayers = exports.games = exports.rooms = exports.users = void 0;
// backend/src/db/schema.ts
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
const drizzle_orm_1 = require("drizzle-orm");
// Users 
exports.users = (0, sqlite_core_1.sqliteTable)('users', {
    id: (0, sqlite_core_1.text)('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    username: (0, sqlite_core_1.text)('username', { length: 50 }).unique().notNull(),
    passwordHash: (0, sqlite_core_1.text)('password_hash', { length: 255 }).notNull(),
    gamesPlayed: (0, sqlite_core_1.int)('games_played').default(0).notNull(),
    gamesWon: (0, sqlite_core_1.int)('games_won').default(0).notNull(),
    createdAt: (0, sqlite_core_1.int)('created_at', { mode: 'timestamp' })
        .default((0, drizzle_orm_1.sql) `(unixepoch())`)
        .notNull(),
    updatedAt: (0, sqlite_core_1.int)('updated_at', { mode: 'timestamp' })
        .default((0, drizzle_orm_1.sql) `(unixepoch())`)
        .notNull(),
});
// Rooms table
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
// Games table
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
// Game players table - tracks players in each game
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
// Room members table - tracks current players in rooms
exports.roomMembers = (0, sqlite_core_1.sqliteTable)('room_members', {
    id: (0, sqlite_core_1.text)('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    roomId: (0, sqlite_core_1.text)('room_id').references(() => exports.rooms.id).notNull(),
    userId: (0, sqlite_core_1.text)('user_id').references(() => exports.users.id).notNull(),
    isHost: (0, sqlite_core_1.int)('is_host', { mode: 'boolean' }).default(false).notNull(),
    joinedAt: (0, sqlite_core_1.int)('joined_at', { mode: 'timestamp' })
        .default((0, drizzle_orm_1.sql) `(unixepoch())`)
        .notNull(),
});
