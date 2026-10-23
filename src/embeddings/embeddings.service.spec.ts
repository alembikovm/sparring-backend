import { pipeline as realPipeline } from '@huggingface/transformers';
import type { Mock } from 'vitest';
import {
  EMBEDDING_MODEL,
  EmbeddingsService,
  toPgVector,
} from './embeddings.service.js';

// Настоящая модель весит ~130 МБ и считает сотни миллисекунд — в unit-тестах
// подменяем её функцией, которая «возвращает вектор».
vi.mock('@huggingface/transformers', () => ({
  env: {},
  pipeline: vi.fn(),
}));

// vi.mocked(pipeline) упирается в тот же TS2590, что и в сервисе.
const pipeline = realPipeline as unknown as Mock;

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;
  const extractor = vi.fn();

  beforeEach(() => {
    pipeline.mockReset().mockResolvedValue(extractor);
    extractor
      .mockReset()
      .mockResolvedValue({ data: new Float32Array([0.6, 0.8]) });
    service = new EmbeddingsService();
  });

  it('adds the "query:" prefix to search queries', async () => {
    await expect(service.embedQuery('рекурсия')).resolves.toEqual([
      expect.closeTo(0.6),
      expect.closeTo(0.8),
    ]);
    expect(extractor).toHaveBeenCalledWith('query: рекурсия', {
      pooling: 'mean',
      normalize: true,
    });
  });

  it('adds the "passage:" prefix to documents', async () => {
    await service.embedPassage('Разверните связный список');
    expect(extractor).toHaveBeenCalledWith(
      'passage: Разверните связный список',
      expect.anything(),
    );
  });

  it('loads the model once for concurrent calls', async () => {
    await Promise.all([service.embedQuery('a'), service.embedPassage('b')]);
    expect(pipeline).toHaveBeenCalledTimes(1);
    expect(pipeline).toHaveBeenCalledWith(
      'feature-extraction',
      EMBEDDING_MODEL,
      { dtype: 'q8' },
    );
  });

  it('retries loading the model after a failure', async () => {
    pipeline.mockRejectedValueOnce(new Error('offline'));
    await expect(service.embedQuery('a')).rejects.toThrow('offline');
    await expect(service.embedQuery('a')).resolves.toHaveLength(2);
    expect(pipeline).toHaveBeenCalledTimes(2);
  });
});

describe('toPgVector', () => {
  it('formats a vector as a pgvector literal', () => {
    expect(toPgVector([0.5, -1, 0])).toBe('[0.5,-1,0]');
  });
});
