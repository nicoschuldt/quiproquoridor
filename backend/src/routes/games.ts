// backend/src/routes/games.ts
import { Router, Request, Response } from 'express';
import passport from 'passport';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

// All routes require authentication
router.use(passport.authenticate('jwt', { session: false }));

// Get game state (placeholder)
router.get('/:roomId/state', asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;
  
  // TODO: Implement game state retrieval
  res.json({
    success: true,
    data: {
      message: 'Game state endpoint - to be implemented',
      roomId,
    },
  });
}));

// Make move (placeholder)
router.post('/:roomId/move', asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { move } = req.body;
  
  // TODO: Implement move handling with game engine
  res.json({
    success: true,
    data: {
      message: 'Move endpoint - to be implemented',
      roomId,
      move,
    },
  });
}));

export { router as gameRouter };