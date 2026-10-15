import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { Database } from '../database/database.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;
  const executeQuery = vi.fn();

  beforeEach(async () => {
    executeQuery.mockReset();
    // sql`...`.execute(db) вызывает db.getExecutor().executeQuery(...)
    const db = {
      getExecutor: () => ({
        transformQuery: (node: unknown) => node,
        compileQuery: (node: unknown) => node,
        executeQuery,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: Database, useValue: db }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns ok when the database responds', async () => {
    executeQuery.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
    });
  });

  it('throws 503 when the database is unreachable', async () => {
    executeQuery.mockRejectedValue(new Error('connect ECONNREFUSED'));
    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
