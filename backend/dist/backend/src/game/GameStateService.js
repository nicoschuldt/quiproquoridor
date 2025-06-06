"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameStateService = exports.GameStateService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const GameEngineManager_1 = require("./GameEngineManager");
const AIManager_1 = require("../ai/AIManager");
class GameStateService {
    constructor() {
        this.aiMoveProcessed = new Map();
        this.disconnectionTimeouts = new Map();
    }
    async createGame(roomId) {
        try {
            console.log(`Creating game for room ${roomId}`);
            const room = await db_1.db
                .select()
                .from(db_1.rooms)
                .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId))
                .limit(1);
            if (room.length === 0) {
                throw new Error('Room not found');
            }
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
                .orderBy(db_1.roomMembers.joinedAt);
            if (playersData.length === 0) {
                throw new Error('No players found in room');
            }
            const playerIds = playersData.map(p => p.userId);
            const gameState = GameEngineManager_1.gameEngineManager.createGame(playerIds, room[0].maxPlayers);
            gameState.players = gameState.players.map((player, index) => ({
                ...player,
                username: playersData[index].username,
                joinedAt: playersData[index].joinedAt,
                selectedPawnTheme: playersData[index].selectedPawnTheme || 'theme-pawn-default',
                isAI: playersData[index].isAI || false,
                aiDifficulty: playersData[index].aiDifficulty || undefined,
            }));
            for (const playerData of playersData) {
                if (playerData.isAI && playerData.aiDifficulty) {
                    AIManager_1.aiManager.createAI(playerData.userId, playerData.aiDifficulty);
                    console.log(`AI instance created for player ${playerData.userId} (${playerData.aiDifficulty})`);
                }
            }
            const [gameRecord] = await db_1.db
                .insert(db_1.games)
                .values({
                roomId,
                gameState: gameState, // JSON field
                status: 'playing',
                startedAt: new Date(),
            })
                .returning();
            const gamePlayerRecords = gameState.players.map((player, index) => ({
                gameId: gameRecord.id,
                userId: player.id,
                playerIndex: index,
                color: player.color,
                wallsUsed: 0,
                isWinner: false,
            }));
            await db_1.db.insert(db_1.gamePlayers).values(gamePlayerRecords);
            console.log(`Game created: ${gameRecord.id}`);
            return gameState;
        }
        catch (error) {
            console.error('Error creating game:', error);
            throw error;
        }
    }
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
            gameState.createdAt = new Date(gameState.createdAt);
            if (gameState.startedAt)
                gameState.startedAt = new Date(gameState.startedAt);
            if (gameState.finishedAt)
                gameState.finishedAt = new Date(gameState.finishedAt);
            gameState.moves = gameState.moves.map(move => ({
                ...move,
                timestamp: new Date(move.timestamp),
            }));
            gameState.players = gameState.players.map(player => ({
                ...player,
                joinedAt: new Date(player.joinedAt),
            }));
            return gameState;
        }
        catch (error) {
            console.error('Error retrieving game state:', error);
            return null;
        }
    }
    async saveGameState(roomId, gameState) {
        try {
            await db_1.db
                .update(db_1.games)
                .set({
                gameState: gameState,
                status: gameState.status,
                winnerId: gameState.winner || null,
                finishedAt: gameState.status === 'finished' ? new Date() : null,
            })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.games.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.games.status, 'playing')));
            if (gameState.status === 'finished' && gameState.winner) {
                await this.completeGame(roomId, gameState);
            }
            await this.processAITurns(roomId, gameState);
        }
        catch (error) {
            console.error('Error saving game state:', error);
            throw error;
        }
    }
    async processAITurns(roomId, gameState) {
        if (gameState.status !== 'playing') {
            return;
        }
        let currentState = gameState;
        let processedAIMove = false;
        while (currentState.status === 'playing') {
            const currentPlayer = GameEngineManager_1.gameEngineManager.getCurrentPlayer(currentState);
            if (!currentPlayer.isAI) {
                break;
            }
            try {
                console.log(`Processing AI turn for player ${currentPlayer.id} (${currentPlayer.username})`);
                const aiMove = await AIManager_1.aiManager.generateMove(currentState, currentPlayer.id);
                if (!GameEngineManager_1.gameEngineManager.validateMove(currentState, aiMove)) {
                    console.error(`AI generated invalid move for player ${currentPlayer.id}`);
                    break;
                }
                currentState = GameEngineManager_1.gameEngineManager.applyMove(currentState, aiMove);
                processedAIMove = true;
                console.log(`AI move applied for player ${currentPlayer.id}`);
                await db_1.db
                    .update(db_1.games)
                    .set({
                    gameState: currentState,
                    status: currentState.status,
                    winnerId: currentState.winner || null,
                    finishedAt: currentState.status === 'finished' ? new Date() : null,
                })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.games.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.games.status, 'playing')));
                if (currentState.status === 'finished' && currentState.winner) {
                    await this.completeGame(roomId, currentState);
                    break;
                }
            }
            catch (error) {
                console.error(`Error processing AI turn for player ${currentPlayer.id}:`, error);
                break;
            }
        }
        if (processedAIMove) {
            this.aiMoveProcessed.set(roomId, currentState);
        }
    }
    getProcessedAIMove(roomId) {
        const state = this.aiMoveProcessed.get(roomId);
        if (state) {
            this.aiMoveProcessed.delete(roomId);
            return state;
        }
        return null;
    }
    async completeGame(roomId, gameState) {
        try {
            console.log(`🏁 Completing game for room ${roomId}, winner: ${gameState.winner}`);
            await this.updatePlayerStats(roomId, gameState);
            await db_1.db
                .update(db_1.rooms)
                .set({
                status: 'finished',
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId));
            setTimeout(async () => {
                await this.cleanupFinishedRoom(roomId);
            }, 30 * 60 * 1000);
            console.log(`Game completion processed for room ${roomId}`);
        }
        catch (error) {
            console.error('Error completing game:', error);
            throw error;
        }
    }
    async cleanupFinishedRoom(roomId) {
        try {
            console.log(`Cleaning up finished room ${roomId}`);
            await db_1.db
                .delete(db_1.roomMembers)
                .where((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId));
            await db_1.db
                .delete(db_1.rooms)
                .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId));
            console.log(`Room ${roomId} cleaned up successfully`);
        }
        catch (error) {
            console.error('Error cleaning up finished room:', error);
        }
    }
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
            console.error('Error checking for active game:', error);
            return false;
        }
    }
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
            gameState.createdAt = new Date(gameState.createdAt);
            if (gameState.startedAt)
                gameState.startedAt = new Date(gameState.startedAt);
            if (gameState.finishedAt)
                gameState.finishedAt = new Date(gameState.finishedAt);
            return gameState;
        }
        catch (error) {
            console.error('Error retrieving finished game:', error);
            return null;
        }
    }
    async getGamePlayers(roomId) {
        try {
            const gameState = await this.getGameState(roomId);
            return gameState?.players || [];
        }
        catch (error) {
            console.error('Error getting game players:', error);
            return [];
        }
    }
    async updatePlayerConnection(roomId, playerId, isConnected) {
        try {
            const gameState = await this.getGameState(roomId);
            if (!gameState)
                return;
            gameState.players = gameState.players.map(player => player.id === playerId ? { ...player, isConnected } : player);
            await this.saveGameState(roomId, gameState);
            console.log(`🔗 Player ${playerId} ${isConnected ? 'connected' : 'disconnected'} in room ${roomId}`);
        }
        catch (error) {
            console.error('Error updating player connection:', error);
        }
    }
    async updatePlayerStats(roomId, gameState) {
        try {
            const gameRecord = await db_1.db
                .select({ id: db_1.games.id })
                .from(db_1.games)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.games.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.games.status, 'finished')))
                .limit(1);
            if (gameRecord.length === 0) {
                console.error('No finished game record found for room:', roomId);
                return;
            }
            const gameId = gameRecord[0].id;
            console.log(`🏁 Updating player stats for game ${gameId}, winner: ${gameState.winner}`);
            for (const player of gameState.players) {
                const isWinner = player.id === gameState.winner;
                const wallsUsed = player.wallsRemaining;
                console.log(`Updating stats for player ${player.username} (${player.id}): winner=${isWinner}, wallsUsed=${wallsUsed}`);
                await db_1.db
                    .update(db_1.gamePlayers)
                    .set({
                    wallsUsed,
                    isWinner,
                    finalPosition: player.position,
                })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.gamePlayers.userId, player.id), (0, drizzle_orm_1.eq)(db_1.gamePlayers.gameId, gameId)));
                await db_1.db
                    .update(db_1.users)
                    .set({
                    gamesPlayed: (0, drizzle_orm_1.sql) `${db_1.users.gamesPlayed} + 1`,
                    gamesWon: isWinner ? (0, drizzle_orm_1.sql) `${db_1.users.gamesWon} + 1` : db_1.users.gamesWon,
                })
                    .where((0, drizzle_orm_1.eq)(db_1.users.id, player.id));
            }
            console.log(`Player stats updated successfully for game ${gameId}`);
        }
        catch (error) {
            console.error('Error updating player stats:', error);
        }
    }
    async cleanupAbandonedGames() {
        try {
            // This will be implemented as part of a cleanup job
            console.log('Cleanup abandoned games - TODO');
        }
        catch (error) {
            console.error('Error cleaning up abandoned games:', error);
        }
    }
    async forfeitPlayer(roomId, playerId) {
        try {
            console.log(`🏳️ Player ${playerId} forfeiting game in room ${roomId}`);
            const gameState = await this.getGameState(roomId);
            if (!gameState) {
                throw new Error('No active game found');
            }
            const forfeiter = gameState.players.find(p => p.id === playerId);
            if (!forfeiter) {
                throw new Error('Player not found in game');
            }
            const remainingPlayers = gameState.players.filter(p => p.id !== playerId && p.isConnected);
            if (gameState.players.length > 2) {
                gameState.status = 'finished';
                gameState.finishedAt = new Date();
                if (remainingPlayers.length > 0) {
                    gameState.winner = remainingPlayers[0].id;
                }
            }
            else {
                if (remainingPlayers.length === 1) {
                    const winner = remainingPlayers[0];
                    gameState.status = 'finished';
                    gameState.winner = winner.id;
                    gameState.finishedAt = new Date();
                }
                else {
                    gameState.status = 'finished';
                    gameState.finishedAt = new Date();
                }
            }
            await this.saveGameState(roomId, gameState);
            console.log(`Player forfeit processed for ${playerId}`);
            return gameState;
        }
        catch (error) {
            console.error('Error processing forfeit:', error);
            return null;
        }
    }
    startDisconnectionTimeout(roomId, playerId, timeoutSeconds = 60) {
        const key = `${roomId}:${playerId}`;
        if (this.disconnectionTimeouts.has(key)) {
            clearTimeout(this.disconnectionTimeouts.get(key));
        }
        console.log(`Starting ${timeoutSeconds}s disconnection timeout for player ${playerId} in room ${roomId}`);
        const timeout = setTimeout(async () => {
            console.log(`⏰ Disconnection timeout expired for player ${playerId}, auto-forfeiting...`);
            try {
                const gameState = await this.forfeitPlayer(roomId, playerId);
                if (gameState) {
                    this.disconnectionTimeouts.set(`${key}:expired`, setTimeout(() => { }, 0));
                }
            }
            catch (error) {
                console.error('Error during auto-forfeit:', error);
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
            console.log(`Disconnection timeout cancelled for player ${playerId}`);
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
exports.gameStateService = new GameStateService();
