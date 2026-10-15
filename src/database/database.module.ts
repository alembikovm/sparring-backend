import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CamelCasePlugin, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { Database } from './database.js';

@Global()
@Module({
  providers: [
    {
      provide: Database,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Database({
          dialect: new PostgresDialect({
            pool: new Pool({
              connectionString: config.getOrThrow<string>('DATABASE_URL'),
              max: 10,
            }),
          }),
          // В коде camelCase (starterCode), в базе snake_case (starter_code).
          plugins: [new CamelCasePlugin()],
        }),
    },
  ],
  exports: [Database],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(private readonly db: Database) {}

  async onApplicationShutdown() {
    await this.db.destroy();
  }
}
