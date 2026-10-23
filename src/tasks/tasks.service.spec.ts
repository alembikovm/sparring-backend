import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  createMockDatabase,
  sentQuery,
} from '../../test/utils/mock-database.js';
import { createMockEmbeddings } from '../../test/utils/mock-embeddings.js';
import { Database } from '../database/database.js';
import {
  EMBEDDING_MODEL,
  EmbeddingsService,
} from '../embeddings/embeddings.service.js';
import { TasksService } from './tasks.service.js';

describe('TasksService', () => {
  let service: TasksService;
  let mock: ReturnType<typeof createMockDatabase>;
  let embeddings: ReturnType<typeof createMockEmbeddings>;

  const userId = '11111111-1111-4111-8111-111111111111';
  const taskId = '22222222-2222-4222-8222-222222222222';

  beforeEach(async () => {
    mock = createMockDatabase();
    embeddings = createMockEmbeddings();
    const module = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: Database, useValue: mock.db },
        { provide: EmbeddingsService, useValue: embeddings },
      ],
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

    it('saves the embedding of the task text in the same transaction', async () => {
      mock.executeQuery.mockResolvedValueOnce({ rows: [{ id: taskId }] });

      await service.create(dto);

      expect(embeddings.embedPassage).toHaveBeenCalledWith(
        'Vue. Todo list\nBuild a todo list',
      );
      const { sql, parameters } = sentQuery(mock.executeQuery, 1);
      expect(sql).toBe(
        'insert into "task_embeddings" ("task_id", "embedding", "model") ' +
          'values ($1, $2, $3) on conflict ("task_id") do update set ' +
          '"embedding" = $4, "model" = $5, "created_at" = now()',
      );
      expect(parameters).toEqual([
        taskId,
        '[0.6,0.8]',
        EMBEDDING_MODEL,
        '[0.6,0.8]',
        EMBEDDING_MODEL,
      ]);
    });

    it('does not touch the database when the model fails', async () => {
      embeddings.embedPassage.mockRejectedValueOnce(new Error('no model'));
      await expect(service.create(dto)).rejects.toThrow('no model');
      expect(mock.executeQuery).not.toHaveBeenCalled();
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

  describe('search', () => {
    it('orders tasks by cosine distance to the query vector', async () => {
      mock.executeQuery.mockResolvedValueOnce({
        rows: [{ id: taskId, title: 'Todo list', distance: 0.25 }],
      });

      await expect(
        service.search({ q: 'список дел', limit: 5 }),
      ).resolves.toEqual([
        { id: taskId, title: 'Todo list', similarity: 0.75 },
      ]);

      expect(embeddings.embedQuery).toHaveBeenCalledWith('список дел');
      const { sql, parameters } = sentQuery(mock.executeQuery);
      expect(sql).toBe(
        'select "tasks".*, "task_embeddings"."embedding" <=> $1::vector as "distance" ' +
          'from "tasks" ' +
          'inner join "task_embeddings" on "task_embeddings"."task_id" = "tasks"."id" ' +
          'where "task_embeddings"."model" = $2 ' +
          'order by "task_embeddings"."embedding" <=> $3::vector ' +
          'limit $4',
      );
      expect(parameters).toEqual([
        '[0.6,0.8]',
        EMBEDDING_MODEL,
        '[0.6,0.8]',
        5,
      ]);
    });

    it('applies filters before taking top-k', async () => {
      await service.search({
        q: 'x',
        userId,
        topic: 'CSS',
        level: 'easy',
        limit: 3,
      });

      const { sql, parameters } = sentQuery(mock.executeQuery);
      expect(sql).toContain(
        'where "task_embeddings"."model" = $2 and "tasks"."user_id" = $3 ' +
          'and "tasks"."topic" = $4 and "tasks"."level" = $5',
      );
      expect(parameters.slice(2, 5)).toEqual([userId, 'CSS', 'easy']);
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
      expect(embeddings.embedPassage).not.toHaveBeenCalled();
    });

    it('recomputes the embedding from the updated row when the text changes', async () => {
      mock.executeQuery.mockResolvedValueOnce({
        rows: [
          { id: taskId, topic: 'CSS', title: 'Grid', prompt: 'Make a grid' },
        ],
      });

      await service.update(taskId, { title: 'Grid' });

      expect(embeddings.embedPassage).toHaveBeenCalledWith(
        'CSS. Grid\nMake a grid',
      );
      expect(sentQuery(mock.executeQuery, 1).sql).toMatch(
        /^insert into "task_embeddings"/,
      );
    });

    it('keeps the embedding when only the level changes', async () => {
      mock.executeQuery.mockResolvedValueOnce({ rows: [{ id: taskId }] });

      await service.update(taskId, { level: 'hard' });

      expect(embeddings.embedPassage).not.toHaveBeenCalled();
      expect(mock.executeQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('reindexEmbeddings', () => {
    it('embeds tasks without a vector or with a vector of another model', async () => {
      mock.executeQuery.mockResolvedValueOnce({
        rows: [
          { id: taskId, topic: 'Vue', title: 'A', prompt: 'a' },
          { id: userId, topic: 'CSS', title: 'B', prompt: 'b' },
        ],
      });

      await expect(service.reindexEmbeddings()).resolves.toBe(2);

      const { sql, parameters } = sentQuery(mock.executeQuery);
      expect(sql).toContain(
        'left join "task_embeddings" on "task_embeddings"."task_id" = "tasks"."id" ' +
          'where ("task_embeddings"."model" is null or "task_embeddings"."model" != $1)',
      );
      expect(parameters).toEqual([EMBEDDING_MODEL]);
      expect(embeddings.embedPassage.mock.calls).toEqual([
        ['Vue. A\na'],
        ['CSS. B\nb'],
      ]);
      // один select + по upsert на задачу
      expect(mock.executeQuery).toHaveBeenCalledTimes(3);
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
