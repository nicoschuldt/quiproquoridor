"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const migrator_1 = require("drizzle-orm/libsql/migrator");
const index_1 = require("./index");
async function main() {
    console.log('🔄 Running migrations...');
    try {
        await (0, migrator_1.migrate)(index_1.db, { migrationsFolder: './src/db/migrations' });
        console.log('Migrations completed successfully');
    }
    catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}
main();
