// Kas sync API (plain node:http). Routes: GET /health, POST /register, POST /login, POST /sync.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { promisify } from 'node:util';
import { eq } from 'drizzle-orm';
import { db } from './db.ts';
import { sessions, users } from './schema.ts';
import { HttpError, pull, push } from './sync.ts';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const MAX_BODY = 20 * 1024 * 1024;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString('hex')}:${(await scrypt(pw, salt, 32)).toString('hex')}`;
}
async function checkPassword(pw: string, stored: string) {
  const [, salt, hash] = stored.split(':');
  const got = await scrypt(pw, Buffer.from(salt, 'hex'), 32);
  return timingSafeEqual(got, Buffer.from(hash, 'hex'));
}

async function newSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  await db.insert(sessions).values({ tokenHash: sha256(token), userId });
  return token;
}

async function userFrom(req: IncomingMessage) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  const s = token ? (await db.select().from(sessions).where(eq(sessions.tokenHash, sha256(token))))[0] : undefined;
  if (!s) throw new HttpError(401, 'Sesi tidak valid, silakan masuk lagi');
  return s.userId;
}

function readJson(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Data terlalu besar'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new HttpError(400, 'JSON tidak valid'));
      }
    });
    req.on('error', reject);
  });
}

function credentials(body: any) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Email tidak valid');
  if (password.length < 8) throw new HttpError(400, 'Password minimal 8 karakter');
  return { email, password };
}

async function route(req: IncomingMessage): Promise<[number, unknown]> {
  const path = new URL(req.url ?? '/', 'http://x').pathname;
  if (req.method === 'GET' && path === '/health') return [200, { ok: true }];
  if (req.method !== 'POST') throw new HttpError(404, 'Tidak ditemukan');

  if (path === '/register') {
    const { email, password } = credentials(await readJson(req));
    const [u] = await db.insert(users).values({ email, passwordHash: await hashPassword(password) }).onConflictDoNothing().returning();
    if (!u) throw new HttpError(409, 'Email sudah terdaftar');
    return [201, { token: await newSession(u.id), email }];
  }
  if (path === '/login') {
    const { email, password } = credentials(await readJson(req));
    const [u] = await db.select().from(users).where(eq(users.email, email));
    if (!u || !(await checkPassword(password, u.passwordHash))) throw new HttpError(401, 'Email atau password salah');
    return [200, { token: await newSession(u.id), email }];
  }
  if (path === '/sync') {
    const userId = await userFrom(req);
    const body = await readJson(req);
    const cursor = Number(body?.cursor ?? 0);
    if (!Number.isSafeInteger(cursor) || cursor < 0) throw new HttpError(400, 'cursor tidak valid');
    await push(userId, body?.changes);
    return [200, await pull(userId, cursor)];
  }
  throw new HttpError(404, 'Tidak ditemukan');
}

export async function handler(req: IncomingMessage, res: ServerResponse) {
  let status = 500;
  let body: unknown;
  try {
    [status, body] = await route(req);
  } catch (e: any) {
    // Postgres constraint violations (23xxx) and bad input types (22xxx) are the client's fault
    if (e instanceof HttpError) status = e.status;
    else if (/^2[23]/.test(e?.cause?.code ?? e?.code ?? '')) status = 400;
    else console.error(e);
    body = { error: status === 500 ? 'Server error' : (e.cause?.detail ?? e.message) };
  }
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 8787);
  // 0.0.0.0 so a phone on the same Wi-Fi can reach it
  createServer(handler).listen(port, '0.0.0.0', () => console.log(`Kas server http://0.0.0.0:${port}`));
}
