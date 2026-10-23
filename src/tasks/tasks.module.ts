import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module.js';
import { TasksService } from './tasks.service.js';
import { TasksController } from './tasks.controller.js';

@Module({
  imports: [EmbeddingsModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
