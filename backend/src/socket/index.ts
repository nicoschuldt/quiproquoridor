import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db, users, rooms, roomMembers } from '../db';
import { eq, and } from 'drizzle-orm';
import { ClientToServerEvents, ServerToClientEvents } from '../../../shared/types';

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
}

export const socketHandler = (io: Server<ClientToServerEvents, ServerToClientEvents>) => {
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

    // Handle room events
    authenticatedSocket.on('join-room', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;
        console.log(`👤 ${user.username} joining room ${roomId}`);
        
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

        // Check if room is now full and should auto-start
        if (players.length === room.maxPlayers && room.status === 'lobby') {
          console.log(`🎮 Room ${roomId} is full, auto-starting game`);
          
          // Update room status to 'playing'
          await db
            .update(rooms)
            .set({ status: 'playing' })
            .where(eq(rooms.id, roomId));

          // TODO: Create game state and save to database
          const gameState = {
            id: crypto.randomUUID(),
            players,
            walls: [],
            currentPlayerIndex: 0,
            status: 'playing' as const,
            moves: [],
            createdAt: new Date(),
            startedAt: new Date(),
            maxPlayers: room.maxPlayers as 2 | 4,
            timeLimit: room.hasTimeLimit && room.timeLimitSeconds ? room.timeLimitSeconds : undefined,
          };

          // Emit to entire room that game has started
          io.to(roomId).emit('game-started', { gameState });
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

    authenticatedSocket.on('make-move', async (data: { roomId: string; move: any }) => {
      try {
        const { roomId, move } = data;
        console.log(`👤 ${user.username} making move in room ${roomId}:`, move);
        
        // TODO: Validate move with game engine
        // TODO: Update game state in database
        
        // For now, just broadcast the move
        const fullMove = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          ...move
        };
        
        // Broadcast move to all players in room
        io.to(roomId).emit('move-made', {
          move: fullMove,
          gameState: {} as any // TODO: Return actual game state
        });
        
      } catch (error) {
        console.error('Error processing move:', error);
        authenticatedSocket.emit('invalid-move', {
          error: 'Failed to process move',
          move: data.move
        });
      }
    });

    // Handle ping for connection monitoring
    authenticatedSocket.on('ping', () => {
      authenticatedSocket.emit('pong');
    });

    // Handle disconnection
    authenticatedSocket.on('disconnect', (reason: string) => {
      console.log(`🔌 User ${user.username} disconnected (${reason})`);
      
      // TODO: Update user's connected status in active rooms
      // TODO: Notify other players in rooms
    });
  });

  console.log('🔌 Socket.io server initialized');
};