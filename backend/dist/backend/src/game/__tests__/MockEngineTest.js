"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMockEngineTest = runMockEngineTest;
exports.testGameScenarios = testGameScenarios;
const GameEngineManager_1 = require("../GameEngineManager");
function runMockEngineTest() {
    console.log('\nStarting Mock Engine Test...\n');
    console.log('Test 1: Creating new game');
    const playerIds = ['player1', 'player2'];
    const gameState = GameEngineManager_1.gameEngineManager.createGame(playerIds, 2);
    console.log(`Game created with ID: ${gameState.id}`);
    console.log(`Players: ${gameState.players.map(p => `${p.username} at (${p.position.x},${p.position.y})`).join(', ')}`);
    console.log(`Current player: ${GameEngineManager_1.gameEngineManager.getCurrentPlayer(gameState).username}`);
    console.log('\nTest 2: Getting valid moves');
    const currentPlayer = GameEngineManager_1.gameEngineManager.getCurrentPlayer(gameState);
    const validMoves = GameEngineManager_1.gameEngineManager.getValidMoves(gameState, currentPlayer.id);
    console.log(`Found ${validMoves.length} valid moves for ${currentPlayer.username}`);
    console.log('📝 Sample moves:');
    validMoves.slice(0, 5).forEach((move, index) => {
        if (move.type === 'pawn') {
            console.log(`  ${index + 1}. Pawn: (${move.fromPosition?.x},${move.fromPosition?.y}) → (${move.toPosition?.x},${move.toPosition?.y})`);
        }
        else {
            console.log(`  ${index + 1}. Wall: ${move.wallOrientation} at (${move.wallPosition?.x},${move.wallPosition?.y})`);
        }
    });
    console.log('\nTest 3: Making a pawn move');
    const pawnMove = validMoves.find(m => m.type === 'pawn');
    if (pawnMove) {
        const isValid = GameEngineManager_1.gameEngineManager.validateMove(gameState, pawnMove);
        console.log(`Move validation: ${isValid}`);
        if (isValid) {
            const newGameState = GameEngineManager_1.gameEngineManager.applyMove(gameState, pawnMove);
            console.log(`Move applied successfully`);
            console.log(`New current player: ${GameEngineManager_1.gameEngineManager.getCurrentPlayer(newGameState).username}`);
            console.log(`Total moves: ${newGameState.moves.length}`);
            console.log('\nTest 4: Making a wall move');
            const currentPlayer2 = GameEngineManager_1.gameEngineManager.getCurrentPlayer(newGameState);
            const validMoves2 = GameEngineManager_1.gameEngineManager.getValidMoves(newGameState, currentPlayer2.id);
            const wallMove = validMoves2.find(m => m.type === 'wall');
            if (wallMove) {
                const isWallValid = GameEngineManager_1.gameEngineManager.validateMove(newGameState, wallMove);
                console.log(`Wall move validation: ${isWallValid}`);
                if (isWallValid) {
                    const finalGameState = GameEngineManager_1.gameEngineManager.applyMove(newGameState, wallMove);
                    console.log(`Wall placed successfully`);
                    console.log(`Total walls: ${finalGameState.walls.length}`);
                    console.log(`Player walls remaining: ${GameEngineManager_1.gameEngineManager.getCurrentPlayer(finalGameState).wallsRemaining}`);
                    console.log('\nTest 5: Game state validation');
                    const validation = GameEngineManager_1.gameEngineManager.validateGameState(finalGameState);
                    console.log(`Game state valid: ${validation.isValid}`);
                    if (!validation.isValid) {
                        console.log('Validation errors:', validation.errors);
                    }
                    console.log('\nTest 6: Game statistics');
                    const stats = GameEngineManager_1.gameEngineManager.getGameStats(finalGameState);
                    console.log(`Stats:`, stats);
                    console.log('\nTest 7: Engine info');
                    const engineInfo = GameEngineManager_1.gameEngineManager.getEngineInfo();
                    console.log(`Engine type: ${engineInfo.type}`);
                    console.log(`Advanced engine ready: ${engineInfo.ready}`);
                }
            }
        }
    }
    console.log('\nMock Engine Test Complete!\n');
}
function testGameScenarios() {
    console.log('\nTesting Game Scenarios...\n');
    console.log('Scenario 1: Invalid move handling');
    const gameState = GameEngineManager_1.gameEngineManager.createGame(['p1', 'p2'], 2);
    const invalidMove = {
        type: 'pawn',
        playerId: 'wrong-player',
        fromPosition: { x: 4, y: 0 },
        toPosition: { x: 4, y: 1 }
    };
    const isInvalid = GameEngineManager_1.gameEngineManager.validateMove(gameState, invalidMove);
    console.log(`Invalid move correctly rejected: ${!isInvalid}`);
    console.log('\nScenario 2: Wall collision detection');
    let testState = gameState;
    const wallMove1 = {
        type: 'wall',
        playerId: gameState.players[0].id,
        wallPosition: { x: 3, y: 3 },
        wallOrientation: 'horizontal'
    };
    testState = GameEngineManager_1.gameEngineManager.applyMove(testState, wallMove1);
    console.log(`First wall placed successfully`);
    const wallMove2 = {
        type: 'wall',
        playerId: gameState.players[1].id,
        wallPosition: { x: 3, y: 3 }, // Same position
        wallOrientation: 'horizontal'
    };
    const isOverlapping = GameEngineManager_1.gameEngineManager.validateMove(testState, wallMove2);
    console.log(`Overlapping wall correctly rejected: ${!isOverlapping}`);
    console.log('\nScenario 3: Win condition testing');
    const winTestState = GameEngineManager_1.gameEngineManager.createGame(['winner', 'loser'], 2);
    winTestState.players[0].position = { x: 4, y: 8 };
    const winner = GameEngineManager_1.gameEngineManager.getWinner(winTestState);
    const isFinished = GameEngineManager_1.gameEngineManager.isGameFinished(winTestState);
    console.log(`Winner detected: ${winner === 'winner'}`);
    console.log(`Game finished: ${isFinished}`);
    console.log('\nGame Scenarios Test Complete!\n');
}
if (require.main === module) {
    runMockEngineTest();
    testGameScenarios();
}
