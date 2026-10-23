import { Injectable, NotFoundException } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import { Database } from '../database/database.js';
import type { DB, Task } from '../database/database.types.js';
import {
  EMBEDDING_MODEL,
  EmbeddingsService,
  toPgVector,
} from '../embeddings/embeddings.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { FindTasksQueryDto } from './dto/find-tasks-query.dto.js';
import { SearchTasksQueryDto } from './dto/search-tasks-query.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';

// Код ошибки Postgres: нарушение внешнего ключа (ссылка на несуществующую запись).
const FOREIGN_KEY_VIOLATION = '23503';

// Поля, из которых складывается текст для эмбеддинга (см. taskPassage).
// level сюда не входит: по нему фильтруют, а не ищут по смыслу.
const EMBEDDED_FIELDS = ['topic', 'title', 'prompt'] as const;
type EmbeddedFields = Pick<Task, (typeof EMBEDDED_FIELDS)[number]>;

export type TaskSearchResult = Task & {
  // Косинусная близость к запросу: чем больше, тем ближе по смыслу.
  similarity: number;
};

/** Текст задачи, который превращается в вектор. */
export function taskPassage({ topic, title, prompt }: EmbeddedFields): string {
  return `${topic}. ${title}\n${prompt}`;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly db: Database,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async create(dto: CreateTaskDto): Promise<Task> {
    // Считаем вектор до транзакции: модели база не нужна, а держать
    // транзакцию открытой, пока она думает, незачем.
    const embedding = await this.embeddings.embedPassage(taskPassage(dto));
    try {
      // Задача и её вектор появляются вместе или не появляются вовсе.
      return await this.db.transaction().execute(async (trx) => {
        const task = await trx
          .insertInto('tasks')
          .values(dto)
          .returningAll()
          .executeTakeFirstOrThrow();
        await this.saveEmbedding(trx, task.id, embedding);
        return task;
      });
    } catch (e) {
      if ((e as { code?: string }).code === FOREIGN_KEY_VIOLATION) {
        throw new NotFoundException(`User ${dto.userId} not found`);
      }
      throw e;
    }
  }

  findAll({
    userId,
    topic,
    level,
    limit,
    offset,
  }: FindTasksQueryDto): Promise<Task[]> {
    let query = this.db.selectFrom('tasks').selectAll();
    if (userId) query = query.where('userId', '=', userId);
    if (topic) query = query.where('topic', '=', topic);
    if (level) query = query.where('level', '=', level);

    return (
      query
        // id — для стабильного порядка у задач с одинаковым createdAt
        .orderBy('createdAt', 'desc')
        .orderBy('id', 'desc')
        .limit(limit)
        .offset(offset)
        .execute()
    );
  }

  /** Семантический поиск: top-k задач, ближайших по смыслу к запросу. */
  async search({
    q,
    userId,
    topic,
    level,
    limit,
  }: SearchTasksQueryDto): Promise<TaskSearchResult[]> {
    const vector = toPgVector(await this.embeddings.embedQuery(q));
    // <=> — косинусное расстояние pgvector (0 — то же направление, 2 —
    // противоположное). Именно для него построен HNSW-индекс, поэтому
    // сортируем по расстоянию, а не по близости.
    const distance = sql<number>`${sql.ref('taskEmbeddings.embedding')} <=> ${vector}::vector`;

    let query = this.db
      .selectFrom('tasks')
      .innerJoin('taskEmbeddings', 'taskEmbeddings.taskId', 'tasks.id')
      .selectAll('tasks')
      .select(distance.as('distance'))
      // векторы другой модели лежат в другом пространстве — с ними не сравниваем
      .where('taskEmbeddings.model', '=', EMBEDDING_MODEL);
    if (userId) query = query.where('tasks.userId', '=', userId);
    if (topic) query = query.where('tasks.topic', '=', topic);
    if (level) query = query.where('tasks.level', '=', level);

    const rows = await query.orderBy(distance).limit(limit).execute();
    return rows.map(({ distance, ...task }) => ({
      ...task,
      similarity: 1 - distance,
    }));
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.db
      .selectFrom('tasks')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async update(id: string, dto: UpdateTaskDto): Promise<Task> {
    // UPDATE без SET — синтаксическая ошибка, а пустой PATCH ничего не меняет.
    if (Object.keys(dto).length === 0) return this.findOne(id);

    return this.db.transaction().execute(async (trx) => {
      const task = await trx
        .updateTable('tasks')
        .set(dto)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
      if (!task) throw new NotFoundException(`Task ${id} not found`);

      // Текст для вектора берём из обновлённой строки: в dto только
      // изменённые поля, а нужны все три. Модель считает внутри транзакции,
      // чтобы вектор не отстал от текста, если она упадёт.
      if (EMBEDDED_FIELDS.some((field) => field in dto)) {
        const embedding = await this.embeddings.embedPassage(taskPassage(task));
        await this.saveEmbedding(trx, task.id, embedding);
      }
      return task;
    });
  }

  async remove(id: string): Promise<void> {
    // Вектор удалится сам: внешний ключ task_embeddings с on delete cascade.
    const { numDeletedRows } = await this.db
      .deleteFrom('tasks')
      .where('id', '=', id)
      .executeTakeFirst();
    if (numDeletedRows === 0n)
      throw new NotFoundException(`Task ${id} not found`);
  }

  /**
   * Считает векторы задачам, у которых их нет или они от другой модели
   * (задачи, созданные до RAG, или после смены EMBEDDING_MODEL).
   * Возвращает, сколько задач обработано.
   */
  async reindexEmbeddings(): Promise<number> {
    const tasks = await this.db
      .selectFrom('tasks')
      .leftJoin('taskEmbeddings', 'taskEmbeddings.taskId', 'tasks.id')
      .select(['tasks.id', 'tasks.topic', 'tasks.title', 'tasks.prompt'])
      .where((eb) =>
        eb.or([
          eb('taskEmbeddings.model', 'is', null),
          eb('taskEmbeddings.model', '!=', EMBEDDING_MODEL),
        ]),
      )
      .execute();

    for (const task of tasks) {
      const embedding = await this.embeddings.embedPassage(taskPassage(task));
      await this.saveEmbedding(this.db, task.id, embedding);
    }
    return tasks.length;
  }

  // Upsert: у задачи один вектор, при пересчёте он перезаписывается.
  private async saveEmbedding(
    db: Database | Transaction<DB>,
    taskId: string,
    embedding: number[],
  ): Promise<void> {
    const row = { embedding: toPgVector(embedding), model: EMBEDDING_MODEL };
    await db
      .insertInto('taskEmbeddings')
      .values({ taskId, ...row })
      .onConflict((oc) =>
        // createdAt — когда вектор посчитан, поэтому обновляем и его
        oc.column('taskId').doUpdateSet({ ...row, createdAt: sql`now()` }),
      )
      .execute();
  }
}
