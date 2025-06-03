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

      // Get all players in the room with their usernames and theme data
      const playersData = await db
        .select({
          userId: roomMembers.userId,
          username: users.username,
          joinedAt: roomMembers.joinedAt,
          selectedPawnTheme: users.selectedPawnTheme,
        })
        .from(roomMembers)
        .innerJoin(users, eq(roomMembers.userId, users.id))
        .where(eq(roomMembers.roomId, roomId))
        .orderBy(roomMembers.joinedAt); // Consistent player order

      if (playersData.length === 0) {
        throw new Error('No players found in room');
      }

      // Check if room has AI option enabled
      const withAI = room[0].withAI;
      
      // If AI is enabled, add AI player as long as we don't exceed maxPlayers
      let playerIds = playersData.map(p => p.userId);
      let aiPlayerId: string | null = null;
      
      if (withAI && playerIds.length < room[0].maxPlayers) {
        try {
          // Générer un ID unique pour l'IA
          aiPlayerId = `ai-${crypto.randomUUID()}`;
          console.log(`🤖 Génération d'un ID pour l'IA: ${aiPlayerId}`);
          
          // Générer un nom unique en ajoutant un timestamp pour éviter les collisions
          const timestamp = Date.now();
          const uniqueAiUsername = `Monte Carlo AI ${timestamp}`;
          
          try {
            // Utiliser directement les requêtes SQL brutes via le tag sql
            // Ainsi nous n'avons pas besoin de se soucier du format camelCase vs snake_case
            const now = Math.floor(Date.now() / 1000);
            
            // Utilisation de l'API standard pour insérer des données dans Drizzle
            // IMPORTANT: Utiliser camelCase pour les noms de propriétés comme attendu par l'API Drizzle
            await db.insert(users).values({
              id: aiPlayerId,
              username: uniqueAiUsername,
              passwordHash: 'ai-user-no-password', // camelCase comme dans le schéma Drizzle
              gamesPlayed: 0,
              gamesWon: 0,
              coinBalance: 0,
              selectedBoardTheme: 'default',
              selectedPawnTheme: 'default',
              createdAt: new Date(now * 1000), // Utiliser un objet Date pour les timestamps
              updatedAt: new Date(now * 1000)
            });
            
            console.log(`🤖 Utilisateur IA créé avec succès: ${uniqueAiUsername}`);
          } catch (unknownError) {
            // Gestion sécurisée des erreurs de type unknown
            const errorMessage = unknownError instanceof Error 
              ? unknownError.message 
              : 'Unknown database error';
              
            console.error('Erreur lors de l\'insertion de l\'utilisateur AI:', errorMessage);
            
            // Si l'erreur est due à un nom d'utilisateur dupliqué, essayons avec un autre nom
            if (errorMessage.includes('UNIQUE constraint failed')) {
              console.log('Tentative avec un autre nom d\'utilisateur...');
              const newTimestamp = Date.now() + Math.floor(Math.random() * 1000);
              const alternativeUsername = `Monte Carlo AI ${newTimestamp}`;
              const retryNow = Math.floor(Date.now() / 1000);
              
              try {
                // Deuxième tentative avec un nom d'utilisateur différent
                // Utiliser la même approche cohérente pour les deux tentatives
                await db.insert(users).values({
                  id: aiPlayerId,
                  username: alternativeUsername,
                  passwordHash: 'ai-user-no-password', // camelCase comme dans le schéma Drizzle
                  gamesPlayed: 0,
                  gamesWon: 0,
                  coinBalance: 0,
                  selectedBoardTheme: 'default',
                  selectedPawnTheme: 'default',
                  createdAt: new Date(retryNow * 1000), // Utiliser un objet Date pour les timestamps
                  updatedAt: new Date(retryNow * 1000)
                });
                
                console.log(`🤖 Utilisateur IA créé avec succès (deuxième tentative): ${alternativeUsername}`);
              } catch (secondError) {
                const secondErrorMessage = secondError instanceof Error 
                  ? secondError.message 
                  : 'Unknown database error on retry';
                console.error('Deuxième échec de création de l\'utilisateur AI:', secondErrorMessage);
                throw new Error(`Failed to create AI user after two attempts`);
              }
            } else {
              // Si ce n'est pas un problème de duplication, propager l'erreur
              throw new Error(`Failed to create AI user: ${errorMessage}`);
            }
          }
          
          // Ajouter l'ID de l'IA aux joueurs
          playerIds.push(aiPlayerId);
          console.log(`🤖 Ajout de l'IA avec ID ${aiPlayerId} à la partie`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('❌ Erreur lors de la création de l\'utilisateur IA:', errorMessage);
          throw new Error(`Failed to create AI user: ${errorMessage}`);
        }
      }
      
      const gameState = gameEngineManager.createGame(playerIds, room[0].maxPlayers as 2 | 4);

      // Update players with real usernames and theme data
      gameState.players = gameState.players.map((player, index) => ({
        ...player,
        username: playersData[index].username,
        joinedAt: playersData[index].joinedAt,
        selectedPawnTheme: playersData[index].selectedPawnTheme || 'theme-pawn-default',
      }));
      // Update players with real usernames and AI flag
      gameState.players = gameState.players.map((player, index) => {
        // Check if this is a human player (has corresponding playerData)
        const playerData = playersData.find(p => p.userId === player.id);
        
        if (playerData) {
          // Human player
          return {
            ...player,
            username: playerData.username,
            joinedAt: playerData.joinedAt,
            isAI: false,
            selectedPawnTheme: playersData[index].selectedPawnTheme || 'theme-pawn-default',
          };
        } else {
          // AI player
          return {
            ...player,
            username: 'Monte Carlo AI',
            joinedAt: new Date(),
            isAI: true,
            selectedPawnTheme: playersData[index].selectedPawnTheme || 'theme-pawn-default', 
          };
        }
      });

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

      // Save game players - including AI player if present
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

      if (gameState.status === 'finished' && gameState.winner) {
        await this.completeGame(roomId, gameState);
      }

    } catch (error) {
      console.error('❌ Error saving game state:', error);
      throw error;
    }
  }

  /**
   * Handles complete game finishing including room cleanup
   */
  async completeGame(roomId: string, gameState: GameState): Promise<void> {
    try {
      console.log(`🏁 Completing game for room ${roomId}, winner: ${gameState.winner}`);

      // Update player statistics
      await this.updatePlayerStats(roomId, gameState);

      // Update room status to 'finished' and schedule cleanup
      await db
        .update(rooms)
        .set({ 
          status: 'finished',
          // Set a cleanup time for 30 minutes from now
          updatedAt: new Date()
        })
        .where(eq(rooms.id, roomId));

      // **OPTIONAL**: Schedule room cleanup after a delay (e.g., 30 minutes)
      // This allows players to see final results before room is cleaned up
      setTimeout(async () => {
        await this.cleanupFinishedRoom(roomId);
      }, 30 * 60 * 1000); // 30 minutes

      console.log(`✅ Game completion processed for room ${roomId}`);

    } catch (error) {
      console.error('❌ Error completing game:', error);
      throw error;
    }
  }

  /**
   * Cleans up a finished room and removes players
   */
  async cleanupFinishedRoom(roomId: string): Promise<void> {
    try {
      console.log(`🧹 Cleaning up finished room ${roomId}`);

      // Remove all room members
      await db
        .delete(roomMembers)
        .where(eq(roomMembers.roomId, roomId));

      // Mark room as cleaned up (keep for history) or delete it
      await db
        .delete(rooms)
        .where(eq(rooms.id, roomId));

      console.log(`✅ Room ${roomId} cleaned up successfully`);

    } catch (error) {
      console.error('❌ Error cleaning up finished room:', error);
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
   * Gets finished game results for display
   */
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
      
      // Ensure dates are properly converted
      gameState.createdAt = new Date(gameState.createdAt);
      if (gameState.startedAt) gameState.startedAt = new Date(gameState.startedAt);
      if (gameState.finishedAt) gameState.finishedAt = new Date(gameState.finishedAt);
      
      return gameState;

    } catch (error) {
      console.error('❌ Error retrieving finished game:', error);
      return null;
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

  /**
   * **NEW**: Handles player forfeit
   */
  async forfeitPlayer(roomId: string, playerId: string): Promise<GameState | null> {
    try {
      console.log(`🏳️ Player ${playerId} forfeiting game in room ${roomId}`);

      const gameState = await this.getGameState(roomId);
      if (!gameState) {
        throw new Error('No active game found');
      }

      // Check if player is in the game
      const forfeiter = gameState.players.find(p => p.id === playerId);
      if (!forfeiter) {
        throw new Error('Player not found in game');
      }

      // Mark game as finished and determine winner(s)
      const remainingPlayers = gameState.players.filter(p => p.id !== playerId && p.isConnected);
      
      if (remainingPlayers.length === 1) {
        // Single winner
        const winner = remainingPlayers[0];
        gameState.status = 'finished';
        gameState.winner = winner.id;
        gameState.finishedAt = new Date();
      } else if (remainingPlayers.length > 1) {
        // Multiple players remaining - continue with forfeited player removed
        gameState.players = gameState.players.map(p => 
          p.id === playerId ? { ...p, isConnected: false } : p
        );
      } else {
        // All players forfeited/disconnected - end game with no winner
        gameState.status = 'finished';
        gameState.finishedAt = new Date();
      }

      // Save the updated game state
      await this.saveGameState(roomId, gameState);

      console.log(`✅ Player forfeit processed for ${playerId}`);
      return gameState;

    } catch (error) {
      console.error('❌ Error processing forfeit:', error);
      return null;
    }
  }

  /**
   * **NEW**: Manages disconnection timeouts
   */
  private disconnectionTimeouts = new Map<string, NodeJS.Timeout>();

  /**
   * **NEW**: Starts disconnection timeout for a player
   */
  startDisconnectionTimeout(roomId: string, playerId: string, timeoutSeconds: number = 60): void {
    const key = `${roomId}:${playerId}`;
    
    // Clear existing timeout if any
    if (this.disconnectionTimeouts.has(key)) {
      clearTimeout(this.disconnectionTimeouts.get(key)!);
    }

    console.log(`⏱️ Starting ${timeoutSeconds}s disconnection timeout for player ${playerId} in room ${roomId}`);

    const timeout = setTimeout(async () => {
      console.log(`⏰ Disconnection timeout expired for player ${playerId}, auto-forfeiting...`);
      
      try {
        const gameState = await this.forfeitPlayer(roomId, playerId);
        if (gameState) {
          // The socket handler will need to emit events for this
          // We'll store this information for the socket handler to pick up
          this.disconnectionTimeouts.set(`${key}:expired`, setTimeout(() => {}, 0));
        }
      } catch (error) {
        console.error('❌ Error during auto-forfeit:', error);
      }
      
      this.disconnectionTimeouts.delete(key);
    }, timeoutSeconds * 1000);

    this.disconnectionTimeouts.set(key, timeout);
  }

  /**
   * **NEW**: Cancels disconnection timeout (player reconnected)
   */
  cancelDisconnectionTimeout(roomId: string, playerId: string): boolean {
    const key = `${roomId}:${playerId}`;
    
    if (this.disconnectionTimeouts.has(key)) {
      clearTimeout(this.disconnectionTimeouts.get(key)!);
      this.disconnectionTimeouts.delete(key);
      console.log(`✅ Disconnection timeout cancelled for player ${playerId}`);
      return true;
    }
    
    return false;
  }

  /**
   * **NEW**: Checks if player has an active disconnection timeout
   */
  hasDisconnectionTimeout(roomId: string, playerId: string): boolean {
    const key = `${roomId}:${playerId}`;
    return this.disconnectionTimeouts.has(key);
  }
}

// Singleton instance
export const gameStateService = new GameStateService(); 