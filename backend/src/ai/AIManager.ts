import type { AIEngine, GameState, Move, AIDifficulty } from '../shared/types';
import { RandomAI } from './RandomAI';
import { GreedyAI } from "./GreedyAI";

export class AIManager {
  private aiInstances = new Map<string, AIEngine>();

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
        ai = new RandomAI('easy');
        break;
    }

    this.aiInstances.set(playerId, ai);
    return ai;
  }

  getAI(playerId: string): AIEngine | null {
    return this.aiInstances.get(playerId) || null;
  }

  async generateMove(gameState: GameState, playerId: string): Promise<Omit<Move, 'id' | 'timestamp'>> {
    const ai = this.getAI(playerId);
    if (!ai) {
      throw new Error(`No AI instance found for player ${playerId}`);
    }

    try {
        return await ai.generateMove(gameState, playerId);
    } catch (error) {
        console.error(`AIManager: Error during AI move generation for player ${playerId} (difficulty: ${ai.constructor.name}).`, error);
        throw new Error(`AI ${playerId} failed to generate a move: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  isAIPlayer(gameState: GameState, playerId: string): boolean {
    const player = gameState.players.find(p => p.id === playerId);
    return player?.isAI || false;
  }

  removeAI(playerId: string): void {
    if (this.aiInstances.has(playerId)) {
      console.log(`🗑️ Removing AI instance for player ${playerId}`);
      this.aiInstances.delete(playerId);
    }
  }

  getActiveAICount(): number {
    return this.aiInstances.size;
  }

  clearAll(): void {
    console.log(`🧹 Clearing all AI instances (${this.aiInstances.size} total)`);
    this.aiInstances.clear();
  }
}

export const aiManager = new AIManager();