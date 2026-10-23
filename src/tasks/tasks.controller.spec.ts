import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller.js';
import { createMockDatabase } from '../../test/utils/mock-database.js';
import { createMockEmbeddings } from '../../test/utils/mock-embeddings.js';
import { Database } from '../database/database.js';
import { EmbeddingsService } from '../embeddings/embeddings.service.js';
import { TasksService } from './tasks.service.js';

describe('TasksController', () => {
  let controller: TasksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        TasksService,
        { provide: Database, useValue: createMockDatabase().db },
        { provide: EmbeddingsService, useValue: createMockEmbeddings() },
      ],
    }).compile();

    controller = module.get<TasksController>(TasksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
