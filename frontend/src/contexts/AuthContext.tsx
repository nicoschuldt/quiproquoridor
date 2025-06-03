import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfileWithShop, UserRoomStatus } from '@/types';
import { authApi, roomApi } from '../services/api';

interface AuthContextType {
  user: UserProfileWithShop | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isReconnecting: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfileWithShop | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // **CRITICAL FIX**: Better reconnection flow with loading states
  useEffect(() => {
    const checkRoomReconnection = async () => {
      if (user && token && !isReconnecting) {
        try {
          setIsReconnecting(true);
          console.log('🔄 Checking for room reconnection...');
          
          const roomStatus: UserRoomStatus | null = await roomApi.getCurrentRoom();
          if (roomStatus) {
            console.log(`🎯 Found active room ${roomStatus.roomId} (${roomStatus.roomStatus})`);
            
            // **CRITICAL FIX**: Only auto-redirect if NOT on home page
            // Let home page banner handle reconnection instead
            const currentPath = window.location.pathname;
            if (currentPath === '/' || currentPath === '/home') {
              console.log('📍 User on home page - letting banner handle reconnection');
              return;
            }
            
            // Add a small delay to ensure proper state initialization
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const path = roomStatus.roomStatus === 'playing' 
              ? `/game/${roomStatus.roomId}` 
              : `/room/${roomStatus.roomId}`;
            
            // Auto-redirect only if user is on other pages
            if (window.location.pathname !== path) {
              console.log(`🚀 Auto-redirecting to ${path}`);
              window.location.href = path;
            }
          } else {
            console.log('✅ No active room found');
          }
        } catch (error) {
          console.error('❌ Failed to check room status:', error);
          // Don't block user if reconnection check fails
        } finally {
          setIsReconnecting(false);
        }
      }
    };

    // Only check reconnection after auth is fully loaded
    if (!isLoading) {
      checkRoomReconnection();
    }
  }, [user, token, isLoading]);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const profile = await authApi.getProfile();
          setUser(profile);
        } catch (error) {
          console.error('Auth init failed:', error);
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, [token]);

  const login = async (username: string, password: string) => {
    const response = await authApi.login(username, password);
    setToken(response.token);
    localStorage.setItem('token', response.token);
    // Fetch full profile with shop data
    const fullProfile = await authApi.getProfile();
    setUser(fullProfile);
  };

  const register = async (username: string, password: string) => {
    const response = await authApi.register(username, password);
    setToken(response.token);
    localStorage.setItem('token', response.token);
    // Fetch full profile with shop data
    const fullProfile = await authApi.getProfile();
    setUser(fullProfile);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      register,
      logout,
      isLoading,
      isReconnecting
    }}>
      {children}
    </AuthContext.Provider>
  );
};
