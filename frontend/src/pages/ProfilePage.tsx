import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/api';
import PageLayout from '../components/PageLayout';
import type { GameHistoryEntry, TransactionHistoryEntry } from '@/types';


const ProfilePage: React.FC = () => {
  const { user } = useAuth();
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
      <PageLayout showBackButton title="Profile">
        <div className="flex items-center justify-center py-16">
          <div className="card text-center max-w-md">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Please log in to view your profile</h2>
            <Link to="/login" className="btn btn-primary">Login</Link>
          </div>
        </div>
      </PageLayout>
    );
  }

  const stats = calculateStats();

  return (
    <PageLayout showBackButton title="Profile">
      {/* Profile Header */}
      <div className="card mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{user.username}</h1>
              <p className="text-gray-600 mt-1">
                Member since {formatDate(user.createdAt)}
              </p>
            </div>
          </div>
          <Link 
            to="/coin-purchase"
            className="btn btn-primary"
          >
            Buy Coins
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-1">{user.gamesPlayed}</div>
            <div className="text-sm font-medium text-gray-600">Games Played</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-1">{stats.gamesWon}</div>
            <div className="text-sm font-medium text-gray-600">Games Won</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-1">{stats.winRate.toFixed(1)}%</div>
            <div className="text-sm font-medium text-gray-600">Win Rate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600 mb-1">{user.coinBalance}</div>
            <div className="text-sm font-medium text-gray-600">Current Coins</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('games')}
              className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'games'
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Game History ({gameHistory.length})
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'transactions'
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Transaction History ({transactionHistory.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading...</p>
            </div>
          ) : (
            <>
              {activeTab === 'games' && (
                <div>
                  {gameHistory.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                      <div className="text-6xl mb-4">🎮</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No games played yet</h3>
                      <p className="text-gray-600 mb-6">Start your first game to see your history here!</p>
                      <Link to="/create-game" className="btn btn-primary">
                        Start Your First Game
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {gameHistory.map((game, index) => (
                        <div key={game.gameId} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className={`w-4 h-4 rounded-full ${
                                game.color === 'red' ? 'bg-red-500' :
                                game.color === 'blue' ? 'bg-blue-500' :
                                game.color === 'green' ? 'bg-green-500' :
                                'bg-yellow-500'
                              }`}></div>
                              <div>
                                <span className={`font-semibold text-lg ${game.isWinner ? 'text-green-600' : 'text-gray-600'}`}>
                                  {game.isWinner ? '🏆 Victory' : '😔 Defeat'}
                                </span>
                                <p className="text-sm text-gray-500">
                                  Player {game.playerIndex + 1} • {game.wallsUsed} walls used
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-500 mb-1">
                                {formatDate(game.gameFinishedAt || game.gameStartedAt)}
                              </p>
                              <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
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
 
              {activeTab === 'transactions' && (
                <div>
                  {transactionHistory.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                      <div className="text-6xl mb-4">💰</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No transactions yet</h3>
                      <p className="text-gray-600 mb-6">Purchase coins to see your transaction history!</p>
                      <Link to="/coin-purchase" className="btn btn-warning">
                        Buy Your First Coins
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {transactionHistory.map((transaction) => (
                        <div key={transaction.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                                  <span className="text-lg">
                                    {transaction.type === 'coin_purchase' ? '🪙' : 
                                     transaction.type === 'theme_purchase' ? '🎨' : '🎮'}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-900">
                                    {transaction.description || `${transaction.type.replace('_', ' ')}`}
                                  </span>
                                  <div className="flex items-center space-x-2 mt-1">
                                    <p className="text-sm text-gray-500">
                                      {formatDate(transaction.createdAt)}
                                    </p>
                                    {transaction.stripeSessionId && (
                                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                                        Stripe
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`text-xl font-bold ${
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
    </PageLayout>
  );
};

export default ProfilePage; 