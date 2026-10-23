import { sql, type Kysely } from 'kysely';

// `any` is required here since migrations should be frozen in time.
export async function up(db: Kysely<any>): Promise<void> {
  // pgvector: тип vector(n) и операторы расстояния (<=> — косинусное).
  await sql`create extension if not exists vector`.execute(db);

  // Отдельная таблица, а не колонка в tasks: selectAll() по задачам не тащит
  // 384 числа в каждый ответ API, а эмбеддинг можно пересчитать независимо.
  await db.schema
    .createTable('task_embeddings')
    // 1:1 с задачей; удалили задачу — удалился и вектор
    .addColumn('task_id', 'uuid', (col) =>
      col.primaryKey().references('tasks.id').onDelete('cascade'),
    )
    // 384 — размерность multilingual-e5-small
    .addColumn('embedding', sql`vector(384)`, (col) => col.notNull())
    // какой моделью посчитан: векторы разных моделей сравнивать нельзя
    .addColumn('model', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // HNSW — приближённый поиск ближайших соседей без полного перебора.
  // vector_cosine_ops — индекс для оператора <=>.
  await sql`
    create index task_embeddings_embedding_idx
    on task_embeddings using hnsw (embedding vector_cosine_ops)
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('task_embeddings').execute();
  await sql`drop extension if exists vector`.execute(db);
}
