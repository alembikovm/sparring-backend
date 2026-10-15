import { sql, type Kysely } from 'kysely';

// `any` is required here since migrations should be frozen in time.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('evaluations')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    // unique — у одной отправки одна оценка (1:1)
    .addColumn('submission_id', 'uuid', (col) =>
      col.notNull().unique().references('submissions.id').onDelete('cascade'),
    )
    .addColumn('passed', 'boolean', (col) => col.notNull())
    .addColumn('score', 'smallint', (col) =>
      col.notNull().check(sql`score between 0 and 100`),
    )
    .addColumn('feedback', 'text', (col) => col.notNull())
    .addColumn('tips', sql`text[]`, (col) => col.notNull().defaultTo(sql`'{}'`))
    // какая модель оценивала, например claude-sonnet-5
    .addColumn('model', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('evaluations').execute();
}
