import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import passport from 'passport';

import { config } from './config';
import { authRouter } from './routes/auth';
import { roomsRouter } from './routes/rooms';
import { gameRouter } from './routes/games';
import { shopRouter } from './routes/shop';
import { paymentsRouter } from './routes/payments';
import { socketHandler } from './socket';
import { setupPassport } from './auth/passport';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(helmet());
app.use(cors({
  origin: '*',
  credentials: true
}));

app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

setupPassport();
app.use(passport.initialize());

app.set('io', io);

app.use('/api/auth', authRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/games', gameRouter);
app.use('/api/shop', shopRouter);
app.use('/api/payments', paymentsRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

socketHandler(io);

app.use(errorHandler);

server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Ready for Quoridor games!`);
});

export { app, io };