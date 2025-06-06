import type { AIEngine, GameState, Move, AIDifficulty } from '../../shared/types';
import { RandomAI } from './RandomAI';
import { GreedyAI } from "./GreedyAI";

/**
 * Gestionnaire central des IA
 * Factory pattern pour créer différents types d'IA selon difficulté
 */
export class AIManager {
  private aiInstances = new Map<string, AIEngine>();

  /**
   * Création d'une instance IA pour un joueur
   * Mapping difficulté -> type d'IA
   */
  createAI(playerId: string, difficulty: AIDifficulty): AIEngine {
    console.log(`Creating AI instance for player ${playerId} with difficulty ${difficulty}`);

    let ai: AIEngine;

    // sélection algorithme selon difficulté
    switch (difficulty) {
      case 'easy':
        ai = new RandomAI(difficulty);
        break;
      case 'medium':
        ai = new GreedyAI(difficulty); // algo glouton
        break;
      case 'hard':
        ai = new GreedyAI(difficulty); // même algo mais plus agressif
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

  /**
   * Génération d'un coup par l'IA
   * Point d'entrée principal pour tous les appels IA
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
        throw new Error(`AI ${playerId} failed to generate a move: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const aiManager = new AIManager();