import 'dotenv/config';
import { db, users, rooms, games } from './index';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { seedShopItems } from './seed-shop';

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    await seedShopItems();

    const testUsers = [
      {
        username: 'alice',
        passwordHash: await bcrypt.hash('password123', 10),
        gamesPlayed: 5,
        gamesWon: 3,
        coinBalance: 500,
        selectedBoardTheme: 'theme-board-default',
        selectedPawnTheme: 'theme-pawn-default',
      },
      {
        username: 'bob',
        passwordHash: await bcrypt.hash('password123', 10),
        gamesPlayed: 3,
        gamesWon: 1,
        coinBalance: 200,
        selectedBoardTheme: 'theme-board-default',
        selectedPawnTheme: 'theme-pawn-default',
      },
    ];

    const insertedUsers = await db.insert(users).values(testUsers).returning();
    console.log(`✅ Created ${insertedUsers.length} test users`);

    const testRoom = {
      code: nanoid(6).toUpperCase(),
      hostId: insertedUsers[0].id,
      maxPlayers: 2,
      status: 'lobby' as const,
      isPrivate: false,
      hasTimeLimit: false,
    };

    const insertedRooms = await db.insert(rooms).values(testRoom).returning();
    console.log(`✅ Created ${insertedRooms.length} test room with code: ${testRoom.code}`);

    console.log('✅ Database seeded successfully!');
    console.log('');
    console.log('Test accounts:');
    console.log('- Username: alice, Password: password123 (500 coins)');
    console.log('- Username: bob, Password: password123 (200 coins)');
    console.log(`- Test room code: ${testRoom.code}`);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();