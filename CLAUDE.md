# sparring-backend

NestJS 12 + Kysely + PostgreSQL. Ответы и комментарии в коде — на русском.

## Правила проекта

Нарушения проверяет `scripts/check-rules.mjs`: автоматически через хуки
Claude Code (`.claude/settings.json`) и вручную — `npm run check:rules`.
Смысловую проверку изменений делает субагент `rules-reviewer`.
Новое правило добавляется в оба места: сюда и в массив `RULES` скрипта.

### R1. Тесты не обращаются к реальной базе данных

Unit- и e2e-тесты работают только с моками. Запрещено в `*.spec.ts`,
`*.e2e-spec.ts` и `test/**`:

- импортировать `pg`, создавать `Pool`, `PostgresDialect`, читать `DATABASE_URL`;
- поднимать `AppModule` или `DatabaseModule` без
  `.overrideProvider(Database).useValue(...)`.

Как правильно: `createMockDatabase()` из `test/utils/mock-database.ts` —
настоящий Kysely (строит тот же SQL, что и в проде) с подменённым драйвером,
`executeQuery` которого — `vi.fn()`. В тестах задаётся, что «вернула база»,
и проверяется, какой SQL ушёл.
