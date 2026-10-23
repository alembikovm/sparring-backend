import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

// Описание таблиц для Kysely: ключ — имя таблицы, значение — интерфейс строки.
// Имена в camelCase: CamelCasePlugin (database.module.ts) переводит их в
// snake_case колонок базы и обратно.
// Generated<T> — колонка с DEFAULT в базе: при insert её можно не передавать.
export interface UsersTable {
  id: Generated<string>;
  email: string;
  name: string;
  createdAt: Generated<Date>;
}

// Те же значения проверяет CHECK в миграции create_tasks.
export const TASK_TOPICS = [
  'JavaScript',
  'React',
  'Vue',
  'Angular',
  'Svelte',
  'CSS',
  'TypeScript',
  'Design Patterns',
] as const;
export type TaskTopic = (typeof TASK_TOPICS)[number];

export const TASK_LEVELS = ['easy', 'medium', 'hard'] as const;
export type TaskLevel = (typeof TASK_LEVELS)[number];

export interface TasksTable {
  id: Generated<string>;
  userId: string;
  topic: TaskTopic;
  level: TaskLevel;
  title: string;
  prompt: string;
  starterCode: Generated<string>;
  isCustom: Generated<boolean>;
  createdAt: Generated<Date>;
}

export type Task = Selectable<TasksTable>;
export type NewTask = Insertable<TasksTable>;
export type TaskUpdate = Updateable<TasksTable>;

export interface SubmissionsTable {
  id: Generated<string>;
  taskId: string;
  code: string;
  createdAt: Generated<Date>;
}

export interface EvaluationsTable {
  id: Generated<string>;
  submissionId: string;
  passed: boolean;
  score: number;
  feedback: string;
  tips: Generated<string[]>;
  model: string;
  createdAt: Generated<Date>;
}

export interface TaskEmbeddingsTable {
  taskId: string;
  // pgvector принимает и отдаёт вектор строкой вида '[0.1,0.2,...]'
  embedding: string;
  model: string;
  createdAt: Generated<Date>;
}

export interface DB {
  users: UsersTable;
  tasks: TasksTable;
  submissions: SubmissionsTable;
  evaluations: EvaluationsTable;
  taskEmbeddings: TaskEmbeddingsTable;
}
