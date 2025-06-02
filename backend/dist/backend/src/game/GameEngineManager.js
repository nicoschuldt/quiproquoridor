"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameEngineManager = exports.GameEngineManager = void 0;
const MockQuoridorEngine_1 = require("./MockQuoridorEngine");
/**
 * GameEngineManager - Abstraction layer for game engine integration
 *
 * This class provides a clean interface for the future game engine implementation.
 * Currently uses a sophisticated mock engine that implements realistic Quoridor rules.
 * The actual advanced game engine will be plugged in here by another engineer.
 */
class GameEngineManager {
    constructor() {
        this.engine = null;
        this.mockEngine = MockQuoridorEngine_1.mockQuoridorEngine;
        console.log('🎮 GameEngineManager initialized with mock engine');
    }
    /**
     * Sets the actual game engine implementation
     * This will be called when the advanced game engine is ready
     */
    setEngine(engine) {
        this.engine = engine;
        console.log('🚀 Advanced game engine connected - replacing mock engine');
    }
    /**
     * Checks if advanced game engine is available
     */
    isEngineReady() {
        return this.engine !== null;
    }
    /**
     * Gets the currently active engine (mock or real)
     */
    getActiveEngine() {
        return this.engine || this.mockEngine;
    }
    // ==========================================
    // GAME ENGINE INTERFACE IMPLEMENTATION
    // ==========================================
    createGame(playerIds, maxPlayers) {
        console.log(`🎲 Creating game with ${this.engine ? 'advanced' : 'mock'} engine`);
        return this.getActiveEngine().createGame(playerIds, maxPlayers);
    }
    validateMove(gameState, move) {
        return this.getActiveEngine().validateMove(gameState, move);
    }
    applyMove(gameState, move) {
        return this.getActiveEngine().applyMove(gameState, move);
    }
    isGameFinished(gameState) {
        return this.getActiveEngine().isGameFinished(gameState);
    }
    getWinner(gameState) {
        return this.getActiveEngine().getWinner(gameState);
    }
    getCurrentPlayer(gameState) {
        return this.getActiveEngine().getCurrentPlayer(gameState);
    }
    getValidMoves(gameState, playerId) {
        return this.getActiveEngine().getValidMoves(gameState, playerId);
    }
    isValidPawnMove(gameState, fromPos, toPos, playerId) {
        return this.getActiveEngine().isValidPawnMove(gameState, fromPos, toPos, playerId);
    }
    isValidWallPlacement(gameState, wallPos, orientation) {
        return this.getActiveEngine().isValidWallPlacement(gameState, wallPos, orientation);
    }
    hasValidPathToGoal(gameState, playerId) {
        return this.getActiveEngine().hasValidPathToGoal(gameState, playerId);
    }
    getPlayerById(gameState, playerId) {
        return this.getActiveEngine().getPlayerById(gameState, playerId);
    }
    getPlayerStartPosition(playerIndex, maxPlayers) {
        return this.getActiveEngine().getPlayerStartPosition(playerIndex, maxPlayers);
    }
    getPlayerGoalRow(playerIndex, maxPlayers) {
        return this.getActiveEngine().getPlayerGoalRow(playerIndex, maxPlayers);
    }
    // ==========================================
    // ADDITIONAL UTILITY METHODS
    // ==========================================
    /**
     * Gets debug information about the current engine
     */
    getEngineInfo() {
        return {
            type: this.engine ? 'advanced' : 'mock',
            ready: this.isEngineReady()
        };
    }
    /**
     * Validates a complete game state for consistency
     */
    validateGameState(gameState) {
        const errors = [];
        // Basic structure validation
        if (!gameState.players || gameState.players.length === 0) {
            errors.push('No players found');
        }
        if (gameState.currentPlayerIndex >= gameState.players.length) {
            errors.push('Invalid current player index');
        }
        // Validate player positions
        for (const player of gameState.players) {
            if (player.position.x < 0 || player.position.x > 8 ||
                player.position.y < 0 || player.position.y > 8) {
                errors.push(`Player ${player.id} has invalid position`);
            }
            if (player.wallsRemaining < 0) {
                errors.push(`Player ${player.id} has negative walls`);
            }
        }
        // Validate walls
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
     * Gets comprehensive game statistics
     */
    getGameStats(gameState) {
        return {
            totalMoves: gameState.moves.length,
            wallsPlaced: gameState.walls.length,
            currentTurn: Math.floor(gameState.moves.length / gameState.players.length) + 1,
            playersAtGoal: gameState.players.filter(player => {
                const goalRow = this.getPlayerGoalRow(gameState.players.indexOf(player), gameState.maxPlayers);
                return player.position.y === goalRow;
            }).length
        };
    }
}
exports.GameEngineManager = GameEngineManager;
// Singleton instance
exports.gameEngineManager = new GameEngineManager();
