import { Server, Socket } from 'socket.io';
import { gameEngineManager } from '../game/GameEngineManager';
import { gameStateService } from '../game/GameStateService';
import { db, rooms, roomMembers } from '../db';
import { eq, and } from 'drizzle-orm';
import type { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  Move, 
  GameState,
  ApiError 
} from '../../shared/types';

type AuthenticatedSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  user: { id: string; username: string };
};

interface GameHandlerEvents {
  'start-game': (data: { roomId: string }) => void;
  'make-move': (data: { roomId: string; move: Omit<Move, 'id' | 'timestamp'> }) => void;
  'request-game-state': (data: { roomId: string }) => void;
  'forfeit-game': (data: { roomId: string }) => void;
}

export class GameHandlers {
  constructor(
    private io: Server<ClientToServerEvents, ServerToClientEvents>,
    private socket: AuthenticatedSocket
  ) {}

  setupEventListeners(): void {
    this.socket.on('start-game', this.handleStartGame.bind(this));
    this.socket.on('make-move', this.handleMakeMove.bind(this));
    this.socket.on('request-game-state', this.handleRequestGameState.bind(this));
    this.socket.on('forfeit-game', this.handleForfeitGame.bind(this));
    
    console.log(`Game handlers setup for user ${this.socket.user.username}`);
  }

  private async handleStartGame(data: { roomId: string }): Promise<void> {
    try {
      console.log(`Starting game in room ${data.roomId} by ${this.socket.user.username}`);

      // verif si l'utilisateur est un membre (pas un spectateur)
      const isMember = await this.isUserRoomMember(data.roomId, this.socket.user.id);
      if (!isMember) {
        this.emitError('PERMISSION_DENIED', 'Spectators cannot start games');
        return;
      }

      const room = await this.getRoomWithValidation(data.roomId);
      if (!room) return;

      if (room.hostId !== this.socket.user.id) {
        this.emitError('PERMISSION_DENIED', 'Only the host can start the game');
        return;
      }

      if (room.status !== 'lobby') {
        this.emitError('INVALID_ROOM_STATE', 'Game has already started or finished');
        return;
      }

      const members = await this.getRoomMembers(data.roomId);
      if (members.length < 2) {
        this.emitError('INSUFFICIENT_PLAYERS', 'Need at least 2 players to start');
        return;
      }

      const existingGame = await gameStateService.hasActiveGame(data.roomId);
      if (existingGame) {
        this.emitError('GAME_ALREADY_EXISTS', 'Game already started for this room');
        return;
      }

      const gameState = await gameStateService.createGame(data.roomId);

      await db
        .update(rooms)
        .set({ status: 'playing' })
        .where(eq(rooms.id, data.roomId));

      this.io.to(data.roomId).emit('game-started', { gameState });
      
      console.log(`Game started successfully in room ${data.roomId}`);

    } catch (error) {
      console.error('Error starting game:', error);
      this.emitError('GAME_START_FAILED', 'Failed to start game');
    }
  }

