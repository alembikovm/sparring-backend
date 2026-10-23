import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { FindTasksQueryDto } from './dto/find-tasks-query.dto.js';
import { SearchTasksQueryDto } from './dto/search-tasks-query.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { TasksService } from './tasks.service.js';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(createTaskDto);
  }

  @Get()
  findAll(@Query() query: FindTasksQueryDto) {
    return this.tasksService.findAll(query);
  }

  // Объявлен до :id, иначе /tasks/search попал бы в findOne как id = 'search'.
  @Get('search')
  search(@Query() query: SearchTasksQueryDto) {
    return this.tasksService.search(query);
  }

  // ParseUUIDPipe: на /tasks/abc ответ 400, а не ошибка Postgres про формат uuid.
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, updateTaskDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.remove(id);
  }
}
