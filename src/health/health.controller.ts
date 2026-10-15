import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'kysely';
import { Database } from '../database/database.js';

@Controller('health')
export class HealthController {
  constructor(private readonly db: Database) {}

  @Get()
  async check() {
    try {
      await sql`select 1`.execute(this.db);
      return { status: 'ok', db: 'up' };
    } catch (e) {
      throw new ServiceUnavailableException({
        status: 'error',
        db: (e as Error).message,
      });
    }
  }
}
