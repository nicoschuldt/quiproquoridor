import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db, users, rooms, roomMembers } from '../db';
import { eq, and } from 'drizzle-orm';
import { ClientToServerEvents, ServerToClientEvents } from '../../../shared/types';
import { createGameHandler } from './gameHandler';
import { gameStateService } from '../game/GameStateService';

interface SocketUser {
  id: string;
  username: string;
}

interface AuthenticatedSocket {
  id: string;
  user: SocketUser;
  emit: Function;
  join: Function;
  leave: Function;
  disconnect: Function;
  on: Function;
  to: Function;
}

export const socketHandler = (io: Server<ClientToServerEvents, ServerToClientEvents>) => {
  // **NEW**: Initialize game handler
  const gameHandler = createGameHandler(io);

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string; username: string };
      
      // Get fresh user data from database
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, decoded.userId))
        .limit(1);

      if (user.length === 0) {
        return next(new Error('User not found'));
      }

      (socket as any).user = {
        id: user[0].id,
        username: user[0].username,
      };

      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket) => {
    const authenticatedSocket = socket as any as AuthenticatedSocket;
    const user = authenticatedSocket.user;
    
    console.log(`🔌 User ${user.username} connected (${socket.id})`);

    // **CRITICAL FIX**: Track user's socket rooms for cleanup
    let userCurrentRoomId: string | null = null;

    // **NEW**: Setup game event handlers
    gameHandler.setupHandlers(authenticatedSocket);

    // Handle room events
    authenticatedSocket.on('join-room', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;
        console.log(`👤 ${user.username} joining room ${roomId}`);
        
        // **CRITICAL FIX**: Leave any previous socket rooms before joining new one
        if (userCurrentRoomId && userCurrentRoomId !== roomId) {
          console.log(`👤 ${user.username} leaving previous socket room ${userCurrentRoomId}`);
          await authenticatedSocket.leave(userCurrentRoomId);
          socket.to(userCurrentRoomId).emit('player-left', {
            playerId: user.id,
            room: {} as any
          });
        }
        
        // Verify user is member of room in database
        const membership = await db
          .select()
          .from(roomMembers)
          .where(and(
            eq(roomMembers.roomId, roomId),
            eq(roomMembers.userId, user.id)
          ))
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
        const roomResult = await db
          .select()
          .from(rooms)
          .where(eq(rooms.id, roomId))
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

        // **NEW**: Check if there's already an active game
        const existingGame = await gameStateService.hasActiveGame(roomId);
        if (existingGame) {
          console.log(`🎮 Player ${user.username} joining existing game in room ${roomId}`);
          
          // Send game state to reconnecting player
          authenticatedSocket.emit('request-game-state', { roomId });
          return;
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

        // Convert to Player format
        const players = membersWithUsers.map((member, index) => ({
          id: member.id,
          username: member.username,
          color: ['red', 'blue', 'green', 'yellow'][index] as 'red' | 'blue' | 'green' | 'yellow',
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
          maxPlayers: room.maxPlayers as 2 | 4,
          status: room.status,
          isPrivate: room.isPrivate,
          hasTimeLimit: room.hasTimeLimit,
          timeLimitSeconds: room.timeLimitSeconds || undefined,
          createdAt: room.createdAt,
        };

        // Notify others in the room that this player joined
        socket.to(roomId).emit('player-joined', {
          player: players.find(p => p.id === user.id)!,
          room: roomData
        });

        // **ENHANCED**: Check if room is now full and should auto-start
        if (players.length === room.maxPlayers && room.status === 'lobby') {
          console.log(`🎮 Room ${roomId} is full, auto-starting game`);
          
          // Update room status to 'playing'
          await db
            .update(rooms)
            .set({ status: 'playing' })
            .where(eq(rooms.id, roomId));

          // **NEW**: Create and start the game using game handler
          await gameHandler.createAndStartGame(roomId);
        } else {
          // Just emit room-full if we reached capacity but didn't start
          if (players.length === room.maxPlayers) {
            io.to(roomId).emit('room-full', { room: roomData });
          }
        }
        
      } catch (error) {
        console.error('Error joining room:', error);
        authenticatedSocket.emit('error', {
          error: {
            code: 'JOIN_ROOM_FAILED',
            message: 'Failed to join room'
          }
        });
      }
    });

    authenticatedSocket.on('leave-room', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;
        console.log(`👤 ${user.username} leaving room ${roomId}`);
        
        // Leave the socket room
        await authenticatedSocket.leave(roomId);
        
        // Note: We don't remove from database here - that should be done via API call
        // This is just for socket room management
        
        // Notify others in the room that this player left
        socket.to(roomId).emit('player-left', {
          playerId: user.id,
          room: {} as any // Room data will be updated by the API call
        });
        
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    });

    // **REMOVED**: Old basic make-move handler (now handled by gameHandler)

    // Handle ping for connection monitoring
    authenticatedSocket.on('ping', () => {
      authenticatedSocket.emit('pong');
    });

    // Handle disconnection
    authenticatedSocket.on('disconnect', async (reason: string) => {
      console.log(`🔌 User ${user.username} disconnected (${reason})`);
      
      try {
        // **CRITICAL FIX**: Clean up user's room memberships on disconnect
        // Find all rooms the user is in
        const userRooms = await db
          .select({
            roomId: roomMembers.roomId,
            isHost: roomMembers.isHost,
            roomStatus: rooms.status,
          })
          .from(roomMembers)
          .innerJoin(rooms, eq(roomMembers.roomId, rooms.id))
          .where(eq(roomMembers.userId, user.id));

        for (const userRoom of userRooms) {
          const { roomId, isHost } = userRoom;
          
          // **ENHANCED**: Handle disconnection based on room/game status
          if (userRoom.roomStatus === 'lobby') {
            // For lobby rooms: remove user completely (they can reconnect via normal flow)
            await db
              .delete(roomMembers)
              .where(and(
                eq(roomMembers.roomId, roomId),
                eq(roomMembers.userId, user.id)
              ));

            // Notify other players in the room
            socket.to(roomId).emit('player-left', {
              playerId: user.id,
              room: {} as any
            });

            // Check remaining members for cleanup
            const remainingMembers = await db
              .select()
              .from(roomMembers)
              .where(eq(roomMembers.roomId, roomId));

            if (remainingMembers.length === 0) {
              // Delete empty room
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

              await db
                .update(rooms)
                .set({ hostId: oldestMember.userId })
                .where(eq(rooms.id, roomId));
            }
          } else if (userRoom.roomStatus === 'playing') {
            // **NEW**: For playing games, handle via game handler
            await gameHandler.handlePlayerDisconnect(roomId, user.id, user.username);
          }
        }
      } catch (error) {
        console.error('Error handling user disconnect:', error);
      }
    });
  });

  console.log('🔌 Socket.io server initialized with game support');
};