import type { AIEngine, GameState, Move, AIDifficulty } from '../../../shared/types';
import { RandomAI } from './RandomAI';
import { GreedyAI } from "./GreedyAI";

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

    let ai: AIEngine;

    switch (difficulty) {
      case 'easy':
        ai = new RandomAI(difficulty);
        break;
      case 'medium':
        ai = new GreedyAI(difficulty);
        break;
      case 'hard':
        ai = new GreedyAI(difficulty);
        break;
      default:
        console.warn(`Unknown AI difficulty: ${difficulty}. Defaulting to RandomAI (easy).`);
        ai = new RandomAI('easy'); // Fallback par défaut
        break;
    }

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

    try {
        return await ai.generateMove(gameState, playerId);
    } catch (error) {
        console.error(`AIManager: Error during AI move generation for player ${playerId} (difficulty: ${ai.constructor.name}).`, error);
        // Implement a safe fallback move if AI fails catastrophically
        // For example, try to return a random valid move from the current game state
        // This requires access to game logic for getting legal moves.
        // For now, rethrow or throw a more specific error.
        throw new Error(`AI ${playerId} failed to generate a move: ${error instanceof Error ? error.message : String(error)}`);
    }
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