import { sql, type Kysely } from 'kysely';

// `any` is required here since migrations should be frozen in time.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('tasks')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('topic', 'text', (col) => col.notNull())
    .addColumn('level', 'text', (col) => col.notNull())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('prompt', 'text', (col) => col.notNull())
    .addColumn('starter_code', 'text', (col) => col.notNull().defaultTo(''))
    // true — задача по описанию пользователя, false — сгенерирована по теме/уровню
    .addColumn('is_custom', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      'tasks_topic_check',
      sql`topic in ('JavaScript', 'React', 'Vue', 'Angular', 'Svelte', 'CSS', 'TypeScript', 'Design Patterns')`,
    )
    .addCheckConstraint(
      'tasks_level_check',
      sql`level in ('easy', 'medium', 'hard')`,
    )
    .execute();

  await db.schema
    .createIndex('tasks_user_id_created_at_idx')
    .on('tasks')
    .columns(['user_id', 'created_at'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('tasks').execute();
}
