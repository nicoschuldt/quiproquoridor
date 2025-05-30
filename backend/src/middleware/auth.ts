import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db, users } from '../db';
import { eq } from 'drizzle-orm';
import { AppError } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    gamesPlayed: number;
    gamesWon: number;
  };
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'NO_TOKEN', 'No authentication token provided');
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwtSecret) as any;

    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (userResult.length === 0) {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token');
    }

    const user = userResult[0];
    req.user = {
      id: user.id,
      username: user.username,
      gamesPlayed: user.gamesPlayed,
      gamesWon: user.gamesWon,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError(401, 'AUTH_FAILED', 'Authentication failed'));
  }
};