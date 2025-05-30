// backend/src/db/seed.ts
import 'dotenv/config';
import { db, users, rooms, games } from './index';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // Create test users
    const testUsers = [
      {
        username: 'alice',
        passwordHash: await bcrypt.hash('password123', 10),
        gamesPlayed: 5,
        gamesWon: 3,
      },
      {
        username: 'bob',
        passwordHash: await bcrypt.hash('password123', 10),
        gamesPlayed: 3,
        gamesWon: 1,
      },
    ];

    const insertedUsers = await db.insert(users).values(testUsers).returning();
    console.log(`✅ Created ${insertedUsers.length} test users`);

    // Create test room
    const testRoom = {
      code: nanoid(6).toUpperCase(),
      hostId: insertedUsers[0].id,
      maxPlayers: 2,
      status: 'lobby' as const,
      isPrivate: false,
      hasTimeLimit: false,
    };

    const insertedRooms = await db.insert(rooms).values(testRoom).returning();
    console.log(`Created ${insertedRooms.length} test room with code: ${testRoom.code}`);

    console.log('Database seeded successfully!');
    console.log('');
    console.log('Test accounts:');
    console.log('- Username: alice, Password: password123');
    console.log('- Username: bob, Password: password123');
    console.log(`- Test room code: ${testRoom.code}`);

  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();