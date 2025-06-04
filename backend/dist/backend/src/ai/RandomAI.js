"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RandomAI = void 0;
exports.createAI = createAI;
const GameEngineManager_1 = require("../game/GameEngineManager");
/**
 * RandomAI - A simple AI that makes random valid moves
 *
 * This is the basic AI implementation that will be used for testing
 * and as a fallback. More sophisticated AIs can be implemented later.
 */
class RandomAI {
    constructor(difficulty = 'easy') {
        this.difficulty = difficulty;
        // Set thinking time based on difficulty
        switch (difficulty) {
            case 'easy':
                this.thinkingTimeMs = 0; // 0.5 seconds
                break;
            case 'medium':
                this.thinkingTimeMs = 0; // 1 second
                break;
            case 'hard':
                this.thinkingTimeMs = 0; // 1.5 seconds
                break;
        }
    }
    async generateMove(gameState, playerId) {
        console.log(`🤖 ${this.getName()} thinking for player ${playerId}...`);
        // Simulate thinking time
        await this.delay(this.thinkingTimeMs);
        // Get all valid moves for the player
        const validMoves = GameEngineManager_1.gameEngineManager.getValidMoves(gameState, playerId);
        if (validMoves.length === 0) {
            throw new Error(`No valid moves available for AI player ${playerId}`);
        }
        // For now, just pick a random move
        // TODO: Add more sophisticated move selection based on difficulty
        const randomIndex = Math.floor(Math.random() * validMoves.length);
        const selectedMove = validMoves[randomIndex];
        console.log(`🤖 ${this.getName()} selected ${selectedMove.type} move`);
        return selectedMove;
    }
    getDifficulty() {
        return this.difficulty;
    }
    getName() {
        return `RandomAI (${this.difficulty})`;
    }
    /**
     * Simple delay utility for simulating thinking time
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.RandomAI = RandomAI;
// Factory function to create AI instances
function createAI(difficulty) {
    return new RandomAI(difficulty);
}
