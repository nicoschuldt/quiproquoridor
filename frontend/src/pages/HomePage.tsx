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
            Jouons à Quiproquoridor !
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
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Créer une partie</h3>
                <p className="text-gray-600">
                  Créé une partie et invite tes amis à jouer
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
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Rejoindre un salon</h3>
                <p className="text-gray-600">
                  Entre le code du salon pour rejoindre une partie
                </p>
              </div>
            </Link>
          </div>
        ) : (
          <div className="text-center">
            <Link to="/register" className="btn-primary btn-lg">
              Commencons 
            </Link>
            <p className="mt-4 text-gray-600">
              Tu as déjà un compte ?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-500">
                Connecte toi
              </Link>
            </p>
          </div>
        )}

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-xl">⚡</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Rapide et amusant</h3>
            <p className="text-gray-600">
              Partie rapide, facile à apprendre et amusante à jouer
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-xl">🌐</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Jouer en ligne</h3>
            <p className="text-gray-600">
              Multijoueur en ligne avec des joueurs du monde entier en temps réel
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-xl">🧠</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Stratégique</h3>
            <p className="text-gray-600">
              Un jeu de stratégie où chaque mouvement compte !
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
