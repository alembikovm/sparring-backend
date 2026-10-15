#!/usr/bin/env node
// Проверка правил проекта (см. CLAUDE.md, раздел «Правила проекта»).
//
//   node scripts/check-rules.mjs          — проверить весь проект
//   node scripts/check-rules.mjs --hook   — режим хука Claude Code: JSON события
//                                           приходит в stdin, при нарушениях
//                                           exit 2 и описание в stderr — Claude
//                                           получает его и исправляет.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git']);

const isTestFile = (rel) =>
  /\.(e2e-)?spec\.ts$/.test(rel) || /^test\/.+\.ts$/.test(rel);

const RULES = [
  {
    id: 'R1',
    title: 'Тесты не обращаются к реальной базе данных',
    appliesTo: isTestFile,
    fix:
      'Используй createMockDatabase() из test/utils/mock-database.ts. ' +
      'Если в тесте поднимается AppModule/DatabaseModule — добавь ' +
      '.overrideProvider(Database).useValue(db) перед .compile().',
    check(source) {
      const found = [];
      const forbidden = [
        [/from\s+['"]pg['"]/, "импорт драйвера 'pg'"],
        [/\bnew\s+Pool\s*\(/, 'создание пула соединений Pool'],
        [/\bPostgresDialect\b/, 'PostgresDialect — реальное подключение'],
        [/\bDATABASE_URL\b/, 'чтение DATABASE_URL'],
      ];
      source.split('\n').forEach((text, i) => {
        for (const [re, what] of forbidden) {
          if (re.test(text)) found.push({ line: i + 1, what });
        }
      });

      // Ищем именно импорт модуля, а не упоминание в комментарии.
      const bootsRealDb =
        /import\s*\{[^}]*\b(AppModule|DatabaseModule)\b[^}]*\}\s*from/.exec(
          source,
        );
      if (bootsRealDb && !/\.overrideProvider\(\s*Database\s*\)/.test(source)) {
        const line = source.slice(0, bootsRealDb.index).split('\n').length;
        found.push({
          line,
          what: `${bootsRealDb[1]} поднимается без overrideProvider(Database) — запросы уйдут в реальную базу`,
        });
      }
      return found;
    },
  },
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP_DIRS.has(name) || name.startsWith('.')) return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function checkFiles(files) {
  const violations = [];
  for (const file of files) {
    const rel = relative(ROOT, file);
    if (!rel.endsWith('.ts') || rel.startsWith('..')) continue;
    let source;
    try {
      source = readFileSync(file, 'utf8');
    } catch {
      continue; // файл удалён
    }
    for (const rule of RULES) {
      if (!rule.appliesTo(rel)) continue;
      for (const v of rule.check(source)) violations.push({ rule, rel, ...v });
    }
  }
  return violations;
}

function format(violations) {
  const lines = [`Нарушены правила проекта (${violations.length}):`];
  for (const { rule, rel, line, what } of violations) {
    lines.push(`- [${rule.id}] ${rel}:${line} — ${what}`);
  }
  const rules = [...new Set(violations.map((v) => v.rule))];
  lines.push('', 'Как исправить:');
  for (const rule of rules)
    lines.push(`- [${rule.id}] ${rule.title}. ${rule.fix}`);
  lines.push('', 'Подробности — CLAUDE.md, раздел «Правила проекта».');
  return lines.join('\n');
}

if (process.argv.includes('--hook')) {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const editedFile = input.tool_input?.file_path;
  // PostToolUse — проверяем только что изменённый файл, Stop — весь проект.
  const violations = checkFiles(
    editedFile ? [resolve(editedFile)] : walk(ROOT),
  );
  if (violations.length === 0) process.exit(0);

  if (input.hook_event_name === 'Stop' && input.stop_hook_active) {
    // Уже возвращали на исправление в этом ходе — не зацикливаемся,
    // но показываем пользователю, что нарушения остались.
    console.log(JSON.stringify({ systemMessage: format(violations) }));
    process.exit(0);
  }
  console.error(format(violations));
  process.exit(2);
} else {
  const violations = checkFiles(walk(ROOT));
  if (violations.length === 0) {
    console.log('Правила проекта соблюдены.');
  } else {
    console.error(format(violations));
    process.exit(1);
  }
}
