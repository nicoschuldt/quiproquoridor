import { gameEngineManager } from '../GameEngineManager';
import type { GameState, Move } from '../../../shared/types';

function runMockEngineTest(): void {
  console.log('\nStarting Mock Engine Test...\n');

  console.log('Test 1: Creating new game');
  const playerIds = ['player1', 'player2'];
  const gameState = gameEngineManager.createGame(playerIds, 2);
  
  console.log(`Game created with ID: ${gameState.id}`);
  console.log(`Players: ${gameState.players.map(p => `${p.username} at (${p.position.x},${p.position.y})`).join(', ')}`);
  console.log(`Current player: ${gameEngineManager.getCurrentPlayer(gameState).username}`);

  console.log('\nTest 2: Getting valid moves');
  const currentPlayer = gameEngineManager.getCurrentPlayer(gameState);
  const validMoves = gameEngineManager.getValidMoves(gameState, currentPlayer.id);
  
  console.log(`Found ${validMoves.length} valid moves for ${currentPlayer.username}`);
  console.log('📝 Sample moves:');
  validMoves.slice(0, 5).forEach((move, index) => {
    if (move.type === 'pawn') {
      console.log(`  ${index + 1}. Pawn: (${move.fromPosition?.x},${move.fromPosition?.y}) → (${move.toPosition?.x},${move.toPosition?.y})`);
    } else {
      console.log(`  ${index + 1}. Wall: ${move.wallOrientation} at (${move.wallPosition?.x},${move.wallPosition?.y})`);
    }
  });

  console.log('\nTest 3: Making a pawn move');
  const pawnMove = validMoves.find(m => m.type === 'pawn');
  if (pawnMove) {
    const isValid = gameEngineManager.validateMove(gameState, pawnMove);
    console.log(`Move validation: ${isValid}`);
    
    if (isValid) {
      const newGameState = gameEngineManager.applyMove(gameState, pawnMove);
      console.log(`Move applied successfully`);
      console.log(`New current player: ${gameEngineManager.getCurrentPlayer(newGameState).username}`);
      console.log(`Total moves: ${newGameState.moves.length}`);
      
      console.log('\nTest 4: Making a wall move');
      const currentPlayer2 = gameEngineManager.getCurrentPlayer(newGameState);
      const validMoves2 = gameEngineManager.getValidMoves(newGameState, currentPlayer2.id);
      const wallMove = validMoves2.find(m => m.type === 'wall');
      
      if (wallMove) {
        const isWallValid = gameEngineManager.validateMove(newGameState, wallMove);
        console.log(`Wall move validation: ${isWallValid}`);
        
        if (isWallValid) {
          const finalGameState = gameEngineManager.applyMove(newGameState, wallMove);
          console.log(`Wall placed successfully`);
          console.log(`Total walls: ${finalGameState.walls.length}`);
          console.log(`Player walls remaining: ${gameEngineManager.getCurrentPlayer(finalGameState).wallsRemaining}`);
          
          console.log('\nTest 5: Game state validation');
          const validation = gameEngineManager.validateGameState(finalGameState);
          console.log(`Game state valid: ${validation.isValid}`);
          if (!validation.isValid) {
            console.log('Validation errors:', validation.errors);
          }
          
          console.log('\nTest 6: Game statistics');
          const stats = gameEngineManager.getGameStats(finalGameState);
          console.log(`Stats:`, stats);
          
          console.log('\nTest 7: Engine info');
          const engineInfo = gameEngineManager.getEngineInfo();
          console.log(`Engine type: ${engineInfo.type}`);
          console.log(`Advanced engine ready: ${engineInfo.ready}`);
        }
      }
    }
  }

  console.log('\nMock Engine Test Complete!\n');
}

function testGameScenarios(): void {
  console.log('\nTesting Game Scenarios...\n');

  console.log('Scenario 1: Invalid move handling');
  const gameState = gameEngineManager.createGame(['p1', 'p2'], 2);
  
  const invalidMove: Omit<Move, 'id' | 'timestamp'> = {
    type: 'pawn',
    playerId: 'wrong-player',
    fromPosition: { x: 4, y: 0 },
    toPosition: { x: 4, y: 1 }
  };
  
  const isInvalid = gameEngineManager.validateMove(gameState, invalidMove);
  console.log(`Invalid move correctly rejected: ${!isInvalid}`);

  console.log('\nScenario 2: Wall collision detection');
  let testState = gameState;
  
  const wallMove1: Omit<Move, 'id' | 'timestamp'> = {
    type: 'wall',
    playerId: gameState.players[0].id,
    wallPosition: { x: 3, y: 3 },
    wallOrientation: 'horizontal'
  };
  
  testState = gameEngineManager.applyMove(testState, wallMove1);
  console.log(`First wall placed successfully`);
  
  const wallMove2: Omit<Move, 'id' | 'timestamp'> = {
    type: 'wall',
    playerId: gameState.players[1].id,
    wallPosition: { x: 3, y: 3 }, // Same position
    wallOrientation: 'horizontal'
  };
  
  const isOverlapping = gameEngineManager.validateMove(testState, wallMove2);
  console.log(`Overlapping wall correctly rejected: ${!isOverlapping}`);

  console.log('\nScenario 3: Win condition testing');
  const winTestState = gameEngineManager.createGame(['winner', 'loser'], 2);
  
  winTestState.players[0].position = { x: 4, y: 8 };
  
  const winner = gameEngineManager.getWinner(winTestState);
  const isFinished = gameEngineManager.isGameFinished(winTestState);
  
  console.log(`Winner detected: ${winner === 'winner'}`);
  console.log(`Game finished: ${isFinished}`);

  console.log('\nGame Scenarios Test Complete!\n');
}

export { runMockEngineTest, testGameScenarios };

if (require.main === module) {
  runMockEngineTest();
  testGameScenarios();
}