import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import passport from 'passport';

import 'dotenv/config';

import { config } from './config';
import { authRouter } from './routes/auth';
import { roomsRouter } from './routes/rooms';
import { gameRouter } from './routes/games';
import { shopRouter } from './routes/shop';
import { socketHandler } from './socket';
import { setupPassport } from './auth/passport';
import { errorHandler } from './middleware/errorHandler';
import { purchaseRouter } from './routes/purchase';
import { stripeWebhookRouter } from './routes/stripeWebhook';

const app = express();
const server = createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Passport setup
setupPassport();
app.use(passport.initialize());

// Make io available to routes
app.set('io', io);

// Routes
app.use('/api/auth', authRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/games', gameRouter);
app.use('/api/purchase', purchaseRouter);
app.use('/api/stripe', stripeWebhookRouter);
app.use('/api/shop', shopRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket handling
socketHandler(io);

// Error handling
app.use(errorHandler);

// Start server
server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Ready for Quoridor games!`);
});

export { app, io };