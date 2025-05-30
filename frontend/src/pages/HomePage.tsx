import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const HomePage: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Quoridor</h1>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <span className="text-gray-700">Welcome, {user.username}!</span>
                  <button onClick={logout} className="btn-secondary">
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn-secondary">Login</Link>
                  <Link to="/register" className="btn-primary">Register</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h2 className="text-4xl font-extrabold text-gray-900 sm:text-6xl">
            Play Quoridor
          </h2>
          <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto">
            Strategic board game where you race to reach the opposite side while placing walls to block your opponents.
          </p>
          
          {user ? (
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/create-game" className="btn-primary text-lg px-8 py-3">
                Create Game
              </Link>
              <Link to="/join-game" className="btn-secondary text-lg px-8 py-3">
                Join Game
              </Link>
            </div>
          ) : (
            <div className="mt-10">
              <Link to="/register" className="btn-primary text-lg px-8 py-3 mr-4">
                Get Started
              </Link>
              <Link to="/login" className="btn-secondary text-lg px-8 py-3">
                Login
              </Link>
            </div>
          )}

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card">
              <h3 className="text-xl font-semibold mb-4">Easy to Learn</h3>
            </div>
            <div className="card">
              <h3 className="text-xl font-semibold mb-4">Real-time Multiplayer</h3>
            </div>
            <div className="card">
              <h3 className="text-xl font-semibold mb-4">2 or 4 Players</h3>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
