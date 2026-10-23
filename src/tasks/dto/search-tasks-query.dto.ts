import { PickType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FindTasksQueryDto } from './find-tasks-query.dto.js';

// Фильтры те же, что у GET /tasks; пагинации нет — поиск отдаёт top-k.
export class SearchTasksQueryDto extends PickType(FindTasksQueryDto, [
  'userId',
  'topic',
  'level',
] as const) {
  // Текст запроса на любом языке: ищем по смыслу, а не по словам.
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  q: string;

  // k в top-k: сколько самых похожих задач вернуть.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 5;
}
