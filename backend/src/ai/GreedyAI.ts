import type { AIEngine, GameState, Move, AIDifficulty, Player, Position, Wall } from '../../shared/types';
import { gameEngineManager } from '../game/GameEngineManager';

function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

interface PathNodeInfo {
  position: Position;
  distance: number;
}

const MAX_PATH_DISTANCE = Infinity;

/**
 * IA Gloutonne - stratégie avancée
 * 1. Bloque adversaires proches du goal
 * 2. Sinon avance vers son propre goal
 */
export class GreedyAI implements AIEngine {
  private difficulty: AIDifficulty;
  private thinkingTimeMs: number;
  private opponentCloseThresholdValue: number; // seuil de proximité pour déclencher blocage
  private readonly BOARD_SIZE = 9;

  constructor(difficulty: AIDifficulty = 'medium') {
    this.difficulty = difficulty;
    // hard = plus agressif et réactif
    if (difficulty === 'hard') {
      this.thinkingTimeMs = 400;
      this.opponentCloseThresholdValue = 2; // bloque plus tôt
    } else {
      this.thinkingTimeMs = 100;
      this.opponentCloseThresholdValue = 4;
    }
  }

  // détermination goal selon position joueur et nb participants
  private getPlayerGoal(playerIndex: number, maxPlayers: number): { type: 'row' | 'col', value: number } {
    const maxCoord = this.BOARD_SIZE - 1;

    if (maxPlayers <= 2) {
        if (playerIndex === 0) return { type: 'row', value: 0 }; // haut
        if (playerIndex === 1) return { type: 'row', value: maxCoord }; // bas
        if (maxPlayers === 1 && playerIndex === 0) return { type: 'row', value: 0 };
    } else if (maxPlayers === 4) {
        if (playerIndex === 0) return { type: 'row', value: 0 }; // haut
        if (playerIndex === 1) return { type: 'col', value: 0 }; // gauche
        if (playerIndex === 2) return { type: 'col', value: maxCoord }; // droite
        if (playerIndex === 3) return { type: 'row', value: maxCoord }; // bas
    }
    throw new Error(`Cannot determine goal for playerIndex ${playerIndex} in a game with ${maxPlayers} players. Board size (0-${maxCoord}).`);
  }

  /**
   * Logique principale de l'IA
   * Priorise blocage > avancement propre
   */
  async generateMove(gameState: GameState, playerId: string): Promise<Omit<Move, 'id' | 'timestamp'>> {
    console.log(`${this.getName()} thinking for player ${playerId}...`);
    await this.delay(this.thinkingTimeMs);

    const currentPlayer = gameState.players.find(p => p.id === playerId);
    if (!currentPlayer) {
      throw new Error(`Player ${playerId} not found in gameState`);
    }
    const currentPlayerIndex = gameState.players.findIndex(p => p.id === playerId);
    if (currentPlayerIndex === -1) {
        throw new Error(`Player index for ${playerId} not found`);
    }

    const opponents = gameState.players.filter(p => p.id !== playerId);

    // phase 1: évaluation menace adversaires si on a des murs
    if (opponents.length > 0 && currentPlayer.wallsRemaining > 0) {
      let mostThreateningOpponent: Player | null = null;
      let mostThreateningOpponentIndex = -1;
      let minOpponentPathToGoal = MAX_PATH_DISTANCE;

      // trouve l'adversaire le plus proche de son goal
      for (const opp of opponents) {
        const oppIndex = gameState.players.findIndex(p => p.id === opp.id);
        if (oppIndex === -1) {
            console.warn(`Could not find index for opponent ${opp.id}`);
            continue;
        }

        const oppPathLength = this.computeShortestPath(opp.position, gameState, opp.id, oppIndex);
        
        console.log(`Opponent ${opp.id} (P${oppIndex}) is ${oppPathLength} moves away from their goal.`);

        if (oppPathLength < minOpponentPathToGoal) {
          minOpponentPathToGoal = oppPathLength;
          mostThreateningOpponent = opp;
          mostThreateningOpponentIndex = oppIndex;
        }
      }

      // tentative blocage si adversaire trop proche
      if (mostThreateningOpponent && mostThreateningOpponentIndex !== -1) {
        if (minOpponentPathToGoal <= this.opponentCloseThresholdValue) {
          console.log(`Opponent ${mostThreateningOpponent.id} (P${mostThreateningOpponentIndex}) is close (${minOpponentPathToGoal} moves)! Attempting to block.`);
          const blockingWallMove = this.chooseBlockingWallMove(currentPlayer, mostThreateningOpponent, mostThreateningOpponentIndex, gameState, minOpponentPathToGoal);
          if (blockingWallMove) {
            console.log(`${this.getName()} chose blocking wall for ${mostThreateningOpponent.id}: ${JSON.stringify(blockingWallMove.wallPosition)} ${blockingWallMove.wallOrientation}`);
            return blockingWallMove;
          }
          console.log(`Could not find an effective blocking wall for ${mostThreateningOpponent.id}.`);
        }
      }
    }

    // phase 2: avancement vers son propre goal
    const pawnMove = this.chooseGreedyPawnMove(currentPlayer, gameState, currentPlayerIndex);
    if (pawnMove) {
      console.log(`${this.getName()} chose greedy pawn move to Y:${pawnMove.toPosition?.y}, X:${pawnMove.toPosition?.x}`);
      return pawnMove;
    }

    // fallback: coup aléatoire si bloqué
    console.warn(`${this.getName()} could not find a strategic move. Making a random move.`);
    return this.getRandomMove(gameState, playerId);
  }

  /**
   * Sélection coup de pion optimal (plus proche du goal)
   */
  private chooseGreedyPawnMove(
    player: Player,
    gameState: GameState,
    playerIndex: number
  ): Omit<Move, 'id' | 'timestamp'> | null {
    const validPawnMoves = gameEngineManager.getValidMoves(gameState, player.id)
      .filter(move => move.type === 'pawn' && move.toPosition);

    if (validPawnMoves.length === 0) {
      return null;
    }

    let bestMove: Omit<Move, 'id' | 'timestamp'> | null = null;
    let minDistance = MAX_PATH_DISTANCE;

    // teste chaque coup possible et garde le meilleur
    for (const pawnMove of validPawnMoves) {
      if (!pawnMove.toPosition) continue;
      const simulatedGameState = deepCopy(gameState);
      const playerInSimulatedState = simulatedGameState.players.find(p => p.id === player.id)!;
      playerInSimulatedState.position = pawnMove.toPosition;
      const distance = this.computeShortestPath(pawnMove.toPosition, simulatedGameState, player.id, playerIndex);
      if (distance < minDistance) {
        minDistance = distance;
        bestMove = pawnMove;
      }
    }
    return bestMove;
  }

  /**
   * Recherche du meilleur mur pour bloquer un adversaire
   * Teste tous placements possibles et garde celui qui rallonge le plus le chemin
   */
  private chooseBlockingWallMove(
    currentPlayer: Player,
    opponent: Player,
    opponentIndex: number,
    gameState: GameState,
    opponentCurrentPath: number
  ): Omit<Move, 'id' | 'timestamp'> | null {
    if (currentPlayer.wallsRemaining === 0) return null;
    const validWallMoves = gameEngineManager.getValidMoves(gameState, currentPlayer.id)
        .filter(move => move.type === 'wall' && move.wallPosition && move.wallOrientation);
    if (validWallMoves.length === 0) return null;
    let bestBlockEffect = 0;
    let bestWallMove: Omit<Move, 'id' | 'timestamp'> | null = null;

    // évalue chaque placement de mur possible
    for (const wallMove of validWallMoves) {
      const simulatedState = deepCopy(gameState);
      const newWall: Wall = {
          id: `sim_wall_${Date.now()}`,
          playerId: currentPlayer.id,
          position: wallMove.wallPosition!,
          orientation: wallMove.wallOrientation!
      };
      simulatedState.walls.push(newWall);
      const playerInSimulatedState = simulatedState.players.find(p => p.id === currentPlayer.id)!;
      playerInSimulatedState.wallsRemaining--;
      const newOpponentPath = this.computeShortestPath(opponent.position, simulatedState, opponent.id, opponentIndex);

      // mur parfait = bloque complètement
      if (newOpponentPath === MAX_PATH_DISTANCE && opponentCurrentPath !== MAX_PATH_DISTANCE) {
        console.log(`Found optimal blocking wall for opponent ${opponent.id}: ${JSON.stringify(wallMove.wallPosition)} ${wallMove.wallOrientation}`);
        return wallMove; 
      }

      // sinon garde celui qui rallonge le plus
      const blockEffect = newOpponentPath - opponentCurrentPath;

      if (blockEffect > bestBlockEffect) {
        bestBlockEffect = blockEffect;
        bestWallMove = wallMove;
      }
    }
    
    if (bestBlockEffect > 0) {
        console.log(`Best blocking wall for ${opponent.id} increases path by ${bestBlockEffect}: ${JSON.stringify(bestWallMove?.wallPosition)} ${bestWallMove?.wallOrientation}`);
    }
    return bestWallMove; 
  }

  /**
   * BFS pathfinding avec gestion des murs
   * Calcule distance exacte vers goal en tenant compte obstacles
   */
  private computeShortestPath(
    startPosition: Position,
    gameState: GameState,
    playerId: string,
    playerIndexForGoal: number
  ): number {
    const goal = this.getPlayerGoal(playerIndexForGoal, gameState.maxPlayers);
    const queue: PathNodeInfo[] = [{ position: startPosition, distance: 0 }];
    const visited: Set<string> = new Set([`${startPosition.y},${startPosition.x}`]);
    // directions possibles: adjacentes + sauts + diagonales
    const DIRS: Array<[number, number]> = [
      [-1, 0], [1, 0], [0, -1], [0, 1], // adjacentes
      [-2, 0], [2, 0], [0, -2], [0, 2], // sauts
      [-1, -1], [-1, 1], [1, -1], [1, 1] // diagonales
    ];

    let playerForPathfinding = gameState.players.find(p => p.id === playerId);
    if (!playerForPathfinding) return MAX_PATH_DISTANCE;

    // BFS classique
    while (queue.length > 0) {
      const current = queue.shift()!;
      
      // vérif si arrivé au goal
      if (goal.type === 'row' && current.position.y === goal.value) {
        return current.distance;
      }
      if (goal.type === 'col' && current.position.x === goal.value) {
        return current.distance;
      }

      // exploration voisins
      for (const [dy, dx] of DIRS) {
        const newPos: Position = {
          x: current.position.x + dx,
          y: current.position.y + dy,
        };

        const posKey = `${newPos.y},${newPos.x}`;
        if (visited.has(posKey)) continue;

        // validation coup possible depuis position actuelle
        if (gameEngineManager.isValidPawnMove(gameState, current.position, newPos, playerId)) {
          visited.add(posKey);
          queue.push({ position: newPos, distance: current.distance + 1 });
        }
      }
    }

    return MAX_PATH_DISTANCE; // pas de chemin trouvé
  }

  // fallback - coup aléatoire si stratégie échoue
  private async getRandomMove(gameState: GameState, playerId: string): Promise<Omit<Move, 'id' | 'timestamp'>> {
    const validMoves = gameEngineManager.getValidMoves(gameState, playerId);
    if (validMoves.length === 0) {
      throw new Error(`No valid moves available for AI player ${playerId}`);
    }
    const randomIndex = Math.floor(Math.random() * validMoves.length);
    return validMoves[randomIndex];
  }

  getDifficulty(): AIDifficulty {
    return this.difficulty;
  }

  getName(): string {
    return `GreedyAI (${this.difficulty})`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
