import { v4 as uuidv4 } from 'uuid';
import type {
  GameEngine,
  GameState,
  Move,
  Player,
  Position,
  Wall,
  WallOrientation,
  PlayerColor,
} from '../../shared/types';
import {
  BOARD_SIZE,
  MAX_WALLS_2P,
  MAX_WALLS_4P,
} from '../../shared/types';

/**
 * Moteur de jeu Quoridor - logique complète du jeu
 * Gère règles, validations, pathfinding
 */
export class QuoridorEngine implements GameEngine {
  createGame(playerIds: string[], maxPlayers: 2 | 4): GameState {
    if (playerIds.length < 2 || playerIds.length > 4) {
      throw new Error('Le nombre de joueurs doit être compris entre 2 et 4');
    }
    if (playerIds.length !== maxPlayers) {
      throw new Error(
        `Le nombre de joueurs (${playerIds.length}) ne correspond pas à ${maxPlayers}`
      );
    }

    const colors: PlayerColor[] = ['red', 'blue', 'green', 'yellow'];
    const maxWalls = maxPlayers === 2 ? MAX_WALLS_2P : MAX_WALLS_4P;

    // positionnement initial des joueurs selon nb participants
    const players: Player[] = playerIds.map((id, index) => ({
      id,
      username: `Joueur ${index + 1}`,
      color: colors[index],
      position: this.getPlayerStartPosition(index, maxPlayers),
      wallsRemaining: maxWalls,
      isConnected: true,
      joinedAt: new Date(),
      selectedPawnTheme: 'theme-pawn-default',
      isAI: false,
      aiDifficulty: undefined,
    }));

    const gameState: GameState = {
      id: uuidv4(),
      players,
      walls: [],
      currentPlayerIndex: 0,
      status: 'waiting',
      moves: [],
      maxPlayers,
      createdAt: new Date(),
    };

    gameState.status = 'playing';
    gameState.startedAt = new Date();
    return gameState;
  }

  /**
   * Validation complète d'un coup
   * Vérif joueur actuel, type coup, règles spécifiques
   */
  validateMove(
    gameState: GameState,
    move: Omit<Move, 'id' | 'timestamp'>
  ): boolean {
    if (gameState.status !== 'playing') {
      return false;
    }
    const currentPlayer = this.getCurrentPlayer(gameState);
    if (move.playerId !== currentPlayer.id) {
      return false; // pas le tour du joueur
    }

    if (move.type === 'pawn') {
      // vérif position départ correspond à position actuelle
      if (
        !move.fromPosition ||
        !this.arePositionsEqual(currentPlayer.position, move.fromPosition)
      ) {
        return false;
      }
      return this.isValidPawnMove(
        gameState,
        move.fromPosition!,
        move.toPosition!,
        move.playerId
      );
    } else if (move.type === 'wall') {
      return this.isValidWallPlacement(
        gameState,
        move.wallPosition!,
        move.wallOrientation!
      );
    }

    return false;
  }

  /**
   * Application d'un coup - modifie l'état de jeu
   * Deep copy pour immutabilité
   */
  applyMove(
    gameState: GameState,
    move: Omit<Move, 'id' | 'timestamp'>
  ): GameState {
    const newState: GameState = JSON.parse(JSON.stringify(gameState));

    const fullMove: Move = {
      id: uuidv4(),
      ...move,
      timestamp: new Date(),
    };

    if (move.type === 'pawn') {
      const player = newState.players.find((p) => p.id === move.playerId);
      if (player) {
        player.position = { ...move.toPosition! };
      }
    } else if (move.type === 'wall') {
      const player = newState.players.find((p) => p.id === move.playerId);
      if (player && player.wallsRemaining > 0) {
        newState.walls.push({
          id: uuidv4(),
          position: { ...move.wallPosition! },
          orientation: move.wallOrientation!,
          playerId: move.playerId,
        });
        player.wallsRemaining--;
      } else {
        throw new Error("Le joueur n'a plus de murs disponibles");
      }
    }

    newState.moves.push(fullMove);
    // passage au joueur suivant
    newState.currentPlayerIndex =
      (newState.currentPlayerIndex + 1) % newState.players.length;

    // vérif fin de partie
    if (this.isGameFinished(newState)) {
      newState.status = 'finished';
      newState.finishedAt = new Date();
      const winnerId = this.getWinner(newState);
      if (winnerId) {
        newState.winner = winnerId;
      }
    }

    return newState;
  }

