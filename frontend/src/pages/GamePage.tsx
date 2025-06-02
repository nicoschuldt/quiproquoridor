import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGameSocket } from '../hooks/useGameSocket';
import GameBoard from '../components/game/GameBoard';
import type { GameState, Move, Player, ApiError } from '@/types';

interface GamePageState {
  gameState: GameState | null;
  validMoves: Move[];
  isLoading: boolean;
  error: string | null;
  isGameStarted: boolean;
}

const GamePage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [state, setState] = useState<GamePageState>({
    gameState: null,
    validMoves: [],
    isLoading: true,
    error: null,
    isGameStarted: false,
  });

  // Game socket hook with event handlers
  const gameSocket = useGameSocket({
    roomId: roomId!,
    onGameStarted: useCallback((data: { gameState: GameState }) => {
      console.log('🚀 Game started:', data);
      setState(prev => ({
        ...prev,
        gameState: data.gameState,
        isGameStarted: true,
        isLoading: false,
        error: null,
      }));
      gameSocket.requestGameState();
    }, []),
    
    onMoveMade: useCallback((data: { move: Move; gameState: GameState }) => {
      console.log('🎯 Move made:', data);
      setState(prev => ({
        ...prev,
        gameState: data.gameState,
        error: null,
      }));
      
      // Request valid moves if it's now the user's turn
      if (user && data.gameState.players[data.gameState.currentPlayerIndex].id === user.id) {
        setTimeout(() => gameSocket.requestGameState(), 100);
      }
    }, [user]),
    
    onGameFinished: useCallback((data: { gameState: GameState; winner: Player }) => {
      console.log('🏆 Game finished:', data);
      setState(prev => ({
        ...prev,
        gameState: data.gameState,
        validMoves: [],
      }));
      
      const isWinner = data.winner.id === user?.id;
      
      // **ENHANCED**: Show results and redirect after delay
      setTimeout(() => {
        const message = isWinner ? 
          `🏆 Congratulations! You won the game!` : 
          `Game Over! ${data.winner.username} won the game.`;
        
        alert(message + '\n\nReturning to lobby...');
        
        // Navigate back to home after showing results
        navigate('/');
      }, 2000); // 2 second delay to show the final board state
    }, [user, navigate]),
    
    onGameStateSync: useCallback((data: { gameState: GameState; validMoves?: Move[] }) => {
      console.log('📊 Game state sync:', data);
      setState(prev => ({
        ...prev,
        gameState: data.gameState,
        validMoves: data.validMoves || [],
        isLoading: false,
        error: null,
        isGameStarted: true,
      }));
    }, []),
    
    onInvalidMove: useCallback((data: { error: string }) => {
      console.log('❌ Invalid move:', data);
      setState(prev => ({
        ...prev,
        error: `Invalid move: ${data.error}`,
      }));
      setTimeout(() => setState(prev => ({ ...prev, error: null })), 3000);
    }, []),
    
    onError: useCallback((data: { error: ApiError }) => {
      console.log('⚠️ Socket error:', data);
      setState(prev => ({
        ...prev,
        error: data.error.message,
        isLoading: false,
      }));
    }, [])
  });

  // Join room on mount and request initial state
  useEffect(() => {
    if (roomId && gameSocket.isConnected) {
      gameSocket.joinRoom();
      gameSocket.requestGameState();
    }
    
    return () => {
      if (roomId) {
        gameSocket.leaveRoom();
      }
    };
  }, [roomId, gameSocket.isConnected]);

  // Redirect if no user or room
  if (!user) {
    navigate('/login');
    return null;
  }

  if (!roomId) {
    navigate('/');
    return null;
  }

  const currentPlayer = state.gameState?.players.find(p => p.id === user.id);
  const isCurrentTurn = state.gameState && 
    state.gameState.players[state.gameState.currentPlayerIndex].id === user.id;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Quoridor Game</h1>
              <p className="text-sm text-gray-600">Room: {roomId}</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className={`text-sm px-2 py-1 rounded ${
                gameSocket.connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
                gameSocket.connectionStatus === 'disconnected' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {gameSocket.connectionStatus === 'connected' && '🟢 Connected'}
                {gameSocket.connectionStatus === 'disconnected' && '🔴 Disconnected'}
                {gameSocket.connectionStatus === 'connecting' && '🟡 Connecting...'}
              </div>
              <button 
                onClick={() => navigate('/')}
                className="btn-secondary"
              >
                Leave Game
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Error Display */}
        {state.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            <div className="flex justify-between items-center">
              <span>{state.error}</span>
              <button 
                onClick={() => setState(prev => ({ ...prev, error: null }))}
                className="text-red-500 hover:text-red-700"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        
        {/* Loading State */}
        {state.isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading game...</p>
            </div>
          </div>
        )}
        
        {/* Game Not Started */}
        {!state.isLoading && !state.isGameStarted && (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Game Room</h2>
            <p className="text-gray-600 mb-6">Ready to start the game?</p>
            <button 
              onClick={gameSocket.startGame}
              className="btn-primary"
              disabled={gameSocket.connectionStatus !== 'connected'}
            >
              Start Game
            </button>
          </div>
        )}
        
        {/* Active Game */}
        {!state.isLoading && state.isGameStarted && state.gameState && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <GameBoard
                gameState={state.gameState}
                currentPlayerId={user.id}
                onPawnMove={gameSocket.makePawnMove}
                onWallPlace={gameSocket.placeWall}
                validMoves={state.validMoves}
                disabled={!isCurrentTurn || gameSocket.connectionStatus !== 'connected'}
              />
            </div>
            
            {/* Game Info Sidebar */}
            <div className="space-y-4">
              <div className="card">
                <h3 className="font-semibold mb-2">Current Turn</h3>
                <div className={`p-2 rounded ${isCurrentTurn ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {isCurrentTurn ? 'Your turn!' : 
                    `${state.gameState.players[state.gameState.currentPlayerIndex].username}'s turn`
                  }
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold mb-2">Players</h3>
                <div className="space-y-2">
                  {state.gameState.players.map((player) => (
                    <div key={player.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full bg-game-${player.color}`} />
                        <span className={player.id === user.id ? 'font-bold' : ''}>
                          {player.username}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {player.wallsRemaining} walls
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GamePage;