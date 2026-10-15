import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  createMockDatabase,
  sentQuery,
} from '../../test/utils/mock-database.js';
import { Database } from '../database/database.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;
  let mock: ReturnType<typeof createMockDatabase>;

  beforeEach(async () => {
    mock = createMockDatabase();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: Database, useValue: mock.db }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns ok when the database responds', async () => {
    mock.executeQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
    });
    expect(sentQuery(mock.executeQuery).sql).toBe('select 1');
  });

  it('throws 503 when the database is unreachable', async () => {
    mock.executeQuery.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
