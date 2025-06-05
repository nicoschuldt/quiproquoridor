import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db, users, rooms, roomMembers } from '../db';
import { eq, and } from 'drizzle-orm';
import { GameHandlers } from './gameHandler';
import type { ClientToServerEvents, ServerToClientEvents } from '../shared/types';
import { gameStateService } from '../game/GameStateService';

export const socketHandler = (io: Server<ClientToServerEvents, ServerToClientEvents>) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication failed: No token provided'));
      }

      const decoded = jwt.verify(token, config.jwtSecret) as any;
      
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, decoded.userId))
        .limit(1);

      if (userResult.length === 0) {
        return next(new Error('Authentication failed: User not found'));
      }

      const user = userResult[0];
      (socket as any).user = {
        id: user.id,
        username: user.username,
      };

      next();
    } catch (error) {
      next(new Error('Authentication failed: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const authenticatedSocket = socket as any;
    const user = authenticatedSocket.user;
    
    console.log(`🔌 User ${user.username} connected (${socket.id})`);

    let userCurrentRoomId: string | null = null;

    const gameHandlers = new GameHandlers(io, authenticatedSocket);
    gameHandlers.setupEventListeners();

    authenticatedSocket.on('join-room', async (data: { roomId: string }) => {
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
        
        await authenticatedSocket.join(roomId);
        userCurrentRoomId = roomId;
        
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

        const existingGame = await gameStateService.hasActiveGame(roomId);
        if (existingGame) {
          console.log(`🎮 Player ${user.username} joining existing game in room ${roomId}`);
          
          const hadTimeout = gameStateService.cancelDisconnectionTimeout(roomId, user.id);
          
          await gameStateService.updatePlayerConnection(roomId, user.id, true);
          
          if (hadTimeout) {
            socket.to(roomId).emit('reconnection-success', {
              playerId: user.id,
              playerName: user.username,
              gameState: await gameStateService.getGameState(roomId) as any
            });
            
            console.log(`🔗 Player ${user.username} reconnected to game in room ${roomId}`);
          }
          
          authenticatedSocket.emit('request-game-state', { roomId });
          return;
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
          maxPlayers: room.maxPlayers as 2 | 4,
          status: room.status,
          isPrivate: room.isPrivate,
          hasTimeLimit: room.hasTimeLimit,
          timeLimitSeconds: room.timeLimitSeconds || undefined,
          createdAt: room.createdAt,
        };

        socket.to(roomId).emit('player-joined', {
          player: players.find(p => p.id === user.id)!
        });

        authenticatedSocket.emit('room-updated', { room: roomData });

        if (players.length === room.maxPlayers && room.status === 'lobby') {
          console.log(`🎮 Room ${roomId} is full, auto-starting game`);
          
          await db
            .update(rooms)
            .set({ status: 'playing' })
            .where(eq(rooms.id, roomId));

          try {
            const gameState = await gameStateService.createGame(roomId);
            
            io.to(roomId).emit('game-started', { gameState });
            
            console.log(`✅ Game auto-started for room ${roomId} with ${gameState.players.length} players`);
          } catch (error) {
            console.error('❌ Error auto-starting game:', error);
            
            await db
              .update(rooms)
              .set({ status: 'lobby' })
              .where(eq(rooms.id, roomId));
              
            io.to(roomId).emit('error', {
              error: {
                code: 'GAME_START_FAILED',
                message: 'Failed to start game automatically'
              }
            });
          }
        } else {
          io.to(roomId).emit('room-updated', { room: roomData });
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
        
        await authenticatedSocket.leave(roomId);
        userCurrentRoomId = null;
        
        await gameStateService.updatePlayerConnection(roomId, user.id, false);

        socket.to(roomId).emit('player-left', {
          playerId: user.id
        });
        
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    });

    authenticatedSocket.on('disconnect', async (reason: string) => {
      console.log(`🔌 User ${user.username} disconnected (${reason})`);
      
      try {
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
          if (userRoom.roomStatus === 'lobby') {
            await db
              .delete(roomMembers)
              .where(and(
                eq(roomMembers.roomId, roomId),
                eq(roomMembers.userId, user.id)
              ));

            socket.to(roomId).emit('player-left', {
              playerId: user.id
            });

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
          } else if (userRoom.roomStatus === 'playing') {
            await gameStateService.updatePlayerConnection(roomId, user.id, false);
            
            gameStateService.startDisconnectionTimeout(roomId, user.id, 60);
            
            socket.to(roomId).emit('disconnection-warning', {
              playerId: user.id,
              playerName: user.username,
              timeoutSeconds: 60
            });
            
            console.log(`⏱️ Started 60s disconnection timeout for ${user.username} in room ${roomId}`);
          } else if (userRoom.roomStatus === 'finished') {
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
              await gameStateService.cleanupFinishedRoom(roomId);
            }
          }
        }
      } catch (error) {
        console.error('Error handling user disconnect:', error);
      }
    });
  });

  console.log('🔌 Socket.io server initialized with full room management and game integration');
};