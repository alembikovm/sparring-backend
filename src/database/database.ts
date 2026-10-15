import { Kysely } from 'kysely';
import type { DB } from './database.types.js';

// Класс вместо строкового токена: можно инжектить по типу без @Inject().
export class Database extends Kysely<DB> {}
