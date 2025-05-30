"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.PORT || '3001'),
    nodeEnv: process.env.NODE_ENV || 'development',
    dbFileName: process.env.DB_FILE_NAME || 'file:quoridor.db',
    jwtSecret: process.env.JWT_SECRET || 'super-secret-jwt-key',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    // Game settings
    roomCodeLength: 6,
    maxRoomsPerUser: 5,
    roomIdleTimeout: 30 * 60 * 1000, // 30 minutes
    // Rate limiting
    rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 100, // requests per window
};
