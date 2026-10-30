// Cloudflare Workers compatible Firestore client via REST API.
// firebase-admin/firestore uses eval() which is blocked in Cloudflare Workers.

type FsVal =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { arrayValue: { values?: FsVal[] } }
  | { mapValue: { fields?: Record<string, FsVal> } };

function encode(v: unknown): FsVal {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (typeof v === 'object') {
    const fields: Record<string, FsVal> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val !== undefined) fields[k] = encode(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function decode(v: FsVal): unknown {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decode);
  if ('mapValue' in v) {
    const obj: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v.mapValue.fields ?? {})) obj[k] = decode(val);
    return obj;
  }
  return null;
}

function fieldsToData(fields: Record<string, FsVal>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) data[k] = decode(v);
  return data;
}

function dataToFields(data: Record<string, unknown>): Record<string, FsVal> {
  const fields: Record<string, FsVal> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) fields[k] = encode(v);
  }
  return fields;
}

// ---------- auth ----------
let cachedToken = '';
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const sa = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT!, 'base64').toString('utf-8')
  ) as { client_email: string; private_key: string };

  const now = Math.floor(Date.now() / 1000);
  const b64url = (s: string) =>
    btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore',
  }));

  const sigInput = `${header}.${payload}`;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(sigInput));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = `${sigInput}.${sig}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const json = await resp.json() as { access_token: string; expires_in: number };
  if (!json.access_token) throw new Error(`Token error: ${JSON.stringify(json)}`);
  cachedToken = json.access_token;
  tokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
  return cachedToken;
}

// ---------- HTTP ----------
const PROJECT = 'pec-voice-guide';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

async function req(path: string, init: RequestInit = {}): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (res.status === 404 || res.status === 204) return null;
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Firestore ${res.status}: ${txt}`);
  }
  return res.json();
}

function docId(name: string) { return name.split('/').pop()!; }

// ---------- snapshots ----------
export class DocumentSnapshot {
  constructor(readonly id: string, private _data: Record<string, unknown> | null) {}
  get exists() { return this._data !== null; }
  data() { return this._data ?? undefined; }
  get(field: string) { return this._data?.[field]; }
}

export class QueryDocumentSnapshot {
  ref: DocumentRef;
  constructor(readonly id: string, private _data: Record<string, unknown>, colPath: string) {
    this.ref = new DocumentRef(colPath, id);
  }
  data() { return this._data; }
  get(field: string) { return this._data[field]; }
}

export class QuerySnapshot {
  constructor(readonly docs: QueryDocumentSnapshot[]) {}
  get empty() { return this.docs.length === 0; }
  get size() { return this.docs.length; }
  forEach(fn: (d: QueryDocumentSnapshot) => void) { this.docs.forEach(fn); }
}

// ---------- operator map ----------
const OPS: Record<string, string> = {
  '==': 'EQUAL', '!=': 'NOT_EQUAL',
  '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL',
  '>': 'GREATER_THAN', '>=': 'GREATER_THAN_OR_EQUAL',
  'in': 'IN', 'array-contains': 'ARRAY_CONTAINS',
};

// ---------- query builder ----------
interface Where { f: string; op: string; v: unknown }
interface Order { f: string; dir: 'asc' | 'desc' }

class QueryBuilder {
  constructor(
    private colPath: string,
    private wheres: Where[] = [],
    private orders: Order[] = [],
    private _limit: number | null = null,
    private _select: string[] = [],
  ) {}

  where(f: string, op: string, v: unknown) {
    return new QueryBuilder(this.colPath, [...this.wheres, { f, op, v }], this.orders, this._limit, this._select);
  }
  orderBy(f: string, dir: 'asc' | 'desc' = 'asc') {
    return new QueryBuilder(this.colPath, this.wheres, [...this.orders, { f, dir }], this._limit, this._select);
  }
  limit(n: number) {
    return new QueryBuilder(this.colPath, this.wheres, this.orders, n, this._select);
  }
  select(...fields: string[]) {
    return new QueryBuilder(this.colPath, this.wheres, this.orders, this._limit, fields);
  }

  async get(): Promise<QuerySnapshot> {
    const parts = this.colPath.split('/');
    const colId = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join('/');
    const parentUrl = parentPath ? `/${parentPath}` : '';

    const query: Record<string, unknown> = {
      from: [{ collectionId: colId }],
    };

    if (this.wheres.length === 1) {
      const w = this.wheres[0];
      query.where = { fieldFilter: { field: { fieldPath: w.f }, op: OPS[w.op] ?? 'EQUAL', value: encode(w.v) } };
    } else if (this.wheres.length > 1) {
      query.where = {
        compositeFilter: {
          op: 'AND',
          filters: this.wheres.map(w => ({
            fieldFilter: { field: { fieldPath: w.f }, op: OPS[w.op] ?? 'EQUAL', value: encode(w.v) },
          })),
        },
      };
    }

    if (this.orders.length > 0) {
      query.orderBy = this.orders.map(o => ({
        field: { fieldPath: o.f },
        direction: o.dir === 'desc' ? 'DESCENDING' : 'ASCENDING',
      }));
    }
    if (this._limit !== null) query.limit = this._limit;
    if (this._select.length > 0) {
      query.select = { fields: this._select.map(f => ({ fieldPath: f })) };
    }

    const result = await req(`${parentUrl}:runQuery`, {
      method: 'POST',
      body: JSON.stringify({ structuredQuery: query }),
    });

    if (!result || !Array.isArray(result)) return new QuerySnapshot([]);
    const docs = (result as Array<{ document?: { name: string; fields?: Record<string, FsVal> } }>)
      .filter(r => r.document)
      .map(r => {
        const id = docId(r.document!.name);
        const data = fieldsToData(r.document!.fields ?? {});
        return new QueryDocumentSnapshot(id, data, this.colPath);
      });
    return new QuerySnapshot(docs);
  }
}

// ---------- document ref ----------
export class DocumentRef {
  constructor(private colPath: string, readonly id: string) {}

  private get docUrl() { return `/${this.colPath}/${this.id}`; }

  async get(): Promise<DocumentSnapshot> {
    const raw = await req(this.docUrl) as { name: string; fields?: Record<string, FsVal> } | null;
    if (!raw) return new DocumentSnapshot(this.id, null);
    return new DocumentSnapshot(this.id, fieldsToData(raw.fields ?? {}));
  }

  async set(data: Record<string, unknown>, opts?: { merge?: boolean }) {
    const fields = dataToFields(data);
    if (opts?.merge) {
      const mask = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
      await req(`${this.docUrl}?${mask}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
    } else {
      await req(this.docUrl, { method: 'PATCH', body: JSON.stringify({ fields }) });
    }
  }

  async update(data: Record<string, unknown>) {
    const fields = dataToFields(data);
    const mask = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    await req(`${this.docUrl}?${mask}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
  }

  async delete() {
    await req(this.docUrl, { method: 'DELETE' });
  }

  collection(name: string): CollectionRef {
    return new CollectionRef(`${this.colPath}/${this.id}/${name}`);
  }
}

// ---------- collection ref ----------
class CollectionRef {
  constructor(private colPath: string) {}

  doc(id?: string): DocumentRef {
    return new DocumentRef(this.colPath, id ?? crypto.randomUUID());
  }

  async add(data: Record<string, unknown>): Promise<DocumentRef> {
    const fields = dataToFields(data);
    const raw = await req(`/${this.colPath}`, {
      method: 'POST',
      body: JSON.stringify({ fields }),
    }) as { name: string };
    return new DocumentRef(this.colPath, docId(raw.name));
  }

  where(f: string, op: string, v: unknown) { return new QueryBuilder(this.colPath).where(f, op, v); }
  orderBy(f: string, dir: 'asc' | 'desc' = 'asc') { return new QueryBuilder(this.colPath).orderBy(f, dir); }
  limit(n: number) { return new QueryBuilder(this.colPath).limit(n); }
  select(...fields: string[]) { return new QueryBuilder(this.colPath).select(...fields); }

  async get(): Promise<QuerySnapshot> {
    return new QueryBuilder(this.colPath).get();
  }
}

// ---------- batch write ----------
const DOC_BASE_PATH = `projects/${PROJECT}/databases/(default)/documents`;

export async function batchDeletePaths(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  for (let i = 0; i < paths.length; i += 500) {
    const chunk = paths.slice(i, i + 500);
    await req(':batchWrite', {
      method: 'POST',
      body: JSON.stringify({
        writes: chunk.map(p => ({ delete: `${DOC_BASE_PATH}/${p}` })),
      }),
    });
  }
}

export async function batchSetDocuments(docs: Array<{ path: string; data: Record<string, unknown> }>): Promise<void> {
  if (docs.length === 0) return;
  for (let i = 0; i < docs.length; i += 500) {
    const chunk = docs.slice(i, i + 500);
    const result = await req(':batchWrite', {
      method: 'POST',
      body: JSON.stringify({
        writes: chunk.map(({ path, data }) => ({
          update: {
            name: `${DOC_BASE_PATH}/${path}`,
            fields: dataToFields(data),
          },
        })),
      }),
    }) as { status?: Array<{ code?: number; message?: string }> } | null;

    // batchWrite returns HTTP 200 even when individual writes fail;
    // errors are in result.status[].code (0 = OK, anything else = error)
    const statuses = result?.status ?? [];
    const failed = statuses.filter(s => s.code && s.code !== 0);
    if (failed.length > 0) {
      throw new Error(`batchWrite partial failure: ${failed.map(s => s.message).join('; ')}`);
    }
  }
}

// ---------- exports ----------
export const db = {
  collection(id: string): CollectionRef {
    return new CollectionRef(id);
  },
};
