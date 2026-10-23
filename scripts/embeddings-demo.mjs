#!/usr/bin/env node
// Демо поиска по смыслу: без базы, только модель и косинусная близость.
//
//   npm run embeddings:demo                      — запрос по умолчанию
//   npm run embeddings:demo -- "свой запрос"
//
// Та же модель и те же префиксы, что в src/embeddings/embeddings.service.ts.
import { env, pipeline } from '@huggingface/transformers';

env.cacheDir = '.cache/models';

const query = process.argv[2] ?? 'задача на рекурсию';

// Маленькая «база знаний» — как будто это задачи из таблицы tasks.
const passages = [
  'Reverse a singly linked list in place',
  'Напишите функцию, которая вычисляет факториал числа рекурсивно',
  'Implement a debounce function in JavaScript',
  'Обход дерева DOM в глубину и подсчёт всех вложенных элементов',
  'Center a div horizontally and vertically with CSS Grid',
  'Реализуйте паттерн Observer для системы уведомлений',
  'Fibonacci numbers with memoization',
  'Сверстайте адаптивную карточку товара на Flexbox',
];

const extractor = await pipeline(
  'feature-extraction',
  'Xenova/multilingual-e5-small',
  { dtype: 'q8' },
);
const embed = async (text) =>
  Array.from(
    (await extractor(text, { pooling: 'mean', normalize: true })).data,
  );

// Векторы нормализованы (длина 1), поэтому косинус = скалярное произведение.
const cosine = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);

const q = await embed(`query: ${query}`);
console.log(`Запрос: «${query}»`);
console.log(
  `Вектор: ${q.length} чисел, начало [${q
    .slice(0, 4)
    .map((x) => x.toFixed(3))
    .join(', ')}, …]\n`,
);

const ranked = [];
for (const text of passages) {
  ranked.push({ text, score: cosine(q, await embed(`passage: ${text}`)) });
}
ranked.sort((a, b) => b.score - a.score);

for (const { text, score } of ranked) {
  const bar = '█'.repeat(Math.max(0, Math.round((score - 0.7) * 100)));
  console.log(`${score.toFixed(3)}  ${bar.padEnd(25)} ${text}`);
}
