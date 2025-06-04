import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ActiveGameBanner from '../components/ActiveGameBanner';
import Navigation from '../components/Navigation';

const HomePage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navigation />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {user && <ActiveGameBanner />}
        
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Play Quoridor!
          </h2>
          
        </div>

        {user ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <Link
              to="/create-game"
              className="card hover:shadow-lg transition-shadow cursor-pointer group"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 transition-colors">
                  <span className="text-2xl">🎮</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Create Game</h3>
                <p className="text-gray-600">
                  Start a new game and invite friends with a room code
                </p>
              </div>
            </Link>

            <Link
              to="/join-game"
              className="card hover:shadow-lg transition-shadow cursor-pointer group"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-green-200 transition-colors">
                  <span className="text-2xl">🔗</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Join Game</h3>
                <p className="text-gray-600">
                  Enter a room code to join an existing game
                </p>
              </div>
            </Link>
          </div>
        ) : (
          <div className="text-center">
            <Link to="/register" className="btn-primary btn-lg">
              Get Started
            </Link>
            <p className="mt-4 text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-500">
                Sign in
              </Link>
            </p>
          </div>
        )}

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-xl">⚡</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Fast & Fun</h3>
            <p className="text-gray-600">
              Quick games that you can finish in 10-15 minutes
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-xl">🌐</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Play Online</h3>
            <p className="text-gray-600">
              Real-time multiplayer with friends around the world
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-xl">🧠</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Strategic</h3>
            <p className="text-gray-600">
              Plan your moves and outsmart your opponents
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
