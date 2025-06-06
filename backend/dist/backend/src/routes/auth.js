"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const db_1 = require("../db");
const drizzle_orm_1 = require("drizzle-orm");
const config_1 = require("../config");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
exports.authRouter = router;
const registerSchema = zod_1.z.object({
    username: zod_1.z.string().min(3).max(50),
    password: zod_1.z.string().min(6),
});
const loginSchema = zod_1.z.object({
    username: zod_1.z.string(),
    password: zod_1.z.string(),
});
router.post('/register', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { username, password } = registerSchema.parse(req.body);
    const existingUser = await db_1.db
        .select()
        .from(db_1.users)
        .where((0, drizzle_orm_1.eq)(db_1.users.username, username))
        .limit(1);
    if (existingUser.length > 0) {
        throw new errorHandler_1.AppError(400, 'USER_EXISTS', 'Username already taken');
    }
    const passwordHash = await bcrypt_1.default.hash(password, 10);
    const newUser = await db_1.db
        .insert(db_1.users)
        .values({
        username,
        passwordHash,
    })
        .returning();
    const user = newUser[0];
    const token = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username }, config_1.config.jwtSecret, { expiresIn: '7d' });
    res.json({
        success: true,
        data: {
            token,
            user: {
                id: user.id,
                username: user.username,
                gamesPlayed: user.gamesPlayed,
                gamesWon: user.gamesWon,
                createdAt: user.createdAt,
            },
        },
    });
}));
router.post('/login', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);
    const userResult = await db_1.db
        .select()
        .from(db_1.users)
        .where((0, drizzle_orm_1.eq)(db_1.users.username, username))
        .limit(1);
    if (userResult.length === 0) {
        throw new errorHandler_1.AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
    }
    const user = userResult[0];
    const isValidPassword = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!isValidPassword) {
        throw new errorHandler_1.AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
    }
    const token = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username }, config_1.config.jwtSecret, { expiresIn: '7d' });
    res.json({
        success: true,
        data: {
            token,
            user: {
                id: user.id,
                username: user.username,
                gamesPlayed: user.gamesPlayed,
                gamesWon: user.gamesWon,
                createdAt: user.createdAt,
            },
        },
    });
}));
router.get('/me', passport_1.default.authenticate('jwt', { session: false }), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const fullUserData = await db_1.db
        .select({
        id: db_1.users.id,
        username: db_1.users.username,
        gamesPlayed: db_1.users.gamesPlayed,
        gamesWon: db_1.users.gamesWon,
        createdAt: db_1.users.createdAt,
        coinBalance: db_1.users.coinBalance,
        selectedBoardTheme: db_1.users.selectedBoardTheme,
        selectedPawnTheme: db_1.users.selectedPawnTheme,
    })
        .from(db_1.users)
        .where((0, drizzle_orm_1.eq)(db_1.users.id, user.id))
        .limit(1);
    if (fullUserData.length === 0) {
        throw new errorHandler_1.AppError(404, 'USER_NOT_FOUND', 'User not found');
    }
    const userData = fullUserData[0];
    res.json({
        success: true,
        data: {
            id: userData.id,
            username: userData.username,
            gamesPlayed: userData.gamesPlayed,
            gamesWon: userData.gamesWon,
            createdAt: userData.createdAt,
            coinBalance: userData.coinBalance,
            selectedBoardTheme: userData.selectedBoardTheme,
            selectedPawnTheme: userData.selectedPawnTheme,
        },
    });
}));
router.get('/game-history', passport_1.default.authenticate('jwt', { session: false }), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const gameHistory = await db_1.db
        .select({
        gameId: db_1.gamePlayers.gameId,
        playerIndex: db_1.gamePlayers.playerIndex,
        color: db_1.gamePlayers.color,
        isWinner: db_1.gamePlayers.isWinner,
        wallsUsed: db_1.gamePlayers.wallsUsed,
        gameStatus: db_1.games.status,
        gameStartedAt: db_1.games.startedAt,
        gameFinishedAt: db_1.games.finishedAt,
    })
        .from(db_1.gamePlayers)
        .innerJoin(db_1.games, (0, drizzle_orm_1.eq)(db_1.games.id, db_1.gamePlayers.gameId))
        .where((0, drizzle_orm_1.eq)(db_1.gamePlayers.userId, user.id))
        .orderBy((0, drizzle_orm_1.desc)(db_1.games.createdAt))
        .limit(50);
    res.json({
        success: true,
        data: gameHistory,
    });
}));
router.get('/transaction-history', passport_1.default.authenticate('jwt', { session: false }), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const transactionHistory = await db_1.db
        .select({
        id: db_1.transactions.id,
        type: db_1.transactions.type,
        amount: db_1.transactions.amount,
        description: db_1.transactions.description,
        shopItemId: db_1.transactions.shopItemId,
        stripeSessionId: db_1.transactions.stripeSessionId,
        createdAt: db_1.transactions.createdAt,
    })
        .from(db_1.transactions)
        .where((0, drizzle_orm_1.eq)(db_1.transactions.userId, user.id))
        .orderBy((0, drizzle_orm_1.desc)(db_1.transactions.createdAt))
        .limit(100);
    res.json({
        success: true,
        data: transactionHistory,
    });
}));
