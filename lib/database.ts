import { randomUUID } from 'node:crypto';
import { sql, type SQL } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { modelMetadata } from '@/db/model-metadata.generated';

export type QueryArgs = Record<string, any>;
type Executor = { execute(query: SQL): Promise<any> };
type Metadata = (typeof modelMetadata)[keyof typeof modelMetadata];

export class DatabaseRecordNotFoundError extends Error {
  readonly code = 'QE_NOT_FOUND';
  constructor(model: string) {
    super(`${model} record was not found`);
    this.name = 'DatabaseRecordNotFoundError';
  }
}

export function postgresErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { code?: unknown; cause?: { code?: unknown } };
  const code = candidate.code ?? candidate.cause?.code;
  return typeof code === 'string' ? code : undefined;
}

export function isUniqueViolation(error: unknown) {
  return postgresErrorCode(error) === '23505';
}

export function isForeignKeyViolation(error: unknown) {
  return postgresErrorCode(error) === '23503';
}

export function isRecordNotFound(error: unknown) {
  return error instanceof DatabaseRecordNotFoundError;
}

export function databaseErrorStatus(error: unknown): 400 | 404 | 409 | undefined {
  if (isRecordNotFound(error)) return 404;
  const code = postgresErrorCode(error);
  if (code === '23505') return 409;
  if (code === '23503' || code === '23502' || code === '22P02' || code === '22001') {
    return 400;
  }
  return undefined;
}

let aliasSequence = 0;
function aliasFor(prefix: string) {
  aliasSequence += 1;
  return `${prefix}_${aliasSequence}`;
}

function meta(model: string): Metadata {
  const value = (modelMetadata as Record<string, Metadata>)[model];
  if (!value) throw new Error(`Unknown database model: ${model}`);
  return value;
}

function modelFromDelegate(delegate: string) {
  return delegate.charAt(0).toUpperCase() + delegate.slice(1);
}

function identifier(alias: string, column: string) {
  return sql`${sql.identifier(alias)}.${sql.identifier(column)}`;
}

function combine(parts: SQL[], separator: SQL = sql` AND `): SQL {
  if (parts.length === 0) return sql`TRUE`;
  return sql.join(parts.map((part) => sql`(${part})`), separator);
}

function valueList(values: any[]): SQL {
  return sql`(${sql.join(values.map((value) => sql`${value}`), sql`, `)})`;
}

function scalarCondition(column: SQL, value: any): SQL {
  if (value === null) return sql`${column} IS NULL`;
  if (Array.isArray(value)) return value.length ? sql`${column} IN ${valueList(value)}` : sql`FALSE`;
  if (typeof value !== 'object' || value instanceof Date) return sql`${column} = ${value}`;

  const conditions: SQL[] = [];
  for (const [operator, operand] of Object.entries(value)) {
    if (operator === 'mode') continue;
    if (operator === 'equals') conditions.push(scalarCondition(column, operand));
    else if (operator === 'in') {
      const list = operand as any[];
      conditions.push(list.length ? sql`${column} IN ${valueList(list)}` : sql`FALSE`);
    } else if (operator === 'notIn') {
      const list = operand as any[];
      conditions.push(list.length ? sql`${column} NOT IN ${valueList(list)}` : sql`TRUE`);
    } else if (operator === 'lt') conditions.push(sql`${column} < ${operand}`);
    else if (operator === 'lte') conditions.push(sql`${column} <= ${operand}`);
    else if (operator === 'gt') conditions.push(sql`${column} > ${operand}`);
    else if (operator === 'gte') conditions.push(sql`${column} >= ${operand}`);
    else if (operator === 'contains') conditions.push(sql`${column} LIKE ${`%${operand}%`}`);
    else if (operator === 'startsWith') conditions.push(sql`${column} LIKE ${`${operand}%`}`);
    else if (operator === 'endsWith') conditions.push(sql`${column} LIKE ${`%${operand}`}`);
    else if (operator === 'not') conditions.push(sql`NOT (${scalarCondition(column, operand)})`);
  }
  return combine(conditions);
}