  isGameFinished(gameState: GameState): boolean {
    return gameState.players.some((player, idx) =>
      this.isAtGoal(player.position, idx, gameState.maxPlayers)
    );
  }

  getWinner(gameState: GameState): string | null {
    const winner = gameState.players.find((player, idx) =>
      this.isAtGoal(player.position, idx, gameState.maxPlayers)
    );
    return winner ? winner.id : null;
  }

  getCurrentPlayer(gameState: GameState): Player {
    return gameState.players[gameState.currentPlayerIndex];
  }

  /**
   * Génération de tous les coups valides pour un joueur
   * Utilisé par l'IA pour explorer possibilités
   */
  getValidMoves(
    gameState: GameState,
    playerId: string
  ): Array<Omit<Move, 'id' | 'timestamp'>> {
    const moves: Array<Omit<Move, 'id' | 'timestamp'>> = [];
    const player = this.getPlayerById(gameState, playerId);
    if (!player || this.getCurrentPlayer(gameState).id !== playerId) {
      return [];
    }

    // coups de pion valides
    const validPawnPositions = this.getValidPawnMoves(gameState, player);
    for (const toPos of validPawnPositions) {
      moves.push({
        type: 'pawn',
        playerId,
        fromPosition: { ...player.position },
        toPosition: toPos,
      });
    }

    // placements de murs si il en reste
    if (player.wallsRemaining > 0) {
      for (let x = 0; x < BOARD_SIZE - 1; x++) {
        for (let y = 0; y < BOARD_SIZE - 1; y++) {
          const pos: Position = { x, y };
          if (this.isValidWallPlacement(gameState, pos, 'horizontal')) {
            moves.push({
              type: 'wall',
              playerId,
              wallPosition: { ...pos },
              wallOrientation: 'horizontal',
            });
          }
          if (this.isValidWallPlacement(gameState, pos, 'vertical')) {
            moves.push({
              type: 'wall',
              playerId,
              wallPosition: { ...pos },
              wallOrientation: 'vertical',
            });
          }
        }
      }
    }

    return moves;
  }

  /**
   * Validation déplacement pion
   * Gère déplacements simples et sauts par-dessus adversaires
   */
  isValidPawnMove(
    gameState: GameState,
    fromPos: Position,
    toPos: Position,
    playerId: string
  ): boolean {
    if (!this.isPositionValid(toPos)) {
      return false;
    }

    // vérif case destination libre
    if (gameState.players.some(p => this.arePositionsEqual(p.position, toPos))) {
      return false;
    }

    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;

    // déplacement simple adjacent
    if ((Math.abs(dx) === 1 && dy === 0) || (Math.abs(dy) === 1 && dx === 0)) {
      return !this.isWallBlocking(gameState.walls, fromPos, toPos);
    }

    // saut par-dessus adversaire (distance 2)
    if ((Math.abs(dx) === 2 && dy === 0) || (Math.abs(dy) === 2 && dx === 0)) {
      const middlePos: Position = {
        x: fromPos.x + dx / 2,
        y: fromPos.y + dy / 2,
      };

      // vérif adversaire en position intermédiaire
      const playerAtMiddle = gameState.players.find(p => 
        this.arePositionsEqual(p.position, middlePos)
      );
      if (!playerAtMiddle) {
        return false;
      }

      // vérif pas de mur bloquant les deux segments
      return !this.isWallBlocking(gameState.walls, fromPos, middlePos) &&
             !this.isWallBlocking(gameState.walls, middlePos, toPos);
    }

    return false;
  }

