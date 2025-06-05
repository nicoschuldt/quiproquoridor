import { Router, Request, Response } from 'express';
import passport from 'passport';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db, users, gamePlayers, games, transactions } from '../db';
import { eq, desc } from 'drizzle-orm';
import { config } from '../config';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

router.post('/register', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { username, password } = registerSchema.parse(req.body);

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingUser.length > 0) {
    throw new AppError(400, 'USER_EXISTS', 'Username already taken');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = await db
    .insert(users)
    .values({
      username,
      passwordHash,
    })
    .returning();

  const user = newUser[0];

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon,
        createdAt: user.createdAt,
      },
    },
  });
}));

router.post('/login', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { username, password } = loginSchema.parse(req.body);

  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (userResult.length === 0) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  }

  const user = userResult[0];

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon,
        createdAt: user.createdAt,
      },
    },
  });
}));

router.get('/me', passport.authenticate('jwt', { session: false }), asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;

  const fullUserData = await db
    .select({
      id: users.id,
      username: users.username,
      gamesPlayed: users.gamesPlayed,
      gamesWon: users.gamesWon,
      createdAt: users.createdAt,
      coinBalance: users.coinBalance,
      selectedBoardTheme: users.selectedBoardTheme,
      selectedPawnTheme: users.selectedPawnTheme,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (fullUserData.length === 0) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const userData = fullUserData[0];

  res.json({
    success: true,
    data: {
      id: userData.id,
      username: userData.username,
      gamesPlayed: userData.gamesPlayed,
      gamesWon: userData.gamesWon,
      createdAt: userData.createdAt,
      coinBalance: userData.coinBalance,
      selectedBoardTheme: userData.selectedBoardTheme,
      selectedPawnTheme: userData.selectedPawnTheme,
    },
  });
}));

router.get('/game-history',
  passport.authenticate('jwt', { session: false }),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = req.user as any;

    const gameHistory = await db
      .select({
        gameId: gamePlayers.gameId,
        playerIndex: gamePlayers.playerIndex,
        color: gamePlayers.color,
        isWinner: gamePlayers.isWinner,
        wallsUsed: gamePlayers.wallsUsed,
        gameStatus: games.status,
        gameStartedAt: games.startedAt,
        gameFinishedAt: games.finishedAt,
      })
      .from(gamePlayers)
      .innerJoin(games, eq(games.id, gamePlayers.gameId))
      .where(eq(gamePlayers.userId, user.id))
      .orderBy(desc(games.createdAt))
      .limit(50);

    res.json({
      success: true,
      data: gameHistory,
    });
  })
);

router.get('/transaction-history',
  passport.authenticate('jwt', { session: false }),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = req.user as any;

    const transactionHistory = await db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        description: transactions.description,
        shopItemId: transactions.shopItemId,
        stripeSessionId: transactions.stripeSessionId,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .where(eq(transactions.userId, user.id))
      .orderBy(desc(transactions.createdAt))
      .limit(100);

    res.json({
      success: true,
      data: transactionHistory,
    });
  })
);

export { router as authRouter };