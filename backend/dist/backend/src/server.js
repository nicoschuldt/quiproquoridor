"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const passport_1 = __importDefault(require("passport"));
const config_1 = require("./config");
const auth_1 = require("./routes/auth");
const rooms_1 = require("./routes/rooms");
const games_1 = require("./routes/games");
const shop_1 = require("./routes/shop");
const payments_1 = require("./routes/payments");
const socket_1 = require("./socket");
const passport_2 = require("./auth/passport");
const errorHandler_1 = require("./middleware/errorHandler");
const app = (0, express_1.default)();
exports.app = app;
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
exports.io = io;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: '*',
    credentials: true
}));
app.use('/api/payments/webhook', express_1.default.raw({ type: 'application/json' }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
(0, passport_2.setupPassport)();
app.use(passport_1.default.initialize());
app.set('io', io);
app.use('/api/auth', auth_1.authRouter);
app.use('/api/rooms', rooms_1.roomsRouter);
app.use('/api/games', games_1.gameRouter);
app.use('/api/shop', shop_1.shopRouter);
app.use('/api/payments', payments_1.paymentsRouter);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
(0, socket_1.socketHandler)(io);
app.use(errorHandler_1.errorHandler);
server.listen(config_1.config.port, () => {
    console.log(`Server running on port ${config_1.config.port}`);
    console.log(`Environment: ${config_1.config.nodeEnv}`);
    console.log(`Ready for Quoridor games!`);
});
