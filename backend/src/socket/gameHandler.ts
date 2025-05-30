import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, Move, GameState } from '../../../shared/types';
import { gameEngineManager } from '../game/GameEngineManager';
import { gameStateService } from '../game/GameStateService';

interface AuthenticatedSocket {
  id: string;
  user: { id: string; username: string };
  emit: Function;
  join: Function;
  leave: Function;
  on: Function;
  to: Function;
}

/**
 * GameHandler - Manages all game-related Socket.IO events
 * 
 * This handler provides robust game state management, move validation,
 * and real-time synchronization for all players in a game.
 */
export class GameHandler {
  constructor(private io: Server<ClientToServerEvents, ServerToClientEvents>) {}

  /**
   * Sets up game event handlers for a socket connection
   */
  setupHandlers(socket: AuthenticatedSocket): void {
    socket.on('make-move', (data: { roomId: string; move: Omit<Move, 'id' | 'timestamp'> }) => this.handleMakeMove(socket, data));
    socket.on('request-game-state', (data: { roomId: string }) => this.handleRequestGameState(socket, data));
  }

  /**
   * Handles a player's move attempt
   */
  private async handleMakeMove(
    socket: AuthenticatedSocket, 
    data: { roomId: string; move: Omit<Move, 'id' | 'timestamp'> }
  ): Promise<void> {
    try {
      const { roomId, move } = data;
      const { user } = socket;
      
      console.log(`🎯 ${user.username} attempting move in room ${roomId}:`, move);

      // **CRITICAL**: Validate the move before applying
      const gameState = await gameStateService.getGameState(roomId);
      if (!gameState) {
        socket.emit('invalid-move', {
          error: 'Game not found',
          move: { id: 'unknown', timestamp: new Date(), ...move }
        });
        return;
      }

      // Check if it's the player's turn
      const currentPlayer = gameEngineManager.getCurrentPlayer(gameState);
      if (currentPlayer.id !== user.id) {
        socket.emit('invalid-move', {
          error: `Not your turn. Current player: ${currentPlayer.username}`,
          move: { id: 'unknown', timestamp: new Date(), ...move }
        });
        return;
      }

      // Validate move through game engine
      const isValidMove = gameEngineManager.validateMove(gameState, move);
      if (!isValidMove) {
        socket.emit('invalid-move', {
          error: 'Invalid move according to game rules',
          move: { id: 'unknown', timestamp: new Date(), ...move }
        });
        return;
      }

      // Apply the move
      const newGameState = gameEngineManager.applyMove(gameState, move);
      
      // Create the full move object
      const fullMove: Move = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        ...move,
      };

      // Save the updated game state
      await gameStateService.saveGameState(roomId, newGameState);

      console.log(`✅ Move applied successfully in room ${roomId}`);

      // Check if game is finished
      if (gameEngineManager.isGameFinished(newGameState)) {
        const winner = gameEngineManager.getWinner(newGameState);
        if (winner) {
          newGameState.status = 'finished';
          newGameState.winner = winner;
          newGameState.finishedAt = new Date();
          
          await gameStateService.saveGameState(roomId, newGameState);
          
          // Broadcast game finished
          this.io.to(roomId).emit('game-finished', {
            winner,
            gameState: newGameState
          });
          
          console.log(`🏆 Game finished in room ${roomId}. Winner: ${winner}`);
          return;
        }
      }

      // Broadcast the move to all players in the room
      this.io.to(roomId).emit('move-made', {
        move: fullMove,
        gameState: newGameState
      });

    } catch (error) {
      console.error('❌ Error processing move:', error);
      
      socket.emit('invalid-move', {
        error: 'Internal server error while processing move',
        move: { id: 'error', timestamp: new Date(), ...data.move }
      });
    }
  }

  /**
   * Handles game state requests (for reconnection/synchronization)
   */
  private async handleRequestGameState(
    socket: AuthenticatedSocket,
    data: { roomId: string }
  ): Promise<void> {
    try {
      const { roomId } = data;
      const { user } = socket;

      console.log(`📊 ${user.username} requesting game state for room ${roomId}`);

      const gameState = await gameStateService.getGameState(roomId);
      if (!gameState) {
        socket.emit('error', {
          error: {
            code: 'GAME_NOT_FOUND',
            message: 'No active game found for this room'
          }
        });
        return;
      }

      // Verify user is in the game
      const player = gameEngineManager.getPlayerById(gameState, user.id);
      if (!player) {
        socket.emit('error', {
          error: {
            code: 'NOT_IN_GAME',
            message: 'You are not a player in this game'
          }
        });
        return;
      }

      // Update player connection status
      await gameStateService.updatePlayerConnection(roomId, user.id, true);

      // Send current game state
      socket.emit('game-state-updated', { gameState });

      // Notify others that player reconnected
      this.io.to(roomId).emit('player-reconnected', { playerId: user.id });

      console.log(`✅ Game state sent to ${user.username} for room ${roomId}`);

    } catch (error) {
      console.error('❌ Error sending game state:', error);
      
      socket.emit('error', {
        error: {
          code: 'GAME_STATE_ERROR',
          message: 'Failed to retrieve game state'
        }
      });
    }
  }

  /**
   * Handles player disconnection from a game
   */
  async handlePlayerDisconnect(
    roomId: string, 
    playerId: string, 
    username: string
  ): Promise<void> {
    try {
      console.log(`🔌 ${username} disconnected from game ${roomId}`);

      // Update player connection status
      await gameStateService.updatePlayerConnection(roomId, playerId, false);

      // Notify other players
      this.io.to(roomId).emit('player-disconnected', { playerId });

      // TODO: Implement timeout logic for abandoned games
      // If all players are disconnected for X minutes, mark game as abandoned

    } catch (error) {
      console.error('❌ Error handling player disconnect:', error);
    }
  }

  /**
   * Gets valid moves for a player (used by frontend for UI hints)
   */
  async getValidMoves(roomId: string, playerId: string): Promise<Omit<Move, 'id' | 'timestamp'>[]> {
    try {
      const gameState = await gameStateService.getGameState(roomId);
      if (!gameState) return [];

      return gameEngineManager.getValidMoves(gameState, playerId);
    } catch (error) {
      console.error('❌ Error getting valid moves:', error);
      return [];
    }
  }

  /**
   * Creates and starts a new game when room is full
   */
  async createAndStartGame(roomId: string): Promise<GameState | null> {
    try {
      console.log(`🎮 Starting new game for room ${roomId}`);

      // Check if game already exists
      const existingGame = await gameStateService.hasActiveGame(roomId);
      if (existingGame) {
        console.log(`⚠️ Game already exists for room ${roomId}`);
        return await gameStateService.getGameState(roomId);
      }

      // Create new game
      const gameState = await gameStateService.createGame(roomId);
      
      // Broadcast game start to all players in room
      this.io.to(roomId).emit('game-started', { gameState });

      console.log(`✅ Game started for room ${roomId} with ${gameState.players.length} players`);
      return gameState;

    } catch (error) {
      console.error('❌ Error creating game:', error);
      
      // Notify room of game creation failure
      this.io.to(roomId).emit('error', {
        error: {
          code: 'GAME_CREATE_FAILED',
          message: 'Failed to start game'
        }
      });
      
      return null;
    }
  }
}

// Factory function to create game handler
export const createGameHandler = (io: Server<ClientToServerEvents, ServerToClientEvents>) => {
  return new GameHandler(io);
}; 