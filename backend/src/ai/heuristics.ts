import type { GameState, Player, Position, Move, WallOrientation } from '../../../shared/types';
import { gameEngineManager } from '../game/GameEngineManager';
import { randomChoice, indicesOfMin, indicesOfMax } from './aiUtils';

const QUORIDOR_BOARD_DIMENSION = 9; // 9×9 pawn cells
const QUORIDOR_WALL_DIMENSION = 8;  // 8×8 wall placements

export interface FullShortestPathResult {
  distanceToGoal: number;
  pathToGoal: Position[];
  goalPosition: Position | null;
  allDistances: Map<string, number>;
  predecessorMap: Map<string, Position | null>;
}

function posToKey(pos: Position): string {
  return `${pos.x},${pos.y}`;
}

/**
 * BFS from player's current position to every reachable cell, recording
 * distances, predecessors, and stopping early if reaching the goal line.
 */
export function computeShortestPathData(
  playerOrPlayerId: Player | string,
  gameState: GameState
): FullShortestPathResult {
  const player: Player | undefined =
    typeof playerOrPlayerId === 'string'
      ? gameState.players.find((p) => p.id === playerOrPlayerId)
      : playerOrPlayerId;
  if (!player) {
    return {
      distanceToGoal: Infinity,
      pathToGoal: [],
      goalPosition: null,
      allDistances: new Map(),
      predecessorMap: new Map()
    };
  }

  const playerIndex = gameState.players.findIndex((p) => p.id === player.id);
  if (playerIndex === -1) {
    return {
      distanceToGoal: Infinity,
      pathToGoal: [],
      goalPosition: null,
      allDistances: new Map(),
      predecessorMap: new Map()
    };
  }

  const goalY = gameEngineManager.getPlayerGoalRow(playerIndex, gameState.maxPlayers);

  // BFS queue
  const queue: Array<{ position: Position; dist: number }> = [];
  const distances = new Map<string, number>();
  const predecessors = new Map<string, Position | null>();

  const startKey = posToKey(player.position);
  distances.set(startKey, 0);
  predecessors.set(startKey, null);
  queue.push({ position: player.position, dist: 0 });

  let closestGoalPosition: Position | null = null;
  let minGoalDistance = Infinity;

  let head = 0;
  while (head < queue.length) {
    const { position: curPos, dist: curDist } = queue[head++];
    // If curPos is on the goal row, update closestGoalDistance
    if (curPos.y === goalY) {
      if (curDist < minGoalDistance) {
        minGoalDistance = curDist;
        closestGoalPosition = curPos;
      }
    }

    // Temporarily move the player's pawn in a cloned state so that getValidMoves from that position is correct
    const playerCloneState: GameState = {
      ...gameState,
      players: gameState.players.map((p) =>
        p.id === player.id ? { ...p, position: curPos } : { ...p }
      ),
      currentPlayerIndex: playerIndex
    };
    const validMoves = gameEngineManager.getValidMoves(playerCloneState, player.id);
    const validPawnMoves = validMoves.filter((m) => m.type === 'pawn' && m.toPosition);

    for (const m of validPawnMoves) {
      const nextPos = m.toPosition!;
      const key = posToKey(nextPos);
      const newDist = curDist + 1;
      if (!distances.has(key) || newDist < (distances.get(key) ?? Infinity)) {
        distances.set(key, newDist);
        predecessors.set(key, curPos);
        queue.push({ position: nextPos, dist: newDist });
      }
    }
  }

  // Reconstruct the path to the closest goal, if any
  const result: FullShortestPathResult = {
    distanceToGoal: minGoalDistance === Infinity ? Infinity : minGoalDistance,
    pathToGoal: [],
    goalPosition: minGoalDistance === Infinity ? null : closestGoalPosition!,
    allDistances: distances,
    predecessorMap: predecessors
  };

  if (closestGoalPosition) {
    const path: Position[] = [];
    let cur: Position | null = closestGoalPosition;
    while (cur) {
      path.unshift(cur);
      const predKey = posToKey(cur);
      cur = predecessors.get(predKey) ?? null;
    }
    result.pathToGoal = path;
  }

  return result;
}

/** Computes only the shortest‐distance integer (convenience) */
export function computeShortestDistance(
  playerOrPlayerId: Player | string,
  gameState: GameState
): number {
  return computeShortestPathData(playerOrPlayerId, gameState).distanceToGoal;
}

/**
 * “Are the two pawns adjacent (orthogonally)?”
 */