  private async handleMakeMove(data: { roomId: string; move: Omit<Move, 'id' | 'timestamp'> }): Promise<void> {
    try {
      console.log(`Processing move from ${this.socket.user.username}:`, {
        type: data.move.type,
        roomId: data.roomId
      });

      // Check if user is a member (not spectator)
      const isMember = await this.isUserRoomMember(data.roomId, this.socket.user.id);
      if (!isMember) {
        this.emitError('PERMISSION_DENIED', 'Spectators cannot make moves');
        return;
      }

      const gameState = await gameStateService.getGameState(data.roomId);
      if (!gameState) {
        this.emitError('GAME_NOT_FOUND', 'No active game found for this room');
        return;
      }

      const currentPlayer = gameEngineManager.getCurrentPlayer(gameState);
      if (data.move.playerId !== this.socket.user.id) {
        this.emitError('INVALID_PLAYER', 'Move playerId does not match authenticated user');
        return;
      }

      if (currentPlayer.id !== this.socket.user.id) {
        this.emitError('NOT_YOUR_TURN', 'It is not your turn');
        return;
      }

      const isValidMove = gameEngineManager.validateMove(gameState, data.move);
      if (!isValidMove) {
        this.emitInvalidMove('INVALID_MOVE', 'Move is not valid according to game rules', data.move);
        return;
      }

      let newGameState = gameEngineManager.applyMove(gameState, data.move);

      const fullMove: Move = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        ...data.move
      };

      await gameStateService.saveGameState(data.roomId, newGameState);

      this.io.to(data.roomId).emit('move-made', {
        move: fullMove,
        gameState: newGameState
      });

      const aiProcessedState = gameStateService.getProcessedAIMove(data.roomId);
      if (aiProcessedState) {
        console.log(`AI moves detected, broadcasting updated state for room ${data.roomId}`);
        
        this.io.to(data.roomId).emit('move-made', {
          move: {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            type: 'pawn',
            playerId: 'ai-player'
          },
          gameState: aiProcessedState
        });

        newGameState = aiProcessedState;
      }

      if (gameEngineManager.isGameFinished(newGameState)) {
        const winner = gameEngineManager.getWinner(newGameState);
        if (winner) {
          this.io.to(data.roomId).emit('game-finished', {
            gameState: newGameState,
            winner: newGameState.players.find(p => p.id === winner)!
          });
          
          console.log(`🏆 Game finished in room ${data.roomId}, winner: ${winner}`);

          setTimeout(() => {
            this.io.to(data.roomId).emit('room-updated', {
              room: {
                id: data.roomId,
                status: 'finished' as any,
                isGameFinished: true
              } as any
            });
          }, 5000);
        }
      }

      console.log(`Move processed successfully for ${this.socket.user.username}`);

    } catch (error) {
      console.error('Error processing move:', error);
      this.emitError('MOVE_PROCESSING_FAILED', 'Failed to process move');
    }
  }

  private async handleRequestGameState(data: { roomId: string }): Promise<void> {
    try {
      console.log(`Game state requested by ${this.socket.user.username} for room ${data.roomId}`);

      // permettre aux spectateurs de voir le jeu
      // pas de verif si l'utilisateur est un membre

      const gameState = await gameStateService.getGameState(data.roomId);
      if (gameState) {
        // spectateurs peuvent voir les valid moves mais ne peuvent pas jouer
        const isMember = await this.isUserRoomMember(data.roomId, this.socket.user.id);
        const validMoves = isMember ? gameEngineManager.getValidMoves(gameState, this.socket.user.id) : [];

        this.socket.emit('game-state-sync', { 
          gameState,
          validMoves: validMoves.map(move => ({
            ...move,
            id: crypto.randomUUID(),
            timestamp: new Date()
          })),
          isSpectator: !isMember
        });

        const userType = isMember ? 'player' : 'spectator';
        console.log(`Active game state sent to ${this.socket.user.username} (${userType})`);
        return;
      }

      const finishedGame = await gameStateService.getFinishedGame(data.roomId);
      if (finishedGame) {
        const winner = finishedGame.players.find(p => p.id === finishedGame.winner);
        
        this.socket.emit('game-finished', {
          gameState: finishedGame,
          winner: winner!
        });

        console.log(`🏆 Finished game results sent to ${this.socket.user.username}`);
        return;
      }

      this.emitError('GAME_NOT_FOUND', 'No active game found for this room');

    } catch (error) {
      console.error('Error sending game state:', error);
      this.emitError('GAME_STATE_FAILED', 'Failed to get game state');
    }
  }

  private async handleForfeitGame(data: { roomId: string }): Promise<void> {
    try {
      console.log(`🏳️ Forfeit requested by ${this.socket.user.username} in room ${data.roomId}`);

      const isMember = await this.isUserRoomMember(data.roomId, this.socket.user.id);
      if (!isMember) {
        this.emitError('PERMISSION_DENIED', 'Spectators cannot forfeit games');
        return;
      }

      const gameState = await gameStateService.getGameState(data.roomId);
      if (!gameState) {
        this.emitError('GAME_NOT_FOUND', 'No active game found for this room');
        return;
      }

      const player = gameState.players.find(p => p.id === this.socket.user.id);
      if (!player) {
        this.emitError('PLAYER_NOT_IN_GAME', 'You are not a player in this game');
        return;
      }

      const updatedGameState = await gameStateService.forfeitPlayer(data.roomId, this.socket.user.id);
      if (!updatedGameState) {
        this.emitError('FORFEIT_FAILED', 'Failed to process forfeit');
        return;
      }

      this.io.to(data.roomId).emit('player-forfeited', {
        playerId: this.socket.user.id,
        playerName: this.socket.user.username,
        gameState: updatedGameState
      });

      if (updatedGameState.status === 'finished') {
        const winner = updatedGameState.players.find(p => p.id === updatedGameState.winner);
        
        this.io.to(data.roomId).emit('game-finished', {
          gameState: updatedGameState,
          winner: winner || updatedGameState.players.find(p => p.isConnected)!
        });

        console.log(`🏆 Game finished due to forfeit in room ${data.roomId}`);
      }

      console.log(`Forfeit processed successfully for ${this.socket.user.username}`);

    } catch (error) {
      console.error('Error processing forfeit:', error);
      this.emitError('FORFEIT_PROCESSING_FAILED', 'Failed to process forfeit');
    }
  }

  private async getRoomWithValidation(roomId: string) {
    const roomResult = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (roomResult.length === 0) {
      this.emitError('ROOM_NOT_FOUND', 'Room not found');
      return null;
    }

    return roomResult[0];
  }

  private async getRoomMembers(roomId: string) {
    return await db
      .select()
      .from(roomMembers)
      .where(eq(roomMembers.roomId, roomId));
  }

  private async isUserRoomMember(roomId: string, userId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(roomMembers)
      .where(and(
        eq(roomMembers.roomId, roomId),
        eq(roomMembers.userId, userId)
      ))
      .limit(1);

    return result.length > 0;
  }

  private emitError(code: string, message: string): void {
    const error: ApiError = { code, message };
    this.socket.emit('error', { error });
    console.log(`⚠️ Emitted error to ${this.socket.user.username}: ${code} - ${message}`);
  }

  private emitInvalidMove(code: string, message: string, originalMove: Omit<Move, 'id' | 'timestamp'>): void {
    this.socket.emit('invalid-move', { 
      error: message,
      originalMove 
    });
    console.log(`⚠️ Invalid move from ${this.socket.user.username}: ${code} - ${message}`);
  }
}