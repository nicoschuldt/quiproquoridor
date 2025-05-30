"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameEngineManager = exports.GameEngineManager = void 0;
/**
 * GameEngineManager - Abstraction layer for game engine integration
 *
 * This class provides a clean interface for the future game engine implementation.
 * The actual game logic will be plugged in here by another engineer.
 */
class GameEngineManager {
    constructor() {
        this.engine = null;
    }
    /**
     * Sets the actual game engine implementation
     * This will be called when the game engine is ready
     */
    setEngine(engine) {
        this.engine = engine;
        console.log('🎮 Game engine connected');
    }
    /**
     * Checks if game engine is available
     */
    isEngineReady() {
        return this.engine !== null;
    }
    // ==========================================
    // GAME ENGINE INTERFACE IMPLEMENTATION
    // ==========================================
    createGame(playerIds, maxPlayers) {
        if (!this.engine) {
            return this.createMockGameState(playerIds, maxPlayers);
        }
        return this.engine.createGame(playerIds, maxPlayers);
    }
    validateMove(gameState, move) {
        if (!this.engine) {
            console.warn('⚠️ No game engine - using mock validation');
            return this.mockValidateMove(gameState, move);
        }
        return this.engine.validateMove(gameState, move);
    }
    applyMove(gameState, move) {
        if (!this.engine) {
            console.warn('⚠️ No game engine - using mock move application');
            return this.mockApplyMove(gameState, move);
        }
        return this.engine.applyMove(gameState, move);
    }
    isGameFinished(gameState) {
        if (!this.engine) {
            return false; // Mock: game never finishes
        }
        return this.engine.isGameFinished(gameState);
    }
    getWinner(gameState) {
        if (!this.engine) {
            return null; // Mock: no winner
        }
        return this.engine.getWinner(gameState);
    }
    getCurrentPlayer(gameState) {
        return gameState.players[gameState.currentPlayerIndex];
    }
    getValidMoves(gameState, playerId) {
        if (!this.engine) {
            return this.mockGetValidMoves(gameState, playerId);
        }
        return this.engine.getValidMoves(gameState, playerId);
    }
    isValidPawnMove(gameState, fromPos, toPos, playerId) {
        if (!this.engine) {
            return this.mockIsValidPawnMove(fromPos, toPos);
        }
        return this.engine.isValidPawnMove(gameState, fromPos, toPos, playerId);
    }
    isValidWallPlacement(gameState, wallPos, orientation) {
        if (!this.engine) {
            return this.mockIsValidWallPlacement(wallPos);
        }
        return this.engine.isValidWallPlacement(gameState, wallPos, orientation);
    }
    hasValidPathToGoal(gameState, playerId) {
        if (!this.engine) {
            return true; // Mock: always has path
        }
        return this.engine.hasValidPathToGoal(gameState, playerId);
    }
    getPlayerById(gameState, playerId) {
        return gameState.players.find(p => p.id === playerId) || null;
    }
    getPlayerStartPosition(playerIndex, maxPlayers) {
        // Standard Quoridor starting positions
        const positions = {
            2: [
                { x: 4, y: 0 }, // Bottom center
                { x: 4, y: 8 } // Top center
            ],
            4: [
                { x: 4, y: 0 }, // Bottom center
                { x: 8, y: 4 }, // Right center
                { x: 4, y: 8 }, // Top center
                { x: 0, y: 4 } // Left center
            ]
        };
        return positions[maxPlayers][playerIndex];
    }
    getPlayerGoalRow(playerIndex, maxPlayers) {
        if (maxPlayers === 2) {
            return playerIndex === 0 ? 8 : 0; // Player 0 goes to row 8, player 1 to row 0
        }
        else {
            // For 4 players: 0->8, 1->4, 2->0, 3->4 (opposite sides)
            const goals = [8, 4, 0, 4];
            return goals[playerIndex];
        }
    }
    // ==========================================
    // MOCK IMPLEMENTATIONS (TEMPORARY)
    // ==========================================
    createMockGameState(playerIds, maxPlayers) {
        const players = playerIds.map((id, index) => ({
            id,
            username: `Player ${index + 1}`, // Will be updated with real usernames
            color: ['red', 'blue', 'green', 'yellow'][index],
            position: this.getPlayerStartPosition(index, maxPlayers),
            wallsRemaining: maxPlayers === 2 ? 10 : 5,
            isConnected: true,
            joinedAt: new Date(),
        }));
        return {
            id: crypto.randomUUID(),
            players,
            walls: [],
            currentPlayerIndex: 0,
            status: 'playing',
            moves: [],
            createdAt: new Date(),
            startedAt: new Date(),
            maxPlayers,
        };
    }
    mockValidateMove(gameState, move) {
        // Basic validation - just check if it's the player's turn
        const currentPlayer = this.getCurrentPlayer(gameState);
        return move.playerId === currentPlayer.id;
    }
    mockApplyMove(gameState, move) {
        // Create new game state with the move applied
        const fullMove = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            ...move,
        };
        // Advance to next player
        const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
        return {
            ...gameState,
            moves: [...gameState.moves, fullMove],
            currentPlayerIndex: nextPlayerIndex,
        };
    }
    mockGetValidMoves(gameState, playerId) {
        const player = this.getPlayerById(gameState, playerId);
        if (!player)
            return [];
        // Mock: return basic adjacent moves
        const moves = [];
        const { x, y } = player.position;
        // Add adjacent pawn moves
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const newX = x + dx;
            const newY = y + dy;
            if (newX >= 0 && newX <= 8 && newY >= 0 && newY <= 8) {
                moves.push({
                    type: 'pawn',
                    playerId,
                    fromPosition: { x, y },
                    toPosition: { x: newX, y: newY },
                });
            }
        }
        return moves;
    }
    mockIsValidPawnMove(fromPos, toPos) {
        // Mock: allow moves to adjacent squares
        const dx = Math.abs(toPos.x - fromPos.x);
        const dy = Math.abs(toPos.y - fromPos.y);
        return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    }
    mockIsValidWallPlacement(wallPos) {
        // Mock: allow walls anywhere on the board
        return wallPos.x >= 0 && wallPos.x <= 7 && wallPos.y >= 0 && wallPos.y <= 7;
    }
}
exports.GameEngineManager = GameEngineManager;
// Singleton instance
exports.gameEngineManager = new GameEngineManager();
