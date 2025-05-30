// backend/src/routes/games.ts
import { Router, Request, Response } from 'express';
import passport from 'passport';
import { z } from 'zod';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { gameStateService } from '../game/GameStateService';
import { gameEngineManager } from '../game/GameEngineManager';
import { db, roomMembers } from '../db';
import { eq, and } from 'drizzle-orm';

const router = Router();

// All routes require authentication
router.use(passport.authenticate('jwt', { session: false }));

// Validation schemas
const makeMoveSchema = z.object({
  move: z.object({
    type: z.enum(['pawn', 'wall']),
    playerId: z.string(),
    
    // For pawn moves
    fromPosition: z.object({
      x: z.number().min(0).max(8),
      y: z.number().min(0).max(8),
    }).optional(),
    toPosition: z.object({
      x: z.number().min(0).max(8),
      y: z.number().min(0).max(8),
    }).optional(),
    
    // For wall placement
    wallPosition: z.object({
      x: z.number().min(0).max(7),
      y: z.number().min(0).max(7),
    }).optional(),
    wallOrientation: z.enum(['horizontal', 'vertical']).optional(),
  }),
});

// Get game state
router.get('/:roomId/state', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;
  const { roomId } = req.params;

  // Verify user is member of the room
  const membership = await db
    .select()
    .from(roomMembers)
    .where(and(
      eq(roomMembers.roomId, roomId),
      eq(roomMembers.userId, user.id)
    ))
    .limit(1);

  if (membership.length === 0) {
    throw new AppError(403, 'NOT_ROOM_MEMBER', 'You are not a member of this room');
  }

  // Get game state
  const gameState = await gameStateService.getGameState(roomId);
  if (!gameState) {
    throw new AppError(404, 'GAME_NOT_FOUND', 'No active game found for this room');
  }

  // Get valid moves for the current player
  const validMoves = gameEngineManager.getValidMoves(gameState, user.id);

  res.json({
    success: true,
    data: {
      gameState,
      validMoves,
    },
  });
}));

// Make move
router.post('/:roomId/move', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;
  const { roomId } = req.params;
  const { move } = makeMoveSchema.parse(req.body);

  // Verify user is member of the room
  const membership = await db
    .select()
    .from(roomMembers)
    .where(and(
      eq(roomMembers.roomId, roomId),
      eq(roomMembers.userId, user.id)
    ))
    .limit(1);

  if (membership.length === 0) {
    throw new AppError(403, 'NOT_ROOM_MEMBER', 'You are not a member of this room');
  }

  // Ensure the move is from the authenticated user
  if (move.playerId !== user.id) {
    throw new AppError(403, 'INVALID_PLAYER', 'You can only make moves for yourself');
  }

  // Get current game state
  const gameState = await gameStateService.getGameState(roomId);
  if (!gameState) {
    throw new AppError(404, 'GAME_NOT_FOUND', 'No active game found for this room');
  }

  // Check if game is finished
  if (gameState.status === 'finished') {
    throw new AppError(400, 'GAME_FINISHED', 'Game has already finished');
  }

  // Check if it's the player's turn
  const currentPlayer = gameEngineManager.getCurrentPlayer(gameState);
  if (currentPlayer.id !== user.id) {
    throw new AppError(400, 'NOT_YOUR_TURN', `It's ${currentPlayer.username}'s turn`);
  }

  // Validate move through game engine
  const isValidMove = gameEngineManager.validateMove(gameState, move);
  if (!isValidMove) {
    throw new AppError(400, 'INVALID_MOVE', 'Move is not valid according to game rules');
  }

  // Apply the move
  const newGameState = gameEngineManager.applyMove(gameState, move);
  
  // Check if game is finished
  if (gameEngineManager.isGameFinished(newGameState)) {
    const winner = gameEngineManager.getWinner(newGameState);
    if (winner) {
      newGameState.status = 'finished';
      newGameState.winner = winner;
      newGameState.finishedAt = new Date();
    }
  }

  // Save the updated game state
  await gameStateService.saveGameState(roomId, newGameState);

  // Get valid moves for the new current player
  const validMoves = gameEngineManager.getValidMoves(newGameState, newGameState.players[newGameState.currentPlayerIndex].id);

  res.json({
    success: true,
    data: {
      gameState: newGameState,
      validMoves,
    },
  });
}));

// Get valid moves for current player
router.get('/:roomId/valid-moves', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;
  const { roomId } = req.params;

  // Verify user is member of the room
  const membership = await db
    .select()
    .from(roomMembers)
    .where(and(
      eq(roomMembers.roomId, roomId),
      eq(roomMembers.userId, user.id)
    ))
    .limit(1);

  if (membership.length === 0) {
    throw new AppError(403, 'NOT_ROOM_MEMBER', 'You are not a member of this room');
  }

  // Get game state
  const gameState = await gameStateService.getGameState(roomId);
  if (!gameState) {
    throw new AppError(404, 'GAME_NOT_FOUND', 'No active game found for this room');
  }

  // Get valid moves for the user
  const validMoves = gameEngineManager.getValidMoves(gameState, user.id);

  res.json({
    success: true,
    data: {
      validMoves,
      canMove: gameEngineManager.getCurrentPlayer(gameState).id === user.id,
    },
  });
}));

export { router as gameRouter };