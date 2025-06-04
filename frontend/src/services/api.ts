import axios from 'axios';
import type { 
  ApiResponse,
  AuthData,
  CreateRoomRequest, 
  JoinRoomRequest, 
  RoomData,
  UserProfileWithShop,
  GameStateData,
  MakeMoveRequest,
  UserRoomStatus,
  ShopBrowseResponse,
  PurchaseThemeRequest,
  PurchaseThemeResponse,
  SelectThemeRequest,
  ThemeType,
  CoinPackage,
  CreateCheckoutRequest,
  CreateCheckoutResponse
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
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle API responses - extract data from our standard format
api.interceptors.response.use(
  (response) => {
    const apiResponse = response.data as ApiResponse;
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
    return await api.post('/auth/login', { username, password }) as any;
  },

  register: async (username: string, password: string): Promise<AuthData> => {
    return await api.post('/auth/register', { username, password }) as any;
  },

  getProfile: async (): Promise<UserProfileWithShop> => {
    return await api.get('/auth/me') as any;
  },

  getGameHistory: async () => {
    return await api.get('/auth/game-history') as any;
  },

  getTransactionHistory: async () => {
    return await api.get('/auth/transaction-history') as any;
  },
};

export const roomApi = {
  createRoom: async (request: CreateRoomRequest): Promise<RoomData> => {
    return await api.post('/rooms', request) as any;
  },

  joinRoom: async (request: JoinRoomRequest): Promise<RoomData> => {
    return await api.post('/rooms/join', request) as any;
  },

  getRoom: async (roomId: string): Promise<RoomData> => {
    return await api.get(`/rooms/${roomId}`) as any;
  },

  getCurrentRoom: async (): Promise<UserRoomStatus | null> => {
    return await api.get('/rooms/user/current') as any;
  },

  leaveRoom: async (roomId: string): Promise<{ message: string }> => {
    return await api.delete(`/rooms/${roomId}/leave`) as any;
  },

  addAIPlayer: async (roomId: string, difficulty: 'easy' | 'medium' | 'hard'): Promise<{ aiPlayer: any; message: string }> => {
    return await api.post(`/rooms/${roomId}/ai`, { difficulty }) as any;
  },
};

export const gameApi = {
  getGameState: async (roomId: string): Promise<GameStateData> => {
    return await api.get(`/games/${roomId}/state`) as any;
  },

  makeMove: async (roomId: string, moveRequest: MakeMoveRequest): Promise<GameStateData> => {
    return await api.post(`/games/${roomId}/move`, moveRequest) as any;
  },
};

export const shopApi = {
  /**
   * Get all shop data for the current user
   * Returns available themes, owned themes, selected themes, and coin balance
   */
  getShopData: async (): Promise<ShopBrowseResponse> => {
    return await api.get('/shop/data') as any;
  },

  /**
   * Purchase a theme using coins
   * @param shopItemId - The ID of the theme to purchase
   */
  purchaseTheme: async (shopItemId: string): Promise<PurchaseThemeResponse> => {
    const request: PurchaseThemeRequest = { shopItemId };
    return await api.post('/shop/purchase', request) as any;
  },

  /**
   * Select a theme as the active theme for the user
   * @param themeType - Either 'board' or 'pawn'
   * @param cssClass - The CSS class of the theme to select
   */
  selectTheme: async (themeType: ThemeType, cssClass: string): Promise<{ message: string }> => {
    const request: SelectThemeRequest = { themeType, cssClass };
    return await api.post('/shop/select-theme', request) as any;
  },
};

export const paymentApi = {
  /**
   * Get available coin packages
   */
  getCoinPackages: async (): Promise<CoinPackage[]> => {
    return await api.get('/payments/coin-packages') as any;
  },

  /**
   * Create a Stripe checkout session for purchasing coins
   * @param packageId - The ID of the coin package to purchase
   */
  createCheckoutSession: async (packageId: 'starter' | 'popular' | 'pro'): Promise<CreateCheckoutResponse> => {
    const request: CreateCheckoutRequest = { packageId };
    return await api.post('/payments/create-checkout-session', request) as any;
  },

  /**
   * Mock purchase for testing (development only)
   * @param packageId - The ID of the coin package to mock purchase
   */
  mockPurchase: async (packageId: string): Promise<{ message: string; coinsAdded: number; sessionId: string }> => {
    return await api.post('/payments/mock-webhook', { packageId }) as any;
  },
};