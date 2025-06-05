"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameHandlers = void 0;
const GameEngineManager_1 = require("../game/GameEngineManager");
const GameStateService_1 = require("../game/GameStateService");
const db_1 = require("../db");
const drizzle_orm_1 = require("drizzle-orm");
class GameHandlers {
    constructor(io, socket) {
        this.io = io;
        this.socket = socket;
    }
    setupEventListeners() {
        this.socket.on('start-game', this.handleStartGame.bind(this));
        this.socket.on('make-move', this.handleMakeMove.bind(this));
        this.socket.on('request-game-state', this.handleRequestGameState.bind(this));
        this.socket.on('forfeit-game', this.handleForfeitGame.bind(this));
        console.log(`🎮 Game handlers setup for user ${this.socket.user.username}`);
    }
    async handleStartGame(data) {
        try {
            console.log(`🚀 Starting game in room ${data.roomId} by ${this.socket.user.username}`);
            const room = await this.getRoomWithValidation(data.roomId);
            if (!room)
                return;
            if (room.hostId !== this.socket.user.id) {
                this.emitError('PERMISSION_DENIED', 'Only the host can start the game');
                return;
            }
            if (room.status !== 'lobby') {
                this.emitError('INVALID_ROOM_STATE', 'Game has already started or finished');
                return;
            }
            const members = await this.getRoomMembers(data.roomId);
            if (members.length < 2) {
                this.emitError('INSUFFICIENT_PLAYERS', 'Need at least 2 players to start');
                return;
            }
            const existingGame = await GameStateService_1.gameStateService.hasActiveGame(data.roomId);
            if (existingGame) {
                this.emitError('GAME_ALREADY_EXISTS', 'Game already started for this room');
                return;
            }
            const gameState = await GameStateService_1.gameStateService.createGame(data.roomId);
            await db_1.db
                .update(db_1.rooms)
                .set({ status: 'playing' })
                .where((0, drizzle_orm_1.eq)(db_1.rooms.id, data.roomId));
            this.io.to(data.roomId).emit('game-started', { gameState });
            console.log(`✅ Game started successfully in room ${data.roomId}`);
        }
        catch (error) {
            console.error('❌ Error starting game:', error);
            this.emitError('GAME_START_FAILED', 'Failed to start game');
        }
    }
    async handleMakeMove(data) {
        try {
            console.log(`🎯 Processing move from ${this.socket.user.username}:`, {
                type: data.move.type,
                roomId: data.roomId
            });
            const gameState = await GameStateService_1.gameStateService.getGameState(data.roomId);
            if (!gameState) {
                this.emitError('GAME_NOT_FOUND', 'No active game found for this room');
                return;
            }
            const currentPlayer = GameEngineManager_1.gameEngineManager.getCurrentPlayer(gameState);
            if (data.move.playerId !== this.socket.user.id) {
                this.emitError('INVALID_PLAYER', 'Move playerId does not match authenticated user');
                return;
            }
            if (currentPlayer.id !== this.socket.user.id) {
                this.emitError('NOT_YOUR_TURN', 'It is not your turn');
                return;
            }
            const isValidMove = GameEngineManager_1.gameEngineManager.validateMove(gameState, data.move);
            if (!isValidMove) {
                this.emitInvalidMove('INVALID_MOVE', 'Move is not valid according to game rules', data.move);
                return;
            }
            let newGameState = GameEngineManager_1.gameEngineManager.applyMove(gameState, data.move);
            const fullMove = {
                id: crypto.randomUUID(),
                timestamp: new Date(),
                ...data.move
            };
            await GameStateService_1.gameStateService.saveGameState(data.roomId, newGameState);
            this.io.to(data.roomId).emit('move-made', {
                move: fullMove,
                gameState: newGameState
            });
            const aiProcessedState = GameStateService_1.gameStateService.getProcessedAIMove(data.roomId);
            if (aiProcessedState) {
                console.log(`🤖 AI moves detected, broadcasting updated state for room ${data.roomId}`);
                this.io.to(data.roomId).emit('move-made', {
                    move: {
                        id: crypto.randomUUID(),
                        timestamp: new Date(),
                        type: 'pawn',
                        playerId: 'ai-player'
                    },
                    gameState: aiProcessedState
                });
                newGameState = aiProcessedState;
            }
            if (GameEngineManager_1.gameEngineManager.isGameFinished(newGameState)) {
                const winner = GameEngineManager_1.gameEngineManager.getWinner(newGameState);
                if (winner) {
                    this.io.to(data.roomId).emit('game-finished', {
                        gameState: newGameState,
                        winner: newGameState.players.find(p => p.id === winner)
                    });
                    console.log(`🏆 Game finished in room ${data.roomId}, winner: ${winner}`);
                    setTimeout(() => {
                        this.io.to(data.roomId).emit('room-updated', {
                            room: {
                                id: data.roomId,
                                status: 'finished',
                                isGameFinished: true
                            }
                        });
                    }, 5000);
                }
            }
            console.log(`✅ Move processed successfully for ${this.socket.user.username}`);
        }
        catch (error) {
            console.error('❌ Error processing move:', error);
            this.emitError('MOVE_PROCESSING_FAILED', 'Failed to process move');
        }
    }
    async handleRequestGameState(data) {
        try {
            console.log(`📊 Game state requested by ${this.socket.user.username} for room ${data.roomId}`);
            const isMember = await this.isUserRoomMember(data.roomId, this.socket.user.id);
            if (!isMember) {
                this.emitError('ACCESS_DENIED', 'You are not a member of this room');
                return;
            }
            const gameState = await GameStateService_1.gameStateService.getGameState(data.roomId);
            if (gameState) {
                const validMoves = GameEngineManager_1.gameEngineManager.getValidMoves(gameState, this.socket.user.id);
                this.socket.emit('game-state-sync', {
                    gameState,
                    validMoves: validMoves.map(move => ({
                        ...move,
                        id: crypto.randomUUID(),
                        timestamp: new Date()
                    }))
                });
                console.log(`✅ Active game state sent to ${this.socket.user.username}`);
                return;
            }
            const finishedGame = await GameStateService_1.gameStateService.getFinishedGame(data.roomId);
            if (finishedGame) {
                const winner = finishedGame.players.find(p => p.id === finishedGame.winner);
                this.socket.emit('game-finished', {
                    gameState: finishedGame,
                    winner: winner
                });
                console.log(`🏆 Finished game results sent to ${this.socket.user.username}`);
                return;
            }
            this.emitError('GAME_NOT_FOUND', 'No active game found for this room');
        }
        catch (error) {
            console.error('❌ Error sending game state:', error);
            this.emitError('GAME_STATE_FAILED', 'Failed to get game state');
        }
    }
    async handleForfeitGame(data) {
        try {
            console.log(`🏳️ Forfeit requested by ${this.socket.user.username} in room ${data.roomId}`);
            const isMember = await this.isUserRoomMember(data.roomId, this.socket.user.id);
            if (!isMember) {
                this.emitError('ACCESS_DENIED', 'You are not a member of this room');
                return;
            }
            const gameState = await GameStateService_1.gameStateService.getGameState(data.roomId);
            if (!gameState) {
                this.emitError('GAME_NOT_FOUND', 'No active game found for this room');
                return;
            }
            const player = gameState.players.find(p => p.id === this.socket.user.id);
            if (!player) {
                this.emitError('PLAYER_NOT_IN_GAME', 'You are not a player in this game');
                return;
            }
            const updatedGameState = await GameStateService_1.gameStateService.forfeitPlayer(data.roomId, this.socket.user.id);
            if (!updatedGameState) {
                this.emitError('FORFEIT_FAILED', 'Failed to process forfeit');
                return;
            }
            this.io.to(data.roomId).emit('player-forfeited', {
                playerId: this.socket.user.id,
                playerName: this.socket.user.username,
                gameState: updatedGameState
            });
            if (updatedGameState.status === 'finished') {
                const winner = updatedGameState.players.find(p => p.id === updatedGameState.winner);
                this.io.to(data.roomId).emit('game-finished', {
                    gameState: updatedGameState,
                    winner: winner || updatedGameState.players.find(p => p.isConnected)
                });
                console.log(`🏆 Game finished due to forfeit in room ${data.roomId}`);
            }
            console.log(`✅ Forfeit processed successfully for ${this.socket.user.username}`);
        }
        catch (error) {
            console.error('❌ Error processing forfeit:', error);
            this.emitError('FORFEIT_PROCESSING_FAILED', 'Failed to process forfeit');
        }
    }
    async getRoomWithValidation(roomId) {
        const roomResult = await db_1.db
            .select()
            .from(db_1.rooms)
            .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId))
            .limit(1);
        if (roomResult.length === 0) {
            this.emitError('ROOM_NOT_FOUND', 'Room not found');
            return null;
        }
        return roomResult[0];
    }
    async getRoomMembers(roomId) {
        return await db_1.db
            .select()
            .from(db_1.roomMembers)
            .where((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId));
    }
    async isUserRoomMember(roomId, userId) {
        const result = await db_1.db
            .select()
            .from(db_1.roomMembers)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, userId)))
            .limit(1);
        return result.length > 0;
    }
    emitError(code, message) {
        const error = { code, message };
        this.socket.emit('error', { error });
        console.log(`⚠️ Emitted error to ${this.socket.user.username}: ${code} - ${message}`);
    }
    emitInvalidMove(code, message, originalMove) {
        this.socket.emit('invalid-move', {
            error: message,
            originalMove
        });
        console.log(`⚠️ Invalid move from ${this.socket.user.username}: ${code} - ${message}`);
    }
}
exports.GameHandlers = GameHandlers;
