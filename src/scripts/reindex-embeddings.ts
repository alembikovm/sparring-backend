// Считает векторы задачам, у которых их нет (созданы до RAG) или они от
// другой модели. Запуск: npm run embeddings:reindex
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { TasksService } from '../tasks/tasks.service.js';

// Контекст без HTTP-сервера: те же модули и провайдеры, что в приложении.
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn'],
});
try {
  const count = await app.get(TasksService).reindexEmbeddings();
  console.log(`Пересчитано векторов: ${count}`);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await app.close();
  // Воркер ObserveModule перезапускается и после close() и не даёт процессу
  // завершиться сам — выходим явно, с кодом из process.exitCode.
  process.exit();
}
