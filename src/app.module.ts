import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { TasksModule } from './tasks/tasks.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Читает .env, если он есть; переменные окружения процесса имеют приоритет.
    ConfigModule.forRoot({ isGlobal: true }),
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'sparring-backend',
    }),
    DatabaseModule,
    TasksModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    // Глобальная валидация DTO. Через APP_PIPE, а не app.useGlobalPipes() в
    // main.ts, чтобы она работала и в e2e-тестах, которые собирают AppModule.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true, // выкидывать поля, которых нет в DTO
        forbidNonWhitelisted: true, // ...и отвечать 400, если они пришли
        transform: true, // превращать body/query в экземпляры DTO с нужными типами
      }),
    },
  ],
})
export class AppModule {}