export function arePawnsAdjacent(
  gameState: GameState,
  p1Id: string,
  p2Id: string
): boolean {
  const p1 = gameState.players.find((p) => p.id === p1Id);
  const p2 = gameState.players.find((p) => p.id === p2Id);
  if (!p1 || !p2) return false;
  const dx = Math.abs(p1.position.x - p2.position.x);
  const dy = Math.abs(p1.position.y - p2.position.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

/**
 * Creates a map from each cell’s key “x,y” → the next cell on a shortest path to goal.
 * If a cell is the goal itself (or unreachable), the value is null.
 */
export function getShortestPathNextStepMap(
  gameState: GameState,
  playerId: string,
  pathData?: FullShortestPathResult
): Map<string, Position | null> {
  const data = pathData || computeShortestPathData(playerId, gameState);
  const { goalPosition, predecessorMap, allDistances } = data;
  const nextMap = new Map<string, Position | null>();
  if (!goalPosition) return nextMap;

  for (const [posKey, _d] of allDistances) {
    const [xStr, yStr] = posKey.split(',');
    const current: Position = { x: parseInt(xStr), y: parseInt(yStr) };
    const path: Position[] = [];
    let trace: Position | null = goalPosition;
    let safety = 0;
    // Reconstruct reversed path from goal to start, to check if 'current' lies on it
    while (trace) {
      path.unshift(trace);
      if (trace.x === current.x && trace.y === current.y) break;
      // ←— Here we explicitly annotate `pred` as Position | null
      const pred: Position | null = predecessorMap.get(posToKey(trace)) ?? null;
      trace = pred;
      if (++safety > QUORIDOR_BOARD_DIMENSION * QUORIDOR_BOARD_DIMENSION) {
        trace = null;
        break;
      }
    }
    if (path.length > 1 && path[0].x === current.x && path[0].y === current.y) {
      nextMap.set(posKey, path[1]);
    } else {
      nextMap.set(posKey, null);
    }
  }
  return nextMap;
}

/**
 * As in the original JS: choose every valid pawn move that lies on some shortest path.
 */
export function chooseShortestPathNextPawnMoves(
  gameState: GameState,
  playerId: string
): Position[] {
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) return [];
  const data = computeShortestPathData(player, gameState);
  if (data.distanceToGoal === Infinity || !data.goalPosition) return [];

  // Gather all valid pawn‐moves from current position
  const validMoves = gameEngineManager.getValidMoves(gameState, playerId);
  const pawnMoves = validMoves.filter((m) => m.type === 'pawn' && m.toPosition);

  const candidates: Position[] = [];
  for (const m of pawnMoves) {
    // Simulate moving the pawn in a clone so we can compute the new distance
    const cloneState = JSON.parse(JSON.stringify(gameState)) as GameState;
    const clonePlayer = cloneState.players.find((p) => p.id === playerId)!;
    clonePlayer.position = m.toPosition!;
    cloneState.currentPlayerIndex = cloneState.players.findIndex((p) => p.id === playerId);

    const newDist = computeShortestDistance(clonePlayer, cloneState);
    if (newDist + 1 === data.distanceToGoal) {
      candidates.push(m.toPosition!);
    }
  }
  return candidates;
}

/**
 * As in the original JS: choose pawn moves leading to the longest shortest‐path distance.
 */
export function chooseLongestPathNextPawnMoves(
  gameState: GameState,
  playerId: string
): Position[] {
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) return [];

  // Gather valid pawn‐moves
  const validMoves = gameEngineManager.getValidMoves(gameState, playerId);
  const pawnMoves = validMoves.filter((m) => m.type === 'pawn' && m.toPosition);

  if (pawnMoves.length === 0) return [];

  let longestDist = -1;
  const result: Position[] = [];

  for (const m of pawnMoves) {
    const cloneState = JSON.parse(JSON.stringify(gameState)) as GameState;
    const clonePlayer = cloneState.players.find((p) => p.id === playerId)!;
    clonePlayer.position = m.toPosition!;
    cloneState.currentPlayerIndex = cloneState.players.findIndex((p) => p.id === playerId);

    const dist = computeShortestDistance(clonePlayer, cloneState);
    if (dist > longestDist) {
      longestDist = dist;
      result.length = 0;
      result.push(m.toPosition!);
    } else if (dist === longestDist) {
      result.push(m.toPosition!);
    }
  }
  return result;
}

/**
 * Return all valid wall moves that do NOT block any player’s path to their goal.
 * Simple filter of gameEngineManager.getValidMoves + BFS check.
 */
