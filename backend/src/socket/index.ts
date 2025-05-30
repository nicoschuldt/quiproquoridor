import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db, users } from '../db';
import { eq } from 'drizzle-orm';
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
        
        // Join the socket room
        await authenticatedSocket.join(roomId);
        
        // TODO: Verify user is member of room in database
        // TODO: Update room state and notify other players
        
        // Broadcast to room that user joined
        socket.to(roomId).emit('player-joined', {
          player: {
            id: user.id,
            username: user.username,
            color: 'red', // TODO: Assign proper color
            position: { x: 4, y: 0 }, // TODO: Get from game state
            wallsRemaining: 10,
            isReady: false,
            isConnected: true,
            joinedAt: new Date(),
          },
          room: {} as any // TODO: Return actual room data
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
        
        // TODO: Update room state in database
        
        // Broadcast to room that user left
        socket.to(roomId).emit('player-left', {
          playerId: user.id,
          room: {} as any // TODO: Return actual room data
        });
        
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    });

    authenticatedSocket.on('player-ready', async (data: { roomId: string; ready: boolean }) => {
      try {
        const { roomId, ready } = data;
        console.log(`👤 ${user.username} ready status: ${ready} in room ${roomId}`);
        
        // TODO: Update ready status in database
        
        // Broadcast ready status change
        socket.to(roomId).emit('player-ready-changed', {
          playerId: user.id,
          ready
        });
        
      } catch (error) {
        console.error('Error updating ready status:', error);
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