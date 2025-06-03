// backend/src/game/MonteCarloAI.ts

import type {
    GameEngine,
    GameState,
    Move,
    Player,
    Position,
    WallOrientation,
  } from '../../../shared/types';
  import { quoridorEngine } from './QuoridorEngine';
  
  const MAX_PLAYTHROUGH_MOVES = 200; // Max moves per random simulation
  
  /**
   * MonteCarloAI
   *
   * Cette classe permet de choisir un coup pour l'IA grâce à des simulations aléatoires (playouts) 
   * de type Monte Carlo (non MCTS), afin d'estimer pour chaque coup valide le taux de victoire de l'IA.
   */
  export class MonteCarloAI {
    private readonly engine: GameEngine;
    // Nombre de simulations par coup. À ajuster en fonction des performances souhaitées.
    private readonly simulationsPerMove: number;
  
    constructor(simulationsPerMove = 100) {
      // On se base sur le moteur QuoridorEngine (règles de jeu) pour valider/appliquer les coups.
      this.engine = quoridorEngine;
      this.simulationsPerMove = simulationsPerMove;
    }
  
    /**
     * getBestMove
     *
     * @param initialState L'état de jeu courant (avant le coup IA).
     * @param aiPlayerId   L'ID du joueur IA pour lequel on veut choisir un coup.
     * @returns            Un objet Move (sans id ni timestamp) que l'IA estime le plus fort.
     */
    public getBestMove(
      initialState: GameState,
      aiPlayerId: string
    ): Omit<Move, 'id' | 'timestamp'> {
      // 1) On récupère tous les coups valides pour l'IA à cet instant T
      const validMoves = this.engine.getValidMoves(initialState, aiPlayerId);
  
      if (validMoves.length === 0) {
        console.error(`[MonteCarloAI] No valid moves for AI player ${aiPlayerId}. State:`, JSON.stringify(initialState));
        throw new Error(`MonteCarloAI: aucun coup valide pour le joueur IA ${aiPlayerId}`);
      }
  
      console.log(`[MonteCarloAI] Player ${aiPlayerId} calculating best move. Found ${validMoves.length} valid moves.`);
  
      // 2) Pour chaque coup, on va faire des simulations aléatoires pour estimer le taux de victoire
      let bestMove = validMoves[0];
      let bestWinRate = -1;
  
      for (const move of validMoves) {
        console.log(`[MonteCarloAI] Simulating move for player ${aiPlayerId}:`, JSON.stringify(move));
        let aiWins = 0;
  
        // Faire X simulations en faisant ce coup en premier
        for (let i = 0; i < this.simulationsPerMove; i++) {
          // Cloner l'état de jeu initial pour ne pas le modifier
          const simulatedState = this.cloneGameState(initialState);
  
          // Appliquer le coup étudié sur le clone
          const nextState = this.engine.applyMove(simulatedState, move);
  
          // Lancer la simulation aléatoire jusqu'à la fin de la partie
          const winnerId = this.runRandomPlaythrough(nextState, aiPlayerId, i + 1); // Pass aiPlayerId & sim number for context
  
          if (winnerId === aiPlayerId) {
            aiWins++;
          }
        }
  
        const winRate = aiWins / this.simulationsPerMove;
        console.log(`[MonteCarloAI] Win rate for move ${JSON.stringify(move)} for player ${aiPlayerId}: ${winRate.toFixed(2)} (${aiWins}/${this.simulationsPerMove})`);
        // Si ce coup donne un meilleur taux de victoire, on le conserve
        if (winRate > bestWinRate) {
          bestWinRate = winRate;
          bestMove = move;
        }
      }
  
      console.log(`[MonteCarloAI] Best move chosen for player ${aiPlayerId} is ${JSON.stringify(bestMove)} with win rate ${bestWinRate.toFixed(2)}`);
      return bestMove;
    }
  
    /**
     * runRandomPlaythrough
     *
     * À partir d'un état de jeu donné (après avoir appliqué un coup), on effectue
     * des coups choisis aléatoirement parmi ceux valides jusqu'à ce que la partie soit terminée.
     *
     * Retourne l'ID du joueur gagnant à la fin de la simulation.
     */
    private runRandomPlaythrough(simulatedState: GameState, aiPlayerIdContext: string, simulationNumber: number): string | null {
      let state = simulatedState;
      let movesCount = 0;
  
      // Tant que la partie n'est pas terminée, on sélectionne aléatoirement un coup valide pour le joueur courant
      while (!this.engine.isGameFinished(state) && movesCount < MAX_PLAYTHROUGH_MOVES) {
        const currentPlayer = this.engine.getCurrentPlayer(state);
        const moves = this.engine.getValidMoves(state, currentPlayer.id);
  
        if (moves.length === 0) {
          // Théoriquement, cela ne devrait pas arriver si les règles sont correctes
          console.warn(`[MonteCarloAI] runRandomPlaythrough (Sim #${simulationNumber} for AI ${aiPlayerIdContext}): No valid moves for player ${currentPlayer.id}. Current player index: ${state.currentPlayerIndex}, Players: ${state.players.map(p => p.id).join(', ')}. Game moves length: ${state.moves.length}. Breaking simulation.`);
          // Consider logging the state if this happens frequently: console.warn('State:', JSON.stringify(state));
          break;
        }
  
        // Choix aléatoire
        const randomIndex = Math.floor(Math.random() * moves.length);
        const chosenMove = moves[randomIndex];
        state = this.engine.applyMove(state, chosenMove);
        movesCount++;
      }
  
      if (movesCount >= MAX_PLAYTHROUGH_MOVES) {
        console.warn(`[MonteCarloAI] runRandomPlaythrough (Sim #${simulationNumber} for AI ${aiPlayerIdContext}): Simulation reached max moves (${MAX_PLAYTHROUGH_MOVES}) and was aborted. Current player index: ${state.currentPlayerIndex}. Game moves length: ${state.moves.length}.`);
        // Consider logging state if this happens: console.warn('Final state:', JSON.stringify(state));
        return null; // No decisive winner due to timeout
      }
  
      // Une fois terminé, on récupère le gagnant (id du joueur) ou null si ex æquo (rare en Quoridor)
      return this.engine.getWinner(state);
    }
  
    /**
     * cloneGameState
     *
     * Réalise une copie profonde de l'état de jeu. On utilise JSON.parse(JSON.stringify(...))
     * pour cloner la structure (positions, murs, joueurs, etc.). Les Date seront castées en string,
     * mais ça n'impactera pas la logique (on n'a pas besoin des champs Date dans les simulations).
     */
    private cloneGameState(gameState: GameState): GameState {
      // Clone JSON simple : on perd les méthodes, mais on reste avec la même forme d'objet
      const copy: GameState = JSON.parse(JSON.stringify(gameState));
      // Forcer le statut "playing" si nécessaire (dans certains cas, gameState.status pourrait être "waiting" ou autre)
      copy.status = 'playing';
      return copy;
    }
  }
  