// backend/src/db/schema.ts
import { int, text, sqliteTable, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users 
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text('username', { length: 50 }).unique().notNull(),
  passwordHash: text('password_hash', { length: 255 }).notNull(),
  gamesPlayed: int('games_played').default(0).notNull(),
  gamesWon: int('games_won').default(0).notNull(),
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
  isReady: int('is_ready', { mode: 'boolean' }).default(false).notNull(),
  joinedAt: int('joined_at', { mode: 'timestamp' })
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
