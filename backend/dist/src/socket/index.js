"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketHandler = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const db_1 = require("../db");
const drizzle_orm_1 = require("drizzle-orm");
const gameHandler_1 = require("./gameHandler");
const GameStateService_1 = require("../game/GameStateService");
const socketHandler = (io) => {
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication failed: No token provided'));
            }
            const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
            const userResult = await db_1.db
                .select()
                .from(db_1.users)
                .where((0, drizzle_orm_1.eq)(db_1.users.id, decoded.userId))
                .limit(1);
            if (userResult.length === 0) {
                return next(new Error('Authentication failed: User not found'));
            }
            const user = userResult[0];
            socket.user = {
                id: user.id,
                username: user.username,
            };
            next();
        }
        catch (error) {
            next(new Error('Authentication failed: Invalid token'));
        }
    });
    io.on('connection', (socket) => {
        const authenticatedSocket = socket;
        const user = authenticatedSocket.user;
        console.log(`🔌 User ${user.username} connected (${socket.id})`);
        let userCurrentRoomId = null;
        const gameHandlers = new gameHandler_1.GameHandlers(io, authenticatedSocket);
        gameHandlers.setupEventListeners();
        authenticatedSocket.on('join-room', async (data) => {
            try {
                const { roomId } = data;
                console.log(`👤 ${user.username} joining room ${roomId}`);
                if (userCurrentRoomId && userCurrentRoomId !== roomId) {
                    console.log(`👤 ${user.username} leaving previous socket room ${userCurrentRoomId}`);
                    await authenticatedSocket.leave(userCurrentRoomId);
                    socket.to(userCurrentRoomId).emit('player-left', {
                        playerId: user.id
                    });
                }
                const membership = await db_1.db
                    .select()
                    .from(db_1.roomMembers)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id)))
                    .limit(1);
                if (membership.length === 0) {
                    authenticatedSocket.emit('error', {
                        error: {
                            code: 'NOT_ROOM_MEMBER',
                            message: 'You are not a member of this room'
                        }
                    });
                    return;
                }
                await authenticatedSocket.join(roomId);
                userCurrentRoomId = roomId;
                const roomResult = await db_1.db
                    .select()
                    .from(db_1.rooms)
                    .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId))
                    .limit(1);
                if (roomResult.length === 0) {
                    authenticatedSocket.emit('error', {
                        error: {
                            code: 'ROOM_NOT_FOUND',
                            message: 'Room not found'
                        }
                    });
                    return;
                }
                const room = roomResult[0];
                const existingGame = await GameStateService_1.gameStateService.hasActiveGame(roomId);
                if (existingGame) {
                    console.log(`🎮 Player ${user.username} joining existing game in room ${roomId}`);
                    const hadTimeout = GameStateService_1.gameStateService.cancelDisconnectionTimeout(roomId, user.id);
                    await GameStateService_1.gameStateService.updatePlayerConnection(roomId, user.id, true);
                    if (hadTimeout) {
                        socket.to(roomId).emit('reconnection-success', {
                            playerId: user.id,
                            playerName: user.username,
                            gameState: await GameStateService_1.gameStateService.getGameState(roomId)
                        });
                        console.log(`🔗 Player ${user.username} reconnected to game in room ${roomId}`);
                    }
                    authenticatedSocket.emit('request-game-state', { roomId });
                    return;
                }
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
                    position: { x: 4, y: index === 0 ? 0 : 8 },
                    wallsRemaining: room.maxPlayers === 2 ? 10 : 5,
                    isConnected: true,
                    joinedAt: member.joinedAt,
                    selectedPawnTheme: 'theme-pawn-default', // Default theme for socket events
                    isAI: member.isAI || false,
                    aiDifficulty: member.aiDifficulty || undefined,
                }));
                const roomData = {
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
                socket.to(roomId).emit('player-joined', {
                    player: players.find(p => p.id === user.id)
                });
                authenticatedSocket.emit('room-updated', { room: roomData });
                if (players.length === room.maxPlayers && room.status === 'lobby') {
                    console.log(`🎮 Room ${roomId} is full, auto-starting game`);
                    await db_1.db
                        .update(db_1.rooms)
                        .set({ status: 'playing' })
                        .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId));
                    try {
                        const gameState = await GameStateService_1.gameStateService.createGame(roomId);
                        io.to(roomId).emit('game-started', { gameState });
                        console.log(`✅ Game auto-started for room ${roomId} with ${gameState.players.length} players`);
                    }
                    catch (error) {
                        console.error('❌ Error auto-starting game:', error);
                        await db_1.db
                            .update(db_1.rooms)
                            .set({ status: 'lobby' })
                            .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId));
                        io.to(roomId).emit('error', {
                            error: {
                                code: 'GAME_START_FAILED',
                                message: 'Failed to start game automatically'
                            }
                        });
                    }
                }
                else {
                    io.to(roomId).emit('room-updated', { room: roomData });
                }
            }
            catch (error) {
                console.error('Error joining room:', error);
                authenticatedSocket.emit('error', {
                    error: {
                        code: 'JOIN_ROOM_FAILED',
                        message: 'Failed to join room'
                    }
                });
            }
        });
        authenticatedSocket.on('leave-room', async (data) => {
            try {
                const { roomId } = data;
                console.log(`👤 ${user.username} leaving room ${roomId}`);
                await authenticatedSocket.leave(roomId);
                userCurrentRoomId = null;
                await GameStateService_1.gameStateService.updatePlayerConnection(roomId, user.id, false);
                socket.to(roomId).emit('player-left', {
                    playerId: user.id
                });
            }
            catch (error) {
                console.error('Error leaving room:', error);
            }
        });
        authenticatedSocket.on('disconnect', async (reason) => {
            console.log(`🔌 User ${user.username} disconnected (${reason})`);
            try {
                const userRooms = await db_1.db
                    .select({
                    roomId: db_1.roomMembers.roomId,
                    isHost: db_1.roomMembers.isHost,
                    roomStatus: db_1.rooms.status,
                })
                    .from(db_1.roomMembers)
                    .innerJoin(db_1.rooms, (0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, db_1.rooms.id))
                    .where((0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id));
                for (const userRoom of userRooms) {
                    const { roomId, isHost } = userRoom;
                    if (userRoom.roomStatus === 'lobby') {
                        await db_1.db
                            .delete(db_1.roomMembers)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id)));
                        socket.to(roomId).emit('player-left', {
                            playerId: user.id
                        });
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
                    }
                    else if (userRoom.roomStatus === 'playing') {
                        await GameStateService_1.gameStateService.updatePlayerConnection(roomId, user.id, false);
                        GameStateService_1.gameStateService.startDisconnectionTimeout(roomId, user.id, 60);
                        socket.to(roomId).emit('disconnection-warning', {
                            playerId: user.id,
                            playerName: user.username,
                            timeoutSeconds: 60
                        });
                        console.log(`⏱️ Started 60s disconnection timeout for ${user.username} in room ${roomId}`);
                    }
                    else if (userRoom.roomStatus === 'finished') {
                        await db_1.db
                            .delete(db_1.roomMembers)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id)));
                        const remainingMembers = await db_1.db
                            .select()
                            .from(db_1.roomMembers)
                            .where((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId));
                        if (remainingMembers.length === 0) {
                            await GameStateService_1.gameStateService.cleanupFinishedRoom(roomId);
                        }
                    }
                }
            }
            catch (error) {
                console.error('Error handling user disconnect:', error);
            }
        });
    });
    console.log('🔌 Socket.io server initialized with full room management and game integration');
};
exports.socketHandler = socketHandler;
