import {
  CamelCasePlugin,
  DummyDriver,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type QueryResult,
} from 'kysely';
import { Database } from '../../src/database/database.js';

type ExecuteQuery = (query: CompiledQuery) => Promise<QueryResult<unknown>>;

/**
 * Мок базы для тестов (правило R1 в CLAUDE.md).
 *
 * Это настоящий Kysely с теми же диалектом и плагинами, что в DatabaseModule,
 * поэтому сервисы строят тот же SQL, что и в проде. Но соединения нет: каждый
 * запрос попадает в `executeQuery` — `vi.fn()`, которому тест говорит, что
 * «вернула база», и по которому проверяет, какой SQL ушёл.
 *
 *   const { db, executeQuery } = createMockDatabase();
 *   executeQuery.mockResolvedValueOnce({ rows: [task] });
 *   ...
 *   expect(executeQuery.mock.calls[0][0].sql).toContain('insert into "tasks"');
 *
 * По умолчанию любой запрос возвращает пустой результат.
 */
export function createMockDatabase() {
  const executeQuery = vi
    .fn<ExecuteQuery>()
    .mockResolvedValue({ rows: [], numAffectedRows: 0n });

  const connection: DatabaseConnection = {
    executeQuery: executeQuery as DatabaseConnection['executeQuery'],
    streamQuery: () => {
      throw new Error('streamQuery не поддерживается мок-базой');
    },
  };

  class MockDriver extends DummyDriver {
    override async acquireConnection() {
      return connection;
    }
  }

  const db = new Database({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new MockDriver(),
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
  });

  return { db, executeQuery };
}

/** SQL и параметры n-го запроса (с нуля), отправленного в мок-базу. */
export function sentQuery(
  executeQuery: ReturnType<typeof createMockDatabase>['executeQuery'],
  n = 0,
) {
  const query = executeQuery.mock.calls[n]?.[0];
  if (!query) throw new Error(`Запрос #${n} не отправлялся`);
  return { sql: query.sql, parameters: query.parameters };
}
