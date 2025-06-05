"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonteCarloAI = void 0;
exports.createMonteCarloAI = createMonteCarloAI;
const GameEngineManager_1 = require("../game/GameEngineManager");
class QuoridorPathfinder {
    // BFS that properly handles jumping by using game engine's move validation
    static findShortestPath(gameState, playerId) {
        const player = gameState.players.find(p => p.id === playerId);
        const playerIndex = gameState.players.findIndex(p => p.id === playerId);
        const startPos = player.position;
        // Queue: [position, distance, firstMove]
        const queue = [[startPos, 0, null]];
        const visited = new Set();
        while (queue.length > 0) {
            const [current, dist, firstMove] = queue.shift();
            const key = `${current.x},${current.y}`;
            if (visited.has(key))
                continue;
            visited.add(key);
            // Check goal
            if (this.isGoal(current, playerIndex, gameState.maxPlayers)) {
                return { distance: dist, nextMove: firstMove || current };
            }
            // Get valid moves from this position
            const validMoves = this.getValidMovesFrom(current, gameState, playerId);
            for (const next of validMoves) {
                if (!visited.has(`${next.x},${next.y}`)) {
                    queue.push([next, dist + 1, firstMove || next]);
                }
            }
        }
        return { distance: Infinity, nextMove: null };
    }
    // Get all valid pawn moves from a position (handles jumping!)
    static getValidMovesFrom(from, gameState, playerId) {
        // Create temporary state with player at 'from' position
        const tempState = JSON.parse(JSON.stringify(gameState));
        const tempPlayer = tempState.players.find((p) => p.id === playerId);
        tempPlayer.position = from;
        // Use game engine to get valid moves
        const moves = GameEngineManager_1.gameEngineManager.getValidMoves(tempState, playerId);
        return moves
            .filter(m => m.type === 'pawn')
            .map(m => m.toPosition);
    }
    static isGoal(pos, playerIndex, maxPlayers) {
        if (maxPlayers === 2) {
            return playerIndex === 0 ? pos.y === 0 : pos.y === 8;
        }
        else {
            switch (playerIndex) {
                case 0: return pos.y === 0;
                case 1: return pos.x === 0;
                case 2: return pos.y === 8;
                case 3: return pos.x === 8;
                default: return false;
            }
        }
    }
    // Check if two positions are adjacent (for optimization)
    static arePlayersAdjacent(gameState) {
        const positions = gameState.players.map(p => p.position);
        for (let i = 0; i < positions.length - 1; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const p1 = positions[i];
                const p2 = positions[j];
                if ((Math.abs(p1.x - p2.x) === 1 && p1.y === p2.y) ||
                    (Math.abs(p1.y - p2.y) === 1 && p1.x === p2.x)) {
                    return true;
                }
            }
        }
        return false;
    }
}
// ========================================
// STRATEGIC WALL EVALUATION
// ========================================
class WallEvaluator {
    // Find walls that actually block opponent paths
    static getPathBlockingWalls(gameState, targetPlayerId) {
        const currentPlayer = GameEngineManager_1.gameEngineManager.getCurrentPlayer(gameState);
        if (currentPlayer.wallsRemaining === 0)
            return [];
        const allWallMoves = GameEngineManager_1.gameEngineManager.getValidMoves(gameState, currentPlayer.id)
            .filter(m => m.type === 'wall');
        const blockingWalls = [];
        // Get current path length for target
        const currentPath = QuoridorPathfinder.findShortestPath(gameState, targetPlayerId);
        if (currentPath.distance === Infinity)
            return []; // Already blocked
        // Test each wall
        for (const wallMove of allWallMoves) {
            const tempState = JSON.parse(JSON.stringify(gameState));
            // Apply wall
            tempState.walls.push({
                id: 'temp',
                position: wallMove.wallPosition,
                orientation: wallMove.wallOrientation,
                playerId: currentPlayer.id
            });
            // Check new path length
            const newPath = QuoridorPathfinder.findShortestPath(tempState, targetPlayerId);
            const impact = newPath.distance - currentPath.distance;
            if (impact > 0) {
                blockingWalls.push({ move: wallMove, impact });
            }
        }
        // Sort by impact and return top walls
        blockingWalls.sort((a, b) => b.impact - a.impact);
        return blockingWalls.slice(0, 10).map(w => w.move);
    }
    // Get walls near a player (within 3 squares)
    static getWallsNearPlayer(gameState, targetPlayerId) {
        const currentPlayer = GameEngineManager_1.gameEngineManager.getCurrentPlayer(gameState);
        const targetPlayer = gameState.players.find(p => p.id === targetPlayerId);
        const allWallMoves = GameEngineManager_1.gameEngineManager.getValidMoves(gameState, currentPlayer.id)
            .filter(m => m.type === 'wall');
        return allWallMoves.filter(wall => {
            const dist = Math.abs(wall.wallPosition.x - targetPlayer.position.x) +
                Math.abs(wall.wallPosition.y - targetPlayer.position.y);
            return dist <= 3;
        });
    }
}
// ========================================
// MCTS NODE
// ========================================
class MCTSNode {
    constructor(gameState, move, parent, playerPerspective) {
        this.children = [];
        this.visits = 0;
        this.wins = 0;
        this.untriedMoves = [];
        this.gameState = gameState;
        this.move = move;
        this.parent = parent;
        this.playerPerspective = playerPerspective;
        this.isTerminal = GameEngineManager_1.gameEngineManager.isGameFinished(gameState);
        if (!this.isTerminal) {
            this.initializeMoves();
        }
    }
    initializeMoves() {
        const currentPlayer = GameEngineManager_1.gameEngineManager.getCurrentPlayer(this.gameState);
        // If it's our turn, use strategic move selection
        if (currentPlayer.id === this.playerPerspective) {
            this.untriedMoves = this.getStrategicMoves(currentPlayer);
        }
        else {
            // For opponent, consider all their moves
            this.untriedMoves = GameEngineManager_1.gameEngineManager.getValidMoves(this.gameState, currentPlayer.id);
        }
    }
    getStrategicMoves(player) {
        const moves = [];
        // Always include the shortest path pawn move
        const path = QuoridorPathfinder.findShortestPath(this.gameState, player.id);
        if (path.nextMove) {
            moves.push({
                type: 'pawn',
                playerId: player.id,
                fromPosition: player.position,
                toPosition: path.nextMove
            });
        }
        // Add strategic walls if we have them
        if (player.wallsRemaining > 0) {
            // Don't place walls in opening
            if (this.gameState.moves.length < 6) {
                return moves;
            }
            // Find most threatening opponent
            let mostThreateningOpponent = null;
            let minOpponentDist = Infinity;
            for (const opponent of this.gameState.players) {
                if (opponent.id !== player.id) {
                    const oppPath = QuoridorPathfinder.findShortestPath(this.gameState, opponent.id);
                    if (oppPath.distance < minOpponentDist) {
                        minOpponentDist = oppPath.distance;
                        mostThreateningOpponent = opponent;
                    }
                }
            }
            if (mostThreateningOpponent) {
                // Get walls that block the most threatening opponent
                const blockingWalls = WallEvaluator.getPathBlockingWalls(this.gameState, mostThreateningOpponent.id);
                // Add best blocking walls
                moves.push(...blockingWalls.slice(0, 8));
                // Also consider walls near opponent
                if (moves.length < 10) {
                    const nearWalls = WallEvaluator.getWallsNearPlayer(this.gameState, mostThreateningOpponent.id);
                    // Add walls that aren't already in the list
                    for (const wall of nearWalls) {
                        if (!moves.some(m => m.type === 'wall' &&
                            m.wallPosition?.x === wall.wallPosition?.x &&
                            m.wallPosition?.y === wall.wallPosition?.y &&
                            m.wallOrientation === wall.wallOrientation)) {
                            moves.push(wall);
                            if (moves.length >= 15)
                                break;
                        }
                    }
                }
            }
        }
        return moves;
    }
    isFullyExpanded() {
        return this.untriedMoves.length === 0;
    }
    ucb1(c = Math.sqrt(2)) {
        if (this.visits === 0)
            return Infinity;
        const exploitation = this.wins / this.visits;
        const exploration = c * Math.sqrt(Math.log(this.parent.visits) / this.visits);
        return exploitation + exploration;
    }
    selectBestChild(c) {
        return this.children.reduce((best, child) => child.ucb1(c) > best.ucb1(c) ? child : best);
    }
}
// ========================================
// CHAMPIONSHIP MONTE CARLO AI
// ========================================
class MonteCarloAI {
    constructor(difficulty = 'hard') {
        this.difficulty = difficulty;
        switch (difficulty) {
            case 'easy':
                this.iterations = 200;
                this.explorationConstant = 1.5;
                break;
            case 'medium':
                this.iterations = 800;
                this.explorationConstant = Math.sqrt(2);
                break;
            case 'hard':
                this.iterations = 2000;
                this.explorationConstant = 1.0;
                break;
        }
    }
    async generateMove(gameState, playerId) {
        console.log(`🏆 ${this.getName()} analyzing position...`);
        const player = gameState.players.find(p => p.id === playerId);
        // Opening book - first few moves
        if (gameState.moves.length < 2) {
            const path = QuoridorPathfinder.findShortestPath(gameState, playerId);
            if (path.nextMove && path.nextMove.y !== player.position.y) {
                console.log(`🏆 Opening move - advancing forward`);
                return {
                    type: 'pawn',
                    playerId,
                    fromPosition: player.position,
                    toPosition: path.nextMove
                };
            }
        }
        // Endgame - no walls left for anyone
        if (gameState.players.every(p => p.wallsRemaining === 0)) {
            const path = QuoridorPathfinder.findShortestPath(gameState, playerId);
            if (path.nextMove) {
                console.log(`🏆 Pure race - shortest path (${path.distance} moves to goal)`);
                return {
                    type: 'pawn',
                    playerId,
                    fromPosition: player.position,
                    toPosition: path.nextMove
                };
            }
        }
        // Run MCTS
        const rootNode = new MCTSNode(gameState, null, null, playerId);
        // If only one move, take it
        if (rootNode.untriedMoves.length === 1) {
            console.log(`🏆 Only one strategic move available`);
            return rootNode.untriedMoves[0];
        }
        // MCTS iterations
        for (let i = 0; i < this.iterations; i++) {
            let node = this.treePolicy(rootNode);
            let reward = this.rollout(node);
            this.backup(node, reward);
        }
        // Select best move by visit count
        let bestChild = rootNode.children[0];
        for (const child of rootNode.children) {
            if (child.visits > bestChild.visits) {
                bestChild = child;
            }
        }
        const winRate = bestChild.visits > 0 ? bestChild.wins / bestChild.visits : 0;
        console.log(`🏆 Best move: ${bestChild.move?.type} with ${bestChild.visits} visits (${(winRate * 100).toFixed(1)}% win rate)`);
        // Safety check - if win rate is terrible and we're considering a wall, reconsider
        if (winRate < 0.2 && bestChild.move?.type === 'wall') {
            console.log(`🏆 Win rate too low for wall placement, choosing pawn move instead`);
            const pawnPath = QuoridorPathfinder.findShortestPath(gameState, playerId);
            if (pawnPath.nextMove) {
                return {
                    type: 'pawn',
                    playerId,
                    fromPosition: player.position,
                    toPosition: pawnPath.nextMove
                };
            }
        }
        return bestChild.move;
    }
    treePolicy(node) {
        while (!node.isTerminal) {
            if (!node.isFullyExpanded()) {
                return this.expand(node);
            }
            else {
                node = node.selectBestChild(this.explorationConstant);
            }
        }
        return node;
    }
    expand(node) {
        const moveIndex = Math.floor(Math.random() * node.untriedMoves.length);
        const move = node.untriedMoves.splice(moveIndex, 1)[0];
        const newState = GameEngineManager_1.gameEngineManager.applyMove(node.gameState, move);
        const child = new MCTSNode(newState, move, node, node.playerPerspective);
        node.children.push(child);
        return child;
    }
    rollout(node) {
        if (node.isTerminal) {
            const winner = GameEngineManager_1.gameEngineManager.getWinner(node.gameState);
            return winner === node.playerPerspective ? 1 : 0;
        }
        // Smart rollout policy
        let state = JSON.parse(JSON.stringify(node.gameState));
        let depth = 0;
        const maxDepth = 50;
        // Cache for path calculations during rollout
        const pathCache = new Map();
        while (!GameEngineManager_1.gameEngineManager.isGameFinished(state) && depth < maxDepth) {
            const currentPlayer = GameEngineManager_1.gameEngineManager.getCurrentPlayer(state);
            const playerId = currentPlayer.id;
            let selectedMove = null;
            // 70% shortest path, 30% other moves
            if (Math.random() < 0.7) {
                // Check cache first
                const cacheKey = `${playerId}-${currentPlayer.position.x},${currentPlayer.position.y}`;
                let path = pathCache.get(cacheKey);
                if (!path) {
                    path = QuoridorPathfinder.findShortestPath(state, playerId);
                    pathCache.set(cacheKey, path);
                }
                if (path.nextMove) {
                    selectedMove = {
                        type: 'pawn',
                        playerId,
                        fromPosition: currentPlayer.position,
                        toPosition: path.nextMove
                    };
                }
            }
            else if (currentPlayer.wallsRemaining > 0 && Math.random() < 0.5) {
                // Try to place a strategic wall
                const opponents = state.players.filter((p) => p.id !== playerId);
                const opponent = opponents[Math.floor(Math.random() * opponents.length)];
                const blockingWalls = WallEvaluator.getPathBlockingWalls(state, opponent.id);
                if (blockingWalls.length > 0) {
                    selectedMove = blockingWalls[0];
                }
            }
            // Fallback to any valid move
            if (!selectedMove) {
                const moves = GameEngineManager_1.gameEngineManager.getValidMoves(state, playerId);
                if (moves.length > 0) {
                    selectedMove = moves[Math.floor(Math.random() * moves.length)];
                }
                else {
                    break;
                }
            }
            state = GameEngineManager_1.gameEngineManager.applyMove(state, selectedMove);
            depth++;
            // Clear cache when walls are placed
            if (selectedMove.type === 'wall') {
                pathCache.clear();
            }
        }
        // Evaluate final position
        return this.evaluatePosition(state, node.playerPerspective);
    }
    evaluatePosition(state, playerId) {
        if (GameEngineManager_1.gameEngineManager.isGameFinished(state)) {
            const winner = GameEngineManager_1.gameEngineManager.getWinner(state);
            return winner === playerId ? 1 : 0;
        }
        // Compare path lengths
        const myPath = QuoridorPathfinder.findShortestPath(state, playerId);
        let minOpponentPath = Infinity;
        for (const player of state.players) {
            if (player.id !== playerId) {
                const path = QuoridorPathfinder.findShortestPath(state, player.id);
                minOpponentPath = Math.min(minOpponentPath, path.distance);
            }
        }
        if (myPath.distance === Infinity)
            return 0;
        if (minOpponentPath === Infinity)
            return 1;
        // Sigmoid evaluation
        const advantage = minOpponentPath - myPath.distance;
        return 1 / (1 + Math.exp(-advantage / 3));
    }
    backup(node, reward) {
        let current = node;
        // Track whose turn it was at each node
        while (current !== null) {
            current.visits++;
            // The reward is from the perspective of node.playerPerspective
            // We need to check whose turn it was when this node was created
            if (current.parent) {
                const movePlayer = current.gameState.players[(current.parent.gameState.currentPlayerIndex + current.parent.gameState.players.length - 1) %
                    current.parent.gameState.players.length];
                if (movePlayer.id === node.playerPerspective) {
                    current.wins += reward;
                }
                else {
                    current.wins += (1 - reward);
                }
            }
            else {
                // Root node
                current.wins += reward;
            }
            current = current.parent;
        }
    }
    getDifficulty() {
        return this.difficulty;
    }
    getName() {
        return `Championship AI (${this.difficulty})`;
    }
}
exports.MonteCarloAI = MonteCarloAI;
function createMonteCarloAI(difficulty) {
    return new MonteCarloAI(difficulty);
}
