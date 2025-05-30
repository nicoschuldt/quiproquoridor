import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfile, UserRoomStatus } from '@/types';
import { authApi, roomApi } from '../services/api';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  // Check for room reconnection after auth is established
  useEffect(() => {
    const checkRoomReconnection = async () => {
      if (user && token) {
        try {
          const roomStatus: UserRoomStatus | null = await roomApi.getCurrentRoom();
          if (roomStatus) {
            // User is in a room, redirect them
            const path = roomStatus.roomStatus === 'playing' 
              ? `/game/${roomStatus.roomId}` 
              : `/room/${roomStatus.roomId}`;
            
            // Use setTimeout to avoid navigation during render
            setTimeout(() => {
              window.location.href = path;
            }, 100);
          }
        } catch (error) {
          console.error('Failed to check room status:', error);
        }
      }
    };

    checkRoomReconnection();
  }, [user, token]);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const profile = await authApi.getProfile();
          setUser(profile);
        } catch (error) {
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
    setUser(response.user);
    localStorage.setItem('token', response.token);
  };

  const register = async (username: string, password: string) => {
    const response = await authApi.register(username, password);
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem('token', response.token);
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
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
};
