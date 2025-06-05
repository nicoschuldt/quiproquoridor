import type { AIEngine, GameState, Move, AIDifficulty } from '../shared/types';
import { gameEngineManager } from '../game/GameEngineManager';

export class RandomAI implements AIEngine {
  private difficulty: AIDifficulty;
  private thinkingTimeMs: number;

  constructor(difficulty: AIDifficulty = 'easy') {
    this.difficulty = difficulty;
    this.thinkingTimeMs = 0;
  }

  async generateMove(gameState: GameState, playerId: string): Promise<Omit<Move, 'id' | 'timestamp'>> {
    console.log(`🤖 ${this.getName()} thinking for player ${playerId}...`);
    
    await this.delay(this.thinkingTimeMs);
    const validMoves = gameEngineManager.getValidMoves(gameState, playerId);
    if (validMoves.length === 0) {
      throw new Error(`No valid moves available for AI player ${playerId}`);
    }

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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function createAI(difficulty: AIDifficulty): RandomAI {
  return new RandomAI(difficulty);
} 