import axios from 'axios';
import type { 
  ApiResponse,
  AuthData,
  CreateRoomRequest, 
  JoinRoomRequest, 
  RoomData,
  UserProfile,
  GameStateData,
  MakeMoveRequest
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle API responses - extract data from our standard format
api.interceptors.response.use(
  (response) => {
    const apiResponse: ApiResponse = response.data;
    if (!apiResponse.success) {
      throw apiResponse.error || { code: 'API_ERROR', message: 'API request failed' };
    }
    return apiResponse.data;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    if (error.response?.data?.error) {
      throw error.response.data.error;
    }
    throw { code: 'NETWORK_ERROR', message: error.message || 'Network error occurred' };
  }
);

export const authApi = {
  login: async (username: string, password: string): Promise<AuthData> => {
    return await api.post('/auth/login', { username, password });
  },

  register: async (username: string, password: string): Promise<AuthData> => {
    return await api.post('/auth/register', { username, password });
  },

  getProfile: async (): Promise<UserProfile> => {
    return await api.get('/auth/me');
  },
};

export const roomApi = {
  createRoom: async (request: CreateRoomRequest): Promise<RoomData> => {
    return await api.post('/rooms', request);
  },

  joinRoom: async (request: JoinRoomRequest): Promise<RoomData> => {
    return await api.post('/rooms/join', request);
  },

  getRoom: async (roomId: string): Promise<RoomData> => {
    return await api.get(`/rooms/${roomId}`);
  },

  updateReadyStatus: async (roomId: string, ready: boolean): Promise<{ ready: boolean }> => {
    return await api.patch(`/rooms/${roomId}/ready`, { ready });
  },
};

export const gameApi = {
  getGameState: async (roomId: string): Promise<GameStateData> => {
    return await api.get(`/games/${roomId}/state`);
  },

  makeMove: async (roomId: string, moveRequest: MakeMoveRequest): Promise<GameStateData> => {
    return await api.post(`/games/${roomId}/move`, moveRequest);
  },
};