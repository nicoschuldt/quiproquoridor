"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomsRouter = void 0;
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const zod_1 = require("zod");
const db_1 = require("../db");
const drizzle_orm_1 = require("drizzle-orm");
const nanoid_1 = require("nanoid");
const errorHandler_1 = require("../middleware/errorHandler");
const GameStateService_1 = require("../game/GameStateService");
const router = (0, express_1.Router)();
exports.roomsRouter = router;
router.use(passport_1.default.authenticate('jwt', { session: false }));
const createRoomSchema = zod_1.z.object({
    maxPlayers: zod_1.z.union([zod_1.z.literal(2), zod_1.z.literal(4)]),
    isPrivate: zod_1.z.boolean().optional(),
    hasTimeLimit: zod_1.z.boolean().optional(),
    timeLimitSeconds: zod_1.z.number().optional(),
});
const joinRoomSchema = zod_1.z.object({
    code: zod_1.z.string().length(6),
});
const addAIPlayerSchema = zod_1.z.object({
    difficulty: zod_1.z.enum(['easy', 'medium', 'hard']),
});
router.post('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const roomData = createRoomSchema.parse(req.body);
    await db_1.db
        .delete(db_1.roomMembers)
        .where((0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id));
    let code;
    let attempts = 0;
    do {
        code = (0, nanoid_1.customAlphabet)('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6)();
        attempts++;
        if (attempts > 10) {
            throw new errorHandler_1.AppError(500, 'CODE_GENERATION_FAILED', 'Could not generate unique room code');
        }
        const existing = await db_1.db
            .select()
            .from(db_1.rooms)
            .where((0, drizzle_orm_1.eq)(db_1.rooms.code, code))
            .limit(1);
        if (existing.length === 0)
            break;
    } while (true);
    const newRoom = await db_1.db
        .insert(db_1.rooms)
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
    await db_1.db.insert(db_1.roomMembers).values({
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
                maxPlayers: room.maxPlayers,
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
router.post('/join', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { code } = joinRoomSchema.parse(req.body);
    await db_1.db
        .delete(db_1.roomMembers)
        .where((0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id));
    const roomResult = await db_1.db
        .select()
        .from(db_1.rooms)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.rooms.code, code), (0, drizzle_orm_1.eq)(db_1.rooms.status, 'lobby')))
        .limit(1);
    if (roomResult.length === 0) {
        throw new errorHandler_1.AppError(404, 'ROOM_NOT_FOUND', 'Room not found or no longer accepting players');
    }
    const room = roomResult[0];
    const currentMembers = await db_1.db
        .select()
        .from(db_1.roomMembers)
        .where((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, room.id));
    if (currentMembers.length >= room.maxPlayers) {
        throw new errorHandler_1.AppError(400, 'ROOM_FULL', 'Room is full');
    }
    await db_1.db.insert(db_1.roomMembers).values({
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
                maxPlayers: room.maxPlayers,
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
router.get('/:roomId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { roomId } = req.params;
    const roomResult = await db_1.db
        .select()
        .from(db_1.rooms)
        .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId))
        .limit(1);
    if (roomResult.length === 0) {
        throw new errorHandler_1.AppError(404, 'ROOM_NOT_FOUND', 'Room not found');
    }
    const room = roomResult[0];
    // verif si l'utilisateur est un membre
    const membership = await db_1.db
        .select()
        .from(db_1.roomMembers)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, room.id), (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id)))
        .limit(1);
    const isSpectator = membership.length === 0;
    const isHost = membership.length > 0 ? membership[0].isHost : false;
    const membersWithUsers = await db_1.db
        .select({
        id: db_1.users.id,
        username: db_1.users.username,
        isHost: db_1.roomMembers.isHost,
        joinedAt: db_1.roomMembers.joinedAt,
        isAI: db_1.users.isAI,
        aiDifficulty: db_1.users.aiDifficulty,
    })
        .from(db_1.roomMembers)
        .innerJoin(db_1.users, (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, db_1.users.id))
        .where((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId));
    const players = membersWithUsers.map((member, index) => ({
        id: member.id,
        username: member.username,
        color: ['red', 'blue', 'green', 'yellow'][index],
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
                maxPlayers: room.maxPlayers,
                status: room.status,
                isPrivate: room.isPrivate,
                hasTimeLimit: room.hasTimeLimit,
                timeLimitSeconds: room.timeLimitSeconds,
                createdAt: room.createdAt,
            },
            isHost: isHost,
            isSpectator: isSpectator,
        },
    });
}));
router.get('/user/current', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const roomMembership = await db_1.db
        .select({
        roomId: db_1.roomMembers.roomId,
        isHost: db_1.roomMembers.isHost,
        roomStatus: db_1.rooms.status,
    })
        .from(db_1.roomMembers)
        .innerJoin(db_1.rooms, (0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, db_1.rooms.id))
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id), (0, drizzle_orm_1.inArray)(db_1.rooms.status, ['lobby', 'playing'])))
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
router.delete('/:roomId/leave', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { roomId } = req.params;
    const membership = await db_1.db
        .select()
        .from(db_1.roomMembers)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id)))
        .limit(1);
    if (membership.length === 0) {
        throw new errorHandler_1.AppError(403, 'NOT_ROOM_MEMBER', 'You are not a member of this room');
    }
    const isHost = membership[0].isHost;
    await db_1.db
        .delete(db_1.roomMembers)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id)));
    const remainingMembers = await db_1.db
        .select()
        .from(db_1.roomMembers)
        .where((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId));
    if (remainingMembers.length === 0) {
        await db_1.db
            .delete(db_1.rooms)
            .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId));
    }
    else if (isHost) {
        const oldestMember = remainingMembers.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())[0];
        await db_1.db
            .update(db_1.roomMembers)
            .set({ isHost: true })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, oldestMember.userId)));
        await db_1.db
            .update(db_1.rooms)
            .set({ hostId: oldestMember.userId })
            .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId));
    }
    res.json({
        success: true,
        message: 'Left room successfully',
    });
}));
router.post('/:roomId/ai', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { roomId } = req.params;
    const { difficulty } = addAIPlayerSchema.parse(req.body);
    const roomResult = await db_1.db
        .select()
        .from(db_1.rooms)
        .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId))
        .limit(1);
    if (roomResult.length === 0) {
        throw new errorHandler_1.AppError(404, 'ROOM_NOT_FOUND', 'Room not found');
    }
    const room = roomResult[0];
    if (room.hostId !== user.id) {
        throw new errorHandler_1.AppError(403, 'PERMISSION_DENIED', 'Only the host can add AI players');
    }
    if (room.status !== 'lobby') {
        throw new errorHandler_1.AppError(400, 'INVALID_ROOM_STATE', 'Cannot add AI players after game has started');
    }
    const currentMembers = await db_1.db
        .select()
        .from(db_1.roomMembers)
        .where((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId));
    if (currentMembers.length >= room.maxPlayers) {
        throw new errorHandler_1.AppError(400, 'ROOM_FULL', 'Room is full');
    }
    const aiUsername = `AI (${difficulty}) ${Date.now()}`;
    const aiUser = await db_1.db
        .insert(db_1.users)
        .values({
        username: aiUsername,
        passwordHash: 'ai-no-password', // AI doesn't need real auth
        isAI: true,
        aiDifficulty: difficulty,
    })
        .returning();
    await db_1.db.insert(db_1.roomMembers).values({
        roomId: roomId,
        userId: aiUser[0].id,
        isHost: false,
    });
    const io = req.app.get('io');
    const updatedMembers = await db_1.db
        .select({
        id: db_1.users.id,
        username: db_1.users.username,
        isHost: db_1.roomMembers.isHost,
        joinedAt: db_1.roomMembers.joinedAt,
        isAI: db_1.users.isAI,
        aiDifficulty: db_1.users.aiDifficulty,
    })
        .from(db_1.roomMembers)
        .innerJoin(db_1.users, (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, db_1.users.id))
        .where((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId));
    const players = updatedMembers.map((member, index) => ({
        id: member.id,
        username: member.username,
        color: ['red', 'blue', 'green', 'yellow'][index],
        position: { x: 4, y: index === 0 ? 0 : 8 },
        wallsRemaining: room.maxPlayers === 2 ? 10 : 5,
        isConnected: true,
        joinedAt: member.joinedAt,
        selectedPawnTheme: 'theme-pawn-default',
        isAI: member.isAI || false,
        aiDifficulty: member.aiDifficulty || undefined,
    }));
    const aiPlayer = players.find(p => p.id === aiUser[0].id);
    io.to(roomId).emit('player-joined', { player: aiPlayer });
    const updatedRoomData = {
        id: room.id,
        code: room.code,
        hostId: room.hostId,
        players,
        maxPlayers: room.maxPlayers,
        status: room.status,
        isPrivate: room.isPrivate,
        hasTimeLimit: room.hasTimeLimit,
        timeLimitSeconds: room.timeLimitSeconds || undefined,
        createdAt: room.createdAt,
    };
    io.to(roomId).emit('room-updated', { room: updatedRoomData });
    if (players.length === room.maxPlayers) {
        console.log(`Room ${roomId} is full after AI addition, auto-starting game`);
        await db_1.db
            .update(db_1.rooms)
            .set({ status: 'playing' })
            .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId));
        const gameState = await GameStateService_1.gameStateService.createGame(roomId);
        io.to(roomId).emit('game-started', { gameState });
        console.log(`Game auto-started for room ${roomId} with ${players.length} players`);
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
