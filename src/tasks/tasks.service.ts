import { Injectable, NotFoundException } from '@nestjs/common';
import { Database } from '../database/database.js';
import type { Task } from '../database/database.types.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { FindTasksQueryDto } from './dto/find-tasks-query.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';

// Код ошибки Postgres: нарушение внешнего ключа (ссылка на несуществующую запись).
const FOREIGN_KEY_VIOLATION = '23503';

@Injectable()
export class TasksService {
  constructor(private readonly db: Database) {}

  async create(dto: CreateTaskDto): Promise<Task> {
    try {
      return await this.db
        .insertInto('tasks')
        .values(dto)
        .returningAll()
        .executeTakeFirstOrThrow();
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

    const task = await this.db
      .updateTable('tasks')
      .set(dto)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async remove(id: string): Promise<void> {
    const { numDeletedRows } = await this.db
      .deleteFrom('tasks')
      .where('id', '=', id)
      .executeTakeFirst();
    if (numDeletedRows === 0n)
      throw new NotFoundException(`Task ${id} not found`);
  }
}
