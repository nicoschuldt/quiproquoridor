"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameRouter = void 0;
// backend/src/routes/games.ts
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const zod_1 = require("zod");
const errorHandler_1 = require("../middleware/errorHandler");
const GameStateService_1 = require("../game/GameStateService");
const GameEngineManager_1 = require("../game/GameEngineManager");
const db_1 = require("../db");
const drizzle_orm_1 = require("drizzle-orm");
const router = (0, express_1.Router)();
exports.gameRouter = router;
// All routes require authentication
router.use(passport_1.default.authenticate('jwt', { session: false }));
// Validation schemas
const makeMoveSchema = zod_1.z.object({
    move: zod_1.z.object({
        type: zod_1.z.enum(['pawn', 'wall']),
        playerId: zod_1.z.string(),
        // For pawn moves
        fromPosition: zod_1.z.object({
            x: zod_1.z.number().min(0).max(8),
            y: zod_1.z.number().min(0).max(8),
        }).optional(),
        toPosition: zod_1.z.object({
            x: zod_1.z.number().min(0).max(8),
            y: zod_1.z.number().min(0).max(8),
        }).optional(),
        // For wall placement
        wallPosition: zod_1.z.object({
            x: zod_1.z.number().min(0).max(7),
            y: zod_1.z.number().min(0).max(7),
        }).optional(),
        wallOrientation: zod_1.z.enum(['horizontal', 'vertical']).optional(),
    }),
});
// Get game state
router.get('/:roomId/state', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { roomId } = req.params;
    // Verify user is member of the room
    const membership = await db_1.db
        .select()
        .from(db_1.roomMembers)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id)))
        .limit(1);
    if (membership.length === 0) {
        throw new errorHandler_1.AppError(403, 'NOT_ROOM_MEMBER', 'You are not a member of this room');
    }
    // Get game state
    const gameState = await GameStateService_1.gameStateService.getGameState(roomId);
    if (!gameState) {
        throw new errorHandler_1.AppError(404, 'GAME_NOT_FOUND', 'No active game found for this room');
    }
    // Get valid moves for the current player
    const validMoves = GameEngineManager_1.gameEngineManager.getValidMoves(gameState, user.id);
    res.json({
        success: true,
        data: {
            gameState,
            validMoves,
        },
    });
}));
// Make move
router.post('/:roomId/move', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { roomId } = req.params;
    const { move } = makeMoveSchema.parse(req.body);
    // Verify user is member of the room
    const membership = await db_1.db
        .select()
        .from(db_1.roomMembers)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id)))
        .limit(1);
    if (membership.length === 0) {
        throw new errorHandler_1.AppError(403, 'NOT_ROOM_MEMBER', 'You are not a member of this room');
    }
    // Ensure the move is from the authenticated user
    if (move.playerId !== user.id) {
        throw new errorHandler_1.AppError(403, 'INVALID_PLAYER', 'You can only make moves for yourself');
    }
    // Get current game state
    const gameState = await GameStateService_1.gameStateService.getGameState(roomId);
    if (!gameState) {
        throw new errorHandler_1.AppError(404, 'GAME_NOT_FOUND', 'No active game found for this room');
    }
    // Check if game is finished
    if (gameState.status === 'finished') {
        throw new errorHandler_1.AppError(400, 'GAME_FINISHED', 'Game has already finished');
    }
    // Check if it's the player's turn
    const currentPlayer = GameEngineManager_1.gameEngineManager.getCurrentPlayer(gameState);
    if (currentPlayer.id !== user.id) {
        throw new errorHandler_1.AppError(400, 'NOT_YOUR_TURN', `It's ${currentPlayer.username}'s turn`);
    }
    // Validate move through game engine
    const isValidMove = GameEngineManager_1.gameEngineManager.validateMove(gameState, move);
    if (!isValidMove) {
        throw new errorHandler_1.AppError(400, 'INVALID_MOVE', 'Move is not valid according to game rules');
    }
    // Apply the move
    const newGameState = GameEngineManager_1.gameEngineManager.applyMove(gameState, move);
    // Check if game is finished
    if (GameEngineManager_1.gameEngineManager.isGameFinished(newGameState)) {
        const winner = GameEngineManager_1.gameEngineManager.getWinner(newGameState);
        if (winner) {
            newGameState.status = 'finished';
            newGameState.winner = winner;
            newGameState.finishedAt = new Date();
        }
    }
    // Save the updated game state
    await GameStateService_1.gameStateService.saveGameState(roomId, newGameState);
    // Get valid moves for the new current player
    const validMoves = GameEngineManager_1.gameEngineManager.getValidMoves(newGameState, newGameState.players[newGameState.currentPlayerIndex].id);
    res.json({
        success: true,
        data: {
            gameState: newGameState,
            validMoves,
        },
    });
}));
// Get valid moves for current player
router.get('/:roomId/valid-moves', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { roomId } = req.params;
    // Verify user is member of the room
    const membership = await db_1.db
        .select()
        .from(db_1.roomMembers)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id)))
        .limit(1);
    if (membership.length === 0) {
        throw new errorHandler_1.AppError(403, 'NOT_ROOM_MEMBER', 'You are not a member of this room');
    }
    // Get game state
    const gameState = await GameStateService_1.gameStateService.getGameState(roomId);
    if (!gameState) {
        throw new errorHandler_1.AppError(404, 'GAME_NOT_FOUND', 'No active game found for this room');
    }
    // Get valid moves for the user
    const validMoves = GameEngineManager_1.gameEngineManager.getValidMoves(gameState, user.id);
    res.json({
        success: true,
        data: {
            validMoves,
            canMove: GameEngineManager_1.gameEngineManager.getCurrentPlayer(gameState).id === user.id,
        },
    });
}));
