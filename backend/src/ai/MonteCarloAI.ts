/**
 * MonteCarloAI.ts
 *
 * A full MCTS implementation that ties together aiUtils.ts and heuristics.ts
 * and implements the AIEngine interface from shared/types.
 */

import type {
    AIEngine,
    GameState,
    Move,
    AIDifficulty,
    Player,
    Position
  } from '../../../shared/types';
  import { gameEngineManager } from '../game/GameEngineManager';
  
  import {
    chooseShortestPathNextPawnMoves,
    chooseLongestPathNextPawnMoves,
    arePawnsAdjacent,
    getProbableValidNoBlockWallMoves,
    getAllShortestPathsToEveryPosition,
    getExtendedPathData,
    ExtendedPathData,
    AllShortestPathsResult,
    getPlayerOrThrow,
    getValidNextWallsDisturbPathOf
  } from './heuristics';
  
  import { randomChoice, shuffle, indicesOfMin, indicesOfMax } from './aiUtils';
  
  function posToKey(pos: Position): string {
    return `${pos.x},${pos.y}`;
  }
  
  class NodeMCTS {
    parent: NodeMCTS | null;
    children: NodeMCTS[];
    moveThatLedHere: Omit<Move, 'id' | 'timestamp'> | null;
    visits: number;
    wins: number;
    isTerminal: boolean;
    readonly uctConstant: number;
    readonly playerTurnAtNodeState: string;
  
    constructor(
      parent: NodeMCTS | null,
      move: Omit<Move, 'id' | 'timestamp'> | null,
      uctConstant: number,
      playerTurnAtNodeState: string
    ) {
      this.parent = parent;
      this.moveThatLedHere = move;
      this.uctConstant = uctConstant;
      this.visits = 0;
      this.wins = 0;
      this.children = [];
      this.isTerminal = false;
      this.playerTurnAtNodeState = playerTurnAtNodeState;
    }
  
    get isLeaf(): boolean {
      return this.children.length === 0;
    }
  
    get isNew(): boolean {
      return this.visits === 0;
    }
  
    get winRate(): number {
      return this.visits === 0 ? 0 : this.wins / this.visits;
    }
  
    /** Returns UCT value; if this node was never visited, return Infinity */
    getUCT(): number {
      if (this.isNew) return Infinity;
      if (!this.parent || this.parent.visits === 0) {
        const parentVisits = this.parent ? Math.max(1, this.parent.visits) : 1;
        return (
          this.winRate +
          this.uctConstant * Math.sqrt(Math.log(parentVisits) / (this.visits + 1e-6))
        );
      }
      return (
        this.winRate +
        this.uctConstant * Math.sqrt(Math.log(this.parent.visits) / this.visits)
      );
    }
  
    /**
     * Select one child with highest UCT. If multiple share the same maximum UCT,
     * pick randomly among them.
     */
    selectChildUCT(): NodeMCTS | undefined {
      if (this.isLeaf) return undefined;
      let bestChildren: NodeMCTS[] = [];
      let maxUCT = -Infinity;
      for (const child of this.children) {
        const uctVal = child.getUCT();
        if (uctVal > maxUCT) {
          maxUCT = uctVal;
          bestChildren = [child];
        } else if (uctVal === maxUCT) {
          bestChildren.push(child);
        }
      }
      return randomChoice(bestChildren);
    }
  
    addChild(
      move: Omit<Move, 'id' | 'timestamp'>,
      childPlayerTurn: string
    ): NodeMCTS {
      const childNode = new NodeMCTS(this, move, this.uctConstant, childPlayerTurn);
      this.children.push(childNode);
      return childNode;
    }
  }
  
  export class MonteCarloAI implements AIEngine {
    private difficulty: AIDifficulty;
    private numSimulations: number;
    private explorationConstant: number = Math.sqrt(2);
  
    private rootNode!: NodeMCTS;
    private initialGameState!: GameState;
  
    // Cache for rollout path data (to avoid recomputing BFS every time)
    private pathDataCache = new Map<
      string,
      { data: ExtendedPathData; stateSignature: string }
    >();
    private allPathsCache = new Map<
      string,
      { data: AllShortestPathsResult; stateSignature: string }
    >();
  
    constructor(difficulty: AIDifficulty = 'medium') {
      this.difficulty = difficulty;
      switch (difficulty) {
        case 'easy':
          this.numSimulations = 100;
          break;
        case 'medium':
          this.numSimulations = 500;
          break;
        case 'hard':
          this.numSimulations = 1000;
          break;
        default:
          this.numSimulations = 500;
      }
    }
  
    getName(): string {
      return `MonteCarloAI_TS (${this.difficulty})`;
    }
    getDifficulty(): AIDifficulty {
      return this.difficulty;
    }
  
    /** Deep clone by JSON; replace with a faster clone if needed */
    private cloneGameState(gameState: GameState): GameState {
      return JSON.parse(JSON.stringify(gameState));
    }
  
    private getPlayerById(state: GameState, playerId: string): Player | undefined {
      return state.players.find((p) => p.id === playerId);
    }
  
    private getOpponentId(state: GameState, playerId: string): string | undefined {
      return state.players.find((p) => p.id !== playerId)?.id;
    }
  
    /**
     * Cache ExtendedPathData for a player (using a signature of positions+wallsRemaining+wallsOnBoard).
     */
    private getPlayerCachedPathData(
      gameState: GameState,
      playerId: string
    ): ExtendedPathData {
      const stateSignature =
        gameState.players
          .map(
            (p) => `${p.id}:${posToKey(p.position)},${p.wallsRemaining}`
          )
          .join('|') +
        `_W:${gameState.walls.length}`;
      const cached = this.pathDataCache.get(playerId);
      if (cached && cached.stateSignature === stateSignature) {
        return cached.data;
      }
      const data = getExtendedPathData(gameState, playerId);
      this.pathDataCache.set(playerId, { data, stateSignature });
      return data;
    }
  
    /**
     * Cache AllShortestPathsResult for a player (using positions+walls total).
     */
    private getPlayerCachedAllPaths(
      gameState: GameState,
      playerId: string
    ): AllShortestPathsResult {
      const stateSignature =
        gameState.players
          .map((p) => `${p.id}:${posToKey(p.position)}`)
          .join('|') +
        `_W:${gameState.walls.length}`;
      const cached = this.allPathsCache.get(playerId);
      if (cached && cached.stateSignature === stateSignature) {
        return cached.data;
      }
      const data = getAllShortestPathsToEveryPosition(playerId, gameState);
      this.allPathsCache.set(playerId, { data, stateSignature });
      return data;
    }
  
    /**
     * Main entry point. Clone initial state, clear caches, build root node, run MCTS,
     * then pick the child of root with highest visit‐count.
     */
    async generateMove(
      currentGameState: GameState,
      aiPlayerId: string
    ): Promise<Omit<Move, 'id' | 'timestamp'>> {
      // 1) Clone state + clear caches
      this.initialGameState = this.cloneGameState(currentGameState);
      this.pathDataCache.clear();
      this.allPathsCache.clear();
  
      // 2) The "root" node's playerTurnAtNodeState is whoever moves next
      const rootPlayer = gameEngineManager.getCurrentPlayer(this.initialGameState).id;
      this.rootNode = new NodeMCTS(null, null, this.explorationConstant, rootPlayer);
  
      // 3) Run MCTS
      this.search(this.numSimulations, aiPlayerId);
  
      // 4) Pick the child of root with max visits
      const bestNode = this.selectBestMoveNode(this.rootNode);
      if (!bestNode || !bestNode.moveThatLedHere) {
        // Fallback to a random valid move
        const validFallback = gameEngineManager.getValidMoves(
          this.initialGameState,
          aiPlayerId
        );
        const fallback = randomChoice(validFallback);
        if (!fallback) {
          throw new Error(`MCTS: no valid fallback moves for ${aiPlayerId}`);
        }
        return fallback;
      }
      return bestNode.moveThatLedHere;
    }
  
    /**
     * Replay moves from root to 'node' to reconstruct its GameState.
     */
    private getGameStateAtNode(node: NodeMCTS): GameState {
      const movesPath: Omit<Move, 'id' | 'timestamp'>[] = [];
      let temp: NodeMCTS | null = node;
      while (temp && temp.parent && temp.moveThatLedHere) {
        movesPath.unshift(temp.moveThatLedHere);
        temp = temp.parent;
      }
      let state = this.cloneGameState(this.initialGameState);
      for (const m of movesPath) {
        state = gameEngineManager.applyMove(state, m);
      }
      return state;
    }
  
    /**
     * Core MCTS loop (selection → expansion → rollout → backprop).
     */
    private search(simulationsToRun: number, aiRootPlayerId: string) {
      for (let i = 0; i < simulationsToRun; i++) {
        let currentNode = this.rootNode;
        let currentState = this.getGameStateAtNode(currentNode);
  
        // --- SELECTION ---
        while (!currentNode.isTerminal && !currentNode.isLeaf) {
          const nextNode = currentNode.selectChildUCT();
          if (!nextNode) {
            currentNode.isTerminal = true;
            break;
          }
          const stateOfParent = currentState;
          currentNode = nextNode;
          currentState = gameEngineManager.applyMove(
            this.cloneGameState(stateOfParent),
            currentNode.moveThatLedHere!
          );
          if (gameEngineManager.isGameFinished(currentState)) {
            currentNode.isTerminal = true;
          }
        }
  
        // --- EXPANSION ---
        if (!currentNode.isTerminal) {
          if (currentNode.visits > 0 || currentNode === this.rootNode) {
            this.expandNode(currentNode, currentState);
          }
          if (!currentNode.isLeaf) {
            const randomChild = randomChoice(currentNode.children);
            if (randomChild) {
              const stateOfParentForRollout = currentState;
              currentNode = randomChild;
              currentState = gameEngineManager.applyMove(
                this.cloneGameState(stateOfParentForRollout),
                currentNode.moveThatLedHere!
              );
              if (gameEngineManager.isGameFinished(currentState)) {
                currentNode.isTerminal = true;
              }
            } else {
              currentNode.isTerminal = true;
            }
          } else if (currentNode.isLeaf && currentNode.visits === 0) {
            // we will rollout from currentState directly
          } else {
            currentNode.isTerminal = true;
          }
        }
  
        // --- ROLLOUT (SIMULATION) ---
        const winnerId = this.rollout(currentState, aiRootPlayerId);
  
        // --- BACKPROPAGATION ---
        this.backpropagate(currentNode, winnerId);
      }
    }
  
    /**
     * Expand "node" by adding children according to heuristics:
     *  • If opponent still has walls: all pawn moves + probable wall placements.
     *  • If opponent has no walls: restrict to "shortest-path" pawn moves + disturbing walls.
     */
    private expandNode(node: NodeMCTS, stateAtNode: GameState) {
      if (node.children.length > 0 || node.isTerminal) return;
  
      const playerToMove = this.getPlayerById(stateAtNode, node.playerTurnAtNodeState);
      if (!playerToMove) {
        node.isTerminal = true;
        return;
      }
      const opponentId = this.getOpponentId(stateAtNode, playerToMove.id);
      if (!opponentId) {
        node.isTerminal = true;
        return;
      }
      const opponentPlayer = this.getPlayerById(stateAtNode, opponentId);
      if (!opponentPlayer) {
        node.isTerminal = true;
        return;
      }
  
      let movesForExpansion: Omit<Move, 'id' | 'timestamp'>[] = [];
  
      // Case A: Opponent still has walls → all pawn moves + probable walls
      if (opponentPlayer.wallsRemaining > 0) {
        const allValid = gameEngineManager.getValidMoves(stateAtNode, playerToMove.id);
        const pawnOnly = allValid.filter((m) => m.type === 'pawn');
        movesForExpansion.push(...pawnOnly);
  
        const probableWalls = getProbableValidNoBlockWallMoves(
          stateAtNode,
          playerToMove.id
        );
        movesForExpansion.push(...probableWalls);
      } else {
        // Case B: Opponent has no walls → restrict expansion
        const shortestPawnPositions = chooseShortestPathNextPawnMoves(
          stateAtNode,
          playerToMove.id
        );
        const validPawnMoves = gameEngineManager
          .getValidMoves(stateAtNode, playerToMove.id)
          .filter((m) => m.type === 'pawn' && m.toPosition);
        const uniqPawnMoves = new Set<string>();
        for (const pos of shortestPawnPositions) {
          const found = validPawnMoves.find(
            (m) => m.toPosition!.x === pos.x && m.toPosition!.y === pos.y
          );
          if (found) {
            uniqPawnMoves.add(JSON.stringify(found));
          }
        }
        uniqPawnMoves.forEach((js) => {
          movesForExpansion.push(JSON.parse(js));
        });
  
        if (playerToMove.wallsRemaining > 0) {
          const oppPaths = this.getPlayerCachedAllPaths(
            stateAtNode,
            opponentPlayer.id
          );
          const disturbWalls = getValidNextWallsDisturbPathOf(
            opponentPlayer,
            stateAtNode,
            oppPaths
          );
          movesForExpansion.push(...disturbWalls);
        }
      }
  
      if (movesForExpansion.length === 0) {
        node.isTerminal = true;
        return;
      }
  
      // Try applying each move; if valid, add as child
      for (const mov of movesForExpansion) {
        try {
          const nextState = gameEngineManager.applyMove(
            this.cloneGameState(stateAtNode),
            mov
          );
          const nextPlayer = gameEngineManager.getCurrentPlayer(nextState).id;
          node.addChild(mov, nextPlayer);
        } catch {
          // skip invalid
        }
      }
  
      if (node.children.length === 0) {
        node.isTerminal = true;
      }
    }
  
    /**
     * Roll out a simulated game from `stateForRollout` up to MAX_TURNS or until finished.
     * Uses the heuristic:
     *   • 70% move pawn along a shortest path (including jump if adjacent),
     *   • 15% place a probable non-blocking wall (if available),
     *   • otherwise move pawn backward or random.
     */
    private rollout(
      stateForRollout: GameState,
      aiRootPlayerId: string
    ): string | null {
      let simState = this.cloneGameState(stateForRollout);
      let turns = 0;
      const MAX_TURNS = 60;
      let pawnMoveFlag = false;
  
      while (turns < MAX_TURNS) {
        if (gameEngineManager.isGameFinished(simState)) break;
        const currentPlayerId = gameEngineManager.getCurrentPlayer(simState).id;
        const currentPlayer = getPlayerOrThrow(simState, currentPlayerId);
        const opponentId = this.getOpponentId(simState, currentPlayerId);
        if (!opponentId) break;
  
        const pathData = this.getPlayerCachedPathData(simState, currentPlayerId);
        const allValidMoves = gameEngineManager.getValidMoves(simState, currentPlayerId);
        if (allValidMoves.length === 0) break;
  
        const r = Math.random();
        let chosenMove: Omit<Move, 'id' | 'timestamp'> | undefined;
  
        // 70%: move pawn along shortest path (including jumps if adjacent)
        if (r < 0.7) {
          pawnMoveFlag = false;
          const nextMap = pathData.nextStepMap;
          const nextFromCurrent = nextMap.get(posToKey(currentPlayer.position)) || null;
  
          if (nextFromCurrent) {
            if (arePawnsAdjacent(simState, currentPlayerId, opponentId)) {
              const jumpTarget = nextMap.get(posToKey(nextFromCurrent)) || null;
              if (
                jumpTarget &&
                gameEngineManager
                  .getValidMoves(
                    {
                      ...simState,
                      players: simState.players.map((p) =>
                        p.id === currentPlayerId ? { ...p, position: currentPlayer.position } : { ...p }
                      ),
                      currentPlayerIndex: simState.players.findIndex((p) => p.id === currentPlayerId)
                    } as GameState,
                    currentPlayerId
                  )
                  .some(
                    (m) =>
                      m.type === 'pawn' &&
                      m.toPosition!.x === jumpTarget.x &&
                      m.toPosition!.y === jumpTarget.y
                  )
              ) {
                chosenMove = {
                  type: 'pawn',
                  playerId: currentPlayerId,
                  toPosition: jumpTarget
                };
              } else {
                // fallback: random among shortest-path moves
                const arr = chooseShortestPathNextPawnMoves(simState, currentPlayerId);
                if (arr.length > 0) {
                  chosenMove = {
                    type: 'pawn',
                    playerId: currentPlayerId,
                    toPosition: randomChoice(arr)!
                  };
                }
              }
            } else {
              chosenMove = {
                type: 'pawn',
                playerId: currentPlayerId,
                toPosition: nextFromCurrent
              };
            }
          } else {
            const arr = chooseShortestPathNextPawnMoves(simState, currentPlayerId);
            if (arr.length > 0) {
              chosenMove = {
                type: 'pawn',
                playerId: currentPlayerId,
                toPosition: randomChoice(arr)!
              };
            }
          }
        }
        // 15%: attempt to place a probable wall (if any left)
        else if (!pawnMoveFlag && currentPlayer.wallsRemaining > 0 && r < 0.85) {
          const walls = getProbableValidNoBlockWallMoves(simState, currentPlayerId);
          chosenMove = randomChoice(walls);
          if (!chosenMove) pawnMoveFlag = true;
        }
  
        // If no chosenMove or flagged, do "backward" or random pawn move
        if (!chosenMove || pawnMoveFlag) {
          pawnMoveFlag = false;
          const predMap = pathData.predecessorMap;
          const prevPos = predMap.get(posToKey(currentPlayer.position)) || null;
          if (prevPos) {
            const possible = allValidMoves.find(
              (m) =>
                m.type === 'pawn' &&
                m.toPosition!.x === prevPos.x &&
                m.toPosition!.y === prevPos.y
            );
            if (possible) {
              chosenMove = possible;
            } else {
              const arr = chooseLongestPathNextPawnMoves(simState, currentPlayerId);
              if (arr.length > 0) {
                const target = randomChoice(arr)!;
                chosenMove = allValidMoves.find(
                  (m) =>
                    m.type === 'pawn' &&
                    m.toPosition!.x === target.x &&
                    m.toPosition!.y === target.y
                );
              }
            }
          }
        }
  
        // Final fallback: random pawn move or random move of any type
        if (!chosenMove) {
          chosenMove = randomChoice(allValidMoves.filter((m) => m.type === 'pawn'))!;
          if (!chosenMove) {
            chosenMove = randomChoice(allValidMoves)!;
          }
        }
  
        if (!chosenMove) break;
        simState = gameEngineManager.applyMove(simState, chosenMove);
        turns++;
      }
  
      return gameEngineManager.getWinner(simState);
    }
  
    /**
     * Backpropagate simulation result: increment visits on each ancestor,
     * and increment wins on ancestors where playerTurnAtNodeState matches winner.
     */
    private backpropagate(node: NodeMCTS | null, simulationWinnerId: string | null) {
      let temp: NodeMCTS | null = node;
      while (temp) {
        temp.visits++;
        if (simulationWinnerId === temp.playerTurnAtNodeState) {
          temp.wins++;
        }
        temp = temp.parent;
      }
    }
  
    /**
     * After MCTS, pick the child of root with the greatest #visits.
     */
    private selectBestMoveNode(root: NodeMCTS): NodeMCTS | undefined {
      if (root.isLeaf) return undefined;
      let bestNode: NodeMCTS | undefined = undefined;
      let maxVisits = -1;
      for (const child of root.children) {
        if (child.visits > maxVisits) {
          maxVisits = child.visits;
          bestNode = child;
        }
      }
      return bestNode;
    }
  }
  
  export function createAI(difficulty: AIDifficulty): MonteCarloAI {
    return new MonteCarloAI(difficulty);
  }
  