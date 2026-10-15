import { PostgresDialect } from 'kysely';
import { defineConfig } from 'kysely-ctl';
import { Pool } from 'pg';

// kysely-ctl сам загружает .env; на Railway переменная задаётся в настройках сервиса.
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

export default defineConfig({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: process.env.DATABASE_URL }),
  }),
  migrations: { migrationFolder: 'src/database/migrations' },
  seeds: { seedFolder: 'src/database/seeds' },
});