function relationCorrelation(
  parentModel: string,
  parentAlias: string,
  relation: any,
  targetAlias: string,
): SQL {
  const parent = meta(parentModel) as any;
  const target = meta(relation.model) as any;
  const conditions: SQL[] = [];
  if (relation.localFields.length > 0) {
    relation.localFields.forEach((localField: string, index: number) => {
      const referenceField = relation.referenceFields[index];
      conditions.push(
        sql`${identifier(targetAlias, target.fields[referenceField].column)} = ${identifier(parentAlias, parent.fields[localField].column)}`,
      );
    });
  } else {
    relation.remoteFields.forEach((remoteField: string, index: number) => {
      const referenceField = relation.referenceFields[index];
      conditions.push(
        sql`${identifier(targetAlias, target.fields[remoteField].column)} = ${identifier(parentAlias, parent.fields[referenceField].column)}`,
      );
    });
  }
  return combine(conditions);
}

function whereSql(model: string, where: any, alias: string): SQL {
  if (!where || Object.keys(where).length === 0) return sql`TRUE`;
  const modelMeta = meta(model) as any;
  const conditions: SQL[] = [];

  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;
    if (key === 'AND' || key === 'OR' || key === 'NOT') {
      const values = Array.isArray(value) ? value : [value];
      if (key === 'OR' && values.length === 0) {
        conditions.push(sql`FALSE`);
        continue;
      }
      const nested = values.map((item) => whereSql(model, item, alias));
      const joined = combine(nested, key === 'OR' ? sql` OR ` : sql` AND `);
      conditions.push(key === 'NOT' ? sql`NOT (${joined})` : joined);
      continue;
    }

    const field = modelMeta.fields[key];
    if (field) {
      conditions.push(scalarCondition(identifier(alias, field.column), value));
      continue;
    }

    const relation = modelMeta.relations[key];
    if (relation) {
      const targetAlias = aliasFor('rel');
      const target = meta(relation.model) as any;
      const relationValue = value as any;
      const nullRelationCheck = !relation.list && (
        relationValue === null ||
        (relationValue && typeof relationValue === 'object' && relationValue.is === null) ||
        (relationValue && typeof relationValue === 'object' && relationValue.isNot === null)
      );
      if (nullRelationCheck) {
        const correlation = relationCorrelation(model, alias, relation, targetAlias);
        const exists = sql`EXISTS (SELECT 1 FROM ${sql.identifier(target.table)} AS ${sql.identifier(targetAlias)} WHERE ${correlation})`;
        const requireExists = relationValue && typeof relationValue === 'object' && relationValue.isNot === null;
        conditions.push(requireExists ? exists : sql`NOT (${exists})`);
        continue;
      }
      let nestedWhere = relationValue;
      let mode = relation.list ? 'some' : 'is';
      if (relationValue && typeof relationValue === 'object') {
        for (const candidate of ['some', 'none', 'every', 'is', 'isNot']) {
          if (candidate in relationValue) {
            mode = candidate;
            nestedWhere = relationValue[candidate];
            break;
          }
        }
      }
      const correlation = relationCorrelation(model, alias, relation, targetAlias);
      const predicate = combine([
        correlation,
        whereSql(relation.model, nestedWhere ?? {}, targetAlias),
      ]);
      const exists = sql`EXISTS (SELECT 1 FROM ${sql.identifier(target.table)} AS ${sql.identifier(targetAlias)} WHERE ${predicate})`;
      if (mode === 'none' || mode === 'isNot') conditions.push(sql`NOT (${exists})`);
      else if (mode === 'every') {
        const violating = combine([
          correlation,
          sql`NOT (${whereSql(relation.model, nestedWhere ?? {}, targetAlias)})`,
        ]);
        conditions.push(
          sql`NOT EXISTS (SELECT 1 FROM ${sql.identifier(target.table)} AS ${sql.identifier(targetAlias)} WHERE ${violating})`,
        );
      } else {
        conditions.push(exists);
      }
      continue;
    }

    // Legacy compound-unique selectors use a synthetic key containing scalar fields.
    if (value && typeof value === 'object') {
      conditions.push(whereSql(model, value, alias));
      continue;
    }
    throw new Error(`Unknown filter ${model}.${key}`);
  }
  return combine(conditions);
}

