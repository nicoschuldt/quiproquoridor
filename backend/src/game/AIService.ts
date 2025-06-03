// backend/src/game/AIService.ts

import { MonteCarloAI } from './MonteCarloAI';
import { gameEngineManager } from './GameEngineManager';
import { gameStateService } from './GameStateService';
import type { GameState, Move, Player } from '../../../shared/types';

/**
 * AIService - Handles AI player interactions
 * 
 * This service manages AI moves, providing a clean interface
 * for integrating AI players into the game flow.
 */
export class AIService {
  private readonly monteCarloAI: MonteCarloAI;
  
  constructor(simulationsPerMove = 100) {
    this.monteCarloAI = new MonteCarloAI(simulationsPerMove);
  }
  
  /**
   * Determines if the current player is an AI
   */
  isCurrentPlayerAI(gameState: GameState): boolean {
    const currentPlayer = gameEngineManager.getCurrentPlayer(gameState);
    return currentPlayer && currentPlayer.isAI === true;
  }
  
  /**
   * Gets an AI player from the game state by ID
   */
  getAIPlayer(gameState: GameState, playerId: string): Player | null {
    return gameState.players.find(p => p.id === playerId && p.isAI === true) || null;
  }
  
  /**
   * Makes a move for an AI player
   */
  async makeAIMove(roomId: string, gameState: GameState, aiPlayerId: string): Promise<Omit<Move, 'id' | 'timestamp'>> {
    try {
      console.log(`🤖 AI player ${aiPlayerId} is thinking...`);
      
      // Get AI move using Monte Carlo simulation
      const aiMove = this.monteCarloAI.getBestMove(gameState, aiPlayerId);
      
      console.log(`🤖 AI player ${aiPlayerId} chose move:`, {
        type: aiMove.type,
        fromPosition: aiMove.fromPosition,
        toPosition: aiMove.toPosition,
        wallPosition: aiMove.wallPosition,
        wallOrientation: aiMove.wallOrientation
      });
      
      return aiMove;
    } catch (error) {
      console.error('❌ Error generating AI move:', error);
      throw error;
    }
  }
  
  /**
   * Processes a turn for an AI player by generating and applying a move
   */
  async processAITurn(roomId: string): Promise<Omit<Move, 'id' | 'timestamp'> | null> {
    try {
      // Get current game state
      const gameState = await gameStateService.getGameState(roomId);
      if (!gameState || gameState.status !== 'playing') {
        console.log('⚠️ Cannot process AI turn: game not found or not in playing state');
        return null;
      }
      
      // Check if current player is AI
      const currentPlayer = gameEngineManager.getCurrentPlayer(gameState);
      if (!currentPlayer || !currentPlayer.isAI) {
        console.log('⚠️ Current player is not AI, skipping AI processing');
        return null;
      }
      
      // Get AI move
      const aiMove = await this.makeAIMove(roomId, gameState, currentPlayer.id);
      
      return aiMove;
    } catch (error) {
      console.error('❌ Error processing AI turn:', error);
      throw error;
    }
  }
}

// Singleton instance
export const aiService = new AIService();
