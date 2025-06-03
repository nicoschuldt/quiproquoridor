// backend/src/socket/index.ts (Fixed)
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db, users, rooms, roomMembers } from '../db';
import { eq, and } from 'drizzle-orm';
import { GameHandlers } from './gameHandler';
import type { ClientToServerEvents, ServerToClientEvents, Player } from '../../../shared/types';
import { gameStateService } from '../game/GameStateService';
import { gameEngineManager } from '../game/GameEngineManager';
import { aiService } from '../game/AIService';

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
    const authenticatedSocket = socket as any;
    const user = authenticatedSocket.user;
    
    console.log(`🔌 User ${user.username} connected (${socket.id})`);

    // Track user's current socket room for cleanup
    let userCurrentRoomId: string | null = null;

    // Setup game handlers
    const gameHandlers = new GameHandlers(io, authenticatedSocket);
    gameHandlers.setupEventListeners();
    
    // Stocker les gameHandlers dans le socket pour pouvoir y accéder ailleurs
    authenticatedSocket.gameHandlers = gameHandlers;
    
    // Handle adding an AI player to a room
    authenticatedSocket.on('add-ai-player', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;
        console.log(`🤖 ${user.username} is adding an AI player to room ${roomId}`);
        
        // Verify user is a member of the room
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
        
        // Check if user is host
        if (!membership[0].isHost) {
          authenticatedSocket.emit('error', {
            error: {
              code: 'NOT_HOST',
              message: 'Only the host can add AI players'
            }
          });
          return;
        }
        
        // Get room details
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
        
        // Check room status
        if (room.status !== 'lobby') {
          authenticatedSocket.emit('error', {
            error: {
              code: 'INVALID_ROOM_STATE',
              message: 'Cannot add AI player: game has already started'
            }
          });
          return;
        }
        
        // Get all current members to check if room is full
        const members = await db
          .select()
          .from(roomMembers)
          .where(eq(roomMembers.roomId, roomId));
          
        if (members.length >= room.maxPlayers) {
          authenticatedSocket.emit('error', {
            error: {
              code: 'ROOM_FULL',
              message: 'Room is already full'
            }
          });
          return;
        }
        
        // Set room to include AI
        await db
          .update(rooms)
          .set({ withAI: true })
          .where(eq(rooms.id, roomId));
        
        // Get updated room with all members to broadcast
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
          isAI: false,
        }));
        
        // Add AI player to display in UI (will be properly added during game creation)
        const aiPlayer = {
          id: `ai-preview-${crypto.randomUUID()}`,
          username: 'AI Player',
          color: ['red', 'blue', 'green', 'yellow'][players.length] as 'red' | 'blue' | 'green' | 'yellow',
          position: { x: 4, y: players.length === 0 ? 0 : 8 },
          wallsRemaining: room.maxPlayers === 2 ? 10 : 5,
          isConnected: true,
          joinedAt: new Date(),
          isAI: true,
        };
        
        players.push(aiPlayer);
        
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
          withAI: true,
        };

        // Broadcast the updated room with AI player to all members
        io.to(roomId).emit('room-updated', { room: roomData });
        io.to(roomId).emit('player-joined', { player: aiPlayer });
        
        console.log(`✅ AI player added to room ${roomId}`);
        
        // Auto-start game if room is now full
        if (players.length === room.maxPlayers) {
          console.log(`🎮 Room ${roomId} is full after adding AI, auto-starting game`);
          
          // Update room status to 'playing'
          await db
            .update(rooms)
            .set({ status: 'playing' })
            .where(eq(rooms.id, roomId));

          // Create and start the game using game service
          try {
            const gameState = await gameStateService.createGame(roomId);
            
            // Broadcast game start to all players in room
            io.to(roomId).emit('game-started', { gameState });
            
            console.log(`✅ Game auto-started for room ${roomId} with ${gameState.players.length} players`);
            
            // Traiter le tour de l'IA directement sans passer par un gestionnaire temporaire
            // Vérifier si c'est le tour d'un joueur IA
            const currentPlayer = gameState.players[gameState.currentPlayerIndex];
            if (currentPlayer && currentPlayer.isAI) {
              console.log('🤖 Processing AI turn for player', currentPlayer.username);
              
              // Simuler un temps de réflexion pour l'IA
              setTimeout(async () => {
                try {
                  // Obtenir le coup de l'IA via AIService
                  const aiMove = await aiService.makeAIMove(roomId, gameState, currentPlayer.id);
                  
                  // Appliquer le coup de l'IA
                  const newGameState = gameEngineManager.applyMove(gameState, aiMove);
                  
                  // Créer l'objet Move complet
                  const fullMove = {
                    id: crypto.randomUUID(),
                    timestamp: new Date(),
                    ...aiMove
                  };
                  
                  // Sauvegarder l'état du jeu mis à jour
                  await gameStateService.saveGameState(roomId, newGameState);
                  
                  // Diffuser le coup de l'IA à tous les joueurs
                  io.to(roomId).emit('move-made', {
                    move: fullMove,
                    gameState: newGameState
                  });
                  
                  console.log('✅ AI move processed successfully');
                  
                  // Vérifier si le jeu est terminé après le coup de l'IA
                  if (gameEngineManager.isGameFinished(newGameState)) {
                    const winner = gameEngineManager.getWinner(newGameState);
                    if (winner) {
                      io.to(roomId).emit('game-finished', {
                        gameState: newGameState,
                        winner: newGameState.players.find((p: Player) => p.id === winner)!
                      });
                      
                      console.log('🏆 Game finished in room ' + roomId + ', winner: ' + winner);
                    }
                  }
                } catch (error) {
                  console.error('❌ Error processing AI move:', error);
                }
              }, 1000);
            }
          } catch (error) {
            console.error('❌ Error auto-starting game:', error);
            
            // Revert room status
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
        }
      } catch (error) {
        console.error('Error adding AI player:', error);
        authenticatedSocket.emit('error', {
          error: {
            code: 'ADD_AI_FAILED',
            message: 'Failed to add AI player'
          }
        });
      }
    });

    // Handle room events with full logic restoration
    authenticatedSocket.on('join-room', async (data: { roomId: string }) => {
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

        // **ENHANCED**: Check if there's already an active game
        const existingGame = await gameStateService.hasActiveGame(roomId);
        if (existingGame) {
          console.log(`🎮 Player ${user.username} joining existing game in room ${roomId}`);
          
          // **NEW**: Cancel disconnection timeout if player is reconnecting
          const hadTimeout = gameStateService.cancelDisconnectionTimeout(roomId, user.id);
          
          // Update player connection status in game
          await gameStateService.updatePlayerConnection(roomId, user.id, true);
          
          if (hadTimeout) {
            // Player reconnected within timeout - notify others
            socket.to(roomId).emit('reconnection-success', {
              playerId: user.id,
              playerName: user.username,
              gameState: await gameStateService.getGameState(roomId) as any
            });
            
            console.log(`🔗 Player ${user.username} reconnected to game in room ${roomId}`);
          }
          
          // Send game state to reconnecting player via game handler
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
          selectedPawnTheme: 'theme-pawn-default', // Default theme for socket events
          isAI: true,
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
          player: players.find(p => p.id === user.id)!
        });

        // Send updated room data to the joining player
        authenticatedSocket.emit('room-updated', { room: roomData });

        // **ENHANCED**: Check if room is now full and should auto-start
        if (players.length === room.maxPlayers && room.status === 'lobby') {
          console.log(`🎮 Room ${roomId} is full, auto-starting game`);
          
          // Update room status to 'playing'
          await db
            .update(rooms)
            .set({ status: 'playing' })
            .where(eq(rooms.id, roomId));

          // **NEW**: Create and start the game using game service
          try {
            const gameState = await gameStateService.createGame(roomId);
            
            // Broadcast game start to all players in room
            io.to(roomId).emit('game-started', { gameState });
            
            console.log(`✅ Game auto-started for room ${roomId} with ${gameState.players.length} players`);
          } catch (error) {
            console.error('❌ Error auto-starting game:', error);
            
            // Revert room status
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
          // Broadcast updated room data to all players in the room
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
        
        // Leave the socket room
        await authenticatedSocket.leave(roomId);
        userCurrentRoomId = null;
        
        // Update player connection status in game if exists
        await gameStateService.updatePlayerConnection(roomId, user.id, false);
        
        // Note: We don't remove from database here - that should be done via API call
        // This is just for socket room management
        
        // Broadcast to room that user left
        socket.to(roomId).emit('player-left', {
          playerId: user.id
        });
        
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    });

    // Handle disconnection with comprehensive cleanup
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
              playerId: user.id
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
            // **NEW**: For playing games, start disconnection timeout
            await gameStateService.updatePlayerConnection(roomId, user.id, false);
            
            // Start disconnection timeout (60 seconds)
            gameStateService.startDisconnectionTimeout(roomId, user.id, 60);
            
            // Notify other players of disconnection with timeout warning
            socket.to(roomId).emit('disconnection-warning', { 
              playerId: user.id,
              playerName: user.username,
              timeoutSeconds: 60
            });
            
            console.log(`⏱️ Started 60s disconnection timeout for ${user.username} in room ${roomId}`);
          } else if (userRoom.roomStatus === 'finished') {
            // **NEW**: For finished games, remove user immediately
            await db
              .delete(roomMembers)
              .where(and(
                eq(roomMembers.roomId, roomId),
                eq(roomMembers.userId, user.id)
              ));
            
            // Check if room is now empty and clean it up
            const remainingMembers = await db
              .select()
              .from(roomMembers)
              .where(eq(roomMembers.roomId, roomId));

            if (remainingMembers.length === 0) {
              // Clean up empty finished room immediately
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