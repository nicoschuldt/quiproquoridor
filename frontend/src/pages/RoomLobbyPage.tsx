import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { roomApi } from '../services/api';
import type { Room, Player, RoomData, AIDifficulty } from '@/types';

const RoomLobbyPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const userRef = useRef(user);
  
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  
  const [room, setRoom] = useState<Room | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  
  const [addingAI, setAddingAI] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<AIDifficulty>('easy');

  useEffect(() => {
    const loadRoomData = async () => {
      if (!roomId) return;
      
      try {
        const roomData: RoomData = await roomApi.getRoom(roomId);
        setRoom(roomData.room);
        setIsHost(roomData.isHost);
        setPlayers(roomData.room.players || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load room');
      } finally {
        setLoading(false);
      }
    };

    loadRoomData();
  }, [roomId, user]);

  useEffect(() => {
    if (!socket || !roomId) return;

    socket.emit('join-room', { roomId });

    const handleRoomUpdated = (data: { room: Room }) => {
      setRoom(data.room);
      setPlayers(data.room.players || []);
    };

    const handlePlayerJoined = (data: { player: Player }) => {
      setPlayers(prev => [...prev.filter(p => p.id !== data.player.id), data.player]);
    };

    const handlePlayerLeft = (data: { playerId: string }) => {
      setPlayers(prev => prev.filter(p => p.id !== data.playerId));
    };

    const handlePlayerDisconnected = (data: { playerId: string }) => {
      setPlayers(prev => prev.map(p =>
        p.id === data.playerId 
          ? { ...p, isConnected: false } 
          : p
      ));
    };

    const handlePlayerReconnected = (data: { playerId: string }) => {
      setPlayers(prev => prev.map(p =>
        p.id === data.playerId 
          ? { ...p, isConnected: true } 
          : p
      ));
    };

    const handleGameStarted = (data: { gameState: any }) => {
      navigate(`/game/${roomId}`);
    };

    const handleError = (data: { error: any }) => {
      setError(data.error.message || 'An error occurred');
      
      if (data.error.code === 'NOT_ROOM_MEMBER') {
        console.log('Not a room member, attempting to rejoin...');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    };

    socket.on('room-updated', handleRoomUpdated);
    socket.on('player-joined', handlePlayerJoined);
    socket.on('player-left', handlePlayerLeft);
    socket.on('player-disconnected', handlePlayerDisconnected);
    socket.on('player-reconnected', handlePlayerReconnected);
    socket.on('game-started', handleGameStarted);
    socket.on('error', handleError);

    return () => {
      socket.off('room-updated', handleRoomUpdated);
      socket.off('player-joined', handlePlayerJoined);
      socket.off('player-left', handlePlayerLeft);
      socket.off('player-disconnected', handlePlayerDisconnected);
      socket.off('player-reconnected', handlePlayerReconnected);
      socket.off('game-started', handleGameStarted);
      socket.off('error', handleError);
      socket.emit('leave-room', { roomId });
    };
  }, [socket, roomId, navigate]);

  const handleLeaveRoom = async () => {
    try {
      if (roomId) {
        await roomApi.leaveRoom(roomId);
      }
      navigate('/');
    } catch (err: any) {
      console.error('Failed to leave room:', err);
      navigate('/');
    }
  };

  const copyRoomCode = async () => {
    if (!room) return;
    
    try {
      await navigator.clipboard.writeText(room.code);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = room.code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const handleAddAIPlayer = async () => {
    if (!room || !roomId) return;
    
    setAddingAI(true);
    setError(null);
    
    try {
      await roomApi.addAIPlayer(roomId, selectedDifficulty);
      console.log(`AI player (${selectedDifficulty}) added successfully`);
    } catch (err: any) {
      console.error('Failed to add AI player:', err);
      setError(err.message || 'Failed to add AI player');
    } finally {
      setAddingAI(false);
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

  const roomIsFull = players.length === room.maxPlayers;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="text-2xl font-bold text-gray-900">Quoridor</Link>
            </div>
            <div className="flex items-center space-x-4">
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

          {roomIsFull && room.status === 'lobby' && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
              🎮 Room is full! Game will start automatically...
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                              {player.isAI && ' 🤖'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {player.isAI ? (
                                <span className="text-blue-600 flex items-center">
                                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
                                  AI ({player.aiDifficulty || 'easy'})
                                </span>
                              ) : player.isConnected ? (
                                <span className="text-green-600 flex items-center">
                                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                                  Online
                                </span>
                              ) : (
                                <span className="text-orange-600 flex items-center">
                                  <span className="w-2 h-2 bg-orange-500 rounded-full mr-1 animate-pulse"></span>
                                  Reconnecting...
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${
                          player.isConnected ? 'bg-green-500' : 'bg-orange-500 animate-pulse'
                        }`} title={player.isConnected ? 'Online' : 'Disconnected'}></div>
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

            {isHost && !roomIsFull && room.status === 'lobby' && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-sm font-medium text-blue-900 mb-3">Add AI Opponent</h3>
                <div className="flex items-center space-x-3">
                  <select
                    value={selectedDifficulty}
                    onChange={(e) => setSelectedDifficulty(e.target.value as AIDifficulty)}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={addingAI}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                  <button
                    onClick={handleAddAIPlayer}
                    disabled={addingAI}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addingAI ? '🤖 Adding...' : '🤖 Add AI'}
                  </button>
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  AI players will respond automatically during the game
                </p>
              </div>
            )}

            <div className="mt-6">
              {roomIsFull ? (
                <div className="w-full py-3 px-4 bg-green-100 text-green-800 rounded-lg font-medium text-center">
                  🎮 Ready to start! Game will begin automatically...
                </div>
              ) : (
                <div className="w-full py-3 px-4 bg-gray-100 text-gray-600 rounded-lg text-center">
                  Waiting for {room.maxPlayers - players.length} more player{room.maxPlayers - players.length !== 1 ? 's' : ''}...
                </div>
              )}
            </div>
          </div>

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
              <p className="mt-4 text-blue-600">
                <strong>Auto-Start:</strong> The game will start automatically when the room is full.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RoomLobbyPage;
