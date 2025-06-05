"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RandomAI = void 0;
exports.createAI = createAI;
const GameEngineManager_1 = require("../game/GameEngineManager");
class RandomAI {
    constructor(difficulty = 'easy') {
        this.difficulty = difficulty;
        this.thinkingTimeMs = 0;
    }
    async generateMove(gameState, playerId) {
        console.log(`🤖 ${this.getName()} thinking for player ${playerId}...`);
        await this.delay(this.thinkingTimeMs);
        const validMoves = GameEngineManager_1.gameEngineManager.getValidMoves(gameState, playerId);
        if (validMoves.length === 0) {
            throw new Error(`No valid moves available for AI player ${playerId}`);
        }
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
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.RandomAI = RandomAI;
function createAI(difficulty) {
    return new RandomAI(difficulty);
}
