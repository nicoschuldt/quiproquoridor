import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001'),
  nodeEnv: process.env.NODE_ENV || 'development',
  dbFileName: process.env.DB_FILE_NAME || 'file:quoridor.db',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-jwt-key',
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'https://weekly-famous-wren.ngrok-free.app'],
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  allowedHosts: process.env.ALLOWED_HOSTS ? process.env.ALLOWED_HOSTS.split(',') : ['localhost', 'weekly-famous-wren.ngrok-free.app'],
  
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    priceIds: {
      starter: process.env.STRIPE_STARTER_PRICE_ID || 'price_test_starter',
      popular: process.env.STRIPE_POPULAR_PRICE_ID || 'price_test_popular',
      pro: process.env.STRIPE_PRO_PRICE_ID || 'price_test_pro',
    },
  },
  
  roomCodeLength: 6,
  maxRoomsPerUser: 5,
  roomIdleTimeout: 30 * 60 * 1000,
  
  rateLimitWindow: 15 * 60 * 1000,
  rateLimitMax: 100,
} as const; 