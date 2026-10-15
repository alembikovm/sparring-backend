import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  TASK_LEVELS,
  TASK_TOPICS,
  type TaskLevel,
  type TaskTopic,
} from '../../database/database.types.js';

export class CreateTaskDto {
  // Пока нет авторизации, владелец передаётся явно. Потом будет браться из токена.
  @IsUUID()
  userId: string;

  @IsIn(TASK_TOPICS)
  topic: TaskTopic;

  @IsIn(TASK_LEVELS)
  level: TaskLevel;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsOptional()
  @IsString()
  starterCode?: string;

  @IsOptional()
  @IsBoolean()
  isCustom?: boolean;
}
