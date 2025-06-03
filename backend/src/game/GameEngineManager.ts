// backend/src/game/GameEngineManager.ts
import type { 
    GameEngine, 
    GameState, 
    Move, 
    Player, 
    Position, 
    WallOrientation 
  } from '../../../shared/types';
  import { mockQuoridorEngine } from './MockQuoridorEngine';
  import { quoridorEngine } from './QuoridorEngine';
  
  /**
   * GameEngineManager - Abstraction layer for game engine integration
   * 
   * This class provides a clean interface for the future game engine implementation.
   * Currently uses a sophisticated mock engine that implements realistic Quoridor rules.
   * The actual advanced game engine will be plugged in here by another engineer.
   */
  export class GameEngineManager implements GameEngine {
    private engine: GameEngine = quoridorEngine;
  
    constructor() {
      console.log('🎮 GameEngineManager initialized with mock engine');
    }
  
    /**
     * Sets the actual game engine implementation
     * This will be called when the advanced game engine is ready
     */
    setEngine(engine: GameEngine): void {
      this.engine = engine;
      console.log('🚀 Advanced game engine connected - replacing mock engine');
    }
  
    /**
     * Checks if advanced game engine is available
     */
    isEngineReady(): boolean {
      return this.engine !== null;
    }
  
    /**
     * Gets the currently active engine (mock or real)
     */
    private getActiveEngine(): GameEngine {
      return this.engine
    }
  
    // ==========================================
    // GAME ENGINE INTERFACE IMPLEMENTATION
    // ==========================================
  
    createGame(playerIds: string[], maxPlayers: 2 | 4): GameState {
      console.log(`🎲 Creating game with ${this.engine ? 'advanced' : 'mock'} engine`);
      return this.getActiveEngine().createGame(playerIds, maxPlayers);
    }
  
    validateMove(gameState: GameState, move: Omit<Move, 'id' | 'timestamp'>): boolean {
      return this.getActiveEngine().validateMove(gameState, move);
    }
  
    applyMove(gameState: GameState, move: Omit<Move, 'id' | 'timestamp'>): GameState {
      return this.getActiveEngine().applyMove(gameState, move);
    }
  
    isGameFinished(gameState: GameState): boolean {
      return this.getActiveEngine().isGameFinished(gameState);
    }
  
    getWinner(gameState: GameState): string | null {
      return this.getActiveEngine().getWinner(gameState);
    }
  
    getCurrentPlayer(gameState: GameState): Player {
      return this.getActiveEngine().getCurrentPlayer(gameState);
    }
  
    getValidMoves(gameState: GameState, playerId: string): Omit<Move, 'id' | 'timestamp'>[] {
      return this.getActiveEngine().getValidMoves(gameState, playerId);
    }
  
    isValidPawnMove(gameState: GameState, fromPos: Position, toPos: Position, playerId: string): boolean {
      return this.getActiveEngine().isValidPawnMove(gameState, fromPos, toPos, playerId);
    }
  
    isValidWallPlacement(gameState: GameState, wallPos: Position, orientation: WallOrientation): boolean {
      return this.getActiveEngine().isValidWallPlacement(gameState, wallPos, orientation);
    }
  
    hasValidPathToGoal(gameState: GameState, playerId: string): boolean {
      return this.getActiveEngine().hasValidPathToGoal(gameState, playerId);
    }
  
    getPlayerById(gameState: GameState, playerId: string): Player | null {
      return this.getActiveEngine().getPlayerById(gameState, playerId);
    }
  
    getPlayerStartPosition(playerIndex: number, maxPlayers: 2 | 4): Position {
      return this.getActiveEngine().getPlayerStartPosition(playerIndex, maxPlayers);
    }
  
    getPlayerGoalRow(playerIndex: number, maxPlayers: 2 | 4): number {
      return this.getActiveEngine().getPlayerGoalRow(playerIndex, maxPlayers);
    }
  
    // ==========================================
    // ADDITIONAL UTILITY METHODS
    // ==========================================
  
    /**
     * Gets debug information about the current engine
     */
    getEngineInfo(): { type: 'mock' | 'advanced'; ready: boolean } {
      return {
        type: this.engine ? 'advanced' : 'mock',
        ready: this.isEngineReady()
      };
    }
  
    /**
     * Validates a complete game state for consistency
     */
    validateGameState(gameState: GameState): { isValid: boolean; errors: string[] } {
      const errors: string[] = [];
  
      // Basic structure validation
      if (!gameState.players || gameState.players.length === 0) {
        errors.push('No players found');
      }
  
      if (gameState.currentPlayerIndex >= gameState.players.length) {
        errors.push('Invalid current player index');
      }
  
      // Validate player positions
      for (const player of gameState.players) {
        if (player.position.x < 0 || player.position.x > 8 || 
            player.position.y < 0 || player.position.y > 8) {
          errors.push(`Player ${player.id} has invalid position`);
        }
  
        if (player.wallsRemaining < 0) {
          errors.push(`Player ${player.id} has negative walls`);
        }
      }
  
      // Validate walls
      for (const wall of gameState.walls) {
        if (wall.position.x < 0 || wall.position.x > 7 || 
            wall.position.y < 0 || wall.position.y > 7) {
          errors.push(`Wall ${wall.id} has invalid position`);
        }
      }
  
      return {
        isValid: errors.length === 0,
        errors
      };
    }
  
    /**
     * Gets comprehensive game statistics
     */
    getGameStats(gameState: GameState): {
      totalMoves: number;
      wallsPlaced: number;
      currentTurn: number;
      playersAtGoal: number;
    } {
      return {
        totalMoves: gameState.moves.length,
        wallsPlaced: gameState.walls.length,
        currentTurn: Math.floor(gameState.moves.length / gameState.players.length) + 1,
        playersAtGoal: gameState.players.filter(player => {
          const goalRow = this.getPlayerGoalRow(
            gameState.players.indexOf(player),
            gameState.maxPlayers
          );
          return player.position.y === goalRow;
        }).length
      };
    }
  }
  
  // Singleton instance
  export const gameEngineManager = new GameEngineManager();