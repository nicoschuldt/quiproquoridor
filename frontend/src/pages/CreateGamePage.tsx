import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomApi } from '../services/api';
import type { CreateRoomRequest } from '@/types';

const CreateGamePage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<CreateRoomRequest>({
    maxPlayers: 2,
    isPrivate: false,
    hasTimeLimit: false,
    timeLimitSeconds: 300,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const roomData = await roomApi.createRoom(formData);
      navigate(`/room/${roomData.room.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof CreateRoomRequest, value: any) => {
    setFormData((prev: CreateRoomRequest) => ({ ...prev, [field]: value }));
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
            Create New Game
          </h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Players
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleChange('maxPlayers', 2)}
                  className={`p-4 text-center rounded-lg border-2 transition-colors ${
                    formData.maxPlayers === 2
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-lg font-semibold">2 Players</div>
                  <div className="text-sm text-gray-500">Classic duel</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('maxPlayers', 4)}
                  className={`p-4 text-center rounded-lg border-2 transition-colors ${
                    formData.maxPlayers === 4
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-lg font-semibold">4 Players</div>
                  <div className="text-sm text-gray-500">Battle royale</div>
                </button>
              </div>
            </div>

            

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Game...' : 'Create Game'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-gray-500 hover:text-gray-700"
            >
              Back to Home
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateGamePage; 