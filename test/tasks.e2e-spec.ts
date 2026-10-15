import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { Database } from '../src/database/database.js';
import { createMockDatabase, sentQuery } from './utils/mock-database.js';

// HTTP-слой целиком (маршруты, ValidationPipe, ParseUUIDPipe, коды ответов)
// поверх мок-базы: что «вернула база», задаёт тест.
describe('Tasks (e2e)', () => {
  let app: INestApplication<App>;
  let mock: ReturnType<typeof createMockDatabase>;

  const userId = '11111111-1111-4111-8111-111111111111';
  const taskId = '22222222-2222-4222-8222-222222222222';
  const newTask = {
    userId,
    topic: 'React',
    level: 'easy',
    title: 'Counter',
    prompt: 'Make a counter component',
  };
  // Строка в том виде, в каком её отдаёт Postgres (snake_case).
  const taskRow = {
    id: taskId,
    user_id: userId,
    topic: 'React',
    level: 'easy',
    title: 'Counter',
    prompt: 'Make a counter component',
    starter_code: '',
    is_custom: false,
    created_at: new Date('2026-10-13T10:00:00Z'),
  };

  beforeEach(async () => {
    mock = createMockDatabase();
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(Database)
      .useValue(mock.db)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /tasks', () => {
    it('creates a task and returns it in camelCase', async () => {
      mock.executeQuery.mockResolvedValueOnce({ rows: [taskRow] });

      const { body } = await request(app.getHttpServer())
        .post('/tasks')
        .send(newTask)
        .expect(201);

      expect(body).toEqual({
        id: taskId,
        ...newTask,
        starterCode: '',
        isCustom: false,
        createdAt: '2026-10-13T10:00:00.000Z',
      });
      expect(sentQuery(mock.executeQuery).sql).toMatch(
        /^insert into "tasks" \("user_id", "topic", "level", "title", "prompt"\)/,
      );
    });

    it('returns 404 when the user does not exist', async () => {
      mock.executeQuery.mockRejectedValueOnce(
        Object.assign(new Error('fk violation'), { code: '23503' }),
      );

      await request(app.getHttpServer())
        .post('/tasks')
        .send(newTask)
        .expect(404);
    });

    it.each([
      ['an unknown topic', { ...newTask, topic: 'PHP' }],
      ['an unknown level', { ...newTask, level: 'expert' }],
      ['an empty title', { ...newTask, title: '' }],
      ['a non-uuid userId', { ...newTask, userId: '42' }],
      ['an extra field', { ...newTask, extra: 'field' }],
    ])('rejects %s with 400 without querying the database', async (_, dto) => {
      await request(app.getHttpServer()).post('/tasks').send(dto).expect(400);
      expect(mock.executeQuery).not.toHaveBeenCalled();
    });
  });

  describe('GET /tasks', () => {
    it('passes filters and pagination to the query', async () => {
      mock.executeQuery.mockResolvedValueOnce({ rows: [taskRow] });

      const { body } = await request(app.getHttpServer())
        .get('/tasks')
        .query({ userId, topic: 'React', limit: 5, offset: 10 })
        .expect(200);

      expect(body).toHaveLength(1);
      const { sql, parameters } = sentQuery(mock.executeQuery);
      expect(sql).toBe(
        'select * from "tasks" where "user_id" = $1 and "topic" = $2 ' +
          'order by "created_at" desc, "id" desc limit $3 offset $4',
      );
      expect(parameters).toEqual([userId, 'React', 5, 10]);
    });

    it('rejects limit above 100 with 400', async () => {
      await request(app.getHttpServer())
        .get('/tasks')
        .query({ limit: 1000 })
        .expect(400);
    });
  });

  describe('GET /tasks/:id', () => {
    it('returns the task', async () => {
      mock.executeQuery.mockResolvedValueOnce({ rows: [taskRow] });
      const { body } = await request(app.getHttpServer())
        .get(`/tasks/${taskId}`)
        .expect(200);
      expect(body.id).toBe(taskId);
    });

    it('returns 404 when the task does not exist', async () => {
      await request(app.getHttpServer()).get(`/tasks/${taskId}`).expect(404);
    });

    it('returns 400 for a non-uuid id', async () => {
      await request(app.getHttpServer()).get('/tasks/not-a-uuid').expect(400);
      expect(mock.executeQuery).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /tasks/:id', () => {
    it('updates only the passed fields', async () => {
      mock.executeQuery.mockResolvedValueOnce({
        rows: [{ ...taskRow, level: 'hard' }],
      });

      const { body } = await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .send({ level: 'hard' })
        .expect(200);

      expect(body.level).toBe('hard');
      const { sql, parameters } = sentQuery(mock.executeQuery);
      expect(sql).toMatch(/^update "tasks" set "level" = \$1 where "id" = \$2/);
      expect(parameters).toEqual(['hard', taskId]);
    });

    it('does not allow changing the owner', async () => {
      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .send({ userId })
        .expect(400);
    });

    it('returns 404 when the task does not exist', async () => {
      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .send({ title: 'x' })
        .expect(404);
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('returns 204 when the task was deleted', async () => {
      mock.executeQuery.mockResolvedValueOnce({
        rows: [],
        numAffectedRows: 1n,
      });
      await request(app.getHttpServer()).delete(`/tasks/${taskId}`).expect(204);
      expect(sentQuery(mock.executeQuery).sql).toBe(
        'delete from "tasks" where "id" = $1',
      );
    });

    it('returns 404 when there was nothing to delete', async () => {
      await request(app.getHttpServer()).delete(`/tasks/${taskId}`).expect(404);
    });
  });
});
