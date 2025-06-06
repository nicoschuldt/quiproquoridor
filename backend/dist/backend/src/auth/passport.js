"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupPassport = void 0;
const passport_1 = __importDefault(require("passport"));
const passport_jwt_1 = require("passport-jwt");
const db_1 = require("../db");
const drizzle_orm_1 = require("drizzle-orm");
const config_1 = require("../config");
const setupPassport = () => {
    passport_1.default.use(new passport_jwt_1.Strategy({
        jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: config_1.config.jwtSecret,
    }, async (payload, done) => {
        try {
            const userResult = await db_1.db
                .select()
                .from(db_1.users)
                .where((0, drizzle_orm_1.eq)(db_1.users.id, payload.userId))
                .limit(1);
            if (userResult.length === 0) {
                return done(null, false);
            }
            const user = userResult[0];
            return done(null, user);
        }
        catch (error) {
            return done(error, false);
        }
    }));
};
exports.setupPassport = setupPassport;
