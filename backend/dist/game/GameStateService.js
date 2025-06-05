"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameStateService = exports.GameStateService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const GameEngineManager_1 = require("./GameEngineManager");
const AIManager_1 = require("../ai/AIManager");
/**
 * GameStateService - Handles all game state persistence and retrieval
 *
 * This service manages the database operations for game states and provides
 * a clean interface for game state management.
 */
class GameStateService {
    constructor() {
        // Map to communicate AI moves to socket handler
        this.aiMoveProcessed = new Map();
        this.disconnectionTimeouts = new Map();
    }
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
            // Get all players in the room with their usernames and theme data
            const playersData = await db_1.db
                .select({
                userId: db_1.roomMembers.userId,
                username: db_1.users.username,
                joinedAt: db_1.roomMembers.joinedAt,
                selectedPawnTheme: db_1.users.selectedPawnTheme,
                isAI: db_1.users.isAI,
                aiDifficulty: db_1.users.aiDifficulty,
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
            // Update players with real usernames and theme data
            gameState.players = gameState.players.map((player, index) => ({
                ...player,
                username: playersData[index].username,
                joinedAt: playersData[index].joinedAt,
                selectedPawnTheme: playersData[index].selectedPawnTheme || 'theme-pawn-default',
                isAI: playersData[index].isAI || false,
                aiDifficulty: playersData[index].aiDifficulty || undefined,
            }));
            // Set up AI instances for AI players
            for (const playerData of playersData) {
                if (playerData.isAI && playerData.aiDifficulty) {
                    AIManager_1.aiManager.createAI(playerData.userId, playerData.aiDifficulty);
                    console.log(`🤖 AI instance created for player ${playerData.userId} (${playerData.aiDifficulty})`);
                }
            }
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
            if (gameState.status === 'finished' && gameState.winner) {
                await this.completeGame(roomId, gameState);
            }
            // **NEW AI INTEGRATION**: Process AI turns after saving state
            await this.processAITurns(roomId, gameState);
        }
        catch (error) {
            console.error('❌ Error saving game state:', error);
            throw error;
        }
    }
    /**
     * **NEW**: Processes AI turns automatically after human moves
     */
    async processAITurns(roomId, gameState) {
        // Don't process AI turns if game is finished
        if (gameState.status !== 'playing') {
            return;
        }
        let currentState = gameState;
        let processedAIMove = false;
        // Keep processing AI turns until it's a human player's turn or game ends
        while (currentState.status === 'playing') {
            const currentPlayer = GameEngineManager_1.gameEngineManager.getCurrentPlayer(currentState);
            // If current player is not AI, stop processing
            if (!currentPlayer.isAI) {
                break;
            }
            try {
                console.log(`🤖 Processing AI turn for player ${currentPlayer.id} (${currentPlayer.username})`);
                // Generate AI move
                const aiMove = await AIManager_1.aiManager.generateMove(currentState, currentPlayer.id);
                // Validate the AI move
                if (!GameEngineManager_1.gameEngineManager.validateMove(currentState, aiMove)) {
                    console.error(`❌ AI generated invalid move for player ${currentPlayer.id}`);
                    break;
                }
                // Apply the AI move
                currentState = GameEngineManager_1.gameEngineManager.applyMove(currentState, aiMove);
                processedAIMove = true;
                console.log(`✅ AI move applied for player ${currentPlayer.id}`);
                // Save the updated state (this will trigger socket emissions)
                await db_1.db
                    .update(db_1.games)
                    .set({
                    gameState: currentState,
                    status: currentState.status,
                    winnerId: currentState.winner || null,
                    finishedAt: currentState.status === 'finished' ? new Date() : null,
                })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.games.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.games.status, 'playing')));
                // If game finished, handle completion
                if (currentState.status === 'finished' && currentState.winner) {
                    await this.completeGame(roomId, currentState);
                    break;
                }
            }
            catch (error) {
                console.error(`❌ Error processing AI turn for player ${currentPlayer.id}:`, error);
                break;
            }
        }
        // Emit socket events if we processed any AI moves
        if (processedAIMove) {
            // Store the updated game state for socket handler to pick up
            // This is a simple way to communicate with socket handler without tight coupling
            this.aiMoveProcessed.set(roomId, currentState);
        }
    }
    /**
     * **NEW**: Checks if an AI move was processed and returns the updated state
     */
    getProcessedAIMove(roomId) {
        const state = this.aiMoveProcessed.get(roomId);
        if (state) {
            this.aiMoveProcessed.delete(roomId); // Clean up after retrieval
            return state;
        }
        return null;
    }
    /**
     * Handles complete game finishing including room cleanup
     */
    async completeGame(roomId, gameState) {
        try {
            console.log(`🏁 Completing game for room ${roomId}, winner: ${gameState.winner}`);
            // Update player statistics
            await this.updatePlayerStats(roomId, gameState);
            // Update room status to 'finished' and schedule cleanup
            await db_1.db
                .update(db_1.rooms)
                .set({
                status: 'finished',
                // Set a cleanup time for 30 minutes from now
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId));
            // room cleanup after a delay
            // This allows players to see final results before room is cleaned up
            setTimeout(async () => {
                await this.cleanupFinishedRoom(roomId);
            }, 30 * 60 * 1000); // 30 minutes
            console.log(`✅ Game completion processed for room ${roomId}`);
        }
        catch (error) {
            console.error('❌ Error completing game:', error);
            throw error;
        }
    }
    /**
     * Cleans up a finished room and removes players
     */
    async cleanupFinishedRoom(roomId) {
        try {
            console.log(`🧹 Cleaning up finished room ${roomId}`);
            // Remove all room members
            await db_1.db
                .delete(db_1.roomMembers)
                .where((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId));
            // Mark room as cleaned up (keep for history) or delete it
            await db_1.db
                .delete(db_1.rooms)
                .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId));
            console.log(`✅ Room ${roomId} cleaned up successfully`);
        }
        catch (error) {
            console.error('❌ Error cleaning up finished room:', error);
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
     * Gets finished game results for display
     */
    async getFinishedGame(roomId) {
        try {
            const gameRecord = await db_1.db
                .select()
                .from(db_1.games)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.games.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.games.status, 'finished')))
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
            return gameState;
        }
        catch (error) {
            console.error('❌ Error retrieving finished game:', error);
            return null;
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
            const gameRecord = await db_1.db
                .select({ id: db_1.games.id })
                .from(db_1.games)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.games.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.games.status, 'finished')))
                .limit(1);
            if (gameRecord.length === 0) {
                console.error('❌ No finished game record found for room:', roomId);
                return;
            }
            const gameId = gameRecord[0].id;
            console.log(`🏁 Updating player stats for game ${gameId}, winner: ${gameState.winner}`);
            for (const player of gameState.players) {
                const isWinner = player.id === gameState.winner;
                const wallsUsed = player.wallsRemaining;
                console.log(`📊 Updating stats for player ${player.username} (${player.id}): winner=${isWinner}, wallsUsed=${wallsUsed}`);
                // Update game_players table with correct game ID
                await db_1.db
                    .update(db_1.gamePlayers)
                    .set({
                    wallsUsed,
                    isWinner,
                    finalPosition: player.position,
                })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.gamePlayers.userId, player.id), (0, drizzle_orm_1.eq)(db_1.gamePlayers.gameId, gameId)));
                // Update user statistics
                await db_1.db
                    .update(db_1.users)
                    .set({
                    gamesPlayed: (0, drizzle_orm_1.sql) `${db_1.users.gamesPlayed} + 1`,
                    gamesWon: isWinner ? (0, drizzle_orm_1.sql) `${db_1.users.gamesWon} + 1` : db_1.users.gamesWon,
                })
                    .where((0, drizzle_orm_1.eq)(db_1.users.id, player.id));
            }
            console.log(`✅ Player stats updated successfully for game ${gameId}`);
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
    async forfeitPlayer(roomId, playerId) {
        try {
            console.log(`🏳️ Player ${playerId} forfeiting game in room ${roomId}`);
            const gameState = await this.getGameState(roomId);
            if (!gameState) {
                throw new Error('No active game found');
            }
            // Check if player is in the game
            const forfeiter = gameState.players.find(p => p.id === playerId);
            if (!forfeiter) {
                throw new Error('Player not found in game');
            }
            // Mark game as finished and determine winner(s)
            const remainingPlayers = gameState.players.filter(p => p.id !== playerId && p.isConnected);
            if (remainingPlayers.length === 1) {
                // Single winner
                const winner = remainingPlayers[0];
                gameState.status = 'finished';
                gameState.winner = winner.id;
                gameState.finishedAt = new Date();
            }
            else if (remainingPlayers.length > 1) {
                // Multiple players remaining - continue with forfeited player removed
                gameState.players = gameState.players.map(p => p.id === playerId ? { ...p, isConnected: false } : p);
            }
            else {
                // All players forfeited/disconnected - end game with no winner
                gameState.status = 'finished';
                gameState.finishedAt = new Date();
            }
            // Save the updated game state
            await this.saveGameState(roomId, gameState);
            console.log(`✅ Player forfeit processed for ${playerId}`);
            return gameState;
        }
        catch (error) {
            console.error('❌ Error processing forfeit:', error);
            return null;
        }
    }
    startDisconnectionTimeout(roomId, playerId, timeoutSeconds = 60) {
        const key = `${roomId}:${playerId}`;
        // Clear existing timeout if any
        if (this.disconnectionTimeouts.has(key)) {
            clearTimeout(this.disconnectionTimeouts.get(key));
        }
        console.log(`⏱️ Starting ${timeoutSeconds}s disconnection timeout for player ${playerId} in room ${roomId}`);
        const timeout = setTimeout(async () => {
            console.log(`⏰ Disconnection timeout expired for player ${playerId}, auto-forfeiting...`);
            try {
                const gameState = await this.forfeitPlayer(roomId, playerId);
                if (gameState) {
                    // The socket handler will need to emit events for this
                    // We'll store this information for the socket handler to pick up
                    this.disconnectionTimeouts.set(`${key}:expired`, setTimeout(() => { }, 0));
                }
            }
            catch (error) {
                console.error('❌ Error during auto-forfeit:', error);
            }
            this.disconnectionTimeouts.delete(key);
        }, timeoutSeconds * 1000);
        this.disconnectionTimeouts.set(key, timeout);
    }
    cancelDisconnectionTimeout(roomId, playerId) {
        const key = `${roomId}:${playerId}`;
        if (this.disconnectionTimeouts.has(key)) {
            clearTimeout(this.disconnectionTimeouts.get(key));
            this.disconnectionTimeouts.delete(key);
            console.log(`✅ Disconnection timeout cancelled for player ${playerId}`);
            return true;
        }
        return false;
    }
    hasDisconnectionTimeout(roomId, playerId) {
        const key = `${roomId}:${playerId}`;
        return this.disconnectionTimeouts.has(key);
    }
}
exports.GameStateService = GameStateService;
// Singleton instance
exports.gameStateService = new GameStateService();
