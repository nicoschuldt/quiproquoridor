import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGameSocket } from '../hooks/useGameSocket';
import GameBoard from '../components/game/GameBoard';
import { getBoardThemeClass } from '../utils/themeUtils';
import type { GameState, Move, Player, ApiError } from '@/types';

interface GamePageState {
  gameState: GameState | null;
  validMoves: Move[];
  isLoading: boolean;
  error: string | null;
  isGameStarted: boolean;
  disconnectedPlayers: Set<string>;
  notifications: Array<{
    id: string;
    type: 'info' | 'warning' | 'success';
    message: string;
    timeout?: number;
  }>;
  endGameModal: {
    isOpen: boolean;
    winner: Player | null;
    reason: 'normal' | 'forfeit' | 'timeout';
    message: string;
  } | null;
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
    disconnectedPlayers: new Set(),
    notifications: [],
    endGameModal: null,
  });

  // **NEW**: Handle forfeit events
  const addNotification = useCallback((type: 'info' | 'warning' | 'success', message: string, timeout: number = 5000) => {
    const id = crypto.randomUUID();
    setState(prev => ({
      ...prev,
      notifications: [...prev.notifications, { id, type, message, timeout }]
    }));
    
    // Auto-remove notification after timeout
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        notifications: prev.notifications.filter(n => n.id !== id)
      }));
    }, timeout);
  }, []);

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
        endGameModal: {
          isOpen: true,
          winner: data.winner,
          reason: 'normal',
          message: data.winner.id === user?.id ? 
            'Congratulations! You won the game!' : 
            `${data.winner.username} won the game!`
        }
      }));
    }, [user]),
    
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

    onPlayerForfeited: useCallback((data: { playerId: string; playerName: string; gameState: GameState }) => {
      console.log('🏳️ Player forfeited:', data);
      setState(prev => ({
        ...prev,
        gameState: data.gameState,
      }));
      
      // **FIXED**: Check if game is finished after forfeit
      if (data.gameState.status === 'finished') {
        const winner = data.gameState.players.find(p => p.id === data.gameState.winner);
        const isCurrentUser = data.playerId === user?.id;
        
        setState(prev => ({
          ...prev,
          endGameModal: {
            isOpen: true,
            winner: winner || null,
            reason: 'forfeit',
            message: isCurrentUser ? 
              'You forfeited the game' : 
              winner ? 
                (winner.id === user?.id ? 
                  `You won! ${data.playerName} forfeited` : 
                  `${winner.username} won! ${data.playerName} forfeited`) :
                `${data.playerName} forfeited the game`
          }
        }));
      } else {
        // Game continues with forfeit notification
        const isCurrentUser = data.playerId === user?.id;
        const message = isCurrentUser ? 
          'You have forfeited the game' : 
          `${data.playerName} has forfeited the game`;
        
        addNotification('info', message, 5000);
      }
    }, [user?.id, addNotification]),

    onDisconnectionWarning: useCallback((data: { playerId: string; playerName: string; timeoutSeconds: number }) => {
      console.log('⚠️ Player disconnected:', data);
      setState(prev => ({
        ...prev,
        disconnectedPlayers: new Set([...prev.disconnectedPlayers, data.playerId])
      }));
      
      addNotification('warning', `${data.playerName} disconnected. Auto-forfeit in ${data.timeoutSeconds}s if they don't reconnect.`, 8000);
      
      // **NEW**: Set timeout for auto-forfeit modal if current user disconnected
      if (data.playerId === user?.id) {
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            endGameModal: {
              isOpen: true,
              winner: null,
              reason: 'timeout',
              message: 'You were disconnected and the game timed out'
            }
          }));
        }, data.timeoutSeconds * 1000);
      }
    }, [addNotification, user?.id]),

    onReconnectionSuccess: useCallback((data: { playerId: string; playerName: string; gameState: GameState }) => {
      console.log('🔗 Player reconnected:', data);
      setState(prev => ({
        ...prev,
        gameState: data.gameState,
        disconnectedPlayers: new Set([...prev.disconnectedPlayers].filter(id => id !== data.playerId))
      }));
      
      addNotification('success', `${data.playerName} reconnected!`, 3000);
    }, [addNotification]),
    
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

  // **NEW**: Forfeit confirmation
  const handleForfeit = useCallback(() => {
    if (!window.confirm('Are you sure you want to forfeit this game? This action cannot be undone.')) {
      return;
    }
    gameSocket.forfeitGame();
  }, [gameSocket]);

  // **NEW**: Handle end game modal close
  const handleEndGameModalClose = useCallback(() => {
    setState(prev => ({
      ...prev,
      endGameModal: null
    }));
    navigate('/');
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* **NEW**: End Game Modal */}
      {state.endGameModal?.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 text-center">
            <div className="mb-6">
              {state.endGameModal.winner ? (
                <div>
                  <div className="text-6xl mb-4">
                    {state.endGameModal.winner.id === user?.id ? '🏆' : '🎯'}
                  </div>
                  <h2 className="text-2xl font-bold mb-2">
                    {state.endGameModal.winner.id === user?.id ? 'Victory!' : 'Game Over'}
                  </h2>
                  <p className="text-lg text-gray-700">{state.endGameModal.message}</p>
                  {state.endGameModal.reason === 'forfeit' && (
                    <p className="text-sm text-gray-500 mt-2">Game ended by forfeit</p>
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-6xl mb-4">🤝</div>
                  <h2 className="text-2xl font-bold mb-2">Game Ended</h2>
                  <p className="text-lg text-gray-700">{state.endGameModal.message}</p>
                </div>
              )}
            </div>
            
            <button 
              onClick={handleEndGameModalClose}
              className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium w-full"
            >
              Return to Lobby
            </button>
          </div>
        </div>
      )}

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
              
              {/* **NEW**: Forfeit button - only show during active game */}
              {state.isGameStarted && state.gameState?.status === 'playing' && (
                <button 
                  onClick={handleForfeit}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium"
                >
                  Forfeit
                </button>
              )}
              
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

      {/* **NEW**: Notifications */}
      {state.notifications.length > 0 && (
        <div className="fixed top-20 right-4 z-50 space-y-2">
          {state.notifications.map((notification) => (
            <div
              key={notification.id}
              className={`px-4 py-3 rounded-lg shadow-lg max-w-sm animate-slide-in-right ${
                notification.type === 'success' ? 'bg-green-100 border border-green-400 text-green-700' :
                notification.type === 'warning' ? 'bg-yellow-100 border border-yellow-400 text-yellow-700' :
                'bg-blue-100 border border-blue-400 text-blue-700'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-sm font-medium">{notification.message}</span>
                <button 
                  onClick={() => setState(prev => ({
                    ...prev,
                    notifications: prev.notifications.filter(n => n.id !== notification.id)
                  }))}
                  className="ml-2 text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
                boardTheme={getBoardThemeClass(user.selectedBoardTheme)}
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
                        <span className={`${player.id === user.id ? 'font-bold' : ''} ${
                          state.disconnectedPlayers.has(player.id) ? 'text-gray-500 line-through' : ''
                        }`}>
                          {player.username}
                          {state.disconnectedPlayers.has(player.id) && (
                            <span className="ml-1 text-xs text-red-500">(disconnected)</span>
                          )}
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