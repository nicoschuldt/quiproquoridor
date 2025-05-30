import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { roomApi } from '../services/api';
import type { Room, Player, RoomData } from '@/types';

const RoomLobbyPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isReady, setIsReady] = useState(false);

  // Load initial room data
  useEffect(() => {
    const loadRoomData = async () => {
      if (!roomId) return;
      
      try {
        const roomData: RoomData = await roomApi.getRoom(roomId);
        setRoom(roomData.room);
        setIsHost(roomData.isHost);
        // TODO: Load players from room members
        setPlayers([]);
      } catch (err: any) {
        setError(err.message || 'Failed to load room');
      } finally {
        setLoading(false);
      }
    };

    loadRoomData();
  }, [roomId]);

  // WebSocket connection and event listeners
  useEffect(() => {
    if (!socket || !roomId || !room) return;

    // Join the room
    socket.emit('join-room', { roomId });

    // Listen for room events
    const handleRoomUpdated = (data: { room: Room }) => {
      setRoom(data.room);
    };

    const handlePlayerJoined = (data: { player: Player; room: Room }) => {
      setPlayers(prev => [...prev.filter(p => p.id !== data.player.id), data.player]);
      setRoom(data.room);
    };

    const handlePlayerLeft = (data: { playerId: string; room: Room }) => {
      setPlayers(prev => prev.filter(p => p.id !== data.playerId));
      setRoom(data.room);
    };

    const handlePlayerReadyChanged = (data: { playerId: string; ready: boolean }) => {
      setPlayers(prev => prev.map(p => 
        p.id === data.playerId ? { ...p, isReady: data.ready } : p
      ));
      
      // Update our own ready state if it's us
      if (user && data.playerId === user.id) {
        setIsReady(data.ready);
      }
    };

    const handleGameStarted = (data: { gameState: any }) => {
      // Navigate to game page when game starts
      navigate(`/game/${roomId}`);
    };

    const handleError = (data: { error: any }) => {
      setError(data.error.message || 'An error occurred');
    };

    // Register event listeners
    socket.on('room-updated', handleRoomUpdated);
    socket.on('player-joined', handlePlayerJoined);
    socket.on('player-left', handlePlayerLeft);
    socket.on('player-ready-changed', handlePlayerReadyChanged);
    socket.on('game-started', handleGameStarted);
    socket.on('error', handleError);

    // Cleanup
    return () => {
      socket.off('room-updated', handleRoomUpdated);
      socket.off('player-joined', handlePlayerJoined);
      socket.off('player-left', handlePlayerLeft);
      socket.off('player-ready-changed', handlePlayerReadyChanged);
      socket.off('game-started', handleGameStarted);
      socket.off('error', handleError);
      socket.emit('leave-room', { roomId });
    };
  }, [socket, roomId, room, user, navigate]);

  const handleReadyToggle = () => {
    if (!socket || !roomId) return;
    
    const newReadyState = !isReady;
    setIsReady(newReadyState);
    socket.emit('player-ready', { roomId, ready: newReadyState });
  };

  const handleStartGame = () => {
    if (!socket || !roomId || !isHost) return;
    
    // Check if all players are ready
    const allReady = players.length >= 2 && players.every(p => p.isReady);
    if (!allReady) {
      setError('All players must be ready before starting the game');
      return;
    }
    
    socket.emit('start-game', { roomId });
  };

  const handleLeaveRoom = () => {
    navigate('/');
  };

  const copyRoomCode = async () => {
    if (!room) return;
    
    try {
      await navigator.clipboard.writeText(room.code);
      // TODO: Show success toast
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = room.code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading room...</p>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="card max-w-md">
          <h1 className="text-xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error || 'Room not found'}</p>
          <Link to="/" className="btn-primary">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const allPlayersReady = players.length >= 2 && players.every(p => p.isReady);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="text-2xl font-bold text-gray-900">Quoridor</Link>
            </div>
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <button onClick={handleLeaveRoom} className="btn-secondary">
                Leave Room
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Room Info */}
        <div className="card mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold">Game Lobby</h1>
              <p className="text-gray-600">
                {room.maxPlayers === 2 ? '2-Player' : '4-Player'} Game
                {room.isPrivate && ' • Private'}
                {room.hasTimeLimit && ` • ${room.timeLimitSeconds}s per move`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Room Code</p>
              <button
                onClick={copyRoomCode}
                className="text-2xl font-mono font-bold text-blue-600 hover:text-blue-500 transition-colors"
                title="Click to copy"
              >
                {room.code}
              </button>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Players */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">
              Players ({players.length}/{room.maxPlayers})
            </h2>
            
            <div className="space-y-3">
              {Array.from({ length: room.maxPlayers }, (_, index) => {
                const player = players[index];
                const isCurrentUser = user && player?.id === user.id;
                
                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 ${
                      player
                        ? isCurrentUser
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white'
                        : 'border-dashed border-gray-300 bg-gray-50'
                    }`}
                  >
                    {player ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-3 bg-${player.color || 'gray'}-500`}></div>
                          <div>
                            <p className="font-medium">
                              {player.username}
                              {isCurrentUser && ' (You)'}
                              {player.id === room.hostId && ' 👑'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {player.isReady ? '✅ Ready' : '⏳ Not Ready'}
                            </p>
                          </div>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${
                          player.isConnected ? 'bg-green-500' : 'bg-red-500'
                        }`} title={player.isConnected ? 'Online' : 'Offline'}></div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-500">
                        <p>Waiting for player...</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Ready/Start Controls */}
            <div className="mt-6">
              {isHost ? (
                <button
                  onClick={handleStartGame}
                  disabled={!allPlayersReady}
                  className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {allPlayersReady ? 'Start Game' : 'Waiting for all players to be ready...'}
                </button>
              ) : (
                <button
                  onClick={handleReadyToggle}
                  className={`w-full py-3 rounded-lg font-medium transition-colors ${
                    isReady
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  {isReady ? '✅ Ready' : 'Mark as Ready'}
                </button>
              )}
            </div>
          </div>

          {/* Game Info */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">How to Play</h2>
            <div className="prose prose-sm text-gray-600">
              <p>
                <strong>Objective:</strong> Be the first to reach the opposite side of the board.
              </p>
              <p>
                <strong>Movement:</strong> Move your pawn one space up, down, left, or right.
              </p>
              <p>
                <strong>Walls:</strong> Place walls to block opponents' paths. You have{' '}
                {room.maxPlayers === 2 ? '10' : '5'} walls.
              </p>
              <p>
                <strong>Victory:</strong> Reach any square on the opposite side to win!
              </p>
              {room.hasTimeLimit && (
                <p>
                  <strong>Time Limit:</strong> You have {room.timeLimitSeconds} seconds per move.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RoomLobbyPage;
