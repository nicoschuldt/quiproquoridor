"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
// backend/src/routes/auth.ts
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
// Validation schemas
const registerSchema = zod_1.z.object({
    username: zod_1.z.string().min(3).max(50),
    password: zod_1.z.string().min(6),
});
const loginSchema = zod_1.z.object({
    username: zod_1.z.string(),
    password: zod_1.z.string(),
});
// Register route
router.post('/register', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { username, password } = registerSchema.parse(req.body);
    // Check if user exists
    const existingUser = await db_1.db
        .select()
        .from(db_1.users)
        .where((0, drizzle_orm_1.eq)(db_1.users.username, username))
        .limit(1);
    if (existingUser.length > 0) {
        throw new errorHandler_1.AppError(400, 'USER_EXISTS', 'Username already taken');
    }
    // Hash password
    const passwordHash = await bcrypt_1.default.hash(password, 10);
    // Create user
    const newUser = await db_1.db
        .insert(db_1.users)
        .values({
        username,
        passwordHash,
    })
        .returning();
    const user = newUser[0];
    // Generate JWT
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
                createdAt: user.createdAt, // Drizzle already converts this to Date
            },
        },
    });
}));
// Login route
router.post('/login', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);
    // Find user
    const userResult = await db_1.db
        .select()
        .from(db_1.users)
        .where((0, drizzle_orm_1.eq)(db_1.users.username, username))
        .limit(1);
    if (userResult.length === 0) {
        throw new errorHandler_1.AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
    }
    const user = userResult[0];
    // Verify password
    const isValidPassword = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!isValidPassword) {
        throw new errorHandler_1.AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
    }
    // Generate JWT
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
// Get current user profile
router.get('/me', passport_1.default.authenticate('jwt', { session: false }), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user; // Will be populated by passport
    res.json({
        success: true,
        data: {
            id: user.id,
            username: user.username,
            gamesPlayed: user.gamesPlayed,
            gamesWon: user.gamesWon,
            createdAt: user.createdAt,
        },
    });
}));
