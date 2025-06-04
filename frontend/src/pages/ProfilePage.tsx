import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/api';
import type { GameHistoryEntry, TransactionHistoryEntry } from '@/types';

const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<TransactionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'games' | 'transactions'>('games');

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const [gameHistoryData, transactionHistoryData] = await Promise.all([
        authApi.getGameHistory(),
        authApi.getTransactionHistory(),
      ]);
      setGameHistory(gameHistoryData);
      setTransactionHistory(transactionHistoryData);
    } catch (error) {
      console.error('Failed to load profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const gamesWon = gameHistory.filter(game => game.isWinner).length;
    const winRate = gameHistory.length > 0 ? (gamesWon / gameHistory.length * 100) : 0;
    
    const coinsEarned = transactionHistory
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const coinsSpent = transactionHistory
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return { gamesWon, winRate, coinsEarned, coinsSpent };
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Please log in to view your profile</h2>
          <Link to="/login" className="btn-primary">Login</Link>
        </div>
      </div>
    );
  }

  const stats = calculateStats();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-xl font-bold text-blue-600 hover:text-blue-700">
              ← Back to Home
            </Link>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1 bg-yellow-100 px-3 py-1 rounded-full">
                <span className="text-lg">🪙</span>
                <span className="font-semibold text-yellow-800">{user.coinBalance || 0}</span>
              </div>
              <button onClick={logout} className="btn-secondary">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{user.username}</h1>
              <p className="text-gray-600 mt-1">
                Member since {formatDate(user.createdAt)}
              </p>
            </div>
            <Link 
              to="/buy-coins"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Buy Coins
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-gray-900">{user.gamesPlayed}</div>
              <div className="text-sm text-gray-600">Games Played</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{stats.gamesWon}</div>
              <div className="text-sm text-gray-600">Games Won</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.winRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Win Rate</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">{user.coinBalance}</div>
              <div className="text-sm text-gray-600">Current Coins</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('games')}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'games'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Game History ({gameHistory.length})
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'transactions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Transaction History ({transactionHistory.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading...</p>
              </div>
            ) : (
              <>
                {/* Games Tab */}
                {activeTab === 'games' && (
                  <div>
                    {gameHistory.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>No games played yet.</p>
                        <Link to="/create-game" className="btn-primary mt-4">
                          Start Your First Game
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {gameHistory.map((game, index) => (
                          <div key={game.gameId} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className={`w-4 h-4 rounded-full bg-${game.color}-500`}></div>
                                <div>
                                  <span className={`font-medium ${game.isWinner ? 'text-green-600' : 'text-gray-600'}`}>
                                    {game.isWinner ? '🏆 Victory' : '😔 Defeat'}
                                  </span>
                                  <p className="text-sm text-gray-500">
                                    Player {game.playerIndex + 1} • {game.wallsUsed} walls used
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-gray-500">
                                  {formatDate(game.gameFinishedAt || game.gameStartedAt)}
                                </p>
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  game.gameStatus === 'finished' 
                                    ? 'bg-green-100 text-green-800'
                                    : game.gameStatus === 'playing'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {game.gameStatus}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Transactions Tab */}
                {activeTab === 'transactions' && (
                  <div>
                    {transactionHistory.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>No transactions yet.</p>
                        <Link to="/buy-coins" className="btn-primary mt-4">
                          Buy Your First Coins
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {transactionHistory.map((transaction) => (
                          <div key={transaction.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-lg">
                                    {transaction.type === 'coin_purchase' ? '🪙' : 
                                     transaction.type === 'theme_purchase' ? '🎨' : '🎮'}
                                  </span>
                                  <span className="font-medium text-gray-900">
                                    {transaction.description || `${transaction.type.replace('_', ' ')}`}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-500 mt-1">
                                  {formatDate(transaction.createdAt)}
                                  {transaction.stripeSessionId && (
                                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                      Stripe
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className={`text-lg font-bold ${
                                  transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                                </span>
                                <p className="text-sm text-gray-500">coins</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage; 