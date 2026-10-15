import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  createMockDatabase,
  sentQuery,
} from '../../test/utils/mock-database.js';
import { Database } from '../database/database.js';
import { TasksService } from './tasks.service.js';

describe('TasksService', () => {
  let service: TasksService;
  let mock: ReturnType<typeof createMockDatabase>;

  const userId = '11111111-1111-4111-8111-111111111111';
  const taskId = '22222222-2222-4222-8222-222222222222';

  beforeEach(async () => {
    mock = createMockDatabase();
    const module = await Test.createTestingModule({
      providers: [TasksService, { provide: Database, useValue: mock.db }],
    }).compile();
    service = module.get(TasksService);
  });

  describe('create', () => {
    const dto = {
      userId,
      topic: 'Vue' as const,
      level: 'medium' as const,
      title: 'Todo list',
      prompt: 'Build a todo list',
    };

    it('inserts the task and returns the created row', async () => {
      mock.executeQuery.mockResolvedValueOnce({
        rows: [{ id: taskId, user_id: userId, title: 'Todo list' }],
      });

      await expect(service.create(dto)).resolves.toMatchObject({
        id: taskId,
        userId,
      });
      const { sql, parameters } = sentQuery(mock.executeQuery);
      expect(sql).toBe(
        'insert into "tasks" ("user_id", "topic", "level", "title", "prompt") ' +
          'values ($1, $2, $3, $4, $5) returning *',
      );
      expect(parameters).toEqual([
        userId,
        'Vue',
        'medium',
        'Todo list',
        'Build a todo list',
      ]);
    });

    it('turns a foreign key violation into NotFoundException', async () => {
      mock.executeQuery.mockRejectedValueOnce(
        Object.assign(new Error('fk violation'), { code: '23503' }),
      );
      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('rethrows other database errors as is', async () => {
      const error = new Error('connection lost');
      mock.executeQuery.mockRejectedValueOnce(error);
      await expect(service.create(dto)).rejects.toBe(error);
    });
  });

  describe('findAll', () => {
    it('without filters only orders and paginates', async () => {
      await service.findAll({ limit: 20, offset: 0 });

      const { sql, parameters } = sentQuery(mock.executeQuery);
      expect(sql).toBe(
        'select * from "tasks" order by "created_at" desc, "id" desc ' +
          'limit $1 offset $2',
      );
      expect(parameters).toEqual([20, 0]);
    });

    it('adds a where clause for each filter', async () => {
      await service.findAll({
        userId,
        topic: 'CSS',
        level: 'hard',
        limit: 10,
        offset: 0,
      });

      const { sql, parameters } = sentQuery(mock.executeQuery);
      expect(sql).toContain(
        'where "user_id" = $1 and "topic" = $2 and "level" = $3',
      );
      expect(parameters).toEqual([userId, 'CSS', 'hard', 10, 0]);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when there is no row', async () => {
      await expect(service.findOne(taskId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('with an empty dto does not run UPDATE and returns the task', async () => {
      mock.executeQuery.mockResolvedValueOnce({ rows: [{ id: taskId }] });

      await expect(service.update(taskId, {})).resolves.toEqual({ id: taskId });
      expect(sentQuery(mock.executeQuery).sql).toMatch(/^select /);
    });

    it('throws NotFoundException when nothing was updated', async () => {
      await expect(service.update(taskId, { title: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('resolves when a row was deleted', async () => {
      mock.executeQuery.mockResolvedValueOnce({
        rows: [],
        numAffectedRows: 1n,
      });
      await expect(service.remove(taskId)).resolves.toBeUndefined();
    });

    it('throws NotFoundException when nothing was deleted', async () => {
      await expect(service.remove(taskId)).rejects.toThrow(NotFoundException);
    });
  });
});
