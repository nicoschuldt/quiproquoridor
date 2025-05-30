"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameStateService = exports.GameStateService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const GameEngineManager_1 = require("./GameEngineManager");
/**
 * GameStateService - Handles all game state persistence and retrieval
 *
 * This service manages the database operations for game states and provides
 * a clean interface for game state management.
 */
class GameStateService {
    /**
     * Creates and persists a new game state to the database
     */
    async createGame(roomId) {
        try {
            console.log(`🎮 Creating game for room ${roomId}`);
            // Get room and players
            const room = await db_1.db
                .select()
                .from(db_1.rooms)
                .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId))
                .limit(1);
            if (room.length === 0) {
                throw new Error('Room not found');
            }
            // Get all players in the room with their usernames
            const playersData = await db_1.db
                .select({
                userId: db_1.roomMembers.userId,
                username: db_1.users.username,
                joinedAt: db_1.roomMembers.joinedAt,
            })
                .from(db_1.roomMembers)
                .innerJoin(db_1.users, (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, db_1.users.id))
                .where((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId))
                .orderBy(db_1.roomMembers.joinedAt); // Consistent player order
            if (playersData.length === 0) {
                throw new Error('No players found in room');
            }
            // Create game state using game engine
            const playerIds = playersData.map(p => p.userId);
            const gameState = GameEngineManager_1.gameEngineManager.createGame(playerIds, room[0].maxPlayers);
            // Update players with real usernames
            gameState.players = gameState.players.map((player, index) => ({
                ...player,
                username: playersData[index].username,
                joinedAt: playersData[index].joinedAt,
            }));
            // Save game to database
            const [gameRecord] = await db_1.db
                .insert(db_1.games)
                .values({
                roomId,
                gameState: gameState, // JSON field
                status: 'playing',
                startedAt: new Date(),
            })
                .returning();
            // Save game players
            const gamePlayerRecords = gameState.players.map((player, index) => ({
                gameId: gameRecord.id,
                userId: player.id,
                playerIndex: index,
                color: player.color,
                wallsUsed: 0,
                isWinner: false,
            }));
            await db_1.db.insert(db_1.gamePlayers).values(gamePlayerRecords);
            console.log(`✅ Game created: ${gameRecord.id}`);
            return gameState;
        }
        catch (error) {
            console.error('❌ Error creating game:', error);
            throw error;
        }
    }
    /**
     * Retrieves the current game state for a room
     */
    async getGameState(roomId) {
        try {
            const gameRecord = await db_1.db
                .select()
                .from(db_1.games)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.games.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.games.status, 'playing')))
                .limit(1);
            if (gameRecord.length === 0) {
                return null;
            }
            const gameState = gameRecord[0].gameState;
            // Ensure dates are properly converted
            gameState.createdAt = new Date(gameState.createdAt);
            if (gameState.startedAt)
                gameState.startedAt = new Date(gameState.startedAt);
            if (gameState.finishedAt)
                gameState.finishedAt = new Date(gameState.finishedAt);
            // Convert move timestamps
            gameState.moves = gameState.moves.map(move => ({
                ...move,
                timestamp: new Date(move.timestamp),
            }));
            // Convert player joinedAt dates
            gameState.players = gameState.players.map(player => ({
                ...player,
                joinedAt: new Date(player.joinedAt),
            }));
            return gameState;
        }
        catch (error) {
            console.error('❌ Error retrieving game state:', error);
            return null;
        }
    }
    /**
     * Updates the game state in the database
     */
    async saveGameState(roomId, gameState) {
        try {
            await db_1.db
                .update(db_1.games)
                .set({
                gameState: gameState, // JSON field
                status: gameState.status,
                winnerId: gameState.winner || null,
                finishedAt: gameState.status === 'finished' ? new Date() : null,
            })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.games.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.games.status, 'playing')));
            // Update player statistics if game is finished
            if (gameState.status === 'finished' && gameState.winner) {
                await this.updatePlayerStats(roomId, gameState);
            }
        }
        catch (error) {
            console.error('❌ Error saving game state:', error);
            throw error;
        }
    }
    /**
     * Checks if a game exists for a room
     */
    async hasActiveGame(roomId) {
        try {
            const count = await db_1.db
                .select()
                .from(db_1.games)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.games.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.games.status, 'playing')))
                .limit(1);
            return count.length > 0;
        }
        catch (error) {
            console.error('❌ Error checking for active game:', error);
            return false;
        }
    }
    /**
     * Gets all players in a game with their current connection status
     */
    async getGamePlayers(roomId) {
        try {
            const gameState = await this.getGameState(roomId);
            return gameState?.players || [];
        }
        catch (error) {
            console.error('❌ Error getting game players:', error);
            return [];
        }
    }
    /**
     * Updates player connection status in game state
     */
    async updatePlayerConnection(roomId, playerId, isConnected) {
        try {
            const gameState = await this.getGameState(roomId);
            if (!gameState)
                return;
            // Update player connection status
            gameState.players = gameState.players.map(player => player.id === playerId ? { ...player, isConnected } : player);
            await this.saveGameState(roomId, gameState);
            console.log(`🔗 Player ${playerId} ${isConnected ? 'connected' : 'disconnected'} in room ${roomId}`);
        }
        catch (error) {
            console.error('❌ Error updating player connection:', error);
        }
    }
    /**
     * Updates player statistics after game completion
     */
    async updatePlayerStats(roomId, gameState) {
        try {
            for (const player of gameState.players) {
                const isWinner = player.id === gameState.winner;
                const wallsUsed = player.wallsRemaining;
                // Update game_players table
                await db_1.db
                    .update(db_1.gamePlayers)
                    .set({
                    wallsUsed,
                    isWinner,
                    finalPosition: player.position, // JSON field
                })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.gamePlayers.userId, player.id), (0, drizzle_orm_1.eq)(db_1.gamePlayers.gameId, roomId) // This should be gameId, but using roomId for now
                ));
                // Update user statistics
                await db_1.db
                    .update(db_1.users)
                    .set({
                    gamesPlayed: (0, drizzle_orm_1.sql) `${db_1.users.gamesPlayed} + 1`,
                    gamesWon: isWinner ? (0, drizzle_orm_1.sql) `${db_1.users.gamesWon} + 1` : db_1.users.gamesWon,
                })
                    .where((0, drizzle_orm_1.eq)(db_1.users.id, player.id));
            }
        }
        catch (error) {
            console.error('❌ Error updating player stats:', error);
        }
    }
    /**
     * Cleans up abandoned games (games where all players are disconnected)
     */
    async cleanupAbandonedGames() {
        try {
            // This will be implemented as part of a cleanup job
            console.log('🧹 Cleanup abandoned games - TODO');
        }
        catch (error) {
            console.error('❌ Error cleaning up abandoned games:', error);
        }
    }
}
exports.GameStateService = GameStateService;
// Singleton instance
exports.gameStateService = new GameStateService();
