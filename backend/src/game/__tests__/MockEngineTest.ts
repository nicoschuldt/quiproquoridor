// backend/src/game/__tests__/MockEngineTest.ts
import { gameEngineManager } from '../GameEngineManager';
import type { GameState, Move } from '../../../../shared/types';

/**
 * MockEngineTest - Demonstrates and validates the mock game engine
 * 
 * This test file shows how the mock engine works and can be used
 * to validate functionality during development.
 */

function runMockEngineTest(): void {
  console.log('\n🧪 Starting Mock Engine Test...\n');

  // Test 1: Create a new game
  console.log('📋 Test 1: Creating new game');
  const playerIds = ['player1', 'player2'];
  const gameState = gameEngineManager.createGame(playerIds, 2);
  
  console.log(`✅ Game created with ID: ${gameState.id}`);
  console.log(`✅ Players: ${gameState.players.map(p => `${p.username} at (${p.position.x},${p.position.y})`).join(', ')}`);
  console.log(`✅ Current player: ${gameEngineManager.getCurrentPlayer(gameState).username}`);

  // Test 2: Get valid moves for current player
  console.log('\n📋 Test 2: Getting valid moves');
  const currentPlayer = gameEngineManager.getCurrentPlayer(gameState);
  const validMoves = gameEngineManager.getValidMoves(gameState, currentPlayer.id);
  
  console.log(`✅ Found ${validMoves.length} valid moves for ${currentPlayer.username}`);
  console.log('📝 Sample moves:');
  validMoves.slice(0, 5).forEach((move, index) => {
    if (move.type === 'pawn') {
      console.log(`  ${index + 1}. Pawn: (${move.fromPosition?.x},${move.fromPosition?.y}) → (${move.toPosition?.x},${move.toPosition?.y})`);
    } else {
      console.log(`  ${index + 1}. Wall: ${move.wallOrientation} at (${move.wallPosition?.x},${move.wallPosition?.y})`);
    }
  });

  // Test 3: Make a pawn move
  console.log('\n📋 Test 3: Making a pawn move');
  const pawnMove = validMoves.find(m => m.type === 'pawn');
  if (pawnMove) {
    const isValid = gameEngineManager.validateMove(gameState, pawnMove);
    console.log(`✅ Move validation: ${isValid}`);
    
    if (isValid) {
      const newGameState = gameEngineManager.applyMove(gameState, pawnMove);
      console.log(`✅ Move applied successfully`);
      console.log(`✅ New current player: ${gameEngineManager.getCurrentPlayer(newGameState).username}`);
      console.log(`✅ Total moves: ${newGameState.moves.length}`);
      
      // Test 4: Make a wall move
      console.log('\n📋 Test 4: Making a wall move');
      const currentPlayer2 = gameEngineManager.getCurrentPlayer(newGameState);
      const validMoves2 = gameEngineManager.getValidMoves(newGameState, currentPlayer2.id);
      const wallMove = validMoves2.find(m => m.type === 'wall');
      
      if (wallMove) {
        const isWallValid = gameEngineManager.validateMove(newGameState, wallMove);
        console.log(`✅ Wall move validation: ${isWallValid}`);
        
        if (isWallValid) {
          const finalGameState = gameEngineManager.applyMove(newGameState, wallMove);
          console.log(`✅ Wall placed successfully`);
          console.log(`✅ Total walls: ${finalGameState.walls.length}`);
          console.log(`✅ Player walls remaining: ${gameEngineManager.getCurrentPlayer(finalGameState).wallsRemaining}`);
          
          // Test 5: Game state validation
          console.log('\n📋 Test 5: Game state validation');
          const validation = gameEngineManager.validateGameState(finalGameState);
          console.log(`✅ Game state valid: ${validation.isValid}`);
          if (!validation.isValid) {
            console.log('❌ Validation errors:', validation.errors);
          }
          
          // Test 6: Game statistics
          console.log('\n📋 Test 6: Game statistics');
          const stats = gameEngineManager.getGameStats(finalGameState);
          console.log(`✅ Stats:`, stats);
          
          // Test 7: Engine info
          console.log('\n📋 Test 7: Engine info');
          const engineInfo = gameEngineManager.getEngineInfo();
          console.log(`✅ Engine type: ${engineInfo.type}`);
          console.log(`✅ Advanced engine ready: ${engineInfo.ready}`);
        }
      }
    }
  }

  console.log('\n🎉 Mock Engine Test Complete!\n');
}

/**
 * Test specific game scenarios
 */
function testGameScenarios(): void {
  console.log('\n🎮 Testing Game Scenarios...\n');

  // Scenario 1: Test invalid moves
  console.log('📋 Scenario 1: Invalid move handling');
  const gameState = gameEngineManager.createGame(['p1', 'p2'], 2);
  
  const invalidMove: Omit<Move, 'id' | 'timestamp'> = {
    type: 'pawn',
    playerId: 'wrong-player', // Wrong player
    fromPosition: { x: 4, y: 0 },
    toPosition: { x: 4, y: 1 }
  };
  
  const isInvalid = gameEngineManager.validateMove(gameState, invalidMove);
  console.log(`✅ Invalid move correctly rejected: ${!isInvalid}`);

  // Scenario 2: Test wall collision
  console.log('\n📋 Scenario 2: Wall collision detection');
  let testState = gameState;
  
  const wallMove1: Omit<Move, 'id' | 'timestamp'> = {
    type: 'wall',
    playerId: gameState.players[0].id,
    wallPosition: { x: 3, y: 3 },
    wallOrientation: 'horizontal'
  };
  
  testState = gameEngineManager.applyMove(testState, wallMove1);
  console.log(`✅ First wall placed successfully`);
  
  // Try to place overlapping wall
  const wallMove2: Omit<Move, 'id' | 'timestamp'> = {
    type: 'wall',
    playerId: gameState.players[1].id,
    wallPosition: { x: 3, y: 3 }, // Same position
    wallOrientation: 'horizontal'
  };
  
  const isOverlapping = gameEngineManager.validateMove(testState, wallMove2);
  console.log(`✅ Overlapping wall correctly rejected: ${!isOverlapping}`);

  // Scenario 3: Test win condition
  console.log('\n📋 Scenario 3: Win condition testing');
  const winTestState = gameEngineManager.createGame(['winner', 'loser'], 2);
  
  // Move player to goal position
  winTestState.players[0].position = { x: 4, y: 8 }; // Goal row for player 0
  
  const winner = gameEngineManager.getWinner(winTestState);
  const isFinished = gameEngineManager.isGameFinished(winTestState);
  
  console.log(`✅ Winner detected: ${winner === 'winner'}`);
  console.log(`✅ Game finished: ${isFinished}`);

  console.log('\n🎯 Game Scenarios Test Complete!\n');
}

// Export test functions for use in development
export { runMockEngineTest, testGameScenarios };

// Run tests if this file is executed directly
if (require.main === module) {
  runMockEngineTest();
  testGameScenarios();
}