function relationCountExpression(model: string, alias: string, relationName: string): SQL {
  const relation = (meta(model) as any).relations[relationName];
  if (!relation) throw new Error(`Unknown relation ${model}.${relationName}`);
  const target = meta(relation.model) as any;
  const targetAlias = aliasFor('count');
  return sql`(SELECT count(*)::int FROM ${sql.identifier(target.table)} AS ${sql.identifier(targetAlias)} WHERE ${relationCorrelation(model, alias, relation, targetAlias)})`;
}

function orderSql(model: string, orderBy: any, alias: string): SQL {
  if (!orderBy) return sql.empty();
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  const parts: SQL[] = [];
  for (const order of orders) {
    for (const [key, value] of Object.entries(order)) {
      const direction = (typeof value === 'string' ? value : (value as any)?._count) === 'desc'
        ? sql` DESC`
        : sql` ASC`;
      const field = (meta(model) as any).fields[key];
      if (field) {
        parts.push(sql`${identifier(alias, field.column)}${direction}`);
        continue;
      }
      const relation = (meta(model) as any).relations[key];
      if (!relation) throw new Error(`Unknown order ${model}.${key}`);
      if ((value as any)?._count) {
        parts.push(sql`${relationCountExpression(model, alias, key)}${direction}`);
        continue;
      }
      const [targetField, targetDirection] = Object.entries(value as any)[0] ?? [];
      if (!targetField) continue;
      const target = meta(relation.model) as any;
      const targetAlias = aliasFor('order');
      const correlated = relationCorrelation(model, alias, relation, targetAlias);
      parts.push(sql`(SELECT ${identifier(targetAlias, target.fields[targetField].column)}
        FROM ${sql.identifier(target.table)} AS ${sql.identifier(targetAlias)}
        WHERE ${correlated} LIMIT 1) ${targetDirection === 'desc' ? sql`DESC` : sql`ASC`}`);
    }
  }
  return parts.length ? sql` ORDER BY ${sql.join(parts, sql`, `)}` : sql.empty();
}

function selectedColumns(model: string, alias: string): SQL {
  const parts = Object.entries((meta(model) as any).fields).map(
    ([fieldName, field]: [string, any]) =>
      sql`${identifier(alias, field.column)} AS ${sql.identifier(fieldName)}`,
  );
  return sql.join(parts, sql`, `);
}

function rowsFrom(result: any): any[] {
  if (Array.isArray(result)) return result;
  return result?.rows ?? [];
}

