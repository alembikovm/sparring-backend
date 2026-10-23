import { Injectable } from '@nestjs/common';
import {
  env,
  pipeline,
  type FeatureExtractionPipeline,
} from '@huggingface/transformers';

// Многоязычная модель: русский и английский текст попадают в одно пространство,
// поэтому «развернуть список» находит «reverse a list».
export const EMBEDDING_MODEL = 'Xenova/multilingual-e5-small';
// Должно совпадать с vector(384) в миграции create_task_embeddings.
export const EMBEDDING_DIMENSIONS = 384;

// По умолчанию модель кэшируется в node_modules и пропадает после npm ci.
env.cacheDir = '.cache/models';

// У pipeline() перегрузки под все задачи сразу, и TypeScript не может вывести
// их объединение (TS2590). Сужаем сигнатуру до той, что нужна нам.
const createExtractor = pipeline as (
  task: 'feature-extraction',
  model: string,
  options: { dtype: 'q8' },
) => Promise<FeatureExtractionPipeline>;

@Injectable()
export class EmbeddingsService {
  // Модель (~130 МБ) грузится при первом вызове, а не на старте приложения.
  // Храним промис, чтобы параллельные запросы не грузили её несколько раз.
  private extractor?: Promise<FeatureExtractionPipeline>;

  // Модели семейства e5 обучены с префиксами: короткий запрос пользователя
  // помечается «query:», а документ, среди которых ищем, — «passage:».
  // Без префиксов качество поиска заметно падает.
  embedQuery(text: string): Promise<number[]> {
    return this.embed(`query: ${text}`);
  }

  embedPassage(text: string): Promise<number[]> {
    return this.embed(`passage: ${text}`);
  }

  private async embed(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const output = await extractor(text, {
      // Модель выдаёт вектор на каждый токен, mean усредняет их в один вектор
      // на весь текст.
      pooling: 'mean',
      // Длина вектора 1: тогда косинусная близость — просто скалярное произведение.
      normalize: true,
    });
    return Array.from(output.data as Float32Array);
  }

  private getExtractor(): Promise<FeatureExtractionPipeline> {
    this.extractor ??= createExtractor('feature-extraction', EMBEDDING_MODEL, {
      // 8-битная версия весов: в 4 раза меньше и быстрее, качество почти то же.
      dtype: 'q8',
    }).catch((e: unknown) => {
      // Не запоминаем неудачу (например, нет сети при скачивании модели),
      // чтобы следующий вызов попробовал загрузить её снова.
      this.extractor = undefined;
      throw e;
    });
    return this.extractor;
  }
}

/** Вектор в текстовом формате pgvector: '[0.1,0.2,...]'. */
export function toPgVector(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
