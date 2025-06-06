"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameEngineManager = exports.GameEngineManager = void 0;
const QuoridorEngine_1 = require("./QuoridorEngine");
class GameEngineManager {
    constructor() {
        this.engine = QuoridorEngine_1.quoridorEngine;
        console.log('GameEngineManager initialized with mock engine');
    }
    setEngine(engine) {
        this.engine = engine;
        console.log('Advanced game engine connected - replacing mock engine');
    }
    isEngineReady() {
        return this.engine !== null;
    }
    getActiveEngine() {
        return this.engine;
    }
    createGame(playerIds, maxPlayers) {
        console.log(`Creating game with ${this.engine ? 'advanced' : 'mock'} engine`);
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
    getEngineInfo() {
        return {
            type: this.engine ? 'advanced' : 'mock',
            ready: this.isEngineReady()
        };
    }
    validateGameState(gameState) {
        const errors = [];
        if (!gameState.players || gameState.players.length === 0) {
            errors.push('No players found');
        }
        if (gameState.currentPlayerIndex >= gameState.players.length) {
            errors.push('Invalid current player index');
        }
        for (const player of gameState.players) {
            if (player.position.x < 0 || player.position.x > 8 ||
                player.position.y < 0 || player.position.y > 8) {
                errors.push(`Player ${player.id} has invalid position`);
            }
            if (player.wallsRemaining < 0) {
                errors.push(`Player ${player.id} has negative walls`);
            }
        }
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
exports.gameEngineManager = new GameEngineManager();
