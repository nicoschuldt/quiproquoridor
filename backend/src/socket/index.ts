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
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication failed: No token provided'));
      }

      // Verify JWT
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      
      // Get user from database
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
            isReady: roomMembers.isReady,
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
          isReady: member.isReady,
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
        
        // Notify others in the room that this player left
        socket.to(roomId).emit('player-left', {
          playerId: user.id,
          room: {} as any // TODO: Return updated room data if needed
        });
        
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    });

    authenticatedSocket.on('player-ready', async (data: { roomId: string; ready: boolean }) => {
      try {
        const { roomId, ready } = data;
        console.log(`👤 ${user.username} ready status: ${ready} in room ${roomId}`);
        
        // Update ready status in database
        await db
          .update(roomMembers)
          .set({ isReady: ready })
          .where(and(
            eq(roomMembers.roomId, roomId),
            eq(roomMembers.userId, user.id)
          ));
        
        // Broadcast ready status change to all players in room
        io.to(roomId).emit('player-ready-changed', {
          playerId: user.id,
          ready
        });
        
      } catch (error) {
        console.error('Error updating ready status:', error);
        authenticatedSocket.emit('error', {
          error: {
            code: 'UPDATE_READY_FAILED',
            message: 'Failed to update ready status'
          }
        });
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