function coerceFieldValue(field: any, value: any) {
  if (value == null) return value;
  if (field.type === 'DateTime') {
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid PostgreSQL timestamp for ${field.column}`);
    }
    return parsed;
  }
  if (field.type === 'Int' && typeof value !== 'number') return Number(value);
  if (field.type === 'Boolean' && typeof value !== 'boolean') {
    if (value === 'true' || value === 't' || value === '1') return true;
    if (value === 'false' || value === 'f' || value === '0') return false;
  }
  return value;
}

function coerceModelRow(model: string, row: any) {
  const output = { ...row };
  for (const [fieldName, field] of Object.entries((meta(model) as any).fields)) {
    if (fieldName in output) output[fieldName] = coerceFieldValue(field, output[fieldName]);
  }
  return output;
}

function relationWhereForRow(relation: any, row: any): any {
  const where: Record<string, any> = {};
  if (relation.localFields.length > 0) {
    relation.referenceFields.forEach((reference: string, index: number) => {
      where[reference] = row[relation.localFields[index]];
    });
  } else {
    relation.remoteFields.forEach((remote: string, index: number) => {
      where[remote] = row[relation.referenceFields[index]];
    });
  }
  return where;
}

async function hydrate(
  executor: Executor,
  model: string,
  row: any,
  args: QueryArgs,
): Promise<any> {
  const relationArgs = args.include ?? args.select ?? {};
  const output: Record<string, any> = {};
  const selecting = Boolean(args.select);

  for (const [fieldName] of Object.entries((meta(model) as any).fields)) {
    if (!selecting || args.select[fieldName]) output[fieldName] = row[fieldName];
  }

  for (const [key, option] of Object.entries(relationArgs)) {
    if (!option) continue;
    if (key === '_count') {
      const countSelection = (option as any).select ?? {};
      const counts: Record<string, number> = {};
      for (const [relationName, enabled] of Object.entries(countSelection)) {
        if (!enabled) continue;
        counts[relationName] = await countRows(
          executor,
          (meta(model) as any).relations[relationName].model,
          relationWhereForRow((meta(model) as any).relations[relationName], row),
        );
      }
      output._count = counts;
      continue;
    }
    const relation = (meta(model) as any).relations[key];
    if (!relation) continue;
    const nested = option === true ? {} : (option as QueryArgs);
    const relationWhere = relationWhereForRow(relation, row);
    const where = nested.where ? { AND: [relationWhere, nested.where] } : relationWhere;
    if (relation.list) {
      output[key] = await findRows(executor, relation.model, { ...nested, where });
    } else {
      output[key] = await findOne(executor, relation.model, { ...nested, where });
    }
  }
  return output;
}

async function findRows(executor: Executor, model: string, args: QueryArgs = {}): Promise<any[]> {
  const modelMeta = meta(model) as any;
  const alias = aliasFor('base');
  const distinct = args.distinct
    ? sql`DISTINCT ON (${sql.join(
        (Array.isArray(args.distinct) ? args.distinct : [args.distinct]).map((field: string) =>
          identifier(alias, modelMeta.fields[field].column),
        ),
        sql`, `,
      )}) `
    : sql.empty();
  const order = orderSql(model, args.orderBy, alias);
  const limit = args.take == null ? sql.empty() : sql` LIMIT ${Math.max(0, Number(args.take))}`;
  const offset = args.skip == null ? sql.empty() : sql` OFFSET ${Math.max(0, Number(args.skip))}`;
  const query = sql`SELECT ${distinct}${selectedColumns(model, alias)}
    FROM ${sql.identifier(modelMeta.table)} AS ${sql.identifier(alias)}
    WHERE ${whereSql(model, args.where, alias)}${order}${limit}${offset}`;
  const rows = rowsFrom(await executor.execute(query)).map((row) => coerceModelRow(model, row));
  return Promise.all(rows.map((row) => hydrate(executor, model, row, args)));
}

async function findOne(executor: Executor, model: string, args: QueryArgs = {}) {
  const rows = await findRows(executor, model, { ...args, take: 1 });
  return rows[0] ?? null;
}

function mutationValue(column: any, value: any): SQL {
  if (!value || typeof value !== 'object' || value instanceof Date || Array.isArray(value)) {
    return sql`${value}`;
  }
  if ('set' in value) return sql`${value.set}`;
  if ('increment' in value) return sql`${column} + ${value.increment}`;
  if ('decrement' in value) return sql`${column} - ${value.decrement}`;
  if ('multiply' in value) return sql`${column} * ${value.multiply}`;
  if ('divide' in value) return sql`${column} / ${value.divide}`;
  return sql`${value}`;
}

function scalarData(model: string, data: Record<string, any>, forUpdate = false) {
  const modelMeta = meta(model) as any;
  const values: Array<{ field: string; column: string; value: any }> = [];
  for (const [field, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (!modelMeta.fields[field]) {
      if (modelMeta.relations[field]) {
        throw new Error(
          `Nested relation writes are not supported by the Drizzle gateway: ${model}.${field}`,
        );
      }
      throw new Error(`Unknown data field ${model}.${field}`);
    }
    values.push({ field, column: modelMeta.fields[field].column, value });
  }
  if (!forUpdate && modelMeta.fields.id && !values.some((entry) => entry.field === 'id')) {
    values.push({ field: 'id', column: modelMeta.fields.id.column, value: randomUUID() });
  }
  if (
    forUpdate &&
    modelMeta.fields.updatedAt &&
    !values.some((entry) => entry.field === 'updatedAt')
  ) {
    values.push({
      field: 'updatedAt',
      column: modelMeta.fields.updatedAt.column,
      value: new Date(),
    });
  }
  return values;
}

async function createRow(executor: Executor, model: string, args: QueryArgs) {
  const modelMeta = meta(model) as any;
  const values = scalarData(model, args.data ?? {});
  const query = values.length
    ? sql`INSERT INTO ${sql.identifier(modelMeta.table)}
        (${sql.join(values.map((entry) => sql.identifier(entry.column)), sql`, `)})
        VALUES (${sql.join(values.map((entry) => sql`${entry.value}`), sql`, `)})
        RETURNING ${selectedColumns(model, modelMeta.table)}`
    : sql`INSERT INTO ${sql.identifier(modelMeta.table)} DEFAULT VALUES
        RETURNING ${selectedColumns(model, modelMeta.table)}`;
  const raw = rowsFrom(await executor.execute(query))[0];
  const row = raw ? coerceModelRow(model, raw) : raw;
  return hydrate(executor, model, row, args);
}

async function createRows(
  executor: Executor,
  model: string,
  args: QueryArgs,
  returning: boolean,
): Promise<any> {
  const data = Array.isArray(args.data) ? args.data : [args.data];
  const created = [];
  for (const item of data) created.push(await createRow(executor, model, { data: item }));
  return returning ? created : { count: created.length };
}

async function updateRows(
  executor: Executor,
  model: string,
  args: QueryArgs,
  many: boolean,
) {
  const modelMeta = meta(model) as any;
  const alias = aliasFor('update');
  const values = scalarData(model, args.data ?? {}, true);
  if (!values.length) {
    if (many) return { count: await countRows(executor, model, args.where) };
    const existing = await findOne(executor, model, args);
    if (!existing) throw new DatabaseRecordNotFoundError(model);
    return existing;
  }
  const sets = values.map((entry) =>
    sql`${sql.identifier(entry.column)} = ${mutationValue(sql.identifier(entry.column), entry.value)}`,
  );
  const query = sql`UPDATE ${sql.identifier(modelMeta.table)} AS ${sql.identifier(alias)}
    SET ${sql.join(sets, sql`, `)}
    WHERE ${whereSql(model, args.where, alias)}
    RETURNING ${selectedColumns(model, alias)}`;
  const rows = rowsFrom(await executor.execute(query)).map((row) => coerceModelRow(model, row));
  if (many) return { count: rows.length };
  if (!rows[0]) throw new DatabaseRecordNotFoundError(model);
  return hydrate(executor, model, rows[0], args);
}

async function deleteRows(
  executor: Executor,
  model: string,
  args: QueryArgs,
  many: boolean,
) {
  const modelMeta = meta(model) as any;
  const alias = aliasFor('delete');
  const query = sql`DELETE FROM ${sql.identifier(modelMeta.table)} AS ${sql.identifier(alias)}
    WHERE ${whereSql(model, args.where, alias)}
    RETURNING ${selectedColumns(model, alias)}`;
  const rows = rowsFrom(await executor.execute(query)).map((row) => coerceModelRow(model, row));
  if (many) return { count: rows.length };
  if (!rows[0]) throw new DatabaseRecordNotFoundError(model);
  return hydrate(executor, model, rows[0], args);
}

async function countRows(executor: Executor, model: string, where?: any) {
  const modelMeta = meta(model) as any;
  const alias = aliasFor('count');
  const result = await executor.execute(
    sql`SELECT count(*)::int AS count
      FROM ${sql.identifier(modelMeta.table)} AS ${sql.identifier(alias)}
      WHERE ${whereSql(model, where, alias)}`,
  );
  return Number(rowsFrom(result)[0]?.count ?? 0);
}

async function aggregateRows(executor: Executor, model: string, args: QueryArgs) {
  const modelMeta = meta(model) as any;
  const alias = aliasFor('aggregate');
  const expressions: SQL[] = [];
  const names: Array<[string, string]> = [];
  for (const operation of ['_avg', '_max', '_min', '_sum'] as const) {
    for (const [field, enabled] of Object.entries(args[operation] ?? {})) {
      if (!enabled) continue;
      const resultName = `${operation}_${field}`;
      const fn = operation.slice(1).toUpperCase();
      expressions.push(
        sql`${sql.raw(fn)}(${identifier(alias, modelMeta.fields[field].column)}) AS ${sql.identifier(resultName)}`,
      );
      names.push([operation, field]);
    }
  }
  if (args._count) expressions.push(sql`count(*)::int AS ${sql.identifier('_count_all')}`);
  const result = rowsFrom(
    await executor.execute(
      sql`SELECT ${sql.join(expressions, sql`, `)}
        FROM ${sql.identifier(modelMeta.table)} AS ${sql.identifier(alias)}
        WHERE ${whereSql(model, args.where, alias)}`,
    ),
  )[0] ?? {};
  const output: Record<string, any> = {};
  for (const [operation, field] of names) {
    output[operation] ??= {};
    output[operation][field] = coerceFieldValue(
      modelMeta.fields[field],
      result[`${operation}_${field}`],
    );
  }
  if (args._count) output._count = { _all: Number(result._count_all ?? 0) };
  return output;
}

async function groupRows(executor: Executor, model: string, args: QueryArgs) {
  const modelMeta = meta(model) as any;
  const alias = aliasFor('group');
  const by: string[] = args.by;
  const columns = by.map((field) => identifier(alias, modelMeta.fields[field].column));
  const result = rowsFrom(
    await executor.execute(
      sql`SELECT ${sql.join(
        by.map((field, index) => sql`${columns[index]} AS ${sql.identifier(field)}`),
        sql`, `,
      )}, count(*)::int AS ${sql.identifier('_count_all')}
      FROM ${sql.identifier(modelMeta.table)} AS ${sql.identifier(alias)}
      WHERE ${whereSql(model, args.where, alias)}
      GROUP BY ${sql.join(columns, sql`, `)}`,
    ),
  );
  return result.map((row) => ({
    ...coerceModelRow(model, row),
    _count: { _all: Number(row._count_all) },
  }));
}

export interface RepositoryDelegate {
  findMany(args?: QueryArgs): Promise<DatabaseRecord[]>;
  findFirst(args?: QueryArgs): Promise<DatabaseRecord | null>;
  findUnique(args: QueryArgs): Promise<DatabaseRecord | null>;
  findUniqueOrThrow(args: QueryArgs): Promise<DatabaseRecord>;
  count(args?: QueryArgs): Promise<number>;
  create(args: QueryArgs): Promise<DatabaseRecord>;
  createMany(args: QueryArgs): Promise<{ count: number }>;
  createManyAndReturn(args: QueryArgs): Promise<DatabaseRecord[]>;
  update(args: QueryArgs): Promise<DatabaseRecord>;
  updateMany(args: QueryArgs): Promise<{ count: number }>;
  delete(args: QueryArgs): Promise<DatabaseRecord>;
  deleteMany(args?: QueryArgs): Promise<{ count: number }>;
  upsert(args: QueryArgs): Promise<DatabaseRecord>;
  aggregate(args: QueryArgs): Promise<DatabaseRecord>;
  groupBy(args: QueryArgs): Promise<DatabaseRecord[]>;
}

type ModelMap = typeof modelMetadata;
type ScalarFieldName = {
  [M in keyof ModelMap]: keyof ModelMap[M]['fields'];
}[keyof ModelMap] & string;
type RelationFieldName = {
  [M in keyof ModelMap]: keyof ModelMap[M]['relations'];
}[keyof ModelMap] & string;

type ScalarShape = { [K in ScalarFieldName]: any };
type RelationShape = { [K in RelationFieldName]: any };

/**
 * Compatibility result shape during the route cut-over. Every scalar/relation
 * name is known from generated model metadata; a query still returns only the
 * fields requested by its select/include.
 */
export type DatabaseRecord = ScalarShape &
  RelationShape & {
    _count: any;
    [key: string]: any;
  };

export interface DatabaseGateway {
  $transaction<T>(
    callback: (transaction: DatabaseClient) => Promise<T>,
    options?: unknown,
  ): Promise<T>;
  $queryRaw<T = any[]>(strings: TemplateStringsArray, ...values: any[]): Promise<T>;
  $queryRawUnsafe<T = any[]>(query: string, ...values: any[]): Promise<T>;
  $disconnect(): Promise<void>;
}

type DelegateMap = {
  [K in keyof typeof modelMetadata as Uncapitalize<K & string>]: RepositoryDelegate;
};

export type DatabaseClient = DatabaseGateway & DelegateMap;

function repository(executor: Executor, model: string): RepositoryDelegate {
  return {
    findMany: (args = {}) => findRows(executor, model, args),
    findFirst: (args = {}) => findOne(executor, model, args),
    findUnique: (args) => findOne(executor, model, args),
    findUniqueOrThrow: async (args) => {
      const value = await findOne(executor, model, args);
      if (!value) throw new DatabaseRecordNotFoundError(model);
      return value;
    },
    count: (args = {}) => countRows(executor, model, args.where),
    create: (args) => createRow(executor, model, args),
    createMany: (args) => createRows(executor, model, args, false),
    createManyAndReturn: (args) => createRows(executor, model, args, true),
    update: (args) => updateRows(executor, model, args, false),
    updateMany: (args) => updateRows(executor, model, args, true),
    delete: (args) => deleteRows(executor, model, args, false),
    deleteMany: (args = {}) => deleteRows(executor, model, args, true),
    upsert: async (args) => {
      const existing = await findOne(executor, model, { where: args.where });
      return existing
        ? updateRows(executor, model, { where: args.where, data: args.update, ...args }, false)
        : createRow(executor, model, { data: args.create, ...args });
    },
    aggregate: (args) => aggregateRows(executor, model, args) as Promise<DatabaseRecord>,
    groupBy: (args) => groupRows(executor, model, args),
  };
}

function gateway(executor: Executor): DatabaseClient {
  const delegates = new Map<string, RepositoryDelegate>();
  const target: DatabaseGateway = {
    async $transaction<T>(callback: (transaction: any) => Promise<T>) {
      const database = getDatabase();
      return database.transaction(async (transaction) => callback(gateway(transaction as any)));
    },
    async $queryRaw<T>(strings: TemplateStringsArray, ...values: any[]) {
      const fragments: SQL[] = [];
      strings.forEach((part, index) => {
        fragments.push(sql.raw(part));
        if (index < values.length) fragments.push(sql`${values[index]}`);
      });
      return rowsFrom(await executor.execute(sql.join(fragments, sql.empty()))) as T;
    },
    async $queryRawUnsafe<T>(query: string, ...values: any[]) {
      if (values.length) {
        throw new Error('Parameterized raw SQL must use the tagged $queryRaw form');
      }
      return rowsFrom(await executor.execute(sql.raw(query))) as T;
    },
    async $disconnect() {
      // Pool lifecycle is owned by the process instrumentation.
    },
  };
  return new Proxy(target as DatabaseClient, {
    get(object, property, receiver) {
      if (typeof property !== 'string' || property.startsWith('$')) {
        return Reflect.get(object, property, receiver);
      }
      let delegate = delegates.get(property);
      if (!delegate) {
        delegate = repository(executor, modelFromDelegate(property));
        delegates.set(property, delegate);
      }
      return delegate;
    },
  });
}

/**
 * Drizzle-backed data gateway. Its model delegates intentionally preserve the
 * old result shapes while routes are moved without a flag-day API rewrite.
 */
export const db = new Proxy({} as DatabaseClient, {
  get(_target, property) {
    return (gateway(getDatabase() as any) as any)[property];
  },
});
