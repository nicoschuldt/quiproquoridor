"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomsRouter = void 0;
// backend/src/routes/rooms.ts
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const zod_1 = require("zod");
const db_1 = require("../db");
const drizzle_orm_1 = require("drizzle-orm");
const nanoid_1 = require("nanoid");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
exports.roomsRouter = router;
// All routes require authentication
router.use(passport_1.default.authenticate('jwt', { session: false }));
// Validation schemas
const createRoomSchema = zod_1.z.object({
    maxPlayers: zod_1.z.union([zod_1.z.literal(2), zod_1.z.literal(4)]),
    isPrivate: zod_1.z.boolean().optional(),
    hasTimeLimit: zod_1.z.boolean().optional(),
    timeLimitSeconds: zod_1.z.number().optional(),
});
const joinRoomSchema = zod_1.z.object({
    code: zod_1.z.string().length(6),
});
// Create room
router.post('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const roomData = createRoomSchema.parse(req.body);
    // **CRITICAL FIX**: Ensure user can only be in one room at a time
    // Remove user from any existing rooms before creating/joining new one
    await db_1.db
        .delete(db_1.roomMembers)
        .where((0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id));
    // Generate unique room code
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
    // Create room
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
    // Add host as room member
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
// Join room
router.post('/join', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { code } = joinRoomSchema.parse(req.body);
    // Remove user from any existing rooms before joining new one
    await db_1.db
        .delete(db_1.roomMembers)
        .where((0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id));
    // Find room
    const roomResult = await db_1.db
        .select()
        .from(db_1.rooms)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.rooms.code, code), (0, drizzle_orm_1.eq)(db_1.rooms.status, 'lobby')))
        .limit(1);
    if (roomResult.length === 0) {
        throw new errorHandler_1.AppError(404, 'ROOM_NOT_FOUND', 'Room not found or no longer accepting players');
    }
    const room = roomResult[0];
    // Note: No need to check if user already in room since we just removed them
    // But we still need to check room capacity
    const currentMembers = await db_1.db
        .select()
        .from(db_1.roomMembers)
        .where((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, room.id));
    if (currentMembers.length >= room.maxPlayers) {
        throw new errorHandler_1.AppError(400, 'ROOM_FULL', 'Room is full');
    }
    // Add user to room
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
// Get room details
router.get('/:roomId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { roomId } = req.params;
    // Get room
    const roomResult = await db_1.db
        .select()
        .from(db_1.rooms)
        .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId))
        .limit(1);
    if (roomResult.length === 0) {
        throw new errorHandler_1.AppError(404, 'ROOM_NOT_FOUND', 'Room not found');
    }
    const room = roomResult[0];
    // Check if user is member
    const membership = await db_1.db
        .select()
        .from(db_1.roomMembers)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, room.id), (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id)))
        .limit(1);
    if (membership.length === 0) {
        throw new errorHandler_1.AppError(403, 'NOT_ROOM_MEMBER', 'You are not a member of this room');
    }
    // Get all room members with user details
    const membersWithUsers = await db_1.db
        .select({
        id: db_1.users.id,
        username: db_1.users.username,
        isHost: db_1.roomMembers.isHost,
        joinedAt: db_1.roomMembers.joinedAt,
    })
        .from(db_1.roomMembers)
        .innerJoin(db_1.users, (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, db_1.users.id))
        .where((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId));
    // Convert to Player format expected by frontend
    const players = membersWithUsers.map((member, index) => ({
        id: member.id,
        username: member.username,
        color: ['red', 'blue', 'green', 'yellow'][index],
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
                maxPlayers: room.maxPlayers,
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
router.get('/user/current', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    // Find if user is in any active room
    const roomMembership = await db_1.db
        .select({
        roomId: db_1.roomMembers.roomId,
        isHost: db_1.roomMembers.isHost,
        roomStatus: db_1.rooms.status,
    })
        .from(db_1.roomMembers)
        .innerJoin(db_1.rooms, (0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, db_1.rooms.id))
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id), 
    // **CRITICAL FIX**: Only get rooms that are truly active (exclude finished)
    (0, drizzle_orm_1.inArray)(db_1.rooms.status, ['lobby', 'playing'])))
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
router.delete('/:roomId/leave', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { roomId } = req.params;
    // Check if user is member of the room
    const membership = await db_1.db
        .select()
        .from(db_1.roomMembers)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id)))
        .limit(1);
    if (membership.length === 0) {
        throw new errorHandler_1.AppError(403, 'NOT_ROOM_MEMBER', 'You are not a member of this room');
    }
    const isHost = membership[0].isHost;
    // Remove user from room
    await db_1.db
        .delete(db_1.roomMembers)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id)));
    // Check remaining members
    const remainingMembers = await db_1.db
        .select()
        .from(db_1.roomMembers)
        .where((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId));
    if (remainingMembers.length === 0) {
        // Delete room if empty
        await db_1.db
            .delete(db_1.rooms)
            .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId));
    }
    else if (isHost) {
        // Transfer host to oldest member
        const oldestMember = remainingMembers.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())[0];
        await db_1.db
            .update(db_1.roomMembers)
            .set({ isHost: true })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, oldestMember.userId)));
        // Update room host
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
