"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiManager = exports.AIManager = void 0;
const RandomAI_1 = require("./RandomAI");
/**
 * AIManager - Manages AI players and their move generation
 *
 * This service handles all AI-related operations including creating AI instances,
 * generating moves, and managing AI player lifecycles.
 */
class AIManager {
    constructor() {
        this.aiInstances = new Map();
    }
    /**
     * Creates an AI instance for a player
     */
    createAI(playerId, difficulty) {
        console.log(`🤖 Creating AI instance for player ${playerId} with difficulty ${difficulty}`);
        const ai = new RandomAI_1.RandomAI(difficulty);
        this.aiInstances.set(playerId, ai);
        return ai;
    }
    /**
     * Gets an AI instance for a player
     */
    getAI(playerId) {
        return this.aiInstances.get(playerId) || null;
    }
    /**
     * Generates a move for an AI player
     */
    async generateMove(gameState, playerId) {
        const ai = this.getAI(playerId);
        if (!ai) {
            throw new Error(`No AI instance found for player ${playerId}`);
        }
        return ai.generateMove(gameState, playerId);
    }
    /**
     * Checks if a player is an AI
     */
    isAIPlayer(gameState, playerId) {
        const player = gameState.players.find(p => p.id === playerId);
        return player?.isAI || false;
    }
    /**
     * Removes an AI instance (cleanup)
     */
    removeAI(playerId) {
        if (this.aiInstances.has(playerId)) {
            console.log(`🗑️ Removing AI instance for player ${playerId}`);
            this.aiInstances.delete(playerId);
        }
    }
    /**
     * Gets the current number of AI instances
     */
    getActiveAICount() {
        return this.aiInstances.size;
    }
    /**
     * Clears all AI instances (for cleanup)
     */
    clearAll() {
        console.log(`🧹 Clearing all AI instances (${this.aiInstances.size} total)`);
        this.aiInstances.clear();
    }
}
exports.AIManager = AIManager;
// Singleton instance
exports.aiManager = new AIManager();
