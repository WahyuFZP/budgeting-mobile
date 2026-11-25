import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // default = docker-compose dev DB; set DATABASE_URL for anything else
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://kas:kas@localhost:5432/kas' },
} satisfies Config;
