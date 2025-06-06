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

  const addNotification = useCallback((type: 'info' | 'warning' | 'success', message: string, timeout: number = 5000) => {
    const id = crypto.randomUUID();
    setState(prev => ({
      ...prev,
      notifications: [...prev.notifications, { id, type, message, timeout }]
    }));
    
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        notifications: prev.notifications.filter(n => n.id !== id)
      }));
    }, timeout);
  }, []);

  const gameSocket = useGameSocket({
    roomId: roomId!,
    onGameStarted: useCallback((data: { gameState: GameState }) => {

      console.log('Début de la partie:', data);
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
      console.log('Coup effectué:', data);
      setState(prev => ({
        ...prev,
        gameState: data.gameState,
        error: null,
      }));
      
      if (user && data.gameState.players[data.gameState.currentPlayerIndex].id === user.id) {
        setTimeout(() => gameSocket.requestGameState(), 100);
      }
    }, [user]),
    
    onGameFinished: useCallback((data: { gameState: GameState; winner: Player }) => {
      console.log('🏆 Partie terminée:', data);
      setState(prev => ({
        ...prev,
        gameState: data.gameState,
        validMoves: [],
        endGameModal: {
          isOpen: true,
          winner: data.winner,
          reason: 'normal',
          message: data.winner.id === user?.id ? 
            'Félicitations ! TU as gagné la partie !' : 
            `${data.winner.username} a gagné la partie !`
        }
      }));
    }, [user]),
    
    onGameStateSync: useCallback((data: { gameState: GameState; validMoves?: Move[] }) => {
      console.log('Synchronisation du jeu:', data);
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
      console.log('déplacement incorrecte :', data);
      setState(prev => ({
        ...prev,
        error: `déplacement incorrecte: ${data.error}`,
      }));
      setTimeout(() => setState(prev => ({ ...prev, error: null })), 3000);
    }, []),

    onPlayerForfeited: useCallback((data: { playerId: string; playerName: string; gameState: GameState }) => {
      console.log('🏳️ un joueur a abandonné :', data);
      setState(prev => ({
        ...prev,
        gameState: data.gameState,
      }));
      
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
              'Tu as abandonné la partie' : 
              winner ? 
                (winner.id === user?.id ? 
                  `Tu as gagné ! ${data.playerName} a abandonné` : 
                  `${winner.username} a gagné ! ${data.playerName} a a bandonné `) :
                `${data.playerName} a abandonné la partie`
          }
        }));
      } else {
        const isCurrentUser = data.playerId === user?.id;
        const message = isCurrentUser ? 
          'Tu as abandonné la partie' : 
          `${data.playerName} a abandonné la partie`;
        
        addNotification('info', message, 5000);
      }
    }, [user?.id, addNotification]),

    onDisconnectionWarning: useCallback((data: { playerId: string; playerName: string; timeoutSeconds: number }) => {
      console.log('⚠️ Un joueur est déconnecté :', data);
      setState(prev => ({
        ...prev,
        disconnectedPlayers: new Set([...prev.disconnectedPlayers, data.playerId])
      }));
      
      addNotification('warning', `${data.playerName} a été déconnecté. Fin de la partie dans ${data.timeoutSeconds}s si il ne se reconnecte pas.`, 8000);
      
      if (data.playerId === user?.id) {
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            endGameModal: {
              isOpen: true,
              winner: null,
              reason: 'timeout',
              message: 'Tu as été déconnecté de la partie'
            }
          }));
        }, data.timeoutSeconds * 1000);
      }
    }, [addNotification, user?.id]),

    onReconnectionSuccess: useCallback((data: { playerId: string; playerName: string; gameState: GameState }) => {
      console.log('🔗 joueur reconnecté:', data);
      setState(prev => ({
        ...prev,
        gameState: data.gameState,
        disconnectedPlayers: new Set([...prev.disconnectedPlayers].filter(id => id !== data.playerId))
      }));
      
      addNotification('success', `${data.playerName} a été reconnecté !`, 3000);
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

  if (!user) {
    navigate('/login');
    return null;
  }

  if (!roomId) {
    navigate('/');
    return null;
  }

  const isCurrentTurn = state.gameState &&
    state.gameState.players[state.gameState.currentPlayerIndex].id === user.id;

  const handleForfeit = useCallback(() => {
    if (!window.confirm('Tu es sûr de vouloir abandonné.')) {
      return;
    }
    gameSocket.forfeitGame();
  }, [gameSocket]);

  const handleEndGameModalClose = useCallback(() => {
    setState(prev => ({
      ...prev,
      endGameModal: null
    }));
    navigate('/');
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {state.endGameModal?.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card max-w-md w-full mx-4 text-center">
            <div className="mb-6">
              {state.endGameModal.winner ? (
                <div>
                  <div className="text-6xl mb-4">
                    {state.endGameModal.winner.id === user?.id ? '🏆' : '🎯'}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {state.endGameModal.winner.id === user?.id ? 'Victoire!' : 'Défaite'}
                  </h2>
                  <p className="text-lg text-gray-600">{state.endGameModal.message}</p>
                  {state.endGameModal.reason === 'forfeit' && (
                    <p className="text-sm text-gray-500 mt-2">Partie terminée par forfait</p>
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-6xl mb-4">🤝</div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Partie terminée</h2>
                  <p className="text-lg text-gray-600">{state.endGameModal.message}</p>
                </div>
              )}
            </div>
            
            <button 
              onClick={handleEndGameModalClose}
              className="btn btn-primary w-full"
            >
              retour à l'accueil
            </button>
          </div>
        </div>
      )}

      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">Quiproquoridor Game</h1>
              <div className="hidden sm:block">
                <span className="text-sm text-gray-500">salon: </span>
                <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{roomId}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                gameSocket.connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
                gameSocket.connectionStatus === 'disconnected' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  gameSocket.connectionStatus === 'connected' ? 'bg-green-500' :
                  gameSocket.connectionStatus === 'disconnected' ? 'bg-red-500' :
                  'bg-yellow-500'
                }`} />
                <span>
                  {gameSocket.connectionStatus === 'connected' && 'Connected'}
                  {gameSocket.connectionStatus === 'disconnected' && 'Disconnected'}
                  {gameSocket.connectionStatus === 'connecting' && 'Connecting...'}
                </span>
              </div>
              
              {state.isGameStarted && state.gameState?.status === 'playing' && (
                <button 
                  onClick={handleForfeit}
                  className="btn btn-danger"
                >
                  Forfeit
                </button>
              )}
              
              {/* <button 
                onClick={() => navigate('/')}
                className="btn btn-secondary"
              >
                Leave Game
              </button> */}
            </div>
          </div>
        </div>
      </nav>

      {state.notifications.length > 0 && (
        <div className="fixed top-20 right-4 z-40 space-y-3">
          {state.notifications.map((notification) => (
            <div
              key={notification.id}
              className={`card-floating max-w-sm animate-slide-in-right ${
                notification.type === 'success' ? 'border-green-200 bg-green-50' :
                notification.type === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                'border-blue-200 bg-blue-50'
              }`}
              style={{ padding: '1rem' }}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    notification.type === 'success' ? 'bg-green-500' :
                    notification.type === 'warning' ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`} />
                  <span className={`text-sm font-medium ${
                    notification.type === 'success' ? 'text-green-800' :
                    notification.type === 'warning' ? 'text-yellow-800' :
                    'text-blue-800'
                  }`}>
                    {notification.message}
                  </span>
                </div>
                <button 
                  onClick={() => setState(prev => ({
                    ...prev,
                    notifications: prev.notifications.filter(n => n.id !== notification.id)
                  }))}
                  className="ml-2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {state.error && (
          <div className="card border-red-200 bg-red-50 text-red-700 mb-6" style={{ padding: '1rem' }}>
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span className="font-medium">{state.error}</span>
              </div>
              <button 
                onClick={() => setState(prev => ({ ...prev, error: null }))}
                className="text-red-400 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        
        {state.isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Chargement de la partie...</p>
            </div>
          </div>
        )}
        
        {!state.isLoading && !state.isGameStarted && (
          <div className="text-center py-16">
            <div className="card max-w-md mx-auto">
              <div className="text-6xl mb-4">🎮</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Salon prêt</h2>
              <p className="text-gray-600 mb-6">Tous les joueurs sont connectés!</p>
              <button 
                onClick={gameSocket.startGame}
                className="btn btn-primary btn-lg w-full"
                disabled={gameSocket.connectionStatus !== 'connected'}
              >
                Commencer la partie
              </button>
            </div>
          </div>
        )}
        
        {!state.isLoading && state.isGameStarted && state.gameState && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="xl:col-span-3">
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
            
            <div className="space-y-6">
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Tour actuel</h3>
                <div className={`p-3 rounded-xl font-medium text-center ${
                  isCurrentTurn 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}>
                  {isCurrentTurn ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span>C'est ton tour!</span>
                    </div>
                  ) : (
                    `${state.gameState.players[state.gameState.currentPlayerIndex].username}'s turn`
                  )}
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Joueurs</h3>
                <div className="space-y-3">
                  {state.gameState.players.map((player) => (
                    <div key={player.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className={`w-4 h-4 rounded-full ${
                          player.color === 'red' ? 'bg-red-500' :
                          player.color === 'blue' ? 'bg-blue-500' :
                          player.color === 'green' ? 'bg-green-500' :
                          'bg-yellow-500'
                        }`} />
                        <div>
                          <span className={`font-medium ${
                            player.id === user.id ? 'text-blue-700' : 'text-gray-900'
                          } ${state.disconnectedPlayers.has(player.id) ? 'line-through text-gray-400' : ''}`}>
                            {player.username}
                            {player.id === user.id && (
                              <span className="ml-1 text-xs text-blue-600">(You)</span>
                            )}
                          </span>
                          {state.disconnectedPlayers.has(player.id) && (
                            <div className="text-xs text-red-500 font-medium">Déconnecté</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {player.wallsRemaining}
                        </div>
                        <div className="text-xs text-gray-500">murs</div>
                      </div>
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