  /**
   * Validation placement mur - règle critique du jeu
   * Vérif position valide + pas de blocage complet des chemins
   */
  isValidWallPlacement(
    gameState: GameState,
    wallPos: Position,
    orientation: WallOrientation
  ): boolean {
    // vérif position dans limites plateau
    if (!this.isWallPositionValid(wallPos, orientation)) {
      return false;
    }

    // vérif pas de collision avec murs existants
    for (const existingWall of gameState.walls) {
      if (this.arePositionsEqual(existingWall.position, wallPos)) {
        return false; // même position
      }

      // vérif intersection perpendiculaire au centre
      if (existingWall.orientation !== orientation) {
        if (orientation === 'horizontal') {
          // nouveau mur horizontal vs existant vertical
          if (existingWall.position.x === wallPos.x + 1 && 
              existingWall.position.y === wallPos.y) {
            return false;
          }
        } else {
          // nouveau mur vertical vs existant horizontal
          if (existingWall.position.x === wallPos.x && 
              existingWall.position.y === wallPos.y + 1) {
            return false;
          }
        }
      }
    }

    // test critique - vérif pas de blocage complet
    const tempWalls = [...gameState.walls, {
      id: 'temp',
      position: wallPos,
      orientation,
      playerId: 'temp'
    }];

    // chaque joueur doit garder un chemin vers son goal
    for (let i = 0; i < gameState.players.length; i++) {
      const player = gameState.players[i];
      if (!this.hasPathToGoalWithWalls(player, gameState.players, tempWalls, gameState.maxPlayers)) {
        return false; // mur bloque complètement ce joueur
      }
    }

    return true;
  }

  /**
   * Pathfinding BFS pour vérifier chemin vers goal
   * Crucial pour validation placement murs
   */
  hasValidPathToGoal(gameState: GameState, playerId: string): boolean {
    const player = this.getPlayerById(gameState, playerId);
    if (!player) return false;
    
    const playerIndex = gameState.players.findIndex(p => p.id === playerId);
    return this.hasPathToGoalWithWalls(player, gameState.players, gameState.walls, gameState.maxPlayers);
  }

  getPlayerById(gameState: GameState, playerId: string): Player | null {
    return gameState.players.find((p) => p.id === playerId) || null;
  }

  getPlayerStartPosition(
    playerIndex: number,
    maxPlayers: 2 | 4
  ): Position {
    const mid = Math.floor(BOARD_SIZE / 2);
    if (maxPlayers === 2) {
      return playerIndex === 0
        ? { x: mid, y: BOARD_SIZE - 1 }
        : { x: mid, y: 0 };
    } else {
      switch (playerIndex) {
        case 0:
          return { x: mid, y: BOARD_SIZE - 1 };
        case 1:
          return { x: BOARD_SIZE - 1, y: mid };
        case 2:
          return { x: mid, y: 0 };
        case 3:
          return { x: 0, y: mid };
        default:
          throw new Error(`Index de joueur invalide: ${playerIndex}`);
      }
    }
  }

  getPlayerGoalRow(
    playerIndex: number,
    maxPlayers: 2 | 4
  ): number {
    if (maxPlayers === 2) {
      return playerIndex === 0 ? 0 : BOARD_SIZE - 1;
    } else {
      switch (playerIndex) {
        case 0:
          return 0;
        case 1:
          return 0;
        case 2:
          return BOARD_SIZE - 1;
        case 3:
          return BOARD_SIZE - 1;
        default:
          throw new Error(`Index de joueur invalide: ${playerIndex}`);
      }
    }
  }

  private isPositionValid(pos: Position): boolean {
    return (
      pos.x >= 0 && pos.x < BOARD_SIZE && pos.y >= 0 && pos.y < BOARD_SIZE
    );
  }

  private arePositionsEqual(pos1: Position, pos2: Position): boolean {
    return pos1.x === pos2.x && pos1.y === pos2.y;
  }

  private getValidPawnMoves(
    gameState: GameState,
    player: Player
  ): Position[] {
    const from = player.position;
    const otherPlayers = gameState.players.filter((p) => p.id !== player.id);
    const destinations: Position[] = [];

    const directions = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
    ];

