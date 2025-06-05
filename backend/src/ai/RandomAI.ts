import type { AIEngine, GameState, Move, AIDifficulty } from '../../shared/types';
import { gameEngineManager } from '../game/GameEngineManager';

/**
 * RandomAI - A simple AI that makes random valid moves
 * 
 * This is the basic AI implementation that will be used for testing
 * and as a fallback. More sophisticated AIs can be implemented later.
 */
export class RandomAI implements AIEngine {
  private difficulty: AIDifficulty;
  private thinkingTimeMs: number;

  constructor(difficulty: AIDifficulty = 'easy') {
    this.difficulty = difficulty;
    this.thinkingTimeMs = 0; // 0.5 seconds
  }

  async generateMove(gameState: GameState, playerId: string): Promise<Omit<Move, 'id' | 'timestamp'>> {
    console.log(`🤖 ${this.getName()} thinking for player ${playerId}...`);
    
    // Simulate thinking time
    await this.delay(this.thinkingTimeMs);
    
    // Get all valid moves for the player
    const validMoves = gameEngineManager.getValidMoves(gameState, playerId);
    
    if (validMoves.length === 0) {
      throw new Error(`No valid moves available for AI player ${playerId}`);
    }
    
    // For now, just pick a random move
    // TODO: Add more sophisticated move selection based on difficulty
    const randomIndex = Math.floor(Math.random() * validMoves.length);
    const selectedMove = validMoves[randomIndex];
    
    console.log(`🤖 ${this.getName()} selected ${selectedMove.type} move`);
    return selectedMove;
  }

  getDifficulty(): AIDifficulty {
    return this.difficulty;
  }

  getName(): string {
    return `RandomAI (${this.difficulty})`;
  }

  /**
   * Simple delay utility for simulating thinking time
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function to create AI instances
export function createAI(difficulty: AIDifficulty): RandomAI {
  return new RandomAI(difficulty);
} 