import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface NavigationProps {
  title?: string;
  showBackButton?: boolean;
  backTo?: string;
  className?: string;
}

const Navigation: React.FC<NavigationProps> = ({ 
  title = "Quoridor", 
  showBackButton = false, 
  backTo = "/",
  className = ""
}) => {
  const { user, logout } = useAuth();

  return (
    <nav aria-label="Primary navigation" className={`bg-white shadow-sm border-b ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            {showBackButton ? (
              <Link 
                to={backTo} 
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-2 transition-colors"
              >
                <span aria-hidden="true">←</span>
                <span>Back to {backTo === "/" ? "Home" : "Previous"}</span>
              </Link>
            ) : (
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            )}
          </div>
          
          <div className="flex items-center space-x-6">
            {user ? (
              <>
                {/* User Info Section - Single Line */}
                <div className="flex items-center space-x-4">
                  <span className="text-gray-700 font-medium whitespace-nowrap">Hi, {user.username}!</span>
                  <div className="flex items-center space-x-2 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 px-3 py-1.5 rounded-lg whitespace-nowrap">
                    <div className="w-4 h-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      ¤
                    </div>
                    <span className="font-semibold text-gray-800 text-sm">{user.coinBalance || 0}</span>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center space-x-3">
                  <Link to="/buy-coins" className="btn btn-warning">
                    Buy Coins
                  </Link>

                  <Link to="/shop" className="btn btn-primary">
                    Shop
                  </Link>

                  <Link to="/profile" className="btn btn-secondary">
                    Profile
                  </Link>
                  <button onClick={logout} className="btn btn-secondary">
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <Link to="/login" className="btn btn-secondary">
                  Login
                </Link>
                <Link to="/register" className="btn btn-primary">
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
