// backend/src/routes/rooms.ts
import { Router, Request, Response } from 'express';
import passport from 'passport';
import { z } from 'zod';
import { db, rooms, roomMembers, users } from '../db';
import { eq, and, inArray } from 'drizzle-orm';
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

  // **CRITICAL FIX**: Ensure user can only be in one room at a time
  // Remove user from any existing rooms before creating/joining new one
  await db
    .delete(roomMembers)
    .where(eq(roomMembers.userId, user.id));

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

  // **CRITICAL FIX**: Ensure user can only be in one room at a time
  // Remove user from any existing rooms before joining new one
  await db
    .delete(roomMembers)
    .where(eq(roomMembers.userId, user.id));

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

  // Note: No need to check if user already in room since we just removed them
  // But we still need to check room capacity
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
      joinedAt: roomMembers.joinedAt,
    })
    .from(roomMembers)
    .innerJoin(users, eq(roomMembers.userId, users.id))
    .where(eq(roomMembers.roomId, roomId));

  // Convert to Player format expected by frontend
  const players = membersWithUsers.map((member, index) => ({
    id: member.id,
    username: member.username,
    color: ['red', 'blue', 'green', 'yellow'][index] as 'red' | 'blue' | 'green' | 'yellow',
    position: { x: 4, y: index === 0 ? 0 : 8 }, // Simple position assignment
    wallsRemaining: room.maxPlayers === 2 ? 10 : 5,
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

// Check if user is currently in a room (for reconnection)
router.get('/user/current', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;

  // Find if user is in any active room
  const roomMembership = await db
    .select({
      roomId: roomMembers.roomId,
      isHost: roomMembers.isHost,
      roomStatus: rooms.status,
    })
    .from(roomMembers)
    .innerJoin(rooms, eq(roomMembers.roomId, rooms.id))
    .where(and(
      eq(roomMembers.userId, user.id),
      // Only get rooms that are not finished - include both lobby and playing
      inArray(rooms.status, ['lobby', 'playing'])
    ))
    .limit(1);

  if (roomMembership.length === 0) {
    res.json({
      success: true,
      data: null,
    });
    return;
  }

  const membership = roomMembership[0];
  res.json({
    success: true,
    data: {
      roomId: membership.roomId,
      roomStatus: membership.roomStatus,
      isHost: membership.isHost,
    },
  });
}));

// Leave room
router.delete('/:roomId/leave', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;
  const { roomId } = req.params;

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

  const isHost = membership[0].isHost;

  // Remove user from room
  await db
    .delete(roomMembers)
    .where(and(
      eq(roomMembers.roomId, roomId),
      eq(roomMembers.userId, user.id)
    ));

  // Check remaining members
  const remainingMembers = await db
    .select()
    .from(roomMembers)
    .where(eq(roomMembers.roomId, roomId));

  if (remainingMembers.length === 0) {
    // Delete room if empty
    await db
      .delete(rooms)
      .where(eq(rooms.id, roomId));
  } else if (isHost) {
    // Transfer host to oldest member
    const oldestMember = remainingMembers.sort((a, b) => 
      new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
    )[0];

    await db
      .update(roomMembers)
      .set({ isHost: true })
      .where(and(
        eq(roomMembers.roomId, roomId),
        eq(roomMembers.userId, oldestMember.userId)
      ));

    // Update room host
    await db
      .update(rooms)
      .set({ hostId: oldestMember.userId })
      .where(eq(rooms.id, roomId));
  }

  res.json({
    success: true,
    message: 'Left room successfully',
  });
}));

export { router as roomsRouter };