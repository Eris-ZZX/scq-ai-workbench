import { Client, type BucketItemStat } from 'minio';
import type { Readable } from 'node:stream';

const OBJECT_PREFIX = 'ai-resources/uploads/';

let client: Client | undefined;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required at runtime`);
  return value;
}

function parseBoolean(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be "true" or "false"`);
}

function port() {
  const value = Number(process.env.MINIO_PORT ?? (parseBoolean('MINIO_USE_SSL', false) ? 443 : 9000));
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error('MINIO_PORT must be a valid TCP port');
  }
  return value;
}

function storageClient() {
  if (!client) {
    client = new Client({
      endPoint: required('MINIO_ENDPOINT'),
      port: port(),
      useSSL: parseBoolean('MINIO_USE_SSL', false),
      accessKey: required('MINIO_ACCESS_KEY'),
      secretKey: required('MINIO_SECRET_KEY'),
    });
  }
  return client;
}

export function storageBucket() {
  return required('MINIO_BUCKET');
}

export function aiResourceObjectKey(storedName: string) {
  const safeName = storedName.replaceAll('\\', '/').split('/').pop()?.trim();
  if (!safeName || safeName === '.' || safeName === '..') {
    throw new Error('Invalid stored object name');
  }
  return `${OBJECT_PREFIX}${safeName}`;
}

export async function ensureStorageBucket() {
  const minio = storageClient();
  const bucket = storageBucket();
  if (!(await minio.bucketExists(bucket))) {
    await minio.makeBucket(bucket);
  }
}

export async function putAiResourceObject(
  storedName: string,
  body: Buffer | Readable,
  size: number,
  contentType: string,
) {
  await storageClient().putObject(
    storageBucket(),
    aiResourceObjectKey(storedName),
    body,
    size,
    { 'Content-Type': contentType || 'application/octet-stream' },
  );
}

export function getAiResourceObject(storedName: string) {
  return storageClient().getObject(storageBucket(), aiResourceObjectKey(storedName));
}

export function statAiResourceObject(storedName: string): Promise<BucketItemStat> {
  return storageClient().statObject(storageBucket(), aiResourceObjectKey(storedName));
}

export function removeAiResourceObject(storedName: string) {
  return storageClient().removeObject(storageBucket(), aiResourceObjectKey(storedName));
}

export function isStorageNotFound(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return code === 'NoSuchKey' || code === 'NoSuchObject' || code === 'NotFound';
}
