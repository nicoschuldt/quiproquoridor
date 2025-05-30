// backend/src/routes/rooms.ts
import { Router, Request, Response } from 'express';
import passport from 'passport';
import { z } from 'zod';
import { db, rooms, roomMembers, users } from '../db';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

// All routes require authentication
router.use(passport.authenticate('jwt', { session: false }));

// Validation schemas
const createRoomSchema = z.object({
  maxPlayers: z.union([z.literal(2), z.literal(4)]),
  isPrivate: z.boolean().optional(),
  hasTimeLimit: z.boolean().optional(),
  timeLimitSeconds: z.number().optional(),
});

const joinRoomSchema = z.object({
  code: z.string().length(6),
});

// Create room
router.post('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;
  const roomData = createRoomSchema.parse(req.body);

  // Generate unique room code
  let code: string;
  let attempts = 0;
  do {
    code = nanoid(6).toUpperCase();
    attempts++;
    if (attempts > 10) {
      throw new AppError(500, 'CODE_GENERATION_FAILED', 'Could not generate unique room code');
    }
    
    const existing = await db
      .select()
      .from(rooms)
      .where(eq(rooms.code, code))
      .limit(1);
    
    if (existing.length === 0) break;
  } while (true);

  // Create room
  const newRoom = await db
    .insert(rooms)
    .values({
      code,
      hostId: user.id,
      maxPlayers: roomData.maxPlayers,
      isPrivate: roomData.isPrivate || false,
      hasTimeLimit: roomData.hasTimeLimit || false,
      timeLimitSeconds: roomData.timeLimitSeconds,
    })
    .returning();

  const room = newRoom[0];

  // Add host as room member
  await db.insert(roomMembers).values({
    roomId: room.id,
    userId: user.id,
    isHost: true,
    isReady: false,
  });

  res.json({
    success: true,
    data: {
      room: {
        id: room.id,
        code: room.code,
        hostId: room.hostId,
        maxPlayers: room.maxPlayers as 2 | 4,
        status: room.status,
        isPrivate: room.isPrivate,
        hasTimeLimit: room.hasTimeLimit,
        timeLimitSeconds: room.timeLimitSeconds,
        createdAt: room.createdAt,
      },
      isHost: true,
    },
  });
}));

// Join room
router.post('/join', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;
  const { code } = joinRoomSchema.parse(req.body);

  // Find room
  const roomResult = await db
    .select()
    .from(rooms)
    .where(and(
      eq(rooms.code, code),
      eq(rooms.status, 'lobby')
    ))
    .limit(1);

  if (roomResult.length === 0) {
    throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found or no longer accepting players');
  }

  const room = roomResult[0];

  // Check if user already in room
  const existingMember = await db
    .select()
    .from(roomMembers)
    .where(and(
      eq(roomMembers.roomId, room.id),
      eq(roomMembers.userId, user.id)
    ))
    .limit(1);

  if (existingMember.length > 0) {
    throw new AppError(400, 'ALREADY_IN_ROOM', 'You are already in this room');
  }

  // Check room capacity
  const currentMembers = await db
    .select()
    .from(roomMembers)
    .where(eq(roomMembers.roomId, room.id));

  if (currentMembers.length >= room.maxPlayers) {
    throw new AppError(400, 'ROOM_FULL', 'Room is full');
  }

  // Add user to room
  await db.insert(roomMembers).values({
    roomId: room.id,
    userId: user.id,
    isHost: false,
    isReady: false,
  });

  res.json({
    success: true,
    data: {
      room: {
        id: room.id,
        code: room.code,
        hostId: room.hostId,
        maxPlayers: room.maxPlayers as 2 | 4,
        status: room.status,
        isPrivate: room.isPrivate,
        hasTimeLimit: room.hasTimeLimit,
        timeLimitSeconds: room.timeLimitSeconds,
        createdAt: room.createdAt,
      },
      isHost: false,
    },
  });
}));

// Get room details
router.get('/:roomId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;
  const { roomId } = req.params;

  // Get room
  const roomResult = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (roomResult.length === 0) {
    throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found');
  }

  const room = roomResult[0];

  // Check if user is member
  const membership = await db
    .select()
    .from(roomMembers)
    .where(and(
      eq(roomMembers.roomId, room.id),
      eq(roomMembers.userId, user.id)
    ))
    .limit(1);

  if (membership.length === 0) {
    throw new AppError(403, 'NOT_ROOM_MEMBER', 'You are not a member of this room');
  }

  // Get all room members with user details
  const membersWithUsers = await db
    .select({
      id: users.id,
      username: users.username,
      isHost: roomMembers.isHost,
      isReady: roomMembers.isReady,
      joinedAt: roomMembers.joinedAt,
    })
    .from(roomMembers)
    .innerJoin(users, eq(roomMembers.userId, users.id))
    .where(eq(roomMembers.roomId, room.id));

  // Convert to Player format expected by frontend
  const players = membersWithUsers.map((member, index) => ({
    id: member.id,
    username: member.username,
    color: ['red', 'blue', 'green', 'yellow'][index] as 'red' | 'blue' | 'green' | 'yellow',
    position: { x: 4, y: index === 0 ? 0 : 8 }, // Simple position assignment
    wallsRemaining: room.maxPlayers === 2 ? 10 : 5,
    isReady: member.isReady,
    isConnected: true,
    joinedAt: member.joinedAt,
  }));

  res.json({
    success: true,
    data: {
      room: {
        id: room.id,
        code: room.code,
        hostId: room.hostId,
        players,
        maxPlayers: room.maxPlayers as 2 | 4,
        status: room.status,
        isPrivate: room.isPrivate,
        hasTimeLimit: room.hasTimeLimit,
        timeLimitSeconds: room.timeLimitSeconds,
        createdAt: room.createdAt,
      },
      isHost: membership[0].isHost,
    },
  });
}));

// Update player ready status
router.patch('/:roomId/ready', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;
  const { roomId } = req.params;
  const { ready } = req.body;

  if (typeof ready !== 'boolean') {
    throw new AppError(400, 'INVALID_READY_STATUS', 'Ready status must be a boolean');
  }

  // Check if user is member of the room
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

  // Update ready status
  await db
    .update(roomMembers)
    .set({ isReady: ready })
    .where(and(
      eq(roomMembers.roomId, roomId),
      eq(roomMembers.userId, user.id)
    ));

  res.json({
    success: true,
    data: { ready },
    message: `Ready status updated to ${ready}`,
  });
}));

export { router as roomRouter };