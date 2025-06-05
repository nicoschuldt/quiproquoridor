"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const db_1 = require("../db");
const drizzle_orm_1 = require("drizzle-orm");
const errorHandler_1 = require("./errorHandler");
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new errorHandler_1.AppError(401, 'NO_TOKEN', 'No authentication token provided');
        }
        const token = authHeader.substring(7);
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
        const userResult = await db_1.db
            .select()
            .from(db_1.users)
            .where((0, drizzle_orm_1.eq)(db_1.users.id, decoded.userId))
            .limit(1);
        if (userResult.length === 0) {
            throw new errorHandler_1.AppError(401, 'INVALID_TOKEN', 'Invalid authentication token');
        }
        const user = userResult[0];
        req.user = {
            id: user.id,
            username: user.username,
            gamesPlayed: user.gamesPlayed,
            gamesWon: user.gamesWon,
        };
        next();
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            return next(error);
        }
        next(new errorHandler_1.AppError(401, 'AUTH_FAILED', 'Authentication failed'));
    }
};
exports.authenticate = authenticate;
