import { EmbeddingsService } from '../../src/embeddings/embeddings.service.js';

/**
 * Мок EmbeddingsService: настоящая модель весит ~130 МБ, а тестам важно не
 * качество вектора, а что с ним сделал код. Вектор по умолчанию — короткий
 * и узнаваемый, чтобы проверять, что именно ушло в SQL.
 *
 *   const embeddings = createMockEmbeddings();
 *   ...providers: [{ provide: EmbeddingsService, useValue: embeddings }]
 *   expect(embeddings.embedPassage).toHaveBeenCalledWith('React. Counter\n...');
 */
export function createMockEmbeddings(vector = [0.6, 0.8]) {
  return {
    embedQuery: vi
      .fn<EmbeddingsService['embedQuery']>()
      .mockResolvedValue(vector),
    embedPassage: vi
      .fn<EmbeddingsService['embedPassage']>()
      .mockResolvedValue(vector),
  };
}
