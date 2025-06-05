"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiManager = exports.AIManager = void 0;
const RandomAI_1 = require("./RandomAI");
const GreedyAI_1 = require("./GreedyAI");
class AIManager {
    constructor() {
        this.aiInstances = new Map();
    }
    createAI(playerId, difficulty) {
        console.log(`🤖 Creating AI instance for player ${playerId} with difficulty ${difficulty}`);
        let ai;
        switch (difficulty) {
            case 'easy':
                ai = new RandomAI_1.RandomAI(difficulty);
                break;
            case 'medium':
                ai = new GreedyAI_1.GreedyAI(difficulty);
                break;
            case 'hard':
                ai = new GreedyAI_1.GreedyAI(difficulty);
                break;
            default:
                console.warn(`Unknown AI difficulty: ${difficulty}. Defaulting to RandomAI (easy).`);
                ai = new RandomAI_1.RandomAI('easy');
                break;
        }
        this.aiInstances.set(playerId, ai);
        return ai;
    }
    getAI(playerId) {
        return this.aiInstances.get(playerId) || null;
    }
    async generateMove(gameState, playerId) {
        const ai = this.getAI(playerId);
        if (!ai) {
            throw new Error(`No AI instance found for player ${playerId}`);
        }
        try {
            return await ai.generateMove(gameState, playerId);
        }
        catch (error) {
            console.error(`AIManager: Error during AI move generation for player ${playerId} (difficulty: ${ai.constructor.name}).`, error);
            throw new Error(`AI ${playerId} failed to generate a move: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    isAIPlayer(gameState, playerId) {
        const player = gameState.players.find(p => p.id === playerId);
        return player?.isAI || false;
    }
    removeAI(playerId) {
        if (this.aiInstances.has(playerId)) {
            console.log(`🗑️ Removing AI instance for player ${playerId}`);
            this.aiInstances.delete(playerId);
        }
    }
    getActiveAICount() {
        return this.aiInstances.size;
    }
    clearAll() {
        console.log(`🧹 Clearing all AI instances (${this.aiInstances.size} total)`);
        this.aiInstances.clear();
    }
}
exports.AIManager = AIManager;
exports.aiManager = new AIManager();
