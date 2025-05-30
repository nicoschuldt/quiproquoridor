import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomApi } from '../services/api';

const JoinGamePage: React.FC = () => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const roomData = await roomApi.joinRoom({ code: roomCode.toUpperCase() });
      navigate(`/room/${roomData.room.id}`);
    } catch (err: any) {
      if (err.code === 'ROOM_NOT_FOUND') {
        setError('Room not found. Please check the code and try again.');
      } else if (err.code === 'ROOM_FULL') {
        setError('This room is full.');
      } else if (err.code === 'ALREADY_IN_ROOM') {
        setError('You are already in this room.');
      } else {
        setError(err.message || 'Failed to join room');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length <= 6) {
      setRoomCode(value);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button 
                onClick={() => navigate('/')}
                className="text-2xl font-bold text-gray-900 hover:text-blue-600"
              >
                Quoridor
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-md mx-auto px-4 py-12">
        <div className="card">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Join Game
          </h1>

          <p className="text-gray-600 text-center mb-6">
            Enter the 6-character room code to join an existing game.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="roomCode" className="block text-sm font-medium text-gray-700 mb-2">
                Room Code
              </label>
              <input
                type="text"
                id="roomCode"
                value={roomCode}
                onChange={handleCodeChange}
                placeholder="ABC123"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-2xl font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoComplete="off"
                autoFocus
              />
              <p className="text-sm text-gray-500 mt-1 text-center">
                {roomCode.length}/6 characters
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || roomCode.length !== 6}
              className="w-full btn-primary py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Joining Game...' : 'Join Game'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <div className="text-sm text-gray-500">
              Don't have a room code?
            </div>
            <button
              onClick={() => navigate('/create-game')}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Create a new game
            </button>
            <div>
              <button
                onClick={() => navigate('/')}
                className="text-gray-500 hover:text-gray-700"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default JoinGamePage; 