"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GreedyAI = void 0;
exports.createGreedyAI = createGreedyAI;
const GameEngineManager_1 = require("../game/GameEngineManager");
// Helper for deep copying GameState (basic implementation)
function deepCopy(obj) {
    // Note: JSON.parse(JSON.stringify(obj)) doesn't handle Dates well if they are not strings.
    // Ensure GameState and its components are serializable or use a more robust deep copy.
    return JSON.parse(JSON.stringify(obj));
}
const MAX_PATH_DISTANCE = Infinity; // Used for path calculations
class GreedyAI {
    constructor(difficulty = 'medium') {
        this.BOARD_SIZE = 9; // Quoridor board size (0-8 for 9x9)
        this.difficulty = difficulty;
        if (difficulty === 'hard') {
            this.thinkingTimeMs = 400;
            this.opponentCloseThresholdValue = 2;
        }
        else {
            this.thinkingTimeMs = 100;
            this.opponentCloseThresholdValue = 4;
        }
    }
    // New private method to determine player goals (row or column)
    getPlayerGoal(playerIndex, maxPlayers) {
        const maxCoord = this.BOARD_SIZE - 1; // Max index, e.g., 8 for a 9x9 board
        if (maxPlayers <= 2) { // Handles 1v1 and single player scenarios
            // Player 0 (e.g., starts "bottom", Y=maxCoord) goal is Y=0 ("top")
            // Player 1 (e.g., starts "top", Y=0) goal is Y=maxCoord ("bottom")
            if (playerIndex === 0)
                return { type: 'row', value: 0 };
            if (playerIndex === 1)
                return { type: 'row', value: maxCoord };
            // Fallback for maxPlayers=1, assuming playerIndex is 0
            if (maxPlayers === 1 && playerIndex === 0)
                return { type: 'row', value: 0 };
        }
        else if (maxPlayers === 4) {
            // User-specified 4-player Quoridor goals:
            // Player 1 (index 0): bottom, goal top row (Y=0)
            // Player 2 (index 1): right, goal left column (X=0)
            // Player 3 (index 2): left, goal right column (X=maxCoord)
            // Player 4 (index 3): top, goal bottom row (Y=maxCoord)
            if (playerIndex === 0)
                return { type: 'row', value: 0 }; // Player 1 (bottom) -> goal top
            if (playerIndex === 1)
                return { type: 'col', value: 0 }; // Player 2 (right) -> goal left
            if (playerIndex === 2)
                return { type: 'col', value: maxCoord }; // Player 3 (left) -> goal right
            if (playerIndex === 3)
                return { type: 'row', value: maxCoord }; // Player 4 (top) -> goal bottom
        }
        // If execution reaches here, it's an unsupported/unexpected configuration
        throw new Error(`Cannot determine goal for playerIndex ${playerIndex} in a game with ${maxPlayers} players. Board size (0-${maxCoord}).`);
    }
    async generateMove(gameState, playerId) {
        console.log(`🤖 ${this.getName()} thinking for player ${playerId}...`);
        await this.delay(this.thinkingTimeMs);
        const currentPlayer = gameState.players.find(p => p.id === playerId);
        if (!currentPlayer) {
            throw new Error(`Player ${playerId} not found in gameState`);
        }
        const currentPlayerIndex = gameState.players.findIndex(p => p.id === playerId);
        if (currentPlayerIndex === -1) {
            throw new Error(`Player index for ${playerId} not found`);
        }
        // Identify opponent (assuming 2-player game for simplicity first)
        // const opponent = gameState.players.find(p => p.id !== playerId); // OLD
        const opponents = gameState.players.filter(p => p.id !== playerId);
        // if (opponent && currentPlayer.wallsRemaining > 0) { // OLD
        if (opponents.length > 0 && currentPlayer.wallsRemaining > 0) { // MODIFIED: Check multiple opponents
            let mostThreateningOpponent = null;
            let mostThreateningOpponentIndex = -1;
            let minOpponentPathToGoal = MAX_PATH_DISTANCE;
            for (const opp of opponents) {
                const oppIndex = gameState.players.findIndex(p => p.id === opp.id);
                if (oppIndex === -1) {
                    console.warn(`Could not find index for opponent ${opp.id}`);
                    continue;
                }
                // opponentGoalY is no longer passed directly; computeShortestPath determines goal
                const oppPathLength = this.computeShortestPath(opp.position, gameState, opp.id, oppIndex);
                console.log(`🤖 Opponent ${opp.id} (P${oppIndex}) is ${oppPathLength} moves away from their goal.`);
                if (oppPathLength < minOpponentPathToGoal) {
                    minOpponentPathToGoal = oppPathLength;
                    mostThreateningOpponent = opp;
                    mostThreateningOpponentIndex = oppIndex;
                }
            }
            // const opponentIndex = gameState.players.findIndex(p => p.id === opponent.id); // OLD
            // if (opponentIndex !== -1) { // OLD
            if (mostThreateningOpponent && mostThreateningOpponentIndex !== -1) { // MODIFIED
                // const opponentGoalY = gameEngineManager.getPlayerGoalRow(opponentIndex, gameState.maxPlayers); // OLD
                // const opponentPathLength = this.computeShortestPath(opponent.position, opponentGoalY, gameState, opponent.id); // OLD
                // console.log(`🤖 Opponent ${opponent.id} is ${opponentPathLength} moves away from goal.`); // OLD
                if (minOpponentPathToGoal <= this.opponentCloseThresholdValue) {
                    console.log(`🤖 Opponent ${mostThreateningOpponent.id} (P${mostThreateningOpponentIndex}) is close (${minOpponentPathToGoal} moves)! Attempting to block.`);
                    // MODIFIED: Pass opponentIndex instead of opponentGoalY to chooseBlockingWallMove
                    const blockingWallMove = this.chooseBlockingWallMove(currentPlayer, mostThreateningOpponent, mostThreateningOpponentIndex, gameState, minOpponentPathToGoal);
                    if (blockingWallMove) {
                        console.log(`🤖 ${this.getName()} chose blocking wall for ${mostThreateningOpponent.id}: ${JSON.stringify(blockingWallMove.wallPosition)} ${blockingWallMove.wallOrientation}`);
                        return blockingWallMove;
                    }
                    console.log(`🤖 Could not find an effective blocking wall for ${mostThreateningOpponent.id}.`);
                }
            }
        }
        // If not blocking, or failed to block, choose a greedy pawn move
        const pawnMove = this.chooseGreedyPawnMove(currentPlayer, gameState, currentPlayerIndex);
        if (pawnMove) {
            console.log(`🤖 ${this.getName()} chose greedy pawn move to Y:${pawnMove.toPosition?.y}, X:${pawnMove.toPosition?.x}`);
            return pawnMove;
        }
        // Fallback to a random move if no specific strategy applies
        console.warn(`🤖 ${this.getName()} could not find a strategic move. Making a random move.`);
        return this.getRandomMove(gameState, playerId);
    }
    chooseGreedyPawnMove(player, gameState, playerIndex) {
        const validPawnMoves = GameEngineManager_1.gameEngineManager.getValidMoves(gameState, player.id)
            .filter(move => move.type === 'pawn' && move.toPosition);
        if (validPawnMoves.length === 0) {
            return null;
        }
        let bestMove = null;
        let minDistance = MAX_PATH_DISTANCE;
        // const targetY = gameEngineManager.getPlayerGoalRow(playerIndex, gameState.maxPlayers); // OLD: targetY not needed directly for computeShortestPath
        for (const pawnMove of validPawnMoves) {
            if (!pawnMove.toPosition)
                continue;
            const simulatedGameState = deepCopy(gameState);
            const playerInSimulatedState = simulatedGameState.players.find(p => p.id === player.id);
            playerInSimulatedState.position = pawnMove.toPosition;
            // MODIFIED: Pass playerIndex to computeShortestPath instead of targetY
            const distance = this.computeShortestPath(pawnMove.toPosition, simulatedGameState, player.id, playerIndex);
            if (distance < minDistance) {
                minDistance = distance;
                bestMove = pawnMove;
            }
        }
        return bestMove;
    }
    chooseBlockingWallMove(currentPlayer, opponent, opponentIndex, // ADDED
    gameState, opponentCurrentPath) {
        if (currentPlayer.wallsRemaining === 0)
            return null;
        const validWallMoves = GameEngineManager_1.gameEngineManager.getValidMoves(gameState, currentPlayer.id)
            .filter(move => move.type === 'wall' && move.wallPosition && move.wallOrientation);
        if (validWallMoves.length === 0)
            return null;
        let bestBlockEffect = 0; // Prioritize walls that hinder opponent the most
        let bestWallMove = null;
        for (const wallMove of validWallMoves) {
            const simulatedState = deepCopy(gameState);
            // Apply the wall to the simulated state
            const newWall = {
                id: `sim_wall_${Date.now()}`,
                playerId: currentPlayer.id,
                position: wallMove.wallPosition,
                orientation: wallMove.wallOrientation
            };
            simulatedState.walls.push(newWall);
            const playerInSimulatedState = simulatedState.players.find(p => p.id === currentPlayer.id);
            playerInSimulatedState.wallsRemaining--;
            // CRUCIAL: Validate if this wall placement is legal (doesn't trap anyone completely)
            // Assuming getValidMoves already handles this. If not, add: 
            // if (!gameEngineManager.hasValidPathToGoal(simulatedState, currentPlayer.id) || 
            //     !gameEngineManager.hasValidPathToGoal(simulatedState, opponent.id)) {
            //   console.log(`Wall placement ${newWall.position.x},${newWall.position.y} ${newWall.orientation} would trap a player.`);
            //   continue;
            // }
            // For now, we trust getValidMoves from gameEngineManager
            // MODIFIED: computeShortestPath call updated (remove opponentGoalY, add opponentIndex)
            const newOpponentPath = this.computeShortestPath(opponent.position, simulatedState, opponent.id, opponentIndex);
            if (newOpponentPath === MAX_PATH_DISTANCE && opponentCurrentPath !== MAX_PATH_DISTANCE) {
                // This wall completely blocks the opponent, and they weren't blocked before. Ideal.
                console.log(`Found optimal blocking wall for opponent ${opponent.id}: ${JSON.stringify(wallMove.wallPosition)} ${wallMove.wallOrientation}`);
                return wallMove;
            }
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
    computeShortestPath(startPosition, gameState, // ADDED gameState for maxPlayers
    playerId, playerIndexForGoal // ADDED to determine goal
    ) {
        const goal = this.getPlayerGoal(playerIndexForGoal, gameState.maxPlayers); // Get goal based on player index and max players
        const queue = [{ position: startPosition, distance: 0 }];
        const visited = new Set([`${startPosition.y},${startPosition.x}`]);
        const DIRS = [
            [-1, 0], [1, 0], [0, -1], [0, 1],
            [-2, 0], [2, 0], [0, -2], [0, 2],
            [-1, -1], [-1, 1], [1, -1], [1, 1]
        ];
        let playerForPathfinding = gameState.players.find(p => p.id === playerId);
        if (!playerForPathfinding)
            return MAX_PATH_DISTANCE; // Should not happen
        // Temporarily set the player's position in the copied gameState for accurate isValidPawnMove checks
        // This is because isValidPawnMove might rely on the player's current position within the passed gameState.
        const originalPlayerPosition = deepCopy(playerForPathfinding.position);
        while (queue.length > 0) {
            const { position: currentPos, distance } = queue.shift();
            // MODIFIED: Goal check now considers row or column based goals
            if ((goal.type === 'row' && currentPos.y === goal.value) ||
                (goal.type === 'col' && currentPos.x === goal.value)) {
                playerForPathfinding.position = originalPlayerPosition; // Restore original position
                return distance;
            }
            // Simulate player being at currentPos for pathfinding validity checks
            playerForPathfinding.position = currentPos;
            for (const [dY, dX] of DIRS) {
                const nextY = currentPos.y + dY;
                const nextX = currentPos.x + dX;
                const nextPos = { y: nextY, x: nextX };
                if (nextY >= 0 && nextY < this.BOARD_SIZE && nextX >= 0 && nextX < this.BOARD_SIZE) {
                    const visitedKey = `${nextY},${nextX}`;
                    if (!visited.has(visitedKey)) {
                        // isValidPawnMove uses the gameState where playerForPathfinding is now at currentPos
                        if (GameEngineManager_1.gameEngineManager.isValidPawnMove(gameState, currentPos, nextPos, playerId)) {
                            visited.add(visitedKey);
                            queue.push({ position: nextPos, distance: distance + 1 });
                        }
                    }
                }
            }
        }
        playerForPathfinding.position = originalPlayerPosition; // Restore original position
        return MAX_PATH_DISTANCE;
    }
    async getRandomMove(gameState, playerId) {
        const validMoves = GameEngineManager_1.gameEngineManager.getValidMoves(gameState, playerId);
        if (validMoves.length === 0) {
            throw new Error(`No valid moves available for AI player ${playerId} as fallback.`);
        }
        const randomIndex = Math.floor(Math.random() * validMoves.length);
        const randomMove = validMoves[randomIndex];
        console.log(`🤖 ${this.getName()} making random move: ${randomMove.type} to ${randomMove.toPosition ? `Y:${randomMove.toPosition.y},X:${randomMove.toPosition.x}` : `wall at Y:${randomMove.wallPosition?.y},X:${randomMove.wallPosition?.x} ${randomMove.wallOrientation}`}`);
        return randomMove;
    }
    getDifficulty() {
        return this.difficulty;
    }
    getName() {
        return `GreedyAI (${this.difficulty})`;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.GreedyAI = GreedyAI;
function createGreedyAI(difficulty) {
    return new GreedyAI(difficulty);
}
