import { eq, and, sql } from 'drizzle-orm';
import { db, games, gamePlayers, rooms, roomMembers, users } from '../db';
import { gameEngineManager } from './GameEngineManager';
import { aiManager } from '../ai/AIManager';
import type { GameState, Player } from '../../shared/types';

export class GameStateService {
  async createGame(roomId: string): Promise<GameState> {
    try {
      console.log(`Creating game for room ${roomId}`);

      const room = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .limit(1);

      if (room.length === 0) {
        throw new Error('Room not found');
      }

      const playersData = await db
        .select({
          userId: roomMembers.userId,
          username: users.username,
          joinedAt: roomMembers.joinedAt,
          selectedPawnTheme: users.selectedPawnTheme,
          isAI: users.isAI,
          aiDifficulty: users.aiDifficulty,
        })
        .from(roomMembers)
        .innerJoin(users, eq(roomMembers.userId, users.id))
        .where(eq(roomMembers.roomId, roomId))
        .orderBy(roomMembers.joinedAt);

      if (playersData.length === 0) {
        throw new Error('No players found in room');
      }

      const playerIds = playersData.map(p => p.userId);
      const gameState = gameEngineManager.createGame(playerIds, room[0].maxPlayers as 2 | 4);

      gameState.players = gameState.players.map((player, index) => ({
        ...player,
        username: playersData[index].username,
        joinedAt: playersData[index].joinedAt,
        selectedPawnTheme: playersData[index].selectedPawnTheme || 'theme-pawn-default',
        isAI: playersData[index].isAI || false,
        aiDifficulty: playersData[index].aiDifficulty || undefined,
      }));

      for (const playerData of playersData) {
        if (playerData.isAI && playerData.aiDifficulty) {
          aiManager.createAI(playerData.userId, playerData.aiDifficulty);
          console.log(`AI instance created for player ${playerData.userId} (${playerData.aiDifficulty})`);
        }
      }

      const [gameRecord] = await db
        .insert(games)
        .values({
          roomId,
          gameState: gameState as any, // JSON field
          status: 'playing',
          startedAt: new Date(),
        })
        .returning();

      const gamePlayerRecords = gameState.players.map((player, index) => ({
        gameId: gameRecord.id,
        userId: player.id,
        playerIndex: index,
        color: player.color,
        wallsUsed: 0,
        isWinner: false,
      }));

      await db.insert(gamePlayers).values(gamePlayerRecords);

      console.log(`Game created: ${gameRecord.id}`);
      return gameState;

    } catch (error) {
      console.error('Error creating game:', error);
      throw error;
    }
  }

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
      
      gameState.createdAt = new Date(gameState.createdAt);
      if (gameState.startedAt) gameState.startedAt = new Date(gameState.startedAt);
      if (gameState.finishedAt) gameState.finishedAt = new Date(gameState.finishedAt);
      
      gameState.moves = gameState.moves.map(move => ({
        ...move,
        timestamp: new Date(move.timestamp),
      }));

      gameState.players = gameState.players.map(player => ({
        ...player,
        joinedAt: new Date(player.joinedAt),
      }));

      return gameState;

    } catch (error) {
      console.error('Error retrieving game state:', error);
      return null;
    }
  }

  async saveGameState(roomId: string, gameState: GameState): Promise<void> {
    try {
      await db
        .update(games)
        .set({
          gameState: gameState as any,
          status: gameState.status,
          winnerId: gameState.winner || null,
          finishedAt: gameState.status === 'finished' ? new Date() : null,
        })
        .where(and(
          eq(games.roomId, roomId),
          eq(games.status, 'playing')
        ));

      if (gameState.status === 'finished' && gameState.winner) {
        await this.completeGame(roomId, gameState);
      }

      await this.processAITurns(roomId, gameState);

    } catch (error) {
      console.error('Error saving game state:', error);
      throw error;
    }
  }

  private async processAITurns(roomId: string, gameState: GameState): Promise<void> {
    if (gameState.status !== 'playing') {
      return;
    }

    let currentState = gameState;
    let processedAIMove = false;

    while (currentState.status === 'playing') {
      const currentPlayer = gameEngineManager.getCurrentPlayer(currentState);
      
      if (!currentPlayer.isAI) {
        break;
      }

      try {
        console.log(`Processing AI turn for player ${currentPlayer.id} (${currentPlayer.username})`);
        
        const aiMove = await aiManager.generateMove(currentState, currentPlayer.id);
        
        if (!gameEngineManager.validateMove(currentState, aiMove)) {
          console.error(`AI generated invalid move for player ${currentPlayer.id}`);
          break;
        }

        currentState = gameEngineManager.applyMove(currentState, aiMove);
        processedAIMove = true;

        console.log(`AI move applied for player ${currentPlayer.id}`);

        await db
          .update(games)
          .set({
            gameState: currentState as any,
            status: currentState.status,
            winnerId: currentState.winner || null,
            finishedAt: currentState.status === 'finished' ? new Date() : null,
          })
          .where(and(
            eq(games.roomId, roomId),
            eq(games.status, 'playing')
          ));

        if (currentState.status === 'finished' && currentState.winner) {
          await this.completeGame(roomId, currentState);
          break;
        }

      } catch (error) {
        console.error(`Error processing AI turn for player ${currentPlayer.id}:`, error);
        break;
      }
    }

    if (processedAIMove) {
      this.aiMoveProcessed.set(roomId, currentState);
    }
  }

  private aiMoveProcessed = new Map<string, GameState>();

  getProcessedAIMove(roomId: string): GameState | null {
    const state = this.aiMoveProcessed.get(roomId);
    if (state) {
      this.aiMoveProcessed.delete(roomId);
      return state;
    }
    return null;
  }

  async completeGame(roomId: string, gameState: GameState): Promise<void> {
    try {
      console.log(`🏁 Completing game for room ${roomId}, winner: ${gameState.winner}`);

      await this.updatePlayerStats(roomId, gameState);

      await db
        .update(rooms)
        .set({ 
          status: 'finished',
          updatedAt: new Date()
        })
        .where(eq(rooms.id, roomId));

      setTimeout(async () => {
        await this.cleanupFinishedRoom(roomId);
      }, 30 * 60 * 1000);

      console.log(`Game completion processed for room ${roomId}`);

    } catch (error) {
      console.error('Error completing game:', error);
      throw error;
    }
  }

  async cleanupFinishedRoom(roomId: string): Promise<void> {
    try {
      console.log(`Cleaning up finished room ${roomId}`);

      await db
        .delete(roomMembers)
        .where(eq(roomMembers.roomId, roomId));

      await db
        .delete(rooms)
        .where(eq(rooms.id, roomId));

      console.log(`Room ${roomId} cleaned up successfully`);

    } catch (error) {
      console.error('Error cleaning up finished room:', error);
    }
  }

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
      console.error('Error checking for active game:', error);
      return false;
    }
  }

  async getFinishedGame(roomId: string): Promise<GameState | null> {
    try {
      const gameRecord = await db
        .select()
        .from(games)
        .where(and(
          eq(games.roomId, roomId),
          eq(games.status, 'finished')
        ))
        .limit(1);

      if (gameRecord.length === 0) {
        return null;
      }

      const gameState = gameRecord[0].gameState as GameState;
      
      gameState.createdAt = new Date(gameState.createdAt);
      if (gameState.startedAt) gameState.startedAt = new Date(gameState.startedAt);
      if (gameState.finishedAt) gameState.finishedAt = new Date(gameState.finishedAt);
      
      return gameState;

    } catch (error) {
      console.error('Error retrieving finished game:', error);
      return null;
    }
  }

  async getGamePlayers(roomId: string): Promise<Player[]> {
    try {
      const gameState = await this.getGameState(roomId);
      return gameState?.players || [];
    } catch (error) {
      console.error('Error getting game players:', error);
      return [];
    }
  }

  async updatePlayerConnection(roomId: string, playerId: string, isConnected: boolean): Promise<void> {
    try {
      const gameState = await this.getGameState(roomId);
      if (!gameState) return;

      gameState.players = gameState.players.map(player =>
        player.id === playerId ? { ...player, isConnected } : player
      );

      await this.saveGameState(roomId, gameState);
      
      console.log(`🔗 Player ${playerId} ${isConnected ? 'connected' : 'disconnected'} in room ${roomId}`);
    } catch (error) {
      console.error('Error updating player connection:', error);
    }
  }

  private async updatePlayerStats(roomId: string, gameState: GameState): Promise<void> {
    try {
      const gameRecord = await db
        .select({ id: games.id })
        .from(games)
        .where(and(
          eq(games.roomId, roomId),
          eq(games.status, 'finished')
        ))
        .limit(1);

      if (gameRecord.length === 0) {
        console.error('No finished game record found for room:', roomId);
        return;
      }

      const gameId = gameRecord[0].id;
      console.log(`🏁 Updating player stats for game ${gameId}, winner: ${gameState.winner}`);

      for (const player of gameState.players) {
        const isWinner = player.id === gameState.winner;
        const wallsUsed = player.wallsRemaining;

        console.log(`Updating stats for player ${player.username} (${player.id}): winner=${isWinner}, wallsUsed=${wallsUsed}`);

        await db
          .update(gamePlayers)
          .set({
            wallsUsed,
            isWinner,
            finalPosition: player.position as any,
          })
          .where(and(
            eq(gamePlayers.userId, player.id),
            eq(gamePlayers.gameId, gameId)
          ));

        await db
          .update(users)
          .set({
            gamesPlayed: sql`${users.gamesPlayed} + 1`,
            gamesWon: isWinner ? sql`${users.gamesWon} + 1` : users.gamesWon,
          })
          .where(eq(users.id, player.id));
      }
      
      console.log(`Player stats updated successfully for game ${gameId}`);
    } catch (error) {
      console.error('Error updating player stats:', error);
    }
  }

  async cleanupAbandonedGames(): Promise<void> {
    try {
      // This will be implemented as part of a cleanup job
      console.log('Cleanup abandoned games - TODO');
    } catch (error) {
      console.error('Error cleaning up abandoned games:', error);
    }
  }

  async forfeitPlayer(roomId: string, playerId: string): Promise<GameState | null> {
    try {
      console.log(`🏳️ Player ${playerId} forfeiting game in room ${roomId}`);

      const gameState = await this.getGameState(roomId);
      if (!gameState) {
        throw new Error('No active game found');
      }

      const forfeiter = gameState.players.find(p => p.id === playerId);
      if (!forfeiter) {
        throw new Error('Player not found in game');
      }

      const remainingPlayers = gameState.players.filter(p => p.id !== playerId && p.isConnected);
      
      if (remainingPlayers.length === 1) {
        const winner = remainingPlayers[0];
        gameState.status = 'finished';
        gameState.winner = winner.id;
        gameState.finishedAt = new Date();
      } else if (remainingPlayers.length > 1) {
        gameState.players = gameState.players.map(p =>
          p.id === playerId ? { ...p, isConnected: false } : p
        );
      } else {
        gameState.status = 'finished';
        gameState.finishedAt = new Date();
      }

      await this.saveGameState(roomId, gameState);

      console.log(`Player forfeit processed for ${playerId}`);
      return gameState;

    } catch (error) {
      console.error('Error processing forfeit:', error);
      return null;
    }
  }

  
  private disconnectionTimeouts = new Map<string, NodeJS.Timeout>();

  startDisconnectionTimeout(roomId: string, playerId: string, timeoutSeconds: number = 60): void {
    const key = `${roomId}:${playerId}`;
    
    if (this.disconnectionTimeouts.has(key)) {
      clearTimeout(this.disconnectionTimeouts.get(key)!);
    }

    console.log(`Starting ${timeoutSeconds}s disconnection timeout for player ${playerId} in room ${roomId}`);

    const timeout = setTimeout(async () => {
      console.log(`⏰ Disconnection timeout expired for player ${playerId}, auto-forfeiting...`);
      
      try {
        const gameState = await this.forfeitPlayer(roomId, playerId);
        if (gameState) {
          this.disconnectionTimeouts.set(`${key}:expired`, setTimeout(() => {}, 0));
        }
      } catch (error) {
        console.error('Error during auto-forfeit:', error);
      }
      
      this.disconnectionTimeouts.delete(key);
    }, timeoutSeconds * 1000);

    this.disconnectionTimeouts.set(key, timeout);
  }

  cancelDisconnectionTimeout(roomId: string, playerId: string): boolean {
    const key = `${roomId}:${playerId}`;
    
    if (this.disconnectionTimeouts.has(key)) {
      clearTimeout(this.disconnectionTimeouts.get(key)!);
      this.disconnectionTimeouts.delete(key);
      console.log(`Disconnection timeout cancelled for player ${playerId}`);
      return true;
    }
    
    return false;
  }

  hasDisconnectionTimeout(roomId: string, playerId: string): boolean {
    const key = `${roomId}:${playerId}`;
    return this.disconnectionTimeouts.has(key);
  }
}

export const gameStateService = new GameStateService();