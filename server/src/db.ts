import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.ts';

// default = docker-compose dev DB; set DATABASE_URL for anything else
export const db = drizzle(process.env.DATABASE_URL ?? 'postgres://kas:kas@localhost:5432/kas', { schema });
