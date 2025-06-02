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
    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication failed: No token provided'));
            }
            // Verify JWT
            const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
            // Get user from database
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
        // Track user's current socket room for cleanup
        let userCurrentRoomId = null;
        // Setup game handlers
        const gameHandlers = new gameHandler_1.GameHandlers(io, authenticatedSocket);
        gameHandlers.setupEventListeners();
        // Handle room events with full logic restoration
        authenticatedSocket.on('join-room', async (data) => {
            try {
                const { roomId } = data;
                console.log(`👤 ${user.username} joining room ${roomId}`);
                // **CRITICAL FIX**: Leave any previous socket rooms before joining new one
                if (userCurrentRoomId && userCurrentRoomId !== roomId) {
                    console.log(`👤 ${user.username} leaving previous socket room ${userCurrentRoomId}`);
                    await authenticatedSocket.leave(userCurrentRoomId);
                    socket.to(userCurrentRoomId).emit('player-left', {
                        playerId: user.id
                    });
                }
                // **CRITICAL FIX**: Verify user is member of room in database
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
                // Join the socket room
                await authenticatedSocket.join(roomId);
                userCurrentRoomId = roomId;
                // Get room details with players
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
                // **ENHANCED**: Check if there's already an active game
                const existingGame = await GameStateService_1.gameStateService.hasActiveGame(roomId);
                if (existingGame) {
                    console.log(`🎮 Player ${user.username} joining existing game in room ${roomId}`);
                    // Update player connection status in game
                    await GameStateService_1.gameStateService.updatePlayerConnection(roomId, user.id, true);
                    // Send game state to reconnecting player via game handler
                    authenticatedSocket.emit('request-game-state', { roomId });
                    return;
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
                // Convert to Player format
                const players = membersWithUsers.map((member, index) => ({
                    id: member.id,
                    username: member.username,
                    color: ['red', 'blue', 'green', 'yellow'][index],
                    position: { x: 4, y: index === 0 ? 0 : 8 },
                    wallsRemaining: room.maxPlayers === 2 ? 10 : 5,
                    isConnected: true,
                    joinedAt: member.joinedAt,
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
                // Notify others in the room that this player joined
                socket.to(roomId).emit('player-joined', {
                    player: players.find(p => p.id === user.id)
                });
                // Send updated room data to the joining player
                authenticatedSocket.emit('room-updated', { room: roomData });
                // **ENHANCED**: Check if room is now full and should auto-start
                if (players.length === room.maxPlayers && room.status === 'lobby') {
                    console.log(`🎮 Room ${roomId} is full, auto-starting game`);
                    // Update room status to 'playing'
                    await db_1.db
                        .update(db_1.rooms)
                        .set({ status: 'playing' })
                        .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId));
                    // **NEW**: Create and start the game using game service
                    try {
                        const gameState = await GameStateService_1.gameStateService.createGame(roomId);
                        // Broadcast game start to all players in room
                        io.to(roomId).emit('game-started', { gameState });
                        console.log(`✅ Game auto-started for room ${roomId} with ${gameState.players.length} players`);
                    }
                    catch (error) {
                        console.error('❌ Error auto-starting game:', error);
                        // Revert room status
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
                    // Broadcast updated room data to all players in the room
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
                // Leave the socket room
                await authenticatedSocket.leave(roomId);
                userCurrentRoomId = null;
                // Update player connection status in game if exists
                await GameStateService_1.gameStateService.updatePlayerConnection(roomId, user.id, false);
                // Note: We don't remove from database here - that should be done via API call
                // This is just for socket room management
                // Broadcast to room that user left
                socket.to(roomId).emit('player-left', {
                    playerId: user.id
                });
            }
            catch (error) {
                console.error('Error leaving room:', error);
            }
        });
        // Handle disconnection with comprehensive cleanup
        authenticatedSocket.on('disconnect', async (reason) => {
            console.log(`🔌 User ${user.username} disconnected (${reason})`);
            try {
                // **CRITICAL FIX**: Clean up user's room memberships on disconnect
                // Find all rooms the user is in
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
                    // **ENHANCED**: Handle disconnection based on room/game status
                    if (userRoom.roomStatus === 'lobby') {
                        // For lobby rooms: remove user completely (they can reconnect via normal flow)
                        await db_1.db
                            .delete(db_1.roomMembers)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id)));
                        // Notify other players in the room
                        socket.to(roomId).emit('player-left', {
                            playerId: user.id
                        });
                        // Check remaining members for cleanup
                        const remainingMembers = await db_1.db
                            .select()
                            .from(db_1.roomMembers)
                            .where((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId));
                        if (remainingMembers.length === 0) {
                            // Delete empty room
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
                            await db_1.db
                                .update(db_1.rooms)
                                .set({ hostId: oldestMember.userId })
                                .where((0, drizzle_orm_1.eq)(db_1.rooms.id, roomId));
                        }
                    }
                    else if (userRoom.roomStatus === 'playing') {
                        // **NEW**: For playing games, just update connection status
                        await GameStateService_1.gameStateService.updatePlayerConnection(roomId, user.id, false);
                        // Notify other players of disconnection
                        socket.to(roomId).emit('player-disconnected', { playerId: user.id });
                    }
                    else if (userRoom.roomStatus === 'finished') {
                        // **NEW**: For finished games, remove user immediately
                        await db_1.db
                            .delete(db_1.roomMembers)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.roomMembers.userId, user.id)));
                        // Check if room is now empty and clean it up
                        const remainingMembers = await db_1.db
                            .select()
                            .from(db_1.roomMembers)
                            .where((0, drizzle_orm_1.eq)(db_1.roomMembers.roomId, roomId));
                        if (remainingMembers.length === 0) {
                            // Clean up empty finished room immediately
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
