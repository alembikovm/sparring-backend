import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto.js';

// Все поля необязательны; владельца задачи сменить нельзя.
export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['userId'] as const),
) {}
