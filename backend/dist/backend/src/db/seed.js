"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/db/seed.ts
require("dotenv/config");
const index_1 = require("./index");
const bcrypt_1 = __importDefault(require("bcrypt"));
const nanoid_1 = require("nanoid");
async function seed() {
    console.log('🌱 Seeding database...');
    try {
        // Create test users
        const testUsers = [
            {
                username: 'alice',
                passwordHash: await bcrypt_1.default.hash('password123', 10),
                gamesPlayed: 5,
                gamesWon: 3,
            },
            {
                username: 'bob',
                passwordHash: await bcrypt_1.default.hash('password123', 10),
                gamesPlayed: 3,
                gamesWon: 1,
            },
        ];
        const insertedUsers = await index_1.db.insert(index_1.users).values(testUsers).returning();
        console.log(`✅ Created ${insertedUsers.length} test users`);
        // Create test room
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
        console.log('- Username: alice, Password: password123');
        console.log('- Username: bob, Password: password123');
        console.log(`- Test room code: ${testRoom.code}`);
    }
    catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}
seed();
