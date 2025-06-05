import { Router, Request, Response } from 'express';
import passport from 'passport';
import { z } from 'zod';
import { db, rooms, roomMembers, users } from '../db';
import { eq, and, inArray } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { gameStateService } from '../game/GameStateService';
import type { AIDifficulty, ServerToClientEvents, ClientToServerEvents } from '../shared/types';
import type { Server } from 'socket.io';

const router = Router();

router.use(passport.authenticate('jwt', { session: false }));

const createRoomSchema = z.object({
  maxPlayers: z.union([z.literal(2), z.literal(4)]),
  isPrivate: z.boolean().optional(),
  hasTimeLimit: z.boolean().optional(),
  timeLimitSeconds: z.number().optional(),
});

const joinRoomSchema = z.object({
  code: z.string().length(6),
});

const addAIPlayerSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

router.post('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;
  const roomData = createRoomSchema.parse(req.body);

  await db
    .delete(roomMembers)
    .where(eq(roomMembers.userId, user.id));

  let code: string;
  let attempts = 0;
  do {
    code = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6)();
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

router.post('/join', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;
  const { code } = joinRoomSchema.parse(req.body);

  await db
    .delete(roomMembers)
    .where(eq(roomMembers.userId, user.id));

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
  const currentMembers = await db
    .select()
    .from(roomMembers)
    .where(eq(roomMembers.roomId, room.id));

  if (currentMembers.length >= room.maxPlayers) {
    throw new AppError(400, 'ROOM_FULL', 'Room is full');
  }

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

router.get('/:roomId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;
  const { roomId } = req.params;

  const roomResult = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (roomResult.length === 0) {
    throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found');
  }

  const room = roomResult[0];

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

  const membersWithUsers = await db
    .select({
      id: users.id,
      username: users.username,
      isHost: roomMembers.isHost,
      joinedAt: roomMembers.joinedAt,
      isAI: users.isAI,
      aiDifficulty: users.aiDifficulty,
    })
    .from(roomMembers)
    .innerJoin(users, eq(roomMembers.userId, users.id))
    .where(eq(roomMembers.roomId, roomId));

  const players = membersWithUsers.map((member, index) => ({
    id: member.id,
    username: member.username,
    color: ['red', 'blue', 'green', 'yellow'][index] as 'red' | 'blue' | 'green' | 'yellow',
    position: { x: 4, y: index === 0 ? 0 : 8 }, // Simple position assignment
    wallsRemaining: room.maxPlayers === 2 ? 10 : 5,
    isConnected: true,
    joinedAt: member.joinedAt,
    selectedPawnTheme: 'theme-pawn-default', // Default theme for now
    isAI: member.isAI || false,
    aiDifficulty: member.aiDifficulty || undefined,
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

router.get('/user/current', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;

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

router.delete('/:roomId/leave', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;
  const { roomId } = req.params;

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

  await db
    .delete(roomMembers)
    .where(and(
      eq(roomMembers.roomId, roomId),
      eq(roomMembers.userId, user.id)
    ));

  const remainingMembers = await db
    .select()
    .from(roomMembers)
    .where(eq(roomMembers.roomId, roomId));

  if (remainingMembers.length === 0) {
    await db
      .delete(rooms)
      .where(eq(rooms.id, roomId));
  } else if (isHost) {
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

router.post('/:roomId/ai', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;
  const { roomId } = req.params;
  const { difficulty } = addAIPlayerSchema.parse(req.body);

  const roomResult = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (roomResult.length === 0) {
    throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found');
  }

  const room = roomResult[0];

  if (room.hostId !== user.id) {
    throw new AppError(403, 'PERMISSION_DENIED', 'Only the host can add AI players');
  }

  if (room.status !== 'lobby') {
    throw new AppError(400, 'INVALID_ROOM_STATE', 'Cannot add AI players after game has started');
  }

  const currentMembers = await db
    .select()
    .from(roomMembers)
    .where(eq(roomMembers.roomId, roomId));

  if (currentMembers.length >= room.maxPlayers) {
    throw new AppError(400, 'ROOM_FULL', 'Room is full');
  }

  const aiUsername = `AI (${difficulty}) ${Date.now()}`;
  const aiUser = await db
    .insert(users)
    .values({
      username: aiUsername,
      passwordHash: 'ai-no-password', // AI doesn't need real auth
      isAI: true,
      aiDifficulty: difficulty,
    })
    .returning();

  await db.insert(roomMembers).values({
    roomId: roomId,
    userId: aiUser[0].id,
    isHost: false,
  });

  const io = req.app.get('io') as Server<ClientToServerEvents, ServerToClientEvents>;
  
  const updatedMembers = await db
    .select({
      id: users.id,
      username: users.username,
      isHost: roomMembers.isHost,
      joinedAt: roomMembers.joinedAt,
      isAI: users.isAI,
      aiDifficulty: users.aiDifficulty,
    })
    .from(roomMembers)
    .innerJoin(users, eq(roomMembers.userId, users.id))
    .where(eq(roomMembers.roomId, roomId));

  const players = updatedMembers.map((member, index) => ({
    id: member.id,
    username: member.username,
    color: ['red', 'blue', 'green', 'yellow'][index] as 'red' | 'blue' | 'green' | 'yellow',
    position: { x: 4, y: index === 0 ? 0 : 8 },
    wallsRemaining: room.maxPlayers === 2 ? 10 : 5,
    isConnected: true,
    joinedAt: member.joinedAt,
    selectedPawnTheme: 'theme-pawn-default',
    isAI: member.isAI || false,
    aiDifficulty: member.aiDifficulty || undefined,
  }));

  const aiPlayer = players.find(p => p.id === aiUser[0].id)!;
  
  io.to(roomId).emit('player-joined', { player: aiPlayer });
  
  const updatedRoomData = {
    id: room.id,
    code: room.code,
    hostId: room.hostId,
    players,
    maxPlayers: room.maxPlayers as 2 | 4,
    status: room.status,
    isPrivate: room.isPrivate,
    hasTimeLimit: room.hasTimeLimit,
    timeLimitSeconds: room.timeLimitSeconds || undefined,
    createdAt: room.createdAt,
  };
  
  io.to(roomId).emit('room-updated', { room: updatedRoomData });

  if (players.length === room.maxPlayers) {
    console.log(`🎮 Room ${roomId} is full after AI addition, auto-starting game`);
    
    await db
      .update(rooms)
      .set({ status: 'playing' })
      .where(eq(rooms.id, roomId));

    const gameState = await gameStateService.createGame(roomId);
    
    io.to(roomId).emit('game-started', { gameState });
    
    console.log(`✅ Game auto-started for room ${roomId} with ${players.length} players`);
  }

  res.json({
    success: true,
    data: {
      aiPlayer: {
        id: aiUser[0].id,
        username: aiUsername,
        isAI: true,
        aiDifficulty: difficulty,
      }
    },
    message: 'AI player added successfully',
  });
}));

export { router as roomsRouter };