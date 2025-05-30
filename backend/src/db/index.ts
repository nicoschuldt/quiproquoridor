import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { config } from '../config';
import * as schema from './schema';

// Create LibSQL client
const client = createClient({ 
  url: config.dbFileName 
});

// Initialize Drizzle with schema
export const db = drizzle(client, { schema });

// Export schema for use in queries
export * from './schema';
