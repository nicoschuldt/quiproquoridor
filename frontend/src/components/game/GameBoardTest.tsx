import React, { useState } from 'react';
import GameBoard from './GameBoard';
import type { GameState, Position, WallOrientation, Move } from '@/types';

// Mock game states for testing
const createMockGameState = (scenario: 'initial' | 'midgame' | 'walls'): GameState => {
  const baseState: GameState = {
    id: 'test-game',
    players: [
      {
        id: 'player1',
        username: 'Alice',
        color: 'red',
        position: { x: 4, y: 0 },
        wallsRemaining: 10,
        isConnected: true,
        joinedAt: new Date(),
      },
      {
        id: 'player2',
        username: 'Bob',
        color: 'blue',
        position: { x: 4, y: 8 },
        wallsRemaining: 10,
        isConnected: true,
        joinedAt: new Date(),
      }
    ],
    walls: [],
    currentPlayerIndex: 0,
    status: 'playing',
    moves: [],
    createdAt: new Date(),
    maxPlayers: 2,
  };

  switch (scenario) {
    case 'midgame':
      baseState.players[0].position = { x: 4, y: 2 };
      baseState.players[1].position = { x: 4, y: 6 };
      baseState.currentPlayerIndex = 1;
      break;
      
    case 'walls':
      baseState.players[0].position = { x: 3, y: 1 };
      baseState.players[1].position = { x: 5, y: 7 };
      baseState.walls = [
        {
          id: 'wall1',
          position: { x: 3, y: 2 },
          orientation: 'horizontal',
          playerId: 'player1'
        },
        {
          id: 'wall2',
          position: { x: 4, y: 4 },
          orientation: 'vertical',
          playerId: 'player2'
        }
      ];
      baseState.players[0].wallsRemaining = 9;
      baseState.players[1].wallsRemaining = 9;
      break;
  }

  return baseState;
};

// Mock valid moves
const createMockValidMoves = (currentPlayerId: string, gameState: GameState): Move[] => {
  const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);
  if (!currentPlayer) return [];

  const moves: Move[] = [];
  const { x, y } = currentPlayer.position;

  // Add possible pawn moves (simplified)
  const possibleMoves = [
    { x, y: y + 1 }, // up
    { x, y: y - 1 }, // down
    { x: x - 1, y }, // left
    { x: x + 1, y }, // right
  ].filter(pos => pos.x >= 0 && pos.x <= 8 && pos.y >= 0 && pos.y <= 8);

  possibleMoves.forEach((pos, index) => {
    moves.push({
      id: `move-${index}`,
      type: 'pawn',
      playerId: currentPlayerId,
      timestamp: new Date(),
      toPosition: pos,
    });
  });

  // Add some wall placement options
  if (currentPlayer.wallsRemaining > 0) {
    for (let i = 0; i < 3; i++) {
      moves.push({
        id: `wall-h-${i}`,
        type: 'wall',
        playerId: currentPlayerId,
        timestamp: new Date(),
        wallPosition: { x: x + i - 1, y: y + 1 },
        wallOrientation: 'horizontal',
      });
      
      moves.push({
        id: `wall-v-${i}`,
        type: 'wall',
        playerId: currentPlayerId,
        timestamp: new Date(),
        wallPosition: { x: x + 1, y: y + i - 1 },
        wallOrientation: 'vertical',
      });
    }
  }

  return moves.filter(move => {
    // Basic validation
    if (move.wallPosition) {
      return move.wallPosition.x >= 0 && move.wallPosition.x <= 7 && 
             move.wallPosition.y >= 0 && move.wallPosition.y <= 7;
    }
    return true;
  });
};

const GameBoardTest: React.FC = () => {
  const [scenario, setScenario] = useState<'initial' | 'midgame' | 'walls'>('initial');
  const [currentPlayerId, setCurrentPlayerId] = useState('player1');
  
  const gameState = createMockGameState(scenario);
  const validMoves = createMockValidMoves(currentPlayerId, gameState);

  const handlePawnMove = (from: Position, to: Position) => {
    console.log('🎯 Pawn move handler called:', { from, to });
    alert(`Move from (${from.x},${from.y}) to (${to.x},${to.y})`);
  };

  const handleWallPlace = (position: Position, orientation: WallOrientation) => {
    console.log('🧱 Wall place handler called:', { position, orientation });
    alert(`Place ${orientation} wall at (${position.x},${position.y})`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-center mb-6">GameBoard Component Test</h1>
        
        {/* Test controls */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-3">Test Controls</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Scenario</label>
              <select 
                value={scenario} 
                onChange={(e) => setScenario(e.target.value as any)}
                className="input-field w-full"
              >
                <option value="initial">Initial Game</option>
                <option value="midgame">Mid Game</option>
                <option value="walls">With Walls</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Current Player</label>
              <select 
                value={currentPlayerId} 
                onChange={(e) => setCurrentPlayerId(e.target.value)}
                className="input-field w-full"
              >
                <option value="player1">Alice (Red)</option>
                <option value="player2">Bob (Blue)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Valid Moves</label>
              <div className="text-sm text-gray-600">
                {validMoves.length} moves available
              </div>
            </div>
          </div>
        </div>

        {/* GameBoard component */}
        <GameBoard
          gameState={gameState}
          currentPlayerId={currentPlayerId}
          onPawnMove={handlePawnMove}
          onWallPlace={handleWallPlace}
          validMoves={validMoves}
          disabled={false}
        />

        {/* Debug information */}
        <div className="mt-6 bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-3">Debug Information</h3>
          <div className="text-sm space-y-2">
            <div><strong>Game State:</strong> {JSON.stringify(gameState, null, 2)}</div>
            <div><strong>Valid Moves:</strong> {JSON.stringify(validMoves, null, 2)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameBoardTest;