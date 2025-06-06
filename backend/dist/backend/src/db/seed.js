"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const index_1 = require("./index");
const bcrypt_1 = __importDefault(require("bcrypt"));
const nanoid_1 = require("nanoid");
const seed_shop_1 = require("./seed-shop");
async function seed() {
    console.log('Seeding database...');
    try {
        await (0, seed_shop_1.seedShopItems)();
        const testUsers = [
            {
                username: 'nouria',
                passwordHash: await bcrypt_1.default.hash('123456', 10),
                gamesPlayed: 5,
                gamesWon: 3,
                coinBalance: 500,
                selectedBoardTheme: 'theme-board-default',
                selectedPawnTheme: 'theme-pawn-default',
            },
            {
                username: 'florian',
                passwordHash: await bcrypt_1.default.hash('123456', 10),
                gamesPlayed: 3,
                gamesWon: 1,
                coinBalance: 200,
                selectedBoardTheme: 'theme-board-default',
                selectedPawnTheme: 'theme-pawn-default',
            },
            {
                username: 'nico',
                passwordHash: await bcrypt_1.default.hash('123456', 10),
                gamesPlayed: 1000,
                gamesWon: 1000,
                coinBalance: 1000,
            },
            {
                username: 'oscarito',
                passwordHash: await bcrypt_1.default.hash('123456', 10),
                gamesPlayed: 0,
                gamesWon: 0,
                coinBalance: 0,
            },
        ];
        const insertedUsers = await index_1.db.insert(index_1.users).values(testUsers).returning();
        console.log(`Created ${insertedUsers.length} test users`);
        const testRoom = {
            code: (0, nanoid_1.nanoid)(6).toUpperCase(),
            hostId: insertedUsers[0].id,
            maxPlayers: 2,
            status: 'lobby',
            isPrivate: false,
            hasTimeLimit: false,
        };
        const insertedRooms = await index_1.db.insert(index_1.rooms).values(testRoom).returning();
        console.log(`Created ${insertedRooms.length} test room with code: ${testRoom.code}`);
        console.log('Database seeded successfully!');
        console.log('');
        console.log('Test accounts:');
        console.log('- Username: alice, Password: password123 (500 coins)');
        console.log('- Username: bob, Password: password123 (200 coins)');
        console.log(`- Test room code: ${testRoom.code}`);
    }
    catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}
seed();