export function getProbableValidNoBlockWallMoves(
  gameState: GameState,
  playerId: string
): Omit<Move, 'id' | 'timestamp'>[] {
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player || player.wallsRemaining === 0) return [];

  const validMoves = gameEngineManager.getValidMoves(gameState, playerId);
  const wallMoves = validMoves.filter(
    (m) => m.type === 'wall' && m.wallPosition && m.wallOrientation
  );

  const result: Omit<Move, 'id' | 'timestamp'>[] = [];
  for (const w of wallMoves) {
    // Apply the wall in a clone
    const cloneState = JSON.parse(JSON.stringify(gameState)) as GameState;
    try {
      const after = gameEngineManager.applyMove(cloneState, w);
      // Check every player still has a finite path
      let ok = true;
      for (const p of after.players) {
        if (computeShortestPathData(p, after).distanceToGoal === Infinity) {
          ok = false;
          break;
        }
      }
      if (ok) result.push(w);
    } catch {
      // skip invalid
    }
  }
  return result;
}

/**
 * Build and return { distances, multiPredecessorMap } for every reachable cell
 * (Used by getValidNextWallsDisturbPathOf).
 */
export interface AllShortestPathsResult {
  distances: Map<string, number>;
  multiPredecessorMap: Map<string, Position[]>;
}

export function getAllShortestPathsToEveryPosition(
  playerOrPlayerId: Player | string,
  gameState: GameState
): AllShortestPathsResult {
  const player: Player | undefined =
    typeof playerOrPlayerId === 'string'
      ? gameState.players.find((p) => p.id === playerOrPlayerId)
      : playerOrPlayerId;
  if (!player) return { distances: new Map(), multiPredecessorMap: new Map() };

  const distances = new Map<string, number>();
  const multiPredecessorMap = new Map<string, Position[]>();
  const queue: Position[] = [];

  const startKey = posToKey(player.position);
  distances.set(startKey, 0);
  multiPredecessorMap.set(startKey, []);
  queue.push(player.position);

  let head = 0;
  while (head < queue.length) {
    const curPos = queue[head++];
    const curKey = posToKey(curPos);
    const curDist = distances.get(curKey)!;

    const cloneState = {
      ...gameState,
      players: gameState.players.map((p) =>
        p.id === player.id ? { ...p, position: curPos } : { ...p }
      ),
      currentPlayerIndex: gameState.players.findIndex((p) => p.id === player.id)
    } as GameState;
    const validMoves = gameEngineManager.getValidMoves(cloneState, player.id).filter(
      (m) => m.type === 'pawn' && m.toPosition
    );

    for (const m of validMoves) {
      const nxt = m.toPosition!;
      const nxtKey = posToKey(nxt);
      const newDist = curDist + 1;

      if (!distances.has(nxtKey) || newDist < (distances.get(nxtKey) as number)) {
        distances.set(nxtKey, newDist);
        multiPredecessorMap.set(nxtKey, [curPos]);
        queue.push(nxt);
      } else if (distances.has(nxtKey) && newDist === (distances.get(nxtKey) as number)) {
        const arr = multiPredecessorMap.get(nxtKey) ?? [];
        arr.push(curPos);
        multiPredecessorMap.set(nxtKey, arr);
      }
    }
  }

  return { distances, multiPredecessorMap };
}

/**
 * Identify “disturbing” wall placements for the opponent’s shortest paths,
 * plus walls adjacent to the opponent’s pawn. Corresponds to JS’s getValidNextWallsDisturbPathOf.
 */
