import { eq, and, sql } from 'drizzle-orm';
import { db, games, gamePlayers, rooms, roomMembers, users } from '../db';
import { gameEngineManager } from './GameEngineManager';
import type { GameState, Player } from '../../../shared/types';

/**
 * GameStateService - Handles all game state persistence and retrieval
 * 
 * This service manages the database operations for game states and provides
 * a clean interface for game state management.
 */
export class GameStateService {
  
  /**
   * Creates and persists a new game state to the database
   */
  async createGame(roomId: string): Promise<GameState> {
    try {
      console.log(`🎮 Creating game for room ${roomId}`);

      // Get room and players
      const room = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .limit(1);

      if (room.length === 0) {
        throw new Error('Room not found');
      }

      // Get all players in the room with their usernames
      const playersData = await db
        .select({
          userId: roomMembers.userId,
          username: users.username,
          joinedAt: roomMembers.joinedAt,
        })
        .from(roomMembers)
        .innerJoin(users, eq(roomMembers.userId, users.id))
        .where(eq(roomMembers.roomId, roomId))
        .orderBy(roomMembers.joinedAt); // Consistent player order

      if (playersData.length === 0) {
        throw new Error('No players found in room');
      }

      // Create game state using game engine
      const playerIds = playersData.map(p => p.userId);
      const gameState = gameEngineManager.createGame(playerIds, room[0].maxPlayers as 2 | 4);

      // Update players with real usernames
      gameState.players = gameState.players.map((player, index) => ({
        ...player,
        username: playersData[index].username,
        joinedAt: playersData[index].joinedAt,
      }));

      // Save game to database
      const [gameRecord] = await db
        .insert(games)
        .values({
          roomId,
          gameState: gameState as any, // JSON field
          status: 'playing',
          startedAt: new Date(),
        })
        .returning();

      // Save game players
      const gamePlayerRecords = gameState.players.map((player, index) => ({
        gameId: gameRecord.id,
        userId: player.id,
        playerIndex: index,
        color: player.color,
        wallsUsed: 0,
        isWinner: false,
      }));

      await db.insert(gamePlayers).values(gamePlayerRecords);

      console.log(`✅ Game created: ${gameRecord.id}`);
      return gameState;

    } catch (error) {
      console.error('❌ Error creating game:', error);
      throw error;
    }
  }

  /**
   * Retrieves the current game state for a room
   */
  async getGameState(roomId: string): Promise<GameState | null> {
    try {
      const gameRecord = await db
        .select()
        .from(games)
        .where(and(
          eq(games.roomId, roomId),
          eq(games.status, 'playing')
        ))
        .limit(1);

      if (gameRecord.length === 0) {
        return null;
      }

      const gameState = gameRecord[0].gameState as GameState;
      
      // Ensure dates are properly converted
      gameState.createdAt = new Date(gameState.createdAt);
      if (gameState.startedAt) gameState.startedAt = new Date(gameState.startedAt);
      if (gameState.finishedAt) gameState.finishedAt = new Date(gameState.finishedAt);
      
      // Convert move timestamps
      gameState.moves = gameState.moves.map(move => ({
        ...move,
        timestamp: new Date(move.timestamp),
      }));

      // Convert player joinedAt dates
      gameState.players = gameState.players.map(player => ({
        ...player,
        joinedAt: new Date(player.joinedAt),
      }));

      return gameState;

    } catch (error) {
      console.error('❌ Error retrieving game state:', error);
      return null;
    }
  }

  /**
   * Updates the game state in the database
   */
  async saveGameState(roomId: string, gameState: GameState): Promise<void> {
    try {
      await db
        .update(games)
        .set({
          gameState: gameState as any, // JSON field
          status: gameState.status,
          winnerId: gameState.winner || null,
          finishedAt: gameState.status === 'finished' ? new Date() : null,
        })
        .where(and(
          eq(games.roomId, roomId),
          eq(games.status, 'playing')
        ));

      // Update player statistics if game is finished
      if (gameState.status === 'finished' && gameState.winner) {
        await this.updatePlayerStats(roomId, gameState);
      }

    } catch (error) {
      console.error('❌ Error saving game state:', error);
      throw error;
    }
  }

  /**
   * Checks if a game exists for a room
   */
  async hasActiveGame(roomId: string): Promise<boolean> {
    try {
      const count = await db
        .select()
        .from(games)
        .where(and(
          eq(games.roomId, roomId),
          eq(games.status, 'playing')
        ))
        .limit(1);

      return count.length > 0;
    } catch (error) {
      console.error('❌ Error checking for active game:', error);
      return false;
    }
  }

  /**
   * Gets all players in a game with their current connection status
   */
  async getGamePlayers(roomId: string): Promise<Player[]> {
    try {
      const gameState = await this.getGameState(roomId);
      return gameState?.players || [];
    } catch (error) {
      console.error('❌ Error getting game players:', error);
      return [];
    }
  }

  /**
   * Updates player connection status in game state
   */
  async updatePlayerConnection(roomId: string, playerId: string, isConnected: boolean): Promise<void> {
    try {
      const gameState = await this.getGameState(roomId);
      if (!gameState) return;

      // Update player connection status
      gameState.players = gameState.players.map(player =>
        player.id === playerId ? { ...player, isConnected } : player
      );

      await this.saveGameState(roomId, gameState);
      
      console.log(`🔗 Player ${playerId} ${isConnected ? 'connected' : 'disconnected'} in room ${roomId}`);
    } catch (error) {
      console.error('❌ Error updating player connection:', error);
    }
  }

  /**
   * Updates player statistics after game completion
   */
  private async updatePlayerStats(roomId: string, gameState: GameState): Promise<void> {
    try {
      for (const player of gameState.players) {
        const isWinner = player.id === gameState.winner;
        const wallsUsed = player.wallsRemaining;

        // Update game_players table
        await db
          .update(gamePlayers)
          .set({
            wallsUsed,
            isWinner,
            finalPosition: player.position as any, // JSON field
          })
          .where(and(
            eq(gamePlayers.userId, player.id),
            eq(gamePlayers.gameId, roomId) // This should be gameId, but using roomId for now
          ));

        // Update user statistics
        await db
          .update(users)
          .set({
            gamesPlayed: sql`${users.gamesPlayed} + 1`,
            gamesWon: isWinner ? sql`${users.gamesWon} + 1` : users.gamesWon,
          })
          .where(eq(users.id, player.id));
      }
    } catch (error) {
      console.error('❌ Error updating player stats:', error);
    }
  }

  /**
   * Cleans up abandoned games (games where all players are disconnected)
   */
  async cleanupAbandonedGames(): Promise<void> {
    try {
      // This will be implemented as part of a cleanup job
      console.log('🧹 Cleanup abandoned games - TODO');
    } catch (error) {
      console.error('❌ Error cleaning up abandoned games:', error);
    }
  }
}

// Singleton instance
export const gameStateService = new GameStateService(); 