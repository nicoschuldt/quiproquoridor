import type {
    GameEngine, 
    GameState, 
    Move, 
    Player, 
    Position, 
    WallOrientation 
  } from '../../shared/types';
  import { quoridorEngine } from './QuoridorEngine';

  /**
   * Gestionnaire principal pour les moteurs de jeu Quoridor
   * Pattern proxy permet de basculer entre différents moteurs de jeu
   */
  export class GameEngineManager implements GameEngine {
    private engine: GameEngine = quoridorEngine;
  
    constructor() {
      console.log('GameEngineManager initialized with mock engine');
    }

    // changement dynamique du moteur de jeu si besoin
    setEngine(engine: GameEngine): void {
      this.engine = engine;
    }

    isEngineReady(): boolean {
      return this.engine !== null;
    }

    // récupère l'instance active du moteur
    private getActiveEngine(): GameEngine {
      return this.engine
    }

    createGame(playerIds: string[], maxPlayers: 2 | 4): GameState {
      console.log(`Creating game with ${this.engine ? 'advanced' : 'mock'} engine`);
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

    // vérif chemin valide vers goal - critique pour placement murs
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

    getEngineInfo(): { type: 'mock' | 'advanced'; ready: boolean } {
      return {
        type: this.engine ? 'advanced' : 'mock',
        ready: this.isEngineReady()
      };
    }

    /**
     * Validation complète de l'état de jeu
     * Vérif cohérence positions, murs, joueurs actuel
     */
    validateGameState(gameState: GameState): { isValid: boolean; errors: string[] } {
      const errors: string[] = [];
  
      if (!gameState.players || gameState.players.length === 0) {
        errors.push('No players found');
      }
  
      // vérif index joueur actuel cohérent
      if (gameState.currentPlayerIndex >= gameState.players.length) {
        errors.push('Invalid current player index');
      }
  
      // vérif positions joueurs dans le plateau
      for (const player of gameState.players) {
        if (player.position.x < 0 || player.position.x > 8 || 
            player.position.y < 0 || player.position.y > 8) {
          errors.push(`Player ${player.id} has invalid position`);
        }
  
        if (player.wallsRemaining < 0) {
          errors.push(`Player ${player.id} has negative walls`);
        }
      }
  
      // vérif positions murs valides
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
     * Statistiques utiles pour debug et métriques
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
  
  export const gameEngineManager = new GameEngineManager();