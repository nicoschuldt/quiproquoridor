import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { config } from '../config';
import * as schema from './schema';

const client = createClient({
  url: config.dbFileName 
});

export const db = drizzle(client, { schema });

export * from './schema';
