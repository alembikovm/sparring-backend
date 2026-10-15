import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import {
  TASK_LEVELS,
  TASK_TOPICS,
  type TaskLevel,
  type TaskTopic,
} from '../../database/database.types.js';

export class FindTasksQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsIn(TASK_TOPICS)
  topic?: TaskTopic;

  @IsOptional()
  @IsIn(TASK_LEVELS)
  level?: TaskLevel;

  // Query-параметры приходят строками, @Type превращает их в числа.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