    for (const dir of directions) {
      const adj: Position = { x: from.x + dir.dx, y: from.y + dir.dy };
      if (!this.isPositionValid(adj)) continue;
      if (this.isWallBlocking(gameState.walls, from, adj)) continue;

      const blockingPawn = otherPlayers.find(
        (p) => p.position.x === adj.x && p.position.y === adj.y
      );
      if (!blockingPawn) {
        destinations.push(adj);
      } else {
        const jump: Position = { x: adj.x + dir.dx, y: adj.y + dir.dy };
        if (
          this.isPositionValid(jump) &&
          !this.isWallBlocking(gameState.walls, adj, jump) &&
          !gameState.players.some(
            (p) => p.position.x === jump.x && p.position.y === jump.y
          )
        ) {
          destinations.push(jump);
        } else {
          const sideDirs =
            dir.dx === 0
              ? [
                  { dx: -1, dy: 0 },
                  { dx: 1, dy: 0 },
                ]
              : [
                  { dx: 0, dy: -1 },
                  { dx: 0, dy: 1 },
                ];

          for (const side of sideDirs) {
            const sidePos: Position = {
              x: adj.x + side.dx,
              y: adj.y + side.dy,
            };
            if (!this.isPositionValid(sidePos)) continue;
            if (
              this.isWallBlocking(gameState.walls, adj, sidePos) ||
              gameState.players.some(
                (p) =>
                  p.position.x === sidePos.x &&
                  p.position.y === sidePos.y
              )
            ) {
              continue;
            }
            destinations.push(sidePos);
          }
        }
      }
    }

    const unique: Position[] = [];
    for (const pos of destinations) {
      if (!unique.some((u) => this.arePositionsEqual(u, pos))) {
        unique.push(pos);
      }
    }
    return unique;
  }

  private isWallBlocking(
    walls: Wall[],
    from: Position,
    to: Position
  ): boolean {
    if (from.x === to.x && Math.abs(from.y - to.y) === 1) {
      if (to.y > from.y) {
        return walls.some(
          (w) =>
            w.orientation === 'horizontal' &&
            w.position.y === from.y &&
            (from.x === w.position.x || from.x === w.position.x + 1)
        );
      } else {
        return walls.some(
          (w) =>
            w.orientation === 'horizontal' &&
            w.position.y === to.y &&
            (from.x === w.position.x || from.x === w.position.x + 1)
        );
      }
    }

    if (from.y === to.y && Math.abs(from.x - to.x) === 1) {
      if (to.x > from.x) {
        return walls.some(
          (w) =>
            w.orientation === 'vertical' &&
            w.position.x === from.x &&
            (from.y === w.position.y || from.y === w.position.y + 1)
        );
      } else {
        return walls.some(
          (w) =>
            w.orientation === 'vertical' &&
            w.position.x === to.x &&
            (from.y === w.position.y || from.y === w.position.y + 1)
        );
      }
    }
    return false;
  }

  private hasPathToGoalWithWalls(
    player: Player,
    allPlayers: Player[],
    walls: Wall[],
    maxPlayers: 2 | 4
  ): boolean {
    const start = player.position;
    const visited = new Set<string>();
    const queue: Position[] = [start];
  
    const playerIndex = allPlayers.findIndex((p) => p.id === player.id);
    if (playerIndex < 0) return false;
  
    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.x},${current.y}`;
      if (visited.has(key)) continue;
      visited.add(key);
  
      if (this.isAtGoal(current, playerIndex, maxPlayers)) {
        return true;
      }
  
      const deltas = [
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
      ];
      for (const delta of deltas) {
        const next: Position = {
          x: current.x + delta.dx,
          y: current.y + delta.dy,
        };
        if (!this.isPositionValid(next)) continue;
        if (this.isWallBlocking(walls, current, next)) continue;
        queue.push(next);
      }
    }
    return false;
  }

  private isWallPositionValid(
    pos: Position,
    orientation: WallOrientation
  ): boolean {
    if (orientation === 'horizontal') {
      return pos.x >= 0 && pos.x < BOARD_SIZE - 1 && pos.y >= 0 && pos.y < BOARD_SIZE - 1;
    } else {
      return pos.x >= 0 && pos.x < BOARD_SIZE - 1 && pos.y >= 0 && pos.y < BOARD_SIZE - 1;
    }
  }

  private isAtGoal(
    pos: Position,
    playerIndex: number,
    maxPlayers: 2 | 4
  ): boolean {
    if (maxPlayers === 2) {
      return playerIndex === 0
        ? pos.y === 0
        : pos.y === BOARD_SIZE - 1;
    } else {
      switch (playerIndex) {
        case 0:
          return pos.y === 0;
        case 1:
          return pos.x === 0;
        case 2:
          return pos.y === BOARD_SIZE - 1;
        case 3:
          return pos.x === BOARD_SIZE - 1;
        default:
          return false;
      }
    }
  }
}

export const quoridorEngine = new QuoridorEngine();