export function getValidNextWallsDisturbPathOf(
  opponentPlayer: Player,
  gameState: GameState,
  opponentPathsResult: AllShortestPathsResult
): Omit<Move, 'id' | 'timestamp'>[] {
  const result: Omit<Move, 'id' | 'timestamp'>[] = [];
  const candidateKeys = new Set<string>();

  const { distances, multiPredecessorMap } = opponentPathsResult;
  const opponentIndex = gameState.players.findIndex((p) => p.id === opponentPlayer.id);
  if (opponentIndex === -1) return result;
  const goalY = gameEngineManager.getPlayerGoalRow(opponentIndex, gameState.maxPlayers);

  // 1) Collect all goal‐line positions that are reachable
  const goalPositions: Position[] = [];
  for (let x = 0; x < QUORIDOR_BOARD_DIMENSION; x++) {
    const key = posToKey({ x, y: goalY });
    if (distances.has(key) && distances.get(key)! < Infinity) {
      goalPositions.push({ x, y: goalY });
    }
  }

  // BFS‐like traceback from each goalPosition to collect wall positions that block shortest paths
  const visitedTrace = new Set<string>();
  const queue: Position[] = [...goalPositions];
  let head = 0;

  while (head < queue.length) {
    const cur = queue[head++];
    const curKey = posToKey(cur);
    const preds = multiPredecessorMap.get(curKey) || [];

    for (const prev of preds) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      // If prev -> cur is a vertical move
      if (dx === 0 && dy === -1) {
        // Moved up: wall must be placed horizontally above prev
        if (prev.x < QUORIDOR_WALL_DIMENSION) {
          candidateKeys.add(`${prev.x},${prev.y - 1},H`);
        }
        if (prev.x > 0) {
          candidateKeys.add(`${prev.x - 1},${prev.y - 1},H`);
        }
      } else if (dx === 0 && dy === 1) {
        // Moved down: wall horizontally at (prev.x, prev.y)
        if (prev.x < QUORIDOR_WALL_DIMENSION) {
          candidateKeys.add(`${prev.x},${prev.y},H`);
        }
        if (prev.x > 0) {
          candidateKeys.add(`${prev.x - 1},${prev.y},H`);
        }
      } else if (dx === -1 && dy === 0) {
        // Moved left: wall vertical to left of prev
        if (prev.y < QUORIDOR_WALL_DIMENSION) {
          candidateKeys.add(`${prev.x - 1},${prev.y},V`);
        }
        if (prev.y > 0) {
          candidateKeys.add(`${prev.x - 1},${prev.y - 1},V`);
        }
      } else if (dx === 1 && dy === 0) {
        // Moved right: wall vertical at (prev.x, prev.y)
        if (prev.y < QUORIDOR_WALL_DIMENSION) {
          candidateKeys.add(`${prev.x},${prev.y},V`);
        }
        if (prev.y > 0) {
          candidateKeys.add(`${prev.x},${prev.y - 1},V`);
        }
      }

      const prevKey = posToKey(prev);
      if (!visitedTrace.has(prevKey)) {
        visitedTrace.add(prevKey);
        queue.push(prev);
      }
    }
  }

  // 2) Add walls immediately adjacent to the opponent’s current pawn
  const op = opponentPlayer.position;
  // Above
  if (op.y > 0) {
    if (op.x > 0) candidateKeys.add(`${op.x - 1},${op.y - 1},H`);
    if (op.x < QUORIDOR_WALL_DIMENSION) candidateKeys.add(`${op.x},${op.y - 1},H`);
  }
  // Below
  if (op.y < QUORIDOR_WALL_DIMENSION) {
    if (op.x > 0) candidateKeys.add(`${op.x - 1},${op.y},H`);
    if (op.x < QUORIDOR_WALL_DIMENSION) candidateKeys.add(`${op.x},${op.y},H`);
  }
  // Left
  if (op.x > 0) {
    if (op.y > 0) candidateKeys.add(`${op.x - 1},${op.y - 1},V`);
    if (op.y < QUORIDOR_WALL_DIMENSION) candidateKeys.add(`${op.x - 1},${op.y},V`);
  }
  // Right
  if (op.x < QUORIDOR_WALL_DIMENSION) {
    if (op.y > 0) candidateKeys.add(`${op.x},${op.y - 1},V`);
    if (op.y < QUORIDOR_WALL_DIMENSION) candidateKeys.add(`${op.x},${op.y},V`);
  }

  // 3) Filter those candidates against engine’s actual validMoves
  const placerId = gameState.players.find((p) => p.id !== opponentPlayer.id)!.id;
  const validWallMoves = gameEngineManager
    .getValidMoves(gameState, placerId)
    .filter((m) => m.type === 'wall' && m.wallPosition && m.wallOrientation);

  for (const ck of candidateKeys) {
    const [xStr, yStr, ori] = ck.split(',');
    const wx = parseInt(xStr);
    const wy = parseInt(yStr);
    const orientation = ori as WallOrientation;
    const matches = validWallMoves.find(
      (m) =>
        m.wallPosition!.x === wx &&
        m.wallPosition!.y === wy &&
        m.wallOrientation === orientation
    );
    if (matches) {
      result.push(matches);
    }
  }

  return result;
}

export interface ExtendedPathData {
  predecessorMap: Map<string, Position | null>;
  nextStepMap: Map<string, Position | null>;
  distanceToGoal: number;
  goalPosition: Position | null;
  allDistances: Map<string, number>;
}

/**
 * Aggregates predecessorMap + nextStepMap + distance + goalPosition for quick access
 * in the rollout. Corresponds to JS’s “cacheForPawns[...]” logic.
 */
export function getExtendedPathData(
  gameState: GameState,
  playerId: string
): ExtendedPathData {
  const sp = computeShortestPathData(playerId, gameState);
  const nextMap = getShortestPathNextStepMap(gameState, playerId, sp);
  return {
    predecessorMap: sp.predecessorMap,
    nextStepMap: nextMap,
    distanceToGoal: sp.distanceToGoal,
    goalPosition: sp.goalPosition,
    allDistances: sp.allDistances
  };
}

/** Helper to fetch a Player by ID (throws if not found). */
export function getPlayerOrThrow(gameState: GameState, playerId: string): Player {
  const p = gameState.players.find((p) => p.id === playerId);
  if (!p) throw new Error(`Player ${playerId} not found in gameState.`);
  return p;
}
