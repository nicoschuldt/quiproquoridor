import type { AIEngine, GameState, Move, AIDifficulty } from '../../../shared/types';
import { RandomAI } from './RandomAI';

/**
 * AIManager - Manages AI players and their move generation
 * 
 * This service handles all AI-related operations including creating AI instances,
 * generating moves, and managing AI player lifecycles.
 */
export class AIManager {
  private aiInstances = new Map<string, AIEngine>();

  /**
   * Creates an AI instance for a player
   */
  createAI(playerId: string, difficulty: AIDifficulty): AIEngine {
    console.log(`🤖 Creating AI instance for player ${playerId} with difficulty ${difficulty}`);
    
    const ai = new RandomAI(difficulty);
    this.aiInstances.set(playerId, ai);
    
    return ai;
  }

  /**
   * Gets an AI instance for a player
   */
  getAI(playerId: string): AIEngine | null {
    return this.aiInstances.get(playerId) || null;
  }

  /**
   * Generates a move for an AI player
   */
  async generateMove(gameState: GameState, playerId: string): Promise<Omit<Move, 'id' | 'timestamp'>> {
    const ai = this.getAI(playerId);
    if (!ai) {
      throw new Error(`No AI instance found for player ${playerId}`);
    }

    return ai.generateMove(gameState, playerId);
  }

  /**
   * Checks if a player is an AI
   */
  isAIPlayer(gameState: GameState, playerId: string): boolean {
    const player = gameState.players.find(p => p.id === playerId);
    return player?.isAI || false;
  }

  /**
   * Removes an AI instance (cleanup)
   */
  removeAI(playerId: string): void {
    if (this.aiInstances.has(playerId)) {
      console.log(`🗑️ Removing AI instance for player ${playerId}`);
      this.aiInstances.delete(playerId);
    }
  }

  /**
   * Gets the current number of AI instances
   */
  getActiveAICount(): number {
    return this.aiInstances.size;
  }

  /**
   * Clears all AI instances (for cleanup)
   */
  clearAll(): void {
    console.log(`🧹 Clearing all AI instances (${this.aiInstances.size} total)`);
    this.aiInstances.clear();
  }
}

// Singleton instance
export const aiManager = new AIManager